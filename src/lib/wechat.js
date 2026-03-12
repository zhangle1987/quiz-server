import { wechatAppId, wechatAppSecret } from "../config.js";

export function hasWechatLoginConfig() {
  return Boolean(wechatAppId && wechatAppSecret);
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
