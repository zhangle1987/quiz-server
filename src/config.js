import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const serverRoot = path.resolve(__dirname, "..");
dotenv.config({ path: path.join(serverRoot, ".env") });

export { serverRoot };
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
export const publicDir = path.join(serverRoot, "public");
export const adminPublicDir = path.join(publicDir, "admin");
export const publicUploadDir = path.join(publicDir, "uploads");
export const tempUploadDir = path.join(serverRoot, "tmp", "uploads");
export const defaultPort = 3000;
export const wechatAppId = process.env.WECHAT_APP_ID || "";
export const wechatAppSecret = process.env.WECHAT_APP_SECRET || "";
export const wechatMiniCodePage = String(process.env.WECHAT_MINICODE_PAGE || "pages/index/index").trim() || "pages/index/index";
export const wechatMiniCodeEnvVersion = (() => {
  const value = String(process.env.WECHAT_MINICODE_ENV_VERSION || "release").trim().toLowerCase();
  return ["release", "trial", "develop"].includes(value) ? value : "release";
})();
export const adminSessionSecret = String(process.env.ADMIN_SESSION_SECRET || "").trim();
export const adminInitialUsername = String(process.env.ADMIN_INITIAL_USERNAME || "").trim();
export const adminInitialPassword = String(process.env.ADMIN_INITIAL_PASSWORD || "");
export const publicOrigin = process.env.PUBLIC_ORIGIN || "";

const LEGACY_DEFAULT_ADMIN_SESSION_SECRET = "quiz-backend-local-admin-secret";

export function validateRuntimeConfig() {
  const errors = [];

  if (!adminSessionSecret) {
    errors.push("缺少 ADMIN_SESSION_SECRET");
  } else if (adminSessionSecret.length < 32) {
    errors.push("ADMIN_SESSION_SECRET 长度至少需要 32 个字符");
  } else if (adminSessionSecret === LEGACY_DEFAULT_ADMIN_SESSION_SECRET) {
    errors.push("ADMIN_SESSION_SECRET 不能继续使用默认占位值");
  }

  if (errors.length) {
    throw new Error(`运行配置不完整：${errors.join("；")}`);
  }
}
