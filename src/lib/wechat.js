import {
  wechatAppId,
  wechatAppSecret,
  wechatMiniCodeEnvVersion,
  wechatMiniCodePage,
} from "../config.js";

const MINI_CODE_SCENE_PREFIX = "i=";
const MINI_CODE_SCENE_CHAR_PATTERN = /^[0-9A-Za-z!#$&'()*+,/:;=?@\-._~]+$/;
const ACCESS_TOKEN_RETRY_ERRCODES = new Set([40001, 40014, 42001]);

let accessTokenCache = {
  token: "",
  expiresAt: 0,
};

export function hasWechatLoginConfig() {
  return Boolean(wechatAppId && wechatAppSecret);
}

async function fetchWechatJson(url, options = {}) {
  const response = await fetch(url, options);
  if (!response.ok) {
    throw new Error(`微信接口请求失败: ${response.status}`);
  }

  return response.json();
}

export async function exchangeCodeForSession(code) {
  const normalizedCode = String(code || "").trim();
  if (!normalizedCode) {
    throw new Error("缺少登录 code");
  }

  if (!hasWechatLoginConfig()) {
    throw new Error("服务端未配置 WECHAT_APP_ID / WECHAT_APP_SECRET");
  }

  const url = new URL("https://api.weixin.qq.com/sns/jscode2session");
  url.searchParams.set("appid", wechatAppId);
  url.searchParams.set("secret", wechatAppSecret);
  url.searchParams.set("js_code", normalizedCode);
  url.searchParams.set("grant_type", "authorization_code");

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`微信登录请求失败: ${response.status}`);
  }

  const payload = await response.json();
  if (payload.errcode) {
    throw new Error(payload.errmsg || `微信登录失败: ${payload.errcode}`);
  }

  if (!payload.openid) {
    throw new Error("微信登录未返回 openid");
  }

  return payload;
}

export function buildBrokerMiniCodeScene(brokerId) {
  const normalizedBrokerId = String(brokerId || "").trim();
  if (!normalizedBrokerId) {
    throw new Error("缺少中介人 ID，无法生成小程序碼");
  }

  if (!MINI_CODE_SCENE_CHAR_PATTERN.test(normalizedBrokerId)) {
    throw new Error("中介人 ID 含有不支援的字元，請僅使用英數與常見符號");
  }

  const scene = `${MINI_CODE_SCENE_PREFIX}${normalizedBrokerId}`;
  if (scene.length > 32) {
    throw new Error("中介人 ID 過長，無法放入小程序碼 scene");
  }

  return scene;
}

export async function getWechatAccessToken(options = {}) {
  if (!hasWechatLoginConfig()) {
    throw new Error("服务端未配置 WECHAT_APP_ID / WECHAT_APP_SECRET");
  }

  const forceRefresh = Boolean(options.forceRefresh);
  if (!forceRefresh && accessTokenCache.token && accessTokenCache.expiresAt > Date.now()) {
    return accessTokenCache.token;
  }

  const url = new URL("https://api.weixin.qq.com/cgi-bin/token");
  url.searchParams.set("grant_type", "client_credential");
  url.searchParams.set("appid", wechatAppId);
  url.searchParams.set("secret", wechatAppSecret);

  const payload = await fetchWechatJson(url);
  if (payload.errcode) {
    throw new Error(payload.errmsg || `获取微信 access_token 失败: ${payload.errcode}`);
  }

  const token = String(payload.access_token || "").trim();
  if (!token) {
    throw new Error("微信接口未返回 access_token");
  }

  const expiresIn = Number(payload.expires_in);
  const safeExpiresIn = Number.isFinite(expiresIn) && expiresIn > 120 ? expiresIn - 120 : 6000;
  accessTokenCache = {
    token,
    expiresAt: Date.now() + safeExpiresIn * 1000,
  };
  return accessTokenCache.token;
}

export async function generateUnlimitedWxaCode(input = {}, options = {}) {
  const scene = String(input.scene || "").trim();
  if (!scene) {
    throw new Error("缺少 scene，无法生成小程序碼");
  }

  const page = String(input.page || wechatMiniCodePage || "pages/index/index").trim();
  const envVersion = String(input.envVersion || wechatMiniCodeEnvVersion || "release").trim();
  const checkPath = input.checkPath !== false;
  const retried = Boolean(options.retried);

  const accessToken = await getWechatAccessToken({ forceRefresh: retried });
  const url = new URL("https://api.weixin.qq.com/wxa/getwxacodeunlimit");
  url.searchParams.set("access_token", accessToken);

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      scene,
      page,
      env_version: envVersion,
      check_path: checkPath,
    }),
  });

  if (!response.ok) {
    throw new Error(`微信小程序碼接口请求失败: ${response.status}`);
  }

  const contentType = String(response.headers.get("content-type") || "").toLowerCase();
  if (contentType.includes("application/json") || contentType.includes("text/plain")) {
    const payload = await response.json().catch(async () => {
      const text = await response.text();
      return { errmsg: text || "微信接口返回异常" };
    });

    if (!retried && ACCESS_TOKEN_RETRY_ERRCODES.has(Number(payload.errcode))) {
      return generateUnlimitedWxaCode(input, { retried: true });
    }

    throw new Error(payload.errmsg || `生成小程序碼失败: ${payload.errcode || "unknown"}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length) {
    throw new Error("微信接口未返回小程序碼图片");
  }

  return buffer;
}
