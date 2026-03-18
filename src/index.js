import fs from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";
import express from "express";
import cors from "cors";
import multer from "multer";
import {
  adminPublicDir,
  databasePath,
  defaultPort,
  demosDir,
  publicUploadDir,
  publicOrigin,
  publicDir,
  tempUploadDir,
  validateRuntimeConfig,
} from "./config.js";
import {
  authenticateAdmin,
  createQuizAttempt,
  createOrReplacePaper,
  deleteBroker,
  deletePaper,
  deleteUser,
  getAdminById,
  getBrokerById,
  getBrokerByBrokerId,
  getConfig,
  getDefaultBroker,
  getPaper,
  getLatestQuizAttemptByOpenId,
  getQuizAttemptByIdForOpenId,
  getUserById,
  getUserByOpenId,
  initStore,
  listBrokers,
  listPapers,
  listQuizAttemptsByOpenId,
  listUsersPage,
  countUsers,
  replacePapers,
  saveBroker,
  updateAdminCredentials,
  updateBrokerMiniProgramCodePath,
  updateConfig,
  updatePaper,
  updateUser,
  upsertPaper,
  upsertUserByOpenId,
} from "./lib/store.js";
import { parsePdfToPaper } from "./lib/pdfParser.js";
import {
  buildBrokerMiniCodeScene,
  exchangeCodeForSession,
  generateUnlimitedWxaCode,
  hasWechatLoginConfig,
} from "./lib/wechat.js";
import {
  ADMIN_SESSION_COOKIE,
  createAdminSessionToken,
  parseAdminSessionToken,
} from "./lib/adminAuth.js";

const app = express();
app.set("trust proxy", true);

app.use(cors());
app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/api", (_req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});
app.use("/uploads", express.static(publicUploadDir));
app.use("/admin/assets", express.static(adminPublicDir));
app.get("/:fileName", asyncHandler(async (req, res, next) => {
  const fileName = path.basename(String(req.params.fileName || "").trim());
  if (!fileName.toLowerCase().endsWith(".txt")) {
    next();
    return;
  }

  const filePath = path.join(publicDir, fileName);
  try {
    await fs.access(filePath);
    res.type("text/plain; charset=utf-8");
    res.sendFile(filePath);
  } catch {
    next();
  }
}));

function asyncHandler(handler) {
  return (req, res, next) => {
    Promise.resolve(handler(req, res, next)).catch(next);
  };
}

function createHttpError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function createUploadStorage(destination, fallbackExtension = "") {
  return multer.diskStorage({
    destination(_req, _file, callback) {
      callback(null, destination);
    },
    filename(_req, file, callback) {
      const extension = path.extname(file.originalname || "").toLowerCase() || fallbackExtension;
      callback(null, `${Date.now()}-${crypto.randomUUID()}${extension}`);
    },
  });
}

function createUploadMiddleware({
  destination,
  fallbackExtension = "",
  allowedMimeTypes,
  allowedExtensions,
  fileSizeLimit,
  fileDescription,
}) {
  return multer({
    storage: createUploadStorage(destination, fallbackExtension),
    limits: {
      fileSize: fileSizeLimit,
    },
    fileFilter(_req, file, callback) {
      const extension = path.extname(String(file.originalname || "")).toLowerCase();
      const mimeType = String(file.mimetype || "").toLowerCase();
      const isAllowedExtension = allowedExtensions.includes(extension);
      const isAllowedMimeType = allowedMimeTypes.includes(mimeType);

      if (!isAllowedExtension || !isAllowedMimeType) {
        callback(createHttpError(`仅支持上传${fileDescription}`));
        return;
      }

      callback(null, true);
    },
  });
}

const pdfUpload = createUploadMiddleware({
  destination: tempUploadDir,
  fallbackExtension: ".pdf",
  allowedMimeTypes: ["application/pdf"],
  allowedExtensions: [".pdf"],
  fileSizeLimit: 20 * 1024 * 1024,
  fileDescription: "PDF 文件",
});

