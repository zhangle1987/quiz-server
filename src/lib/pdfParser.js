import fs from "node:fs/promises";
import path from "node:path";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

function slugify(input) {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

function compactText(value) {
  return value.replace(/\s+/g, " ").trim();
}

function normalizeForId(input) {
  return input
    .replace(/\s+/g, "-")
    .replace(/[^\w\u4e00-\u9fa5-]/g, "")
    .toLowerCase();
}

function joinItemText(items) {
  return items
    .sort((a, b) => a.x - b.x)
    .map((item) => item.text)
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function joinMetaText(items) {
  return items
    .sort((a, b) => a.x - b.x)
    .map((item) => item.text)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

function classifyColumn(x) {
  if (x < 110) {
    return "meta";
  }
  if (x < 390) {
    return "question";
  }
  if (x < 575) {
    return "explanation";
  }
  return "answer";
}

function parseMeta(metaText) {
  const cleaned = metaText.replace(/\s+/g, " ").trim();
  if (!cleaned) {
    return null;
  }

  const normalized = cleaned.replace(/^\.\s*/, "");
  const match = normalized.match(/^(?:\([^)]+\)\s*)*(\d+)\s+(.+)$/);
  if (!match) {
    return null;
  }

  const number = Number(match[1]);
  if (!Number.isFinite(number)) {
    return null;
  }

  const tagPart = normalized.slice(0, match.index).trim();
  const tags = [...tagPart.matchAll(/\(([^)]+)\)/g)].map((tag) => tag[1].trim());

  return {
    number,
    reference: match[2].trim(),
    tags,
  };
}

function parseQuestionContent(lines) {
  const normalizedLines = lines
    .map((line) => compactText(line))
    .filter(Boolean);

  const options = {};
  const stemParts = [];
  let currentOptionKey = null;

  for (const line of normalizedLines) {
    const optionMatch = line.match(/^([a-dA-D])\)\s*(.*)$/);
    if (optionMatch) {
      currentOptionKey = optionMatch[1].toUpperCase();
      options[currentOptionKey] = compactText(optionMatch[2]);
      continue;
    }

    if (currentOptionKey) {
      options[currentOptionKey] = compactText(
        `${options[currentOptionKey]} ${line}`,
      );
    } else {
      stemParts.push(line);
    }
  }

  return {
    stem: compactText(stemParts.join(" ")),
    options: Object.entries(options).map(([key, text]) => ({ key, text })),
  };
}

function finalizeQuestion(currentQuestion, paperId) {
  if (!currentQuestion) {
    return null;
  }

  const questionContent = parseQuestionContent(currentQuestion.questionLines);
  const explanation = compactText(currentQuestion.explanationLines.join(" "));
  const answer = currentQuestion.answer.replace(/[^A-D]/gi, "").toUpperCase();

  if (!questionContent.stem || questionContent.options.length < 4 || !answer) {
    return null;
  }

  return {
    id: `${paperId}-q${currentQuestion.number}`,
    number: currentQuestion.number,
    reference: currentQuestion.reference,
    tags: currentQuestion.tags,
    stem: questionContent.stem,
    options: questionContent.options,
    answer,
    explanation,
  };
}

function hasCompleteOptions(questionLines) {
  return parseQuestionContent(questionLines).options.length >= 4;
}

async function extractRows(filePath) {
  const buffer = await fs.readFile(filePath);
  const data = new Uint8Array(buffer);
  const document = await pdfjsLib.getDocument({ data }).promise;
  const rows = [];

  for (let pageNumber = 2; pageNumber <= document.numPages; pageNumber += 1) {
    const page = await document.getPage(pageNumber);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();

    const items = textContent.items
      .map((item) => {
        const text = compactText(item.str || "");
        if (!text) {
          return null;
        }

        const x = item.transform[4];
        const y = viewport.height - item.transform[5];
        return { text, x, y };
      })
      .filter(Boolean)
      .filter((item) => item.y >= 60 && item.y <= viewport.height - 60)
      .sort((a, b) => {
        if (Math.abs(a.y - b.y) > 2) {
          return a.y - b.y;
        }
        return a.x - b.x;
      });

    const pageRows = [];
    for (const item of items) {
      const existingRow = pageRows.find((row) => Math.abs(row.y - item.y) <= 4);
      const targetRow = existingRow || {
        y: item.y,
        meta: [],
        question: [],
        explanation: [],
        answer: [],
      };

      if (!existingRow) {
        pageRows.push(targetRow);
      }

      targetRow[classifyColumn(item.x)].push(item);
    }

    rows.push(
      ...pageRows
        .sort((a, b) => a.y - b.y)
        .map((row) => ({
          meta: joinMetaText(row.meta),
          question: joinItemText(row.question),
          explanation: joinItemText(row.explanation),
          answer: joinItemText(row.answer),
        }))
        .filter(
          (row) =>
            !(
              row.meta.includes("題號") ||
              row.question === "問題" ||
              row.explanation === "解釋" ||
              row.answer === "答案"
            ),
        ),
    );
  }

  return rows;
}

export async function parsePdfToPaper(filePath, sourceLabel) {
  const rows = await extractRows(filePath);
  const fileName = sourceLabel || path.basename(filePath);
  const paperName = path.basename(fileName, path.extname(fileName));
  const paperId = slugify(normalizeForId(paperName));
  const questions = [];

  let currentQuestion = null;

  for (const row of rows) {
    const meta = parseMeta(row.meta);
    const hasAnswer = /^[A-D]$/i.test(row.answer);
    const isOptionLine = /^[a-dA-D]\)/.test(row.question);
    const isQuestionStem = row.question && !meta && !isOptionLine;

    if (
      currentQuestion &&
      currentQuestion.number &&
      isQuestionStem &&
      hasCompleteOptions(currentQuestion.questionLines)
    ) {
      const finalized = finalizeQuestion(currentQuestion, paperId);
      if (finalized) {
        questions.push(finalized);
      }
      currentQuestion = null;
    }

    const hasRowContent = row.question || row.explanation || meta;
    if (!currentQuestion && hasRowContent) {
      currentQuestion = {
        number: null,
        reference: "",
        tags: [],
        answer: "",
        questionLines: [],
        explanationLines: [],
      };
    }

    if (!currentQuestion || !hasRowContent) {
      continue;
    }

    if (row.question) {
      currentQuestion.questionLines.push(row.question);
    }
    if (row.explanation) {
      currentQuestion.explanationLines.push(row.explanation);
    }
    if (meta && hasAnswer) {
      currentQuestion.number = meta.number;
      currentQuestion.reference = meta.reference;
      currentQuestion.tags = meta.tags;
      currentQuestion.answer = row.answer;
    }
  }

  const finalized = finalizeQuestion(currentQuestion, paperId);
  if (finalized) {
    questions.push(finalized);
  }

  if (!questions.length) {
    throw new Error(`未能从 PDF 中解析出题目: ${fileName}`);
  }

  const titleLine = rows.find((row) => row.question.includes("題號"));
  const title = titleLine ? paperName : paperName;

  return {
    id: paperId,
    title,
    sourceFile: fileName,
    importedAt: new Date().toISOString(),
    questionCount: questions.length,
    questions,
  };
}
