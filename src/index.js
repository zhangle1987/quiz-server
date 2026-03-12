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
  publicOrigin,
  publicDir,
  uploadDir,
} from "./config.js";
import {
  authenticateAdmin,
  createOrReplacePaper,
  deleteBroker,
  deletePaper,
  getAdminById,
  getBrokerByBrokerId,
  getBrokerByLinkedOpenId,
  getConfig,
  getDefaultBroker,
  getPaper,
  initStore,
  listBrokers,
  listPapers,
  replacePapers,
  saveBroker,
  updateAdminCredentials,
  updateConfig,
  updatePaper,
  upsertPaper,
  upsertUserByOpenId,
} from "./lib/store.js";
import { parsePdfToPaper } from "./lib/pdfParser.js";
import { exchangeCodeForSession, hasWechatLoginConfig } from "./lib/wechat.js";
import {
  ADMIN_SESSION_COOKIE,
  createAdminSessionToken,
  parseAdminSessionToken,
} from "./lib/adminAuth.js";

const app = express();
app.set("trust proxy", true);
const upload = multer({
  storage: multer.diskStorage({
    destination(_req, _file, callback) {
      callback(null, uploadDir);
    },
    filename(_req, file, callback) {
      const extension = path.extname(file.originalname || "") || "";
      callback(null, `${Date.now()}-${crypto.randomUUID()}${extension}`);
    },
  }),
});

app.use(cors());
app.use(express.json({ limit: "12mb" }));
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(uploadDir));
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

function sanitizePaper(paper) {
  return {
    id: paper.id,
    title: paper.title,
    sourceFile: paper.sourceFile,
    importedAt: paper.importedAt,
    questionCount: paper.questionCount,
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

function setAdminCookie(res, admin) {
  const session = createAdminSessionToken(admin);
  res.setHeader(
    "Set-Cookie",
    `${ADMIN_SESSION_COOKIE}=${encodeURIComponent(session.token)}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${session.maxAge}`,
  );
  return session;
}

function clearAdminCookie(res) {
  res.setHeader(
    "Set-Cookie",
    `${ADMIN_SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`,
  );
}

function requireAdmin(req, res, next) {
  const session = getAdminSession(req);
  const admin = session ? getAdminById(session.adminId) : null;
  if (!admin) {
    clearAdminCookie(res);
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
    ...broker,
    qrImageUrl: broker.qrImagePath ? toAbsoluteUrl(req, broker.qrImagePath) : "",
  };
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
    currentBroker: null,
  };

  const code = String(payload.code || "").trim();
  if (!code) {
    return response;
  }

  try {
    const session = await exchangeCodeForSession(code);
    response.user = upsertUserByOpenId(session.openid);
    response.currentBroker = sanitizeBroker(req, getBrokerByLinkedOpenId(session.openid));
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
  });
});

app.post("/api/auth/login", asyncHandler(async (req, res) => {
  const loginState = await resolveLogin(req, req.body || {});
  res.json(loginState);
}));

app.post("/api/auth/bootstrap", asyncHandler(async (req, res) => {
  const { incomingBrokerId, storedBrokerId } = req.body || {};
  const loginState = await resolveLogin(req, req.body || {});
  const storedBroker = getBrokerByBrokerId(storedBrokerId);
  const incomingBroker = storedBroker ? null : getBrokerByBrokerId(incomingBrokerId);
  const defaultBroker = getDefaultBroker();
  const sourceBroker = storedBroker || incomingBroker || defaultBroker;
  const effectiveBroker = loginState.currentBroker
    || sanitizeBroker(req, sourceBroker)
    || sanitizeBroker(req, defaultBroker);

  res.json({
    ...loginState,
    config: {
      ...getConfig(),
      defaultBrokerId: defaultBroker?.brokerId || "",
    },
    sourceBroker: sanitizeBroker(req, sourceBroker),
    defaultBroker: sanitizeBroker(req, defaultBroker),
    effectiveBroker,
  });
}));