const imageUpload = createUploadMiddleware({
  destination: publicUploadDir,
  allowedMimeTypes: ["image/png", "image/jpeg", "image/webp"],
  allowedExtensions: [".png", ".jpg", ".jpeg", ".webp"],
  fileSizeLimit: 5 * 1024 * 1024,
  fileDescription: "PNG、JPG、JPEG 或 WebP 图片",
});

function sanitizePaper(paper) {
  return {
    id: paper.id,
    title: paper.title,
    sourceFile: paper.sourceFile,
    importedAt: paper.importedAt,
    updatedAt: paper.updatedAt,
    questionCount: paper.questionCount,
    quizConfig: paper.quizConfig,
  };
}

function containsCjk(value = "") {
  return /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/.test(String(value));
}

function decodeUploadedName(originalName = "") {
  const normalized = String(originalName || "").trim();
  if (!normalized || containsCjk(normalized) || /^[\x00-\x7f]+$/.test(normalized)) {
    return normalized;
  }

  try {
    const decoded = Buffer.from(normalized, "latin1").toString("utf8").trim();
    if (decoded && containsCjk(decoded) && !decoded.includes("�")) {
      return decoded;
    }
  } catch {
    return normalized;
  }

  return normalized;
}

function shuffle(items) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const target = Math.floor(Math.random() * (index + 1));
    [next[index], next[target]] = [next[target], next[index]];
  }
  return next;
}

function parseCookies(headerValue = "") {
  return headerValue
    .split(";")
    .map((item) => item.trim())
    .filter(Boolean)
    .reduce((result, item) => {
      const separatorIndex = item.indexOf("=");
      if (separatorIndex === -1) {
        return result;
      }

      const key = item.slice(0, separatorIndex).trim();
      const value = item.slice(separatorIndex + 1).trim();
      result[key] = decodeURIComponent(value);
      return result;
    }, {});
}

function getAdminSession(req) {
  const cookies = parseCookies(req.headers.cookie || "");
  return parseAdminSessionToken(cookies[ADMIN_SESSION_COOKIE]);
}

function shouldUseSecureAdminCookie(req) {
  const forwardedProto = String(req.get("x-forwarded-proto") || "").split(",")[0].trim().toLowerCase();
  return Boolean(req.secure || forwardedProto === "https");
}

