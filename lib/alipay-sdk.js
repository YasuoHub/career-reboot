/* 支付宝 SDK 工厂：生产从环境变量、沙箱从 .alipay-sandbox.json 读取 */
import { AlipaySdk } from 'alipay-sdk';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** 环境变量里的密钥常被写成含字面量 \n 的单行，先还原成真实换行 */
function normalizeKey(key) {
  return String(key || '').replace(/\\n/g, '\n').trim();
}

/**
 * 判断应用私钥是 PKCS#8 还是 PKCS#1。
 * 支付宝密钥工具默认导出 PKCS#8（DER 前缀 30 82 .. 02 01 00 30 0d）；
 * alipay-sdk 默认按 PKCS#1 包装，不显式指定会签名失败。
 */
function detectKeyType(key) {
  const text = normalizeKey(key);
  if (/-----BEGIN PRIVATE KEY-----/.test(text)) return 'PKCS8';
  if (/-----BEGIN RSA PRIVATE KEY-----/.test(text)) return undefined;
  try {
    const der = Buffer.from(text.replace(/\s+/g, ''), 'base64');
    // PKCS#8 PrivateKeyInfo: 30 82 len len | 02 01 00 | 30 0d
    if (der.length > 12 && der[0] === 0x30 && der[4] === 0x02 && der[5] === 0x01
      && der[6] === 0x00 && der[7] === 0x30 && der[8] === 0x0d) return 'PKCS8';
  } catch (_) { /* 非法 base64 交给 SDK 报错 */ }
  return undefined;
}

function keyConfig(privateKey) {
  const keyType = process.env.ALIPAY_KEY_TYPE || detectKeyType(privateKey);
  return keyType ? { keyType } : {};
}

/**
 * 创建 AlipaySdk 实例
 * - NODE_ENV=production 或 ALIPAY_USE_PRODUCTION=true → 从 env
 * - 否则 → 从项目根 .alipay-sandbox.json（沙箱模式）
 */
export function createAlipaySdk(overrides = {}) {
  const useProduction = process.env.NODE_ENV === 'production' || process.env.ALIPAY_USE_PRODUCTION === 'true';

  let cfg;
  if (useProduction) {
    const appId = overrides.appId || process.env.ALIPAY_APP_ID;
    const privateKey = normalizeKey(overrides.privateKey || process.env.ALIPAY_PRIVATE_KEY);
    const alipayPublicKey = normalizeKey(overrides.alipayPublicKey || process.env.ALIPAY_PUBLIC_KEY);
    if (!appId || !privateKey || !alipayPublicKey) {
      throw new Error('生产模式缺少 ALIPAY_APP_ID / ALIPAY_PRIVATE_KEY / ALIPAY_PUBLIC_KEY');
    }
    cfg = { appId, privateKey, alipayPublicKey, ...keyConfig(privateKey) };
  } else {
    // 沙箱模式：读 .alipay-sandbox.json（相对路径向上找 3 层）
    const sandboxFile = findSandboxFile();
    if (!sandboxFile) throw new Error('未找到 .alipay-sandbox.json，请先运行沙箱配置或设置 ALIPAY_USE_PRODUCTION=true');
    const raw = JSON.parse(fs.readFileSync(sandboxFile, 'utf-8'));
    const app = raw.appIds?.[0];
    if (!app?.appId || !app?.appPrivatePkcsKey || !app?.alipayPublicKey) {
      throw new Error('.alipay-sandbox.json 结构异常，缺少 appId/appPrivatePkcsKey/alipayPublicKey');
    }
    const privateKey = normalizeKey(app.appPrivatePkcsKey);
    cfg = {
      appId: app.appId,
      privateKey,
      alipayPublicKey: normalizeKey(app.alipayPublicKey),
      ...keyConfig(privateKey),
    };
  }

  return new AlipaySdk({
    ...cfg,
    // 沙箱网关与生产网关严格区分；未设置 ALIPAY_GATEWAY 时按运行模式取默认值
    gateway: process.env.ALIPAY_GATEWAY
      || (useProduction ? 'https://openapi.alipay.com/gateway.do' : 'https://openapi-sandbox.dl.alipaydev.com/gateway.do'),
    signType: 'RSA2',
  });
}

function findSandboxFile() {
  // 基于模块自身位置定位 .alipay-sandbox.json（不依赖 cwd）
  let dir = __dirname; // lib/
  for (let i = 0; i < 6; i++) {
    const candidate = path.join(dir, '.alipay-sandbox.json');
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

/** 便捷导出：让 API 函数能以具名方式引入 */
export default { createAlipaySdk };