app.get("/api/config", (_req, res) => {
  res.json({
    config: {
      ...getConfig(),
      defaultBrokerId: getDefaultBroker()?.brokerId || "",
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
  const requestedCount = Number(req.query.count);
  const papers = listPapers();
  const paper = getPaper(paperId) || getPaper(papers[0]?.id);
  if (!paper) {
    res.status(404).json({ message: "没有可用题库" });
    return;
  }

  const count = Number.isFinite(requestedCount) && requestedCount > 0
    ? Math.min(requestedCount, paper.questions.length)
    : Math.min(getConfig().defaultQuestionCount, paper.questions.length);

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
    res.status(404).json({ message: "经纪人不存在" });
    return;
  }

  res.json({
    broker: sanitizeBroker(req, broker),
  });
});

app.post("/api/quiz/grade", (req, res) => {
  const { paperId, answers = [], brokerId } = req.body || {};
  const paper = getPaper(paperId);

  if (!paper) {
    res.status(404).json({ message: "题库不存在" });
    return;
  }

  const answerMap = new Map(
    answers.map((item) => [item.questionId, String(item.answer || "").toUpperCase()]),
  );

  const resultItems = paper.questions
    .filter((question) => answerMap.has(question.id))
    .map((question) => {
      const userAnswer = answerMap.get(question.id);
      const isCorrect = userAnswer === question.answer;
      return {
        questionId: question.id,
        number: question.number,
        stem: question.stem,
        options: question.options,
        reference: question.reference,
        userAnswer,
        correctAnswer: question.answer,
        isCorrect,
        explanation: question.explanation,
      };
    });

  const correctCount = resultItems.filter((item) => item.isCorrect).length;
  const total = resultItems.length;
  const broker = getBrokerByBrokerId(brokerId) || getDefaultBroker();

  res.json({
    paper: sanitizePaper(paper),
    broker: sanitizeBroker(req, broker),
    summary: {
      total,
      correctCount,
      wrongCount: total - correctCount,
      score: total ? Math.round((correctCount / total) * 100) : 0,
    },
    results: resultItems,
  });
});

app.post("/admin/api/login", (req, res) => {
  const { username, password } = req.body || {};
  const admin = authenticateAdmin(username, password);
  if (!admin) {
    clearAdminCookie(res);
    res.status(401).json({ message: "账号或密码错误" });
    return;
  }

  const session = setAdminCookie(res, admin);
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
  clearAdminCookie(res);
  res.json({ message: "已退出登录" });
});

const adminApi = express.Router();
adminApi.use(requireAdmin);

adminApi.get("/overview", (req, res) => {
  res.json({
    config: {
      ...getConfig(),
      defaultBrokerId: getDefaultBroker()?.brokerId || "",
    },
    papers: listPapers().map(sanitizePaper),
    brokers: listBrokers().map((broker) => sanitizeBroker(req, broker)),
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

adminApi.post("/upload-pdf", upload.single("pdf"), asyncHandler(async (req, res) => {
  if (!req.file) {
    res.status(400).json({ message: "请上传 PDF 文件" });
    return;
  }

  const sourceLabel = decodeUploadedName(req.file.originalname);
  const parsedPaper = await parsePdfToPaper(req.file.path, sourceLabel);
  const replacePaperId = String(req.body?.replacePaperId || "").trim();
  const paper = replacePaperId
    ? createOrReplacePaper(
      {
        ...parsedPaper,
        id: replacePaperId,
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
}));

adminApi.post("/upload-image", upload.single("file"), (req, res) => {
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
      name: req.file.originalname,
    },
  });
});

adminApi.post("/brokers", (req, res) => {
  const broker = saveBroker(req.body || {});
  res.json({
    message: "经纪人已保存",
    broker: sanitizeBroker(req, broker),
  });
});

adminApi.put("/brokers/:id", (req, res) => {
  const broker = saveBroker({
    ...req.body,
    id: Number(req.params.id),
  });

  res.json({
    message: "经纪人已更新",
    broker: sanitizeBroker(req, broker),
  });
});

adminApi.delete("/brokers/:id", (req, res) => {
  const deleted = deleteBroker(req.params.id);
  if (!deleted) {
    res.status(404).json({ message: "经纪人不存在" });
    return;
  }

  res.json({ message: "经纪人已删除" });
});

adminApi.get("/settings/admin", (req, res) => {
  res.json({ admin: req.admin });
});

adminApi.put("/settings/admin", (req, res) => {
  const admin = updateAdminCredentials(req.admin.id, req.body || {});
  const session = setAdminCookie(res, admin);
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
  res.status(500).json({
    message: error instanceof Error ? error.message : "服务端异常",
  });
});

async function start() {
  const importOnly = process.argv.includes("--import-only");

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
