import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const serverRoot = path.resolve(__dirname, "..");
export const workspaceRoot = path.resolve(serverRoot, "..");
export const miniProgramRoot = process.env.MINIPROGRAM_ROOT
  ? path.resolve(serverRoot, process.env.MINIPROGRAM_ROOT)
  : path.join(workspaceRoot, "miniprogram-1");
export const demosDir = process.env.DEMOS_DIR
  ? path.resolve(serverRoot, process.env.DEMOS_DIR)
  : path.join(miniProgramRoot, "demos");
export const dataDir = path.join(serverRoot, "data");
export const dataFilePath = path.join(serverRoot, "data", "question-banks.json");
export const databasePath = path.join(dataDir, "quiz.sqlite");
export const uploadDir = path.join(serverRoot, "uploads");
export const publicDir = path.join(serverRoot, "public");
export const adminPublicDir = path.join(publicDir, "admin");
export const defaultPort = 3000;
export const wechatAppId = process.env.WECHAT_APP_ID || "";
export const wechatAppSecret = process.env.WECHAT_APP_SECRET || "";
export const adminSessionSecret = process.env.ADMIN_SESSION_SECRET || "quiz-backend-local-admin-secret";
