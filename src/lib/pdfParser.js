import fs from "node:fs/promises";
import path from "node:path";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import { assignQuestionIdentities } from "./questionIdentity.js";

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

const OPTION_LINE_PATTERN = /^([a-dA-D])(?:[\).．。）]|\s+)\s*(.*)$/;
const ANSWER_PATTERN = /^[A-D]$/i;
const HEADER_TEXTS = new Set(["題號", "參考章節", "問題", "解釋", "答案"]);

function classifyColumn(x) {
  if (x < 110) {
    return "meta";
  }
  if (x < 385) {
    return "question";
  }
  if (x < 575) {
    return "explanation";
  }
  return "answer";
}

function normalizeMetaText(metaText) {
  return compactText(metaText || "")
    .replace(/[©]/g, "")
    .replace(/^\.\s*/, "")
    .replace(/^\((熱門|最新)(?=\s+\d)/, "($1)")
    .replace(/^(熱門|最新)\s+(?=\d)/, "($1) ");
}

function parseMeta(metaText) {
  const cleaned = normalizeMetaText(metaText);
  if (!cleaned) {
    return null;
  }

  const match = cleaned.match(/^((?:\([^)]+\)\s*)*)(\d+)(?:\s+(.+))?$/);
  if (!match) {
    return null;
  }

  const number = Number(match[2]);
  if (!Number.isFinite(number)) {
    return null;
  }

  const tagPart = match[1].trim();
  const tags = [...tagPart.matchAll(/\(([^)]+)\)/g)].map((tag) => tag[1].trim());

  return {
    number,
    reference: compactText(match[3] || ""),
    tags,
  };
}

function parseReferenceFragment(metaText, { allowContinuation = false } = {}) {
  const normalized = normalizeMetaText(metaText);
  if (!normalized) {
    return {
      reference: "",
      tags: [],
    };
  }

  const tags = [];
  let referenceText = normalized;
  while (true) {
    const tagMatch = referenceText.match(/^\(([^)]+)\)\s*/);
    if (!tagMatch || !/[\u3400-\u9fa5]/.test(tagMatch[1])) {
      break;
    }
    tags.push(tagMatch[1].trim());
    referenceText = referenceText.slice(tagMatch[0].length).trim();
  }

  const reference = referenceText.replace(/\s+/g, "");
  const isContinuation =
    /^[)&]/.test(reference) || /^[A-Za-z]+\)$/.test(reference);
  if (allowContinuation && isContinuation) {
    return {
      reference,
      tags,
    };
  }

  if (
    !reference ||
    !/[0-9]/.test(reference) ||
    /^\d+$/.test(reference) ||
    !/^[0-9A-Za-z().&/\-\u4e00-\u9fa5]+$/.test(reference)
  ) {
    return {
      reference: "",
      tags: [],
    };
  }

  return {
    reference,
    tags,
  };
}

function appendReferenceFragment(reference, fragment) {
  if (!reference) {
    return fragment;
  }
  return `${reference}${fragment}`.replace(/\s+/g, "");
}

function parseQuestionContent(lines) {
  const normalizedLines = lines
    .map((line) => compactText(line))
    .filter(Boolean);

  const options = {};
  const stemParts = [];
  let currentOptionKey = null;

  for (const line of normalizedLines) {
    const optionMatch = line.match(OPTION_LINE_PATTERN);
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

function median(values) {
  if (!values.length) {
    return null;
  }

  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2) {
    return sorted[middle];
  }
  return (sorted[middle - 1] + sorted[middle]) / 2;
}

function isHeaderRow(items) {
  return items.some((item) => HEADER_TEXTS.has(item.text));
}

function buildLayout(samples) {
  const questionHeaderX = median(samples.questionHeaders);
  const explanationHeaderX = median(samples.explanationHeaders);
  const answerHeaderX = median(samples.answerHeaders);
  const questionStartX = median(samples.optionStarts);
  const answerX = median(samples.answerStarts);

  return {
    metaBoundary:
      Number.isFinite(questionStartX) ? Math.max(60, questionStartX - 10) : 100,
    explanationBoundary:
      Number.isFinite(questionHeaderX) && Number.isFinite(explanationHeaderX)
        ? (questionHeaderX + explanationHeaderX) / 2
        : 360,
    answerBoundary:
      Number.isFinite(answerX)
        ? answerX - 18
        : Number.isFinite(answerHeaderX)
        ? answerHeaderX - 12
        : 560,
  };
}

function normalizeAnchoredRow(row, layout) {
  const items = row.items.sort((a, b) => a.x - b.x);
  if (isHeaderRow(items)) {
    return null;
  }

  const answerItems = items.filter(
    (item) => item.x >= layout.answerBoundary && ANSWER_PATTERN.test(item.text),
  );
  const answerItem = answerItems.at(-1) || null;
  const answer = answerItem ? answerItem.text : "";
  const contentItems = items.filter((item) => item !== answerItem);
  const explanationItems = contentItems.filter(
    (item) => item.x >= layout.explanationBoundary && item.x < layout.answerBoundary,
  );
  const questionSideItems = contentItems.filter(
    (item) => item.x < layout.explanationBoundary,
  );
  const metaItems = questionSideItems.filter(
    (item) => item.x < layout.metaBoundary,
  );
  const questionItems = questionSideItems.filter(
    (item) => !metaItems.includes(item),
  );

  const normalized = {
    meta: joinMetaText(metaItems),
    question: joinItemText(questionItems),
    explanation: joinItemText(explanationItems),
    answer,
  };

  if (
    !normalized.meta &&
    !normalized.question &&
    !normalized.explanation &&
    !normalized.answer
  ) {
    return null;
  }

  return normalized;
}

async function extractPageRows(filePath) {
  const buffer = await fs.readFile(filePath);
  const data = new Uint8Array(buffer);
  const document = await pdfjsLib.getDocument({ data }).promise;
  const pages = [];
  const samples = {
    questionHeaders: [],
    explanationHeaders: [],
    answerHeaders: [],
    optionStarts: [],
    answerStarts: [],
  };

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

    for (const item of items) {
      if (item.text === "問題") {
        samples.questionHeaders.push(item.x);
      } else if (item.text === "解釋") {
        samples.explanationHeaders.push(item.x);
      } else if (item.text === "答案") {
        samples.answerHeaders.push(item.x);
      } else if (OPTION_LINE_PATTERN.test(item.text)) {
        samples.optionStarts.push(item.x);
      } else if (item.x > 500 && ANSWER_PATTERN.test(item.text)) {
        samples.answerStarts.push(item.x);
      }
    }

    const rows = [];
    for (const item of items) {
      const existingRow = rows.find((row) => Math.abs(row.y - item.y) <= 4);
      const targetRow = existingRow || {
        y: item.y,
        items: [],
      };

      if (!existingRow) {
        rows.push(targetRow);
      }

      targetRow.items.push(item);
    }

    pages.push({
      pageNumber,
      rows: rows.sort((a, b) => a.y - b.y),
    });
  }

  return {
    pages,
    layout: buildLayout(samples),
  };
}