function setAdminCookie(req, res, admin) {
  const session = createAdminSessionToken(admin);
  const secureFlag = shouldUseSecureAdminCookie(req) ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(session.token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${session.maxAge}${secureFlag}`,
  );
  return session;
}

function clearAdminCookie(req, res) {
  const secureFlag = shouldUseSecureAdminCookie(req) ? "; Secure" : "";
  res.setHeader(
    "Set-Cookie",
    `${ADMIN_SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0${secureFlag}`,
  );
}

function requireAdmin(req, res, next) {
  const session = getAdminSession(req);
  const admin = session ? getAdminById(session.adminId) : null;
  if (!admin) {
    clearAdminCookie(req, res);
    res.status(401).json({ message: "请先登录管理员账号" });
    return;
  }

  req.admin = admin;
  next();
}

function serveAdminPage(res, fileName) {
  res.sendFile(path.join(adminPublicDir, fileName));
}

function toAbsoluteUrl(req, value) {
  if (!value) {
    return "";
  }

  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  const forwardedProto = String(req.get("x-forwarded-proto") || "").split(",")[0].trim();
  const forwardedHost = String(req.get("x-forwarded-host") || "").split(",")[0].trim();
  const normalizedPublicOrigin = String(publicOrigin || "").trim().replace(/\/+$/, "");
  const origin = normalizedPublicOrigin
    || (forwardedProto && forwardedHost ? `${forwardedProto}://${forwardedHost}` : `${req.protocol}://${req.get("host")}`);
  return new URL(value.replace(/^\.\//, "/"), origin).toString();
}

function sanitizeBroker(req, broker) {
  if (!broker) {
    return null;
  }

  return {
    id: broker.id,
    name: broker.name,
    qrImagePath: broker.qrImagePath || "",
    miniProgramCodePath: broker.miniProgramCodePath || "",
    enabled: Boolean(broker.enabled),
    isDefault: Boolean(broker.isDefault),
    createdAt: broker.createdAt || "",
    updatedAt: broker.updatedAt || "",
    qrImageUrl: broker.qrImagePath ? toAbsoluteUrl(req, broker.qrImagePath) : "",
    miniProgramCodeUrl: broker.miniProgramCodePath ? toAbsoluteUrl(req, broker.miniProgramCodePath) : "",
  };
}

function sanitizeUser(user) {
  return user
    ? {
      ...user,
    }
    : null;
}

function canUserViewAnswers(user) {
  return String(user?.friendStatus || "").trim().toLowerCase() === "added";
}

function sanitizeQuizAttemptForViewer(req, attempt, viewer, options = {}) {
  if (!attempt) {
    return null;
  }

  const { preview = false } = options;
  const canViewAnswers = canUserViewAnswers(viewer);
  const paper = attempt.paper
    ? {
      id: attempt.paper.id,
      title: attempt.paper.title,
      quizConfig: attempt.paper.quizConfig || null,
    }
    : {
      id: attempt.paperId,
      title: attempt.paperTitle,
      quizConfig: null,
    };

  return {
    id: attempt.id,
    createdAt: attempt.createdAt,
    paper,
    broker: sanitizeBroker(req, attempt.broker),
    access: {
      friendStatus: viewer?.friendStatus || "pending",
      canViewAnswers,
      requiresFriend: !canViewAnswers,
    },
    summary: preview || !canViewAnswers ? null : attempt.summary,
    results: preview || !canViewAnswers ? [] : attempt.results,
  };
}

function sanitizeQuizAttemptForAdmin(req, attempt) {
  if (!attempt) {
    return null;
  }

  return {
    id: attempt.id,
    createdAt: attempt.createdAt,
    submitMode: attempt.submitMode,
    paperTitle: attempt.paper?.title || attempt.paperTitle || "",
    score: Number(attempt.summary?.score ?? attempt.summary?.accuracy ?? 0),
    total: Number(attempt.summary?.total || 0),
    passed: Boolean(attempt.summary?.passed),
    broker: sanitizeBroker(req, attempt.broker),
  };
}

function createUploadFileName(prefix, identifier = "", extension = ".png") {
  const normalizedIdentifier = String(identifier || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32) || "item";
  return `${prefix}-${normalizedIdentifier}-${Date.now()}-${crypto.randomUUID().slice(0, 8)}${extension}`;
}

async function removePublicUploadFile(relativePath = "") {
  const normalizedPath = String(relativePath || "").trim().split("?")[0];
  if (!normalizedPath.startsWith("/uploads/")) {
    return;
  }

  const absolutePath = path.resolve(publicUploadDir, normalizedPath.replace(/^\/uploads\/+/, ""));
  const normalizedUploadRoot = `${path.resolve(publicUploadDir)}${path.sep}`;
  if (!absolutePath.startsWith(normalizedUploadRoot)) {
    return;
  }

  await fs.unlink(absolutePath).catch(() => {});
}

async function importDemoPdfs() {
  const entries = await fs.readdir(demosDir, { withFileTypes: true });
  const pdfFiles = entries
    .filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".pdf"))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, "zh-Hant"));

  const papers = [];
  for (const fileName of pdfFiles) {
    const fullPath = path.join(demosDir, fileName);
    const paper = await parsePdfToPaper(fullPath, fileName);
    papers.push(paper);
  }

  replacePapers(papers);
  return papers;
}

async function bootstrapData() {
  initStore();
  if (!listPapers().length) {
    await importDemoPdfs();
  }
}

async function resolveLogin(req, payload = {}) {
  const response = {
    loginAvailable: hasWechatLoginConfig(),
    loginWarning: "",
    user: null,
  };

  const code = String(payload.code || "").trim();
  if (!code) {
    return response;
  }

  try {
    const session = await exchangeCodeForSession(code);
    response.user = upsertUserByOpenId(session.openid);
  } catch (error) {
    response.loginWarning = error instanceof Error ? error.message : String(error);
  }

  return response;
}

app.get("/admin/login", (req, res) => {
  if (getAdminSession(req) && getAdminById(getAdminSession(req).adminId)) {
    res.redirect("/admin");
    return;
  }

  serveAdminPage(res, "login.html");
});

