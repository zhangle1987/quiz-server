import crypto from "node:crypto";

function normalizeContentText(value) {
  return String(value || "")
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[\u200b-\u200f\ufeff]/g, "")
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, "\"")
    .replace(/\s+/g, "")
    .trim();
}

function getOrderedOptionTexts(question) {
  const optionMap = new Map(
    (Array.isArray(question.options) ? question.options : []).map((option) => [
      String(option.key || "").trim().toUpperCase(),
      normalizeContentText(option.text),
    ]),
  );

  return ["A", "B", "C", "D"].map((key) => optionMap.get(key) || "");
}

export function getQuestionFingerprint(question) {
  const stem = normalizeContentText(question?.stem);
  const options = getOrderedOptionTexts(question || {});
  if (!stem || options.some((option) => !option)) {
    return "";
  }

  return crypto
    .createHash("sha256")
    .update(JSON.stringify({ stem, options }))
    .digest("hex")
    .slice(0, 24);
}

export function dedupeQuestionsByContent(questions = [], { prefer = "first" } = {}) {
  const uniqueQuestions = [];
  const seen = new Map();
  const duplicates = [];

  for (const question of questions) {
    const fingerprint = getQuestionFingerprint(question);
    const nextQuestion = {
      ...question,
      fingerprint,
    };

    if (!fingerprint) {
      uniqueQuestions.push(nextQuestion);
      continue;
    }

    const existingIndex = seen.get(fingerprint);
    if (existingIndex === undefined) {
      seen.set(fingerprint, uniqueQuestions.length);
      uniqueQuestions.push(nextQuestion);
      continue;
    }

    duplicates.push({
      fingerprint,
      keptNumber: uniqueQuestions[existingIndex]?.number,
      skippedNumber: nextQuestion.number,
    });

    if (prefer === "last") {
      uniqueQuestions[existingIndex] = nextQuestion;
    }
  }

  return {
    questions: uniqueQuestions,
    duplicateCount: duplicates.length,
    duplicates,
  };
}

export function assignQuestionIdentities(paperId, questions = []) {
  const { questions: uniqueQuestions, duplicateCount, duplicates } =
    dedupeQuestionsByContent(questions);

  return {
    questions: uniqueQuestions.map((question, index) => {
      const fingerprint =
        question.fingerprint ||
        getQuestionFingerprint(question) ||
        crypto.createHash("sha256").update(`${paperId}-${index + 1}`).digest("hex").slice(0, 24);

      return {
        ...question,
        id: `${paperId}-q-${fingerprint}`,
        number: index + 1,
        sourceNumber: Number(question.sourceNumber || question.number) || index + 1,
        fingerprint,
      };
    }),
    duplicateCount,
    duplicates,
  };
}
