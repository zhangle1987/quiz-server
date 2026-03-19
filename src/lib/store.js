import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import {
  adminInitialPassword,
  adminInitialUsername,
  dataDir,
  dataFilePath,
  databasePath,
  publicUploadDir,
  tempUploadDir,
} from "../config.js";
import { hashPassword, verifyPassword } from "./adminAuth.js";

const DEFAULT_CONFIG = {
  defaultQuestionCount: 10,
  questionCountOptions: [10, 20, 30],
  requireFriendForAnswers: true,
};

const DEFAULT_PAPER_QUIZ_CONFIG = {
  durationMinutes: 60,
  questionCount: 20,
  passThreshold: 70,
};

const DEFAULT_BROKER = {
  name: "默认中介人",
  qrImagePath: "",
  miniProgramCodePath: "",
  linkedOpenId: "",
  enabled: true,
  isDefault: true,
};

const FRIEND_STATUS = {
  PENDING: "pending",
  ADDED: "added",
};

let database;

function now() {
  return new Date().toISOString();
}

function ensureDirectories() {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(publicUploadDir, { recursive: true });
  fs.mkdirSync(tempUploadDir, { recursive: true });
}

function parseJson(value, fallback) {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizeFriendStatus(value) {
  return String(value || "").trim().toLowerCase() === FRIEND_STATUS.ADDED
    ? FRIEND_STATUS.ADDED
    : FRIEND_STATUS.PENDING;
}

function normalizeOption(option, index) {
  if (!option) {
    return null;
  }

  const fallbackKey = String.fromCharCode(65 + index);
  return {
    key: String(option.key || fallbackKey).trim().toUpperCase(),
    text: String(option.text || "").trim(),
  };
}

function normalizeQuizConfig(input = {}, availableQuestionCount = 0) {
  const normalizedAvailableQuestionCount = Number.isFinite(Number(availableQuestionCount))
    ? Math.max(0, Number(availableQuestionCount))
    : 0;
  const rawQuestionCount = Number(
    input.questionCount
      ?? input.quizQuestionCount
      ?? DEFAULT_PAPER_QUIZ_CONFIG.questionCount,
  );
  const rawDurationMinutes = Number(
    input.durationMinutes
      ?? input.limitMinutes
      ?? DEFAULT_PAPER_QUIZ_CONFIG.durationMinutes,
  );
  const rawPassThreshold = Number(
    input.passThreshold
      ?? input.passLine
      ?? DEFAULT_PAPER_QUIZ_CONFIG.passThreshold,
  );

  const fallbackQuestionCount = normalizedAvailableQuestionCount || DEFAULT_PAPER_QUIZ_CONFIG.questionCount;
  const durationMinutes = Number.isFinite(rawDurationMinutes) && rawDurationMinutes > 0
    ? Math.round(rawDurationMinutes)
    : DEFAULT_PAPER_QUIZ_CONFIG.durationMinutes;
  const questionCount = Number.isFinite(rawQuestionCount) && rawQuestionCount > 0
    ? Math.round(rawQuestionCount)
    : fallbackQuestionCount;
  const passThreshold = Number.isFinite(rawPassThreshold)
    ? Math.max(0, Math.min(100, Math.round(rawPassThreshold)))
    : DEFAULT_PAPER_QUIZ_CONFIG.passThreshold;

  return {
    durationMinutes,
    questionCount: normalizedAvailableQuestionCount
      ? Math.min(questionCount, normalizedAvailableQuestionCount)
      : questionCount,
    passThreshold,
  };
}

function normalizeQuestion(question, index) {
  const options = Array.isArray(question.options)
    ? question.options
      .map((option, optionIndex) => normalizeOption(option, optionIndex))
      .filter((option) => option && option.text)
    : [];

  return {
    id: String(question.id || `question-${index + 1}`).trim(),
    number: Number(question.number) || index + 1,
    reference: String(question.reference || "").trim(),
    tags: Array.isArray(question.tags)
      ? question.tags.map((tag) => String(tag).trim()).filter(Boolean)
      : [],
    stem: String(question.stem || "").trim(),
    options,
    answer: String(question.answer || "").trim().toUpperCase(),
    explanation: String(question.explanation || "").trim(),
  };
}

function normalizePaper(paper) {
  const normalizedQuestions = Array.isArray(paper.questions)
    ? paper.questions.map((question, index) => normalizeQuestion(question, index))
    : [];
  const quizConfig = normalizeQuizConfig(
    paper.quizConfig || paper.examConfig || paper,
    normalizedQuestions.length,
  );
  const rawSortOrder = Number(
    paper.sortOrder
      ?? paper.sort_order
      ?? paper.displayOrder
      ?? 0,
  );

  return {
    id: String(paper.id || "").trim(),
    title: String(paper.title || "").trim(),
    sourceFile: String(paper.sourceFile || "").trim(),
    importedAt: String(paper.importedAt || now()),
    updatedAt: String(paper.updatedAt || now()),
    sortOrder: Number.isFinite(rawSortOrder) ? Math.round(rawSortOrder) : 0,
    questionCount: normalizedQuestions.length,
    quizConfig,
    questions: normalizedQuestions,
  };
}

function serializePaperRow(row, includeQuestions = false) {
  const paper = {
    id: row.id,
    title: row.title,
    sourceFile: row.source_file,
    importedAt: row.imported_at,
    updatedAt: row.updated_at,
    sortOrder: Number(row.sort_order || 0),
    questionCount: row.question_count,
    quizConfig: normalizeQuizConfig(
      parseJson(row.quiz_config_json, DEFAULT_PAPER_QUIZ_CONFIG),
      row.question_count,
    ),
  };

  if (includeQuestions) {
    paper.questions = parseJson(row.questions_json, []);
  }

  return paper;
}

function serializeBrokerRow(row) {
  return {
    id: row.id,
    name: row.name,
    qrImagePath: row.qr_image_url || "",
    miniProgramCodePath: row.mini_program_code_url || "",
    enabled: Boolean(row.enabled),
    isDefault: Boolean(row.is_default),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function serializeUserRow(row) {
  const nickname = String(row.nickname || "").trim();
  const friendStatus = normalizeFriendStatus(row.friend_status);
  return {
    id: row.id,
    openid: row.openid,
    nickname,
    friendStatus,
    displayName: nickname || row.openid,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
    updatedAt: row.updated_at || row.last_login_at || row.created_at,
    attemptCount: Number(row.attempt_count || 0),
    latestAttemptId: row.latest_attempt_id || "",
    latestAttemptAt: row.latest_attempt_at || "",
    latestPaperTitle: row.latest_paper_title || "",
  };
}

function serializeQuizAttemptRow(row) {
  return {
    id: row.id,
    openid: row.openid,
    nickname: String(row.nickname || "").trim(),
    paperId: row.paper_id,
    paperTitle: row.paper_title,
    brokerId: row.broker_id || "",
    paper: parseJson(row.paper_snapshot_json, null),
    broker: parseJson(row.broker_snapshot_json, null),
    summary: parseJson(row.summary_json, null),
    results: parseJson(row.results_json, []),
    submitMode: row.submit_mode || "manual",
    createdAt: row.created_at,
  };
}

function serializeAdminRow(row) {
  return {
    id: row.id,
    username: row.username,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function getInitialAdminCredentials() {
  const username = String(adminInitialUsername || "").trim();
  const password = String(adminInitialPassword || "");

  if (!username && !password) {
    return null;
  }

  if (!username || !password) {
    throw new Error("请在 .env 中同时设置 ADMIN_INITIAL_USERNAME 和 ADMIN_INITIAL_PASSWORD");
  }

  if (password.trim().length < 8) {
    throw new Error("ADMIN_INITIAL_PASSWORD 长度至少需要 8 个字符");
  }

  if (password.trim() === username) {
    throw new Error("ADMIN_INITIAL_PASSWORD 不能与 ADMIN_INITIAL_USERNAME 相同");
  }

  return {
    username,
    password,
  };
}

function getDb() {
  if (!database) {
    ensureDirectories();
    database = new DatabaseSync(databasePath);
    database.exec(`
      CREATE TABLE IF NOT EXISTS app_config (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS papers (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        source_file TEXT NOT NULL DEFAULT '',
        imported_at TEXT NOT NULL,
        sort_order INTEGER NOT NULL DEFAULT 0,
        question_count INTEGER NOT NULL DEFAULT 0,
        quiz_config_json TEXT NOT NULL DEFAULT '{"durationMinutes":60,"questionCount":20,"passThreshold":70}',
        questions_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        openid TEXT NOT NULL UNIQUE,
        nickname TEXT NOT NULL DEFAULT '',
        friend_status TEXT NOT NULL DEFAULT 'pending',
        created_at TEXT NOT NULL,
        last_login_at TEXT NOT NULL,
        updated_at TEXT NOT NULL DEFAULT ''
      );

      CREATE TABLE IF NOT EXISTS brokers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        qr_image_url TEXT NOT NULL DEFAULT '',
        mini_program_code_url TEXT NOT NULL DEFAULT '',
        linked_openid TEXT NOT NULL DEFAULT '',
        enabled INTEGER NOT NULL DEFAULT 1,
        is_default INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS admins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS quiz_attempts (
        id TEXT PRIMARY KEY,
        openid TEXT NOT NULL,
        nickname TEXT NOT NULL DEFAULT '',
        paper_id TEXT NOT NULL,
        paper_title TEXT NOT NULL DEFAULT '',
        broker_id TEXT NOT NULL DEFAULT '',
        broker_snapshot_json TEXT NOT NULL DEFAULT '{}',
        paper_snapshot_json TEXT NOT NULL DEFAULT '{}',
        summary_json TEXT NOT NULL DEFAULT '{}',
        results_json TEXT NOT NULL DEFAULT '[]',
        submit_mode TEXT NOT NULL DEFAULT 'manual',
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_brokers_linked_openid
      ON brokers (linked_openid);

      CREATE INDEX IF NOT EXISTS idx_quiz_attempts_openid_created_at
      ON quiz_attempts (openid, created_at DESC);
    `);

    seedConfig();
    ensurePaperSchema();
    ensureUserSchema();
    ensureBrokerSchema();
    migrateLegacyData();
    ensureAdminBootstrap();
    ensureDefaultBrokerInvariant();
  }

  return database;
}

function ensurePaperSchema() {
  const db = getDb();
  const columns = db.prepare("PRAGMA table_info(papers)").all();
  const hasQuizConfigColumn = columns.some((column) => column.name === "quiz_config_json");
  const hasSortOrderColumn = columns.some((column) => column.name === "sort_order");
  if (!hasQuizConfigColumn) {
    const defaultValue = JSON.stringify(DEFAULT_PAPER_QUIZ_CONFIG).replace(/'/g, "''");
    db.exec(`
      ALTER TABLE papers
      ADD COLUMN quiz_config_json TEXT NOT NULL DEFAULT '${defaultValue}'
    `);
  }
  if (!hasSortOrderColumn) {
    db.exec(`
      ALTER TABLE papers
      ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0
    `);
  }
}

function ensureUserSchema() {
  const db = getDb();
  const columns = db.prepare("PRAGMA table_info(users)").all();
  const columnNames = new Set(columns.map((column) => column.name));

  if (!columnNames.has("nickname")) {
    db.exec("ALTER TABLE users ADD COLUMN nickname TEXT NOT NULL DEFAULT ''");
  }
  if (!columnNames.has("friend_status")) {
    db.exec(`ALTER TABLE users ADD COLUMN friend_status TEXT NOT NULL DEFAULT '${FRIEND_STATUS.PENDING}'`);
  }
  if (!columnNames.has("updated_at")) {
    db.exec("ALTER TABLE users ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''");
  }

  db.prepare(`
    UPDATE users
    SET updated_at = CASE
      WHEN updated_at IS NULL OR updated_at = '' THEN COALESCE(last_login_at, created_at, '')
      ELSE updated_at
    END
  `).run();
}

function ensureBrokerSchema() {
  const db = getDb();
  const columns = db.prepare("PRAGMA table_info(brokers)").all();
  const columnNames = new Set(columns.map((column) => column.name));

  if (columnNames.has("broker_id")) {
    db.exec(`
      BEGIN;
      CREATE TABLE brokers__new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        qr_image_url TEXT NOT NULL DEFAULT '',
        mini_program_code_url TEXT NOT NULL DEFAULT '',
        linked_openid TEXT NOT NULL DEFAULT '',
        enabled INTEGER NOT NULL DEFAULT 1,
        is_default INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      INSERT INTO brokers__new (
        id,
        name,
        qr_image_url,
        mini_program_code_url,
        linked_openid,
        enabled,
        is_default,
        created_at,
        updated_at
      )
      SELECT
        id,
        name,
        qr_image_url,
        COALESCE(mini_program_code_url, ''),
        COALESCE(linked_openid, ''),
        enabled,
        is_default,
        created_at,
        updated_at
      FROM brokers;

      DROP TABLE brokers;
      ALTER TABLE brokers__new RENAME TO brokers;
      CREATE INDEX IF NOT EXISTS idx_brokers_linked_openid ON brokers (linked_openid);
      COMMIT;
    `);
    return;
  }

  if (!columnNames.has("mini_program_code_url")) {
    db.exec("ALTER TABLE brokers ADD COLUMN mini_program_code_url TEXT NOT NULL DEFAULT ''");
  }
}

function runInTransaction(callback) {
  const db = getDb();
  db.exec("BEGIN");
  try {
    const result = callback(db);
    db.exec("COMMIT");
    return result;
  } catch (error) {
    db.exec("ROLLBACK");
    throw error;
  }
}

function seedConfig() {
  setConfigValue("defaultQuestionCount", DEFAULT_CONFIG.defaultQuestionCount);
  setConfigValue("questionCountOptions", DEFAULT_CONFIG.questionCountOptions);
  setConfigValue("requireFriendForAnswers", DEFAULT_CONFIG.requireFriendForAnswers);
}

function setConfigValue(key, value) {
  const db = getDb();
  const exists = db.prepare("SELECT key FROM app_config WHERE key = ?").get(key);
  if (!exists) {
    db.prepare("INSERT INTO app_config (key, value) VALUES (?, ?)").run(
      key,
      JSON.stringify(value),
    );
  }
}

function writeConfigValue(key, value) {
  const db = getDb();
  db.prepare(`
    INSERT INTO app_config (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, JSON.stringify(value));
}

function migrateLegacyData() {
  const db = getDb();
  const paperCount = db.prepare("SELECT COUNT(*) AS count FROM papers").get().count;
  if (paperCount || !fs.existsSync(dataFilePath)) {
    return;
  }

  const raw = fs.readFileSync(dataFilePath, "utf8");
  const parsed = parseJson(raw, null);
  if (!parsed) {
    return;
  }

  if (parsed.config && typeof parsed.config === "object") {
    if (
      Number.isFinite(Number(parsed.config.defaultQuestionCount)) &&
      Number(parsed.config.defaultQuestionCount) > 0
    ) {
      writeConfigValue("defaultQuestionCount", Number(parsed.config.defaultQuestionCount));
    }

    if (
      Array.isArray(parsed.config.questionCountOptions) &&
      parsed.config.questionCountOptions.length
    ) {
      writeConfigValue(
        "questionCountOptions",
        parsed.config.questionCountOptions
          .map((item) => Number(item))
          .filter((item) => Number.isFinite(item) && item > 0),
      );
    }

    if (typeof parsed.config.requireFriendForAnswers === "boolean") {
      writeConfigValue("requireFriendForAnswers", parsed.config.requireFriendForAnswers);
    }
  }

  if (Array.isArray(parsed.papers)) {
    replacePapers(parsed.papers);
  }
}

function ensureAdminBootstrap() {
  const db = getDb();
  const admins = db.prepare(`
    SELECT *
    FROM admins
    ORDER BY created_at ASC, id ASC
  `).all();
  const initialAdmin = getInitialAdminCredentials();

  if (!admins.length) {
    if (!initialAdmin) {
      throw new Error("首次启动前，请在 .env 中设置 ADMIN_INITIAL_USERNAME 和 ADMIN_INITIAL_PASSWORD");
    }

    const timestamp = now();
    db.prepare(`
      INSERT INTO admins (username, password_hash, created_at, updated_at)
      VALUES (?, ?, ?, ?)
    `).run(
      initialAdmin.username,
      hashPassword(initialAdmin.password),
      timestamp,
      timestamp,
    );
    return;
  }

  const legacyDefaultAdmin = admins.find((admin) => (
    admin.username === "admin" && verifyPassword("admin", admin.password_hash)
  ));

  if (!legacyDefaultAdmin) {
    return;
  }

  if (!initialAdmin) {
    throw new Error(
      "检测到旧的默认管理员 admin/admin，请在 .env 中设置 ADMIN_INITIAL_USERNAME 和 ADMIN_INITIAL_PASSWORD 后重启服务完成迁移",
    );
  }

  const usernameConflict = admins.find((admin) => (
    admin.id !== legacyDefaultAdmin.id && admin.username === initialAdmin.username
  ));
  if (usernameConflict) {
    throw new Error("ADMIN_INITIAL_USERNAME 已被现有管理员占用，请换一个账号名");
  }

  const timestamp = now();
  db.prepare(`
    UPDATE admins
    SET username = ?,
        password_hash = ?,
        updated_at = ?
    WHERE id = ?
  `).run(
    initialAdmin.username,
    hashPassword(initialAdmin.password),
    timestamp,
    legacyDefaultAdmin.id,
  );
}

function ensureDefaultBrokerInvariant() {
  const db = getDb();
  const brokers = db.prepare(`
    SELECT id, enabled, is_default, updated_at
    FROM brokers
    ORDER BY is_default DESC, enabled DESC, updated_at DESC, id DESC
  `).all();

  if (!brokers.length) {
    const createdAt = now();
    db.prepare(`
      INSERT INTO brokers (
        name,
        qr_image_url,
        mini_program_code_url,
        linked_openid,
        enabled,
        is_default,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      DEFAULT_BROKER.name,
      DEFAULT_BROKER.qrImagePath,
      DEFAULT_BROKER.miniProgramCodePath,
      DEFAULT_BROKER.linkedOpenId,
      DEFAULT_BROKER.enabled ? 1 : 0,
      1,
      createdAt,
      createdAt,
    );
    return;
  }

  const preferredDefault = brokers.find((broker) => broker.is_default && broker.enabled)
    || brokers.find((broker) => broker.enabled)
    || brokers[0];

  db.prepare("UPDATE brokers SET is_default = 0").run();
  db.prepare("UPDATE brokers SET is_default = 1 WHERE id = ?").run(preferredDefault.id);
}

export function initStore() {
  getDb();
}

export function getConfig() {
  const db = getDb();
  const defaultQuestionCount = parseJson(
    db.prepare("SELECT value FROM app_config WHERE key = ?").get("defaultQuestionCount")?.value,
    DEFAULT_CONFIG.defaultQuestionCount,
  );
  const questionCountOptions = parseJson(
    db.prepare("SELECT value FROM app_config WHERE key = ?").get("questionCountOptions")?.value,
    DEFAULT_CONFIG.questionCountOptions,
  );
  const requireFriendForAnswers = parseJson(
    db.prepare("SELECT value FROM app_config WHERE key = ?").get("requireFriendForAnswers")?.value,
    DEFAULT_CONFIG.requireFriendForAnswers,
  );

  return {
    defaultQuestionCount:
      Number.isFinite(Number(defaultQuestionCount)) && Number(defaultQuestionCount) > 0
        ? Number(defaultQuestionCount)
        : DEFAULT_CONFIG.defaultQuestionCount,
    questionCountOptions: Array.isArray(questionCountOptions) && questionCountOptions.length
      ? questionCountOptions
        .map((item) => Number(item))
        .filter((item) => Number.isFinite(item) && item > 0)
      : DEFAULT_CONFIG.questionCountOptions,
    requireFriendForAnswers: typeof requireFriendForAnswers === "boolean"
      ? requireFriendForAnswers
      : DEFAULT_CONFIG.requireFriendForAnswers,
  };
}

export function updateConfig(input = {}) {
  const currentConfig = getConfig();
  const nextConfig = { ...currentConfig };

  if (
    Number.isFinite(Number(input.defaultQuestionCount)) &&
    Number(input.defaultQuestionCount) > 0
  ) {
    nextConfig.defaultQuestionCount = Number(input.defaultQuestionCount);
  }

  if (Array.isArray(input.questionCountOptions) && input.questionCountOptions.length) {
    const nextOptions = input.questionCountOptions
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item) && item > 0);
    if (nextOptions.length) {
      nextConfig.questionCountOptions = nextOptions;
    }
  }

  if (typeof input.requireFriendForAnswers === "boolean") {
    nextConfig.requireFriendForAnswers = input.requireFriendForAnswers;
  }

  writeConfigValue("defaultQuestionCount", nextConfig.defaultQuestionCount);
  writeConfigValue("questionCountOptions", nextConfig.questionCountOptions);
  writeConfigValue("requireFriendForAnswers", nextConfig.requireFriendForAnswers);
  return nextConfig;
}

export function listPapers() {
  const db = getDb();
  return db.prepare(`
    SELECT *
    FROM papers
    ORDER BY sort_order DESC, updated_at DESC, imported_at DESC, id ASC
  `).all().map((row) => serializePaperRow(row));
}

export function getPaper(paperId) {
  if (!paperId) {
    return null;
  }

  const db = getDb();
  const row = db.prepare("SELECT * FROM papers WHERE id = ?").get(String(paperId));
  return row ? serializePaperRow(row, true) : null;
}

export function upsertPaper(paperInput) {
  const db = getDb();
  const normalizedPaper = normalizePaper(paperInput);
  if (!normalizedPaper.id || !normalizedPaper.title || !normalizedPaper.questions.length) {
    throw new Error("题库内容不完整，无法保存");
  }

  const existing = getPaper(normalizedPaper.id);
  const importedAt = existing?.importedAt || normalizedPaper.importedAt || now();
  const updatedAt = now();

  db.prepare(`
    INSERT INTO papers (
      id,
      title,
      source_file,
      imported_at,
      sort_order,
      question_count,
      quiz_config_json,
      questions_json,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      source_file = excluded.source_file,
      imported_at = excluded.imported_at,
      sort_order = excluded.sort_order,
      question_count = excluded.question_count,
      quiz_config_json = excluded.quiz_config_json,
      questions_json = excluded.questions_json,
      updated_at = excluded.updated_at
  `).run(
    normalizedPaper.id,
    normalizedPaper.title,
    normalizedPaper.sourceFile,
    importedAt,
    normalizedPaper.sortOrder,
    normalizedPaper.questions.length,
    JSON.stringify(normalizedPaper.quizConfig),
    JSON.stringify(normalizedPaper.questions),
    updatedAt,
  );

  return getPaper(normalizedPaper.id);
}

export function createOrReplacePaper(paperInput, options = {}) {
  const normalizedPaper = normalizePaper(paperInput);
  if (options.replacePaperId) {
    normalizedPaper.id = String(options.replacePaperId).trim();
    normalizedPaper.questions = normalizedPaper.questions.map((question, index) => ({
      ...question,
      id: `${normalizedPaper.id}-q${question.number || index + 1}`,
    }));
    normalizedPaper.questionCount = normalizedPaper.questions.length;
  }
  return upsertPaper(normalizedPaper);
}

export function replacePapers(papers = []) {
  return runInTransaction((db) => {
    db.prepare("DELETE FROM papers").run();
    for (const paper of papers) {
      const normalizedPaper = normalizePaper(paper);
      if (!normalizedPaper.id || !normalizedPaper.title || !normalizedPaper.questions.length) {
        continue;
      }

      db.prepare(`
        INSERT INTO papers (
          id,
          title,
          source_file,
          imported_at,
          sort_order,
          question_count,
          quiz_config_json,
          questions_json,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        normalizedPaper.id,
        normalizedPaper.title,
        normalizedPaper.sourceFile,
        normalizedPaper.importedAt,
        normalizedPaper.sortOrder,
        normalizedPaper.questions.length,
        JSON.stringify(normalizedPaper.quizConfig),
        JSON.stringify(normalizedPaper.questions),
        normalizedPaper.updatedAt,
      );
    }

    return listPapers();
  });
}

export function updatePaper(paperId, updates = {}) {
  const existing = getPaper(paperId);
  if (!existing) {
    return null;
  }

  const nextPaper = {
    ...existing,
    ...updates,
    id: existing.id,
    sourceFile: updates.sourceFile ?? existing.sourceFile,
    questions: Array.isArray(updates.questions) ? updates.questions : existing.questions,
  };

  return upsertPaper(nextPaper);
}

export function deletePaper(paperId) {
  const db = getDb();
  const result = db.prepare("DELETE FROM papers WHERE id = ?").run(String(paperId));
  return result.changes > 0;
}

export function listBrokers() {
  const db = getDb();
  return db.prepare(`
    SELECT *
    FROM brokers
    ORDER BY is_default DESC, enabled DESC, updated_at DESC, id DESC
  `).all().map((row) => serializeBrokerRow(row));
}

export function listUsers() {
  const db = getDb();
  return db.prepare(`
    SELECT
      users.*,
      (SELECT COUNT(*) FROM quiz_attempts WHERE quiz_attempts.openid = users.openid) AS attempt_count,
      (SELECT id FROM quiz_attempts WHERE quiz_attempts.openid = users.openid ORDER BY created_at DESC LIMIT 1) AS latest_attempt_id,
      (SELECT created_at FROM quiz_attempts WHERE quiz_attempts.openid = users.openid ORDER BY created_at DESC LIMIT 1) AS latest_attempt_at,
      (SELECT paper_title FROM quiz_attempts WHERE quiz_attempts.openid = users.openid ORDER BY created_at DESC LIMIT 1) AS latest_paper_title
    FROM users
    ORDER BY last_login_at DESC, created_at DESC, id DESC
  `).all().map((row) => serializeUserRow(row));
}

export function countUsers() {
  const db = getDb();
  const row = db.prepare("SELECT COUNT(*) AS count FROM users").get();
  return Number(row?.count || 0);
}

export function listUsersPage(options = {}) {
  const db = getDb();
  const rawPage = Number(options.page);
  const rawPageSize = Number(options.pageSize);
  const page = Number.isFinite(rawPage) && rawPage > 0 ? Math.round(rawPage) : 1;
  const pageSize = Number.isFinite(rawPageSize) && rawPageSize > 0
    ? Math.min(100, Math.round(rawPageSize))
    : 12;
  const total = countUsers();
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const offset = (safePage - 1) * pageSize;
  const items = db.prepare(`
    SELECT
      users.*,
      (SELECT COUNT(*) FROM quiz_attempts WHERE quiz_attempts.openid = users.openid) AS attempt_count,
      (SELECT id FROM quiz_attempts WHERE quiz_attempts.openid = users.openid ORDER BY created_at DESC LIMIT 1) AS latest_attempt_id,
      (SELECT created_at FROM quiz_attempts WHERE quiz_attempts.openid = users.openid ORDER BY created_at DESC LIMIT 1) AS latest_attempt_at,
      (SELECT paper_title FROM quiz_attempts WHERE quiz_attempts.openid = users.openid ORDER BY created_at DESC LIMIT 1) AS latest_paper_title
    FROM users
    ORDER BY last_login_at DESC, created_at DESC, id DESC
    LIMIT ? OFFSET ?
  `).all(pageSize, offset).map((row) => serializeUserRow(row));

  return {
    items,
    page: safePage,
    pageSize,
    total,
    totalPages,
  };
}

export function getUserById(id) {
  if (!id) {
    return null;
  }

  const db = getDb();
  const row = db.prepare(`
    SELECT
      users.*,
      (SELECT COUNT(*) FROM quiz_attempts WHERE quiz_attempts.openid = users.openid) AS attempt_count,
      (SELECT id FROM quiz_attempts WHERE quiz_attempts.openid = users.openid ORDER BY created_at DESC LIMIT 1) AS latest_attempt_id,
      (SELECT created_at FROM quiz_attempts WHERE quiz_attempts.openid = users.openid ORDER BY created_at DESC LIMIT 1) AS latest_attempt_at,
      (SELECT paper_title FROM quiz_attempts WHERE quiz_attempts.openid = users.openid ORDER BY created_at DESC LIMIT 1) AS latest_paper_title
    FROM users
    WHERE id = ?
  `).get(Number(id));
  return row ? serializeUserRow(row) : null;
}

export function getUserByOpenId(openid) {
  if (!openid) {
    return null;
  }

  const db = getDb();
  const row = db.prepare(`
    SELECT
      users.*,
      (SELECT COUNT(*) FROM quiz_attempts WHERE quiz_attempts.openid = users.openid) AS attempt_count,
      (SELECT id FROM quiz_attempts WHERE quiz_attempts.openid = users.openid ORDER BY created_at DESC LIMIT 1) AS latest_attempt_id,
      (SELECT created_at FROM quiz_attempts WHERE quiz_attempts.openid = users.openid ORDER BY created_at DESC LIMIT 1) AS latest_attempt_at,
      (SELECT paper_title FROM quiz_attempts WHERE quiz_attempts.openid = users.openid ORDER BY created_at DESC LIMIT 1) AS latest_paper_title
    FROM users
    WHERE openid = ?
  `).get(String(openid).trim());
  return row ? serializeUserRow(row) : null;
}

export function getBrokerById(id) {
  if (!id) {
    return null;
  }

  const db = getDb();
  const row = db.prepare("SELECT * FROM brokers WHERE id = ?").get(Number(id));
  return row ? serializeBrokerRow(row) : null;
}

export function getBrokerByBrokerId(brokerId, options = {}) {
  if (!brokerId) {
    return null;
  }

  const { enabledOnly = true } = options;
  const db = getDb();
  const internalId = Number(brokerId);
  if (!Number.isFinite(internalId) || internalId <= 0) {
    return null;
  }
  const row = enabledOnly
    ? db.prepare("SELECT * FROM brokers WHERE id = ? AND enabled = 1").get(internalId)
    : db.prepare("SELECT * FROM brokers WHERE id = ?").get(internalId);

  return row ? serializeBrokerRow(row) : null;
}

export function getBrokerByLinkedOpenId(openid) {
  if (!openid) {
    return null;
  }

  const db = getDb();
  const row = db.prepare(`
    SELECT *
    FROM brokers
    WHERE linked_openid = ? AND enabled = 1
    ORDER BY is_default DESC, updated_at DESC, id DESC
    LIMIT 1
  `).get(String(openid));

  return row ? serializeBrokerRow(row) : null;
}

export function getDefaultBroker() {
  const db = getDb();
  const row = db.prepare(`
    SELECT *
    FROM brokers
    WHERE enabled = 1
    ORDER BY is_default DESC, updated_at DESC, id DESC
    LIMIT 1
  `).get();

  if (row) {
    return serializeBrokerRow(row);
  }

  const fallback = db.prepare(`
    SELECT *
    FROM brokers
    ORDER BY is_default DESC, updated_at DESC, id DESC
    LIMIT 1
  `).get();

  return fallback ? serializeBrokerRow(fallback) : null;
}

export function saveBroker(input = {}) {
  const name = String(input.name || "").trim();
  const qrImagePath = String(input.qrImagePath || "").trim();
  const hasMiniProgramCodePath = Object.prototype.hasOwnProperty.call(input, "miniProgramCodePath");
  const inputMiniProgramCodePath = hasMiniProgramCodePath ? String(input.miniProgramCodePath || "").trim() : null;
  const hasLinkedOpenId = Object.prototype.hasOwnProperty.call(input, "linkedOpenId");
  const inputLinkedOpenId = hasLinkedOpenId ? String(input.linkedOpenId || "").trim() : null;
  const enabled = input.enabled === false || input.enabled === 0 ? 0 : 1;
  const isDefault = Boolean(input.isDefault);

  if (!name) {
    throw new Error("中介人名称不能为空");
  }

  return runInTransaction((db) => {
    if (isDefault) {
      db.prepare("UPDATE brokers SET is_default = 0").run();
    }

    const timestamp = now();
    let internalId = Number(input.id) || 0;
    if (internalId) {
      const existing = db.prepare("SELECT * FROM brokers WHERE id = ?").get(internalId);
      if (!existing) {
        throw new Error("中介人不存在");
      }

      const miniProgramCodePath = inputMiniProgramCodePath === null
        ? String(existing.mini_program_code_url || "").trim()
        : inputMiniProgramCodePath;
      const linkedOpenId = inputLinkedOpenId === null
        ? String(existing.linked_openid || "").trim()
        : inputLinkedOpenId;

      db.prepare(`
        UPDATE brokers
        SET name = ?,
            qr_image_url = ?,
            mini_program_code_url = ?,
            linked_openid = ?,
            enabled = ?,
            is_default = ?,
            updated_at = ?
        WHERE id = ?
      `).run(
        name,
        qrImagePath,
        miniProgramCodePath,
        linkedOpenId,
        enabled,
        isDefault ? 1 : 0,
        timestamp,
        internalId,
      );
    } else {
      const miniProgramCodePath = inputMiniProgramCodePath === null ? "" : inputMiniProgramCodePath;
      const linkedOpenId = inputLinkedOpenId === null ? "" : inputLinkedOpenId;
      const result = db.prepare(`
        INSERT INTO brokers (
          name,
          qr_image_url,
          mini_program_code_url,
          linked_openid,
          enabled,
          is_default,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        name,
        qrImagePath,
        miniProgramCodePath,
        linkedOpenId,
        enabled,
        isDefault ? 1 : 0,
        timestamp,
        timestamp,
      );
      internalId = Number(result.lastInsertRowid);
    }

    ensureDefaultBrokerInvariant();
    return getBrokerById(internalId);
  });
}

export function updateBrokerMiniProgramCodePath(id, miniProgramCodePath = "") {
  const db = getDb();
  const timestamp = now();
  const result = db.prepare(`
    UPDATE brokers
    SET mini_program_code_url = ?,
        updated_at = ?
    WHERE id = ?
  `).run(String(miniProgramCodePath || "").trim(), timestamp, Number(id));

  if (!result.changes) {
    return null;
  }

  return getBrokerById(id);
}

export function deleteBroker(id) {
  return runInTransaction((db) => {
    const total = db.prepare("SELECT COUNT(*) AS count FROM brokers").get().count;
    if (total <= 1) {
      throw new Error("至少保留一个中介人");
    }

    const result = db.prepare("DELETE FROM brokers WHERE id = ?").run(Number(id));
    if (!result.changes) {
      return false;
    }

    ensureDefaultBrokerInvariant();
    return true;
  });
}

export function upsertUserByOpenId(openid, updates = {}) {
  const normalizedOpenId = String(openid || "").trim();
  if (!normalizedOpenId) {
    return null;
  }

  const db = getDb();
  const existing = db.prepare("SELECT * FROM users WHERE openid = ?").get(normalizedOpenId);
  const timestamp = now();
  const requestedNickname = String(updates.nickname || "").trim();
  const hasNicknameUpdate = Boolean(requestedNickname);
  const nextNickname = hasNicknameUpdate ? requestedNickname : String(existing?.nickname || "").trim();
  const nextFriendStatus = Object.prototype.hasOwnProperty.call(updates, "friendStatus")
    ? normalizeFriendStatus(updates.friendStatus)
    : normalizeFriendStatus(existing?.friend_status);

  if (existing) {
    db.prepare(`
      UPDATE users
      SET nickname = ?,
          friend_status = ?,
          last_login_at = ?,
          updated_at = ?
      WHERE openid = ?
    `).run(nextNickname, nextFriendStatus, timestamp, timestamp, normalizedOpenId);
  } else {
    db.prepare(`
      INSERT INTO users (openid, nickname, friend_status, created_at, last_login_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(normalizedOpenId, nextNickname, nextFriendStatus, timestamp, timestamp, timestamp);
  }

  return getUserByOpenId(normalizedOpenId);
}

export function updateUser(id, updates = {}) {
  const db = getDb();
  const existing = db.prepare("SELECT * FROM users WHERE id = ?").get(Number(id));
  if (!existing) {
    throw new Error("用户不存在");
  }

  const requestedNickname = String(updates.nickname || "").trim();
  const nextNickname = Object.prototype.hasOwnProperty.call(updates, "nickname")
    ? requestedNickname
    : String(existing.nickname || "").trim();
  const nextFriendStatus = Object.prototype.hasOwnProperty.call(updates, "friendStatus")
    ? normalizeFriendStatus(updates.friendStatus)
    : normalizeFriendStatus(existing.friend_status);
  const timestamp = now();

  db.prepare(`
    UPDATE users
    SET nickname = ?,
        friend_status = ?,
        updated_at = ?
    WHERE id = ?
  `).run(nextNickname, nextFriendStatus, timestamp, Number(id));

  return getUserById(id);
}

export function deleteUser(id) {
  return runInTransaction((db) => {
    const existing = db.prepare("SELECT * FROM users WHERE id = ?").get(Number(id));
    if (!existing) {
      return false;
    }

    db.prepare("DELETE FROM quiz_attempts WHERE openid = ?").run(String(existing.openid || "").trim());
    const result = db.prepare("DELETE FROM users WHERE id = ?").run(Number(id));
    return Boolean(result.changes);
  });
}

export function createQuizAttempt(input = {}) {
  const normalizedOpenId = String(input.openid || "").trim();
  if (!normalizedOpenId) {
    throw new Error("缺少用户 OpenID");
  }

  const paper = input.paper && typeof input.paper === "object" ? input.paper : null;
  const summary = input.summary && typeof input.summary === "object" ? input.summary : {};
  const results = Array.isArray(input.results) ? input.results : [];
  const broker = input.broker && typeof input.broker === "object" ? input.broker : null;
  const nickname = String(input.nickname || "").trim();
  const submitMode = String(input.submitMode || "manual").trim() || "manual";
  const createdAt = now();
  const attemptId = String(input.id || `attempt-${Date.now()}-${crypto.randomUUID().slice(0, 8)}`);

  runInTransaction((db) => {
    upsertUserByOpenId(normalizedOpenId, { nickname });
    db.prepare(`
      INSERT INTO quiz_attempts (
        id,
        openid,
        nickname,
        paper_id,
        paper_title,
        broker_id,
        broker_snapshot_json,
        paper_snapshot_json,
        summary_json,
        results_json,
        submit_mode,
        created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      attemptId,
      normalizedOpenId,
      nickname,
      String(paper?.id || "").trim(),
      String(paper?.title || "").trim(),
      String(broker?.id || "").trim(),
      JSON.stringify(broker || null),
      JSON.stringify(paper || null),
      JSON.stringify(summary),
      JSON.stringify(results),
      submitMode,
      createdAt,
    );
  });

  return getQuizAttemptByIdForOpenId(attemptId, normalizedOpenId);
}

export function getQuizAttemptByIdForOpenId(attemptId, openid) {
  if (!attemptId || !openid) {
    return null;
  }

  const db = getDb();
  const row = db.prepare(`
    SELECT *
    FROM quiz_attempts
    WHERE id = ? AND openid = ?
  `).get(String(attemptId).trim(), String(openid).trim());
  return row ? serializeQuizAttemptRow(row) : null;
}

export function getLatestQuizAttemptByOpenId(openid) {
  if (!openid) {
    return null;
  }

  const db = getDb();
  const row = db.prepare(`
    SELECT *
    FROM quiz_attempts
    WHERE openid = ?
    ORDER BY created_at DESC, id DESC
    LIMIT 1
  `).get(String(openid).trim());
  return row ? serializeQuizAttemptRow(row) : null;
}

export function listQuizAttemptsByOpenId(openid, limit = 20) {
  if (!openid) {
    return [];
  }

  const db = getDb();
  const normalizedLimit = Number.isFinite(Number(limit)) && Number(limit) > 0
    ? Math.min(100, Math.round(Number(limit)))
    : 20;
  return db.prepare(`
    SELECT *
    FROM quiz_attempts
    WHERE openid = ?
    ORDER BY created_at DESC, id DESC
    LIMIT ?
  `).all(String(openid).trim(), normalizedLimit).map((row) => serializeQuizAttemptRow(row));
}

export function getAdminById(id) {
  if (!id) {
    return null;
  }

  const db = getDb();
  const row = db.prepare("SELECT * FROM admins WHERE id = ?").get(Number(id));
  return row ? serializeAdminRow(row) : null;
}

export function getAdminByUsername(username) {
  if (!username) {
    return null;
  }

  const db = getDb();
  const row = db.prepare("SELECT * FROM admins WHERE username = ?").get(String(username).trim());
  return row ? { ...serializeAdminRow(row), passwordHash: row.password_hash } : null;
}

export function authenticateAdmin(username, password) {
  const admin = getAdminByUsername(username);
  if (!admin || !verifyPassword(password, admin.passwordHash)) {
    return null;
  }

  return {
    id: admin.id,
    username: admin.username,
    createdAt: admin.createdAt,
    updatedAt: admin.updatedAt,
  };
}

export function updateAdminCredentials(id, input = {}) {
  const db = getDb();
  const existing = db.prepare("SELECT * FROM admins WHERE id = ?").get(Number(id));
  if (!existing) {
    throw new Error("管理员不存在");
  }

  const nextUsername = String(input.username || "").trim() || existing.username;
  const nextPassword = String(input.password || "").trim();
  if (!nextUsername) {
    throw new Error("管理员账号不能为空");
  }

  const passwordHash = nextPassword ? hashPassword(nextPassword) : existing.password_hash;
  const timestamp = now();

  db.prepare(`
    UPDATE admins
    SET username = ?,
        password_hash = ?,
        updated_at = ?
    WHERE id = ?
  `).run(nextUsername, passwordHash, timestamp, Number(id));

  return getAdminById(id);
}