app.get(["/admin", "/admin/"], (req, res) => {
  const session = getAdminSession(req);
  if (!session || !getAdminById(session.adminId)) {
    res.redirect("/admin/login");
    return;
  }

  serveAdminPage(res, "index.html");
});

app.get("/api/health", (_req, res) => {
  res.json({
    ok: true,
    databasePath,
    paperCount: listPapers().length,
    brokerCount: listBrokers().length,
    userCount: countUsers(),
  });
});

app.post("/api/auth/login", asyncHandler(async (req, res) => {
  const loginState = await resolveLogin(req, req.body || {});
  res.json(loginState);
}));

app.post("/api/auth/bootstrap", asyncHandler(async (req, res) => {
  const { incomingBrokerId, incomingBrokerSource, storedBrokerId } = req.body || {};
  const loginState = await resolveLogin(req, req.body || {});
  const user = loginState.user?.openid ? getUserByOpenId(loginState.user.openid) : null;
  const defaultBroker = getDefaultBroker();
  const defaultBrokerId = String(defaultBroker?.id || "").trim();
  const normalizedStoredBrokerId = String(storedBrokerId || "").trim();
  const normalizedIncomingBrokerSource = String(incomingBrokerSource || "").trim().toLowerCase();
  const storedBroker = getBrokerByBrokerId(normalizedStoredBrokerId);
  const incomingBroker = getBrokerByBrokerId(incomingBrokerId);
  const shouldPreferSceneBroker = Boolean(
    incomingBroker
    && normalizedIncomingBrokerSource === "scene",
  );
  const shouldOverrideStoredDefault = Boolean(
    incomingBroker
    && storedBroker
    && defaultBrokerId
    && String(storedBroker.id || "") === defaultBrokerId,
  );
  const sourceBroker = shouldPreferSceneBroker
    ? incomingBroker
    : shouldOverrideStoredDefault
    ? incomingBroker
    : (storedBroker || incomingBroker || null);
  const effectiveBroker = sanitizeBroker(req, sourceBroker)
    || sanitizeBroker(req, defaultBroker);
  const latestAttempt = user?.openid ? getLatestQuizAttemptByOpenId(user.openid) : null;

  res.json({
    ...loginState,
    user: sanitizeUser(user),
    config: {
      ...getConfig(),
      defaultBrokerId: defaultBroker?.id || "",
    },
    sourceBroker: sanitizeBroker(req, sourceBroker),
    defaultBroker: sanitizeBroker(req, defaultBroker),
    effectiveBroker,
    latestAttempt: sanitizeQuizAttemptForViewer(req, latestAttempt, user, { preview: true }),
  });
}));

app.get("/api/config", (_req, res) => {
  res.json({
    config: {
      ...getConfig(),
      defaultBrokerId: getDefaultBroker()?.id || "",
    },
    papers: listPapers().map(sanitizePaper),
  });
});

app.get("/api/papers", (_req, res) => {
  res.json({
    papers: listPapers().map(sanitizePaper),
  });
});

app.get("/api/question-bank", (req, res) => {
  const paperId = req.query.paperId;
  const papers = listPapers();
  const paper = getPaper(paperId) || getPaper(papers[0]?.id);
  if (!paper) {
    res.status(404).json({ message: "没有可用题库" });
    return;
  }

  const count = Math.min(
    Number(paper.quizConfig?.questionCount) || getConfig().defaultQuestionCount,
    paper.questions.length,
  );

  const questions = shuffle(paper.questions)
    .slice(0, count)
    .map((question) => ({
      id: question.id,
      number: question.number,
      reference: question.reference,
      tags: question.tags,
      stem: question.stem,
      options: question.options,
    }));

  res.json({
    paper: sanitizePaper(paper),
    questions,
    count,
  });
});

app.get("/api/brokers/:brokerId", (req, res) => {
  const broker = getBrokerByBrokerId(req.params.brokerId);
  if (!broker) {
    res.status(404).json({ message: "中介人不存在" });
    return;
  }

  res.json({
    broker: sanitizeBroker(req, broker),
  });
});