async function extractAnchoredRows(filePath) {
  const { pages, layout } = await extractPageRows(filePath);
  const rows = pages.flatMap((page) =>
    page.rows
      .map((row) => normalizeAnchoredRow(row, layout))
      .filter(Boolean),
  );

  return {
    rows,
    answerRowCount: rows.filter((row) => ANSWER_PATTERN.test(row.answer)).length,
  };
}

async function extractFixedColumnRows(filePath) {
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

function parseRowsToQuestions(rows, paperId) {
  const questions = [];

  let currentQuestion = null;

  for (const row of rows) {
    const meta = parseMeta(row.meta);
    const hasAnswer = /^[A-D]$/i.test(row.answer);
    const isOptionLine = OPTION_LINE_PATTERN.test(row.question);
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
    if (hasAnswer) {
      currentQuestion.answer = row.answer;
    }
    if (meta && (hasAnswer || currentQuestion.answer) && !currentQuestion.number) {
      currentQuestion.number = meta.number;
      currentQuestion.reference = meta.reference;
      currentQuestion.tags = meta.tags;
    } else {
      const fragment = parseReferenceFragment(row.meta, {
        allowContinuation: Boolean(currentQuestion.reference),
      });
      if (fragment.reference) {
        currentQuestion.reference = appendReferenceFragment(
          currentQuestion.reference,
          fragment.reference,
        );
        currentQuestion.tags = [
          ...currentQuestion.tags,
          ...fragment.tags.filter((tag) => !currentQuestion.tags.includes(tag)),
        ];
      }
    }
  }

  const finalized = finalizeQuestion(currentQuestion, paperId);
  if (finalized) {
    questions.push(finalized);
  }

  return questions;
}

function getParseIssues(questions, answerRowCount) {
  const issues = [];

  if (!questions.length) {
    issues.push("未解析出题目");
    return issues;
  }

  if (answerRowCount > 0 && questions.length !== answerRowCount) {
    issues.push(`答案行 ${answerRowCount} 行，实际解析 ${questions.length} 题`);
  }

  for (const question of questions) {
    const optionKeys = new Set(question.options.map((option) => option.key));
    if (!["A", "B", "C", "D"].every((key) => optionKeys.has(key))) {
      issues.push(`第 ${question.number} 题选项不完整`);
      break;
    }
  }

  return issues;
}

function isReliableParse(questions, answerRowCount) {
  return getParseIssues(questions, answerRowCount).length === 0;
}

export async function parsePdfToPaper(filePath, sourceLabel) {
  const fileName = sourceLabel || path.basename(filePath);
  const paperName = path.basename(fileName, path.extname(fileName));
  const paperId = slugify(normalizeForId(paperName));

  const anchored = await extractAnchoredRows(filePath);
  let questions = parseRowsToQuestions(anchored.rows, paperId);
  let issues = getParseIssues(questions, anchored.answerRowCount);

  if (!isReliableParse(questions, anchored.answerRowCount)) {
    const fixedRows = await extractFixedColumnRows(filePath);
    const fixedQuestions = parseRowsToQuestions(fixedRows, paperId);
    const fixedAnswerRows = fixedRows.filter((row) =>
      ANSWER_PATTERN.test(row.answer),
    ).length;
    const fixedIssues = getParseIssues(fixedQuestions, fixedAnswerRows);

    if (!fixedIssues.length || fixedQuestions.length > questions.length) {
      questions = fixedQuestions;
      issues = fixedIssues;
    }
  }

  if (issues.length) {
    throw new Error(`未能从 PDF 中完整解析出题目: ${fileName}（${issues.join("；")}）`);
  }
  const identified = assignQuestionIdentities(paperId, questions);
  questions = identified.questions;

  return {
    id: paperId,
    title: paperName,
    sourceFile: fileName,
    importedAt: new Date().toISOString(),
    questionCount: questions.length,
    rawQuestionCount: questions.length + identified.duplicateCount,
    duplicateQuestionCount: identified.duplicateCount,
    questions,
  };
}
