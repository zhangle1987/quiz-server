import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import {
  dataDir,
  dataFilePath,
  databasePath,
  uploadDir,
} from "../config.js";
import { hashPassword, verifyPassword } from "./adminAuth.js";

const DEFAULT_CONFIG = {
  defaultQuestionCount: 10,
  questionCountOptions: [10, 20, 30],
};

const DEFAULT_BROKER = {
  brokerId: "default-broker",
  name: "默认经纪人",
  qrImagePath: "",
  linkedOpenId: "",
  enabled: true,
  isDefault: true,
};

const DEFAULT_ADMIN = {
  username: "admin",
  password: "admin",
};

let database;

function now() {
  return new Date().toISOString();
}

function ensureDirectories() {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.mkdirSync(uploadDir, { recursive: true });
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

  return {
    id: String(paper.id || "").trim(),
    title: String(paper.title || "").trim(),
    sourceFile: String(paper.sourceFile || "").trim(),
    importedAt: String(paper.importedAt || now()),
    updatedAt: String(paper.updatedAt || now()),
    questionCount: normalizedQuestions.length,
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
    questionCount: row.question_count,
  };

  if (includeQuestions) {
    paper.questions = parseJson(row.questions_json, []);
  }

  return paper;
}

function serializeBrokerRow(row) {
  return {
    id: row.id,
    brokerId: row.broker_id,
    name: row.name,
    qrImagePath: row.qr_image_url || "",
    linkedOpenId: row.linked_openid || "",
    enabled: Boolean(row.enabled),
    isDefault: Boolean(row.is_default),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function serializeUserRow(row) {
  return {
    id: row.id,
    openid: row.openid,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
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
        question_count INTEGER NOT NULL DEFAULT 0,
        questions_json TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        openid TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL,
        last_login_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS brokers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        broker_id TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        qr_image_url TEXT NOT NULL DEFAULT '',
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

      CREATE INDEX IF NOT EXISTS idx_brokers_linked_openid
      ON brokers (linked_openid);
    `);

    seedConfig();
    migrateLegacyData();
    seedDefaultAdmin();
    ensureDefaultBrokerInvariant();
  }

  return database;
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
  }

  if (Array.isArray(parsed.papers)) {
    replacePapers(parsed.papers);
  }
}

function seedDefaultAdmin() {
  const db = getDb();
  const count = db.prepare("SELECT COUNT(*) AS count FROM admins").get().count;
  if (count) {
    return;
  }

  const timestamp = now();
  db.prepare(`
    INSERT INTO admins (username, password_hash, created_at, updated_at)
    VALUES (?, ?, ?, ?)
  `).run(
    DEFAULT_ADMIN.username,
    hashPassword(DEFAULT_ADMIN.password),
    timestamp,
    timestamp,
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
        broker_id,
        name,
        qr_image_url,
        linked_openid,
        enabled,
        is_default,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      DEFAULT_BROKER.brokerId,
      DEFAULT_BROKER.name,
      DEFAULT_BROKER.qrImagePath,
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

  writeConfigValue("defaultQuestionCount", nextConfig.defaultQuestionCount);
  writeConfigValue("questionCountOptions", nextConfig.questionCountOptions);
  return nextConfig;
}

export function listPapers() {
  const db = getDb();
  return db.prepare(`
    SELECT *
    FROM papers
    ORDER BY updated_at DESC, imported_at DESC, id ASC
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
      question_count,
      questions_json,
      updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      title = excluded.title,
      source_file = excluded.source_file,
      imported_at = excluded.imported_at,
      question_count = excluded.question_count,
      questions_json = excluded.questions_json,
      updated_at = excluded.updated_at
  `).run(
    normalizedPaper.id,
    normalizedPaper.title,
    normalizedPaper.sourceFile,
    importedAt,
    normalizedPaper.questions.length,
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
          question_count,
          questions_json,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        normalizedPaper.id,
        normalizedPaper.title,
        normalizedPaper.sourceFile,
        normalizedPaper.importedAt,
        normalizedPaper.questions.length,
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
  const row = enabledOnly
    ? db.prepare("SELECT * FROM brokers WHERE broker_id = ? AND enabled = 1").get(String(brokerId))
    : db.prepare("SELECT * FROM brokers WHERE broker_id = ?").get(String(brokerId));

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
  const brokerId = String(input.brokerId || "").trim();
  const name = String(input.name || "").trim() || brokerId;
  const qrImagePath = String(input.qrImagePath || "").trim();
  const linkedOpenId = String(input.linkedOpenId || "").trim();
  const enabled = input.enabled === false || input.enabled === 0 ? 0 : 1;
  const isDefault = Boolean(input.isDefault);

  if (!brokerId) {
    throw new Error("经纪人 ID 不能为空");
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
        throw new Error("经纪人不存在");
      }

      db.prepare(`
        UPDATE brokers
        SET broker_id = ?,
            name = ?,
            qr_image_url = ?,
            linked_openid = ?,
            enabled = ?,
            is_default = ?,
            updated_at = ?
        WHERE id = ?
      `).run(
        brokerId,
        name,
        qrImagePath,
        linkedOpenId,
        enabled,
        isDefault ? 1 : 0,
        timestamp,
        internalId,
      );
    } else {
      const result = db.prepare(`
        INSERT INTO brokers (
          broker_id,
          name,
          qr_image_url,
          linked_openid,
          enabled,
          is_default,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        brokerId,
        name,
        qrImagePath,
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

export function deleteBroker(id) {
  return runInTransaction((db) => {
    const total = db.prepare("SELECT COUNT(*) AS count FROM brokers").get().count;
    if (total <= 1) {
      throw new Error("至少保留一个经纪人");
    }

    const result = db.prepare("DELETE FROM brokers WHERE id = ?").run(Number(id));
    if (!result.changes) {
      return false;
    }

    ensureDefaultBrokerInvariant();
    return true;
  });
}

export function upsertUserByOpenId(openid) {
  const normalizedOpenId = String(openid || "").trim();
  if (!normalizedOpenId) {
    return null;
  }

  const db = getDb();
  const existing = db.prepare("SELECT * FROM users WHERE openid = ?").get(normalizedOpenId);
  const timestamp = now();

  if (existing) {
    db.prepare(`
      UPDATE users
      SET last_login_at = ?
      WHERE openid = ?
    `).run(timestamp, normalizedOpenId);
  } else {
    db.prepare(`
      INSERT INTO users (openid, created_at, last_login_at)
      VALUES (?, ?, ?)
    `).run(normalizedOpenId, timestamp, timestamp);
  }

  return serializeUserRow(
    db.prepare("SELECT * FROM users WHERE openid = ?").get(normalizedOpenId),
  );
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