app.post("/api/quiz/attempt-detail", (req, res) => {
  const attemptId = String(req.body?.attemptId || "").trim();
  const openid = String(req.body?.openid || "").trim();
  if (!attemptId || !openid) {
    res.status(400).json({ message: "缺少答题记录标识" });
    return;
  }

  const user = getUserByOpenId(openid);
  if (!user) {
    res.status(404).json({ message: "用户不存在" });
    return;
  }

  const attempt = getQuizAttemptByIdForOpenId(attemptId, openid);
  if (!attempt) {
    res.status(404).json({ message: "答题记录不存在" });
    return;
  }

  res.json({
    user: sanitizeUser(user),
    attempt: sanitizeQuizAttemptForViewer(req, attempt, user),
  });
});

app.post("/api/quiz/grade", (req, res) => {
  const {
    paperId,
    answers = [],
    questionIds = [],
    brokerId,
    submitMode = "manual",
    openid,
    nickname = "",
  } = req.body || {};
  const paper = getPaper(paperId);

  if (!paper) {
    res.status(404).json({ message: "题库不存在" });
    return;
  }

  const normalizedOpenId = String(openid || "").trim();
  if (!normalizedOpenId) {
    res.status(400).json({ message: "请先完成登录后再提交答卷" });
    return;
  }

  const normalizedQuestionIds = Array.isArray(questionIds)
    ? questionIds.map((item) => String(item || "").trim()).filter(Boolean)
    : [];
  if (!normalizedQuestionIds.length) {
    res.status(400).json({ message: "缺少题目集合，无法判分" });
    return;
  }

  const answerMap = new Map(
    answers.map((item) => [item.questionId, String(item.answer || "").toUpperCase()]),
  );
  const questionMap = new Map(paper.questions.map((question) => [question.id, question]));

  const resultItems = normalizedQuestionIds
    .map((questionId) => questionMap.get(questionId))
    .filter(Boolean)
    .map((question) => {
      const userAnswer = answerMap.get(question.id) || "";
      const isAnswered = Boolean(userAnswer);
      const isCorrect = userAnswer === question.answer;
      return {
        questionId: question.id,
        number: question.number,
        stem: question.stem,
        options: question.options,
        reference: question.reference,
        userAnswer,
        isAnswered,
        correctAnswer: question.answer,
        isCorrect,
        explanation: question.explanation,
      };
    });

  const correctCount = resultItems.filter((item) => item.isCorrect).length;
  const total = resultItems.length;
  const answeredCount = resultItems.filter((item) => item.isAnswered).length;
  const unansweredCount = total - answeredCount;
  const accuracy = total ? Math.round((correctCount / total) * 100) : 0;
  const passThreshold = Number(paper.quizConfig?.passThreshold) || 70;
  const broker = getBrokerByBrokerId(brokerId) || getDefaultBroker();
  const user = upsertUserByOpenId(normalizedOpenId, { nickname });
  const attempt = createQuizAttempt({
    openid: normalizedOpenId,
    nickname,
    paper: sanitizePaper(paper),
    broker,
    summary: {
      total,
      answeredCount,
      unansweredCount,
      correctCount,
      wrongCount: total - correctCount,
      score: accuracy,
      accuracy,
      passThreshold,
      passed: accuracy >= passThreshold,
      autoSubmitted: submitMode === "timeout",
    },
    results: resultItems,
    submitMode,
  });

  res.json({
    user: sanitizeUser(user),
    attempt: sanitizeQuizAttemptForViewer(req, attempt, user),
  });
});

app.post("/admin/api/login", (req, res) => {
  const { username, password } = req.body || {};
  const admin = authenticateAdmin(username, password);
  if (!admin) {
    clearAdminCookie(req, res);
    res.status(401).json({ message: "账号或密码错误" });
    return;
  }

  const session = setAdminCookie(req, res, admin);
  res.json({
    message: "登录成功",
    admin: {
      id: admin.id,
      username: admin.username,
      expiresAt: session.expiresAt,
    },
  });
});

app.get("/admin/api/session", requireAdmin, (req, res) => {
  res.json({
    authenticated: true,
    admin: req.admin,
  });
});

app.post("/admin/api/logout", (_req, res) => {
  clearAdminCookie(_req, res);
  res.json({ message: "已退出登录" });
});

const adminApi = express.Router();
adminApi.use(requireAdmin);

adminApi.get("/overview", (req, res) => {
  res.json({
    config: {
      ...getConfig(),
      defaultBrokerId: getDefaultBroker()?.id || "",
    },
    papers: listPapers().map(sanitizePaper),
    brokers: listBrokers().map((broker) => sanitizeBroker(req, broker)),
    userCount: countUsers(),
    admin: req.admin,
  });
});

adminApi.get("/papers/:paperId", (req, res) => {
  const paper = getPaper(req.params.paperId);
  if (!paper) {
    res.status(404).json({ message: "题库不存在" });
    return;
  }

  res.json({ paper });
});

adminApi.post("/papers", (req, res) => {
  const paperInput = req.body?.paper || req.body;
  const paper = createOrReplacePaper(paperInput);
  res.json({
    message: "题库已保存",
    paper,
  });
});

adminApi.put("/papers/:paperId", (req, res) => {
  const paperInput = req.body?.paper || req.body;
  const paper = updatePaper(req.params.paperId, paperInput || {});
  if (!paper) {
    res.status(404).json({ message: "题库不存在" });
    return;
  }

  res.json({
    message: "题库已更新",
    paper,
  });
});

adminApi.delete("/papers/:paperId", (req, res) => {
  const deleted = deletePaper(req.params.paperId);
  if (!deleted) {
    res.status(404).json({ message: "题库不存在" });
    return;
  }

  res.json({ message: "题库已删除" });
});

adminApi.post("/import-demos", asyncHandler(async (_req, res) => {
  const papers = await importDemoPdfs();
  res.json({
    message: "示例 PDF 已重新导入",
    papers: papers.map(sanitizePaper),
  });
}));

adminApi.post("/upload-pdf", pdfUpload.single("pdf"), asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400).json({ message: "请上传 PDF 文件" });
    return;
  }

  try {
    const sourceLabel = decodeUploadedName(req.file.originalname);
    const parsedPaper = await parsePdfToPaper(req.file.path, sourceLabel);
    const replacePaperId = String(req.body?.replacePaperId || "").trim();
    const existingPaper = replacePaperId ? getPaper(replacePaperId) : null;
    const paper = replacePaperId
      ? createOrReplacePaper(
        {
          ...parsedPaper,
          id: replacePaperId,
          sortOrder: existingPaper?.sortOrder ?? parsedPaper.sortOrder,
          quizConfig: existingPaper?.quizConfig || parsedPaper.quizConfig,
        },
        { replacePaperId },
      )
      : upsertPaper({
        ...parsedPaper,
        id: `${parsedPaper.id}-${crypto.randomUUID().slice(0, 8)}`,
      });

    res.json({
      message: replacePaperId ? "题库已用 PDF 更新" : "PDF 上传并导入成功",
      paper,
    });
  } finally {
    await fs.unlink(req.file.path).catch(() => {});
  }
}));

adminApi.post("/upload-image", imageUpload.single("file"), (req, res) => {
  if (!req.file) {
    res.status(400).json({ message: "请上传图片文件" });
    return;
  }

  const relativePath = `/uploads/${req.file.filename}`;
  res.json({
    message: "图片上传成功",
    file: {
      path: relativePath,
      url: toAbsoluteUrl(req, relativePath),
      name: decodeUploadedName(req.file.originalname),
    },
  });
});

adminApi.post("/brokers/:id/generate-minicode", asyncHandler(async (req, res) => {
  const broker = getBrokerById(req.params.id);
  if (!broker) {
    res.status(404).json({ message: "中介人不存在" });
    return;
  }

  if (!hasWechatLoginConfig()) {
    res.status(400).json({ message: "服务端未配置 WECHAT_APP_ID / WECHAT_APP_SECRET" });
    return;
  }

  const scene = buildBrokerMiniCodeScene(broker.id);
  const imageBuffer = await generateUnlimitedWxaCode({ scene });
  const codeDirectory = path.join(publicUploadDir, "wxacodes");
  await fs.mkdir(codeDirectory, { recursive: true });

  const fileName = createUploadFileName("minicode", broker.id, ".png");
  const absolutePath = path.join(codeDirectory, fileName);
  const relativePath = `/uploads/wxacodes/${fileName}`;
  await fs.writeFile(absolutePath, imageBuffer);

  if (broker.miniProgramCodePath && broker.miniProgramCodePath !== relativePath) {
    await removePublicUploadFile(broker.miniProgramCodePath);
  }

  const updatedBroker = updateBrokerMiniProgramCodePath(broker.id, relativePath);
  res.json({
    message: "小程序碼已生成",
    broker: sanitizeBroker(req, updatedBroker || { ...broker, miniProgramCodePath: relativePath }),
    file: {
      path: relativePath,
      url: toAbsoluteUrl(req, relativePath),
    },
  });
}));

adminApi.post("/brokers", (req, res) => {
  const broker = saveBroker(req.body || {});
  res.json({
    message: "中介人已保存",
    broker: sanitizeBroker(req, broker),
  });
});

adminApi.put("/brokers/:id", (req, res) => {
  const broker = saveBroker({
    ...req.body,
    id: Number(req.params.id),
  });

  res.json({
    message: "中介人已更新",
    broker: sanitizeBroker(req, broker),
  });
});

adminApi.delete("/brokers/:id", (req, res) => {
  const deleted = deleteBroker(req.params.id);
  if (!deleted) {
    res.status(404).json({ message: "中介人不存在" });
    return;
  }

  res.json({ message: "中介人已删除" });
});

adminApi.get("/users", (req, res) => {
  const page = Number(req.query.page);
  const pageSize = Number(req.query.pageSize);
  const payload = listUsersPage({ page, pageSize });
  res.json({
    users: payload.items.map(sanitizeUser),
    pagination: {
      page: payload.page,
      pageSize: payload.pageSize,
      total: payload.total,
      totalPages: payload.totalPages,
    },
  });
});

adminApi.get("/users/:id/attempts", (req, res) => {
  const user = getUserById(req.params.id);
  if (!user) {
    res.status(404).json({ message: "用户不存在" });
    return;
  }

  res.json({
    user: sanitizeUser(user),
    attempts: listQuizAttemptsByOpenId(user.openid, 20).map((attempt) => sanitizeQuizAttemptForAdmin(req, attempt)),
  });
});

adminApi.put("/users/:id", (req, res) => {
  const user = updateUser(req.params.id, req.body || {});
  res.json({
    message: "用户信息已更新",
    user: sanitizeUser(user),
  });
});

adminApi.delete("/users/:id", (req, res) => {
  const deleted = deleteUser(req.params.id);
  if (!deleted) {
    res.status(404).json({ message: "用户不存在" });
    return;
  }

  res.json({ message: "用户已删除" });
});

adminApi.get("/settings/admin", (req, res) => {
  res.json({ admin: req.admin });
});

adminApi.put("/settings/admin", (req, res) => {
  const admin = updateAdminCredentials(req.admin.id, req.body || {});
  const session = setAdminCookie(req, res, admin);
  res.json({
    message: "管理员信息已更新",
    admin: {
      ...admin,
      expiresAt: session.expiresAt,
    },
  });
});

adminApi.post("/config", (req, res) => {
  res.json({
    message: "配置已更新",
    config: updateConfig(req.body || {}),
  });
});

app.use("/admin/api", adminApi);

app.use((error, _req, res, _next) => {
  console.error(error);
  if (error instanceof multer.MulterError) {
    const message = error.code === "LIMIT_FILE_SIZE"
      ? "上传文件过大"
      : "上传文件不符合要求";
    res.status(400).json({ message });
    return;
  }

  const statusCode = Number(error?.statusCode) || 500;
  res.status(statusCode).json({
    message: statusCode >= 500
      ? "服务端异常"
      : (error instanceof Error ? error.message : "请求无效"),
  });
});

async function start() {
  const importOnly = process.argv.includes("--import-only");
  validateRuntimeConfig();

  if (importOnly) {
    initStore();
    await importDemoPdfs();
    console.log("示例 PDF 导入完成");
    return;
  }

  await bootstrapData();
  app.listen(defaultPort, () => {
    console.log(`Quiz backend listening on http://127.0.0.1:${defaultPort}`);
  });
}

start().catch((error) => {
  console.error(error);
  process.exit(1);
});
