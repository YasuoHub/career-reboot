/* 订单工具（无状态版）
 *
 * 设计原则：支付宝侧订单是唯一权威，本地不持久化订单状态。
 * 理由：Vercel Serverless 多实例 + 冷启动，内存 Map 会在回调/验单时丢单，
 * 因此下单只生成 outTradeNo，支付结果一律通过 alipay.trade.query 主动查询确认。
 *
 * 若要展示"已购买"，前端凭 outTradeNo 换取签名令牌（token）存在本机；
 * 令牌由服务端私钥派生密钥签名，用户无法自行伪造。
 */
import crypto from 'node:crypto';

function normalizePrice(raw) {
  const n = Number(raw);
  // 0 或负数不是合法售价，回退到默认价；避免误配置把付费报告变成免费
  if (!Number.isFinite(n) || n <= 0) return '9.90';
  return (Math.round(n * 100) / 100).toFixed(2);
}

/** 深度报告定价（服务端唯一价格来源，前端不允许传价格） */
export const PRICE = normalizePrice(process.env.ALIPAY_PRICE || '9.90');
export const SUBJECT = '重启人格图鉴 · 深度报告';
/** 站点主域（用于拼接回调地址，可用 ALIPAY_SITE_URL 覆盖） */
export const SITE_URL = (process.env.ALIPAY_SITE_URL || 'https://career-turn.icu').replace(/\/+$/, '');

const OUT_TRADE_NO_RE = /^CRB\d{17}$/;

/** 新订单号：CRB + 13 位毫秒时间戳 + 4 位随机 */
export function nextOutTradeNo() {
  return `CRB${Date.now()}${Math.floor(Math.random() * 1e4).toString().padStart(4, '0')}`;
}

/** 退款请求号：同一次退款重试必须复用原编号，新一次退款生成新编号 */
export function nextOutRequestNo() {
  return `RFD${Date.now()}${Math.floor(Math.random() * 1e4).toString().padStart(4, '0')}`;
}

export function isValidOutTradeNo(value) {
  return typeof value === 'string' && OUT_TRADE_NO_RE.test(value);
}

/** 金额按「分」比较，避免浮点误差与 "9.9"/"9.90" 差异 */
export function amountsEqual(a, b) {
  const na = Number(a), nb = Number(b);
  if (!Number.isFinite(na) || !Number.isFinite(nb)) return false;
  return Math.round(na * 100) === Math.round(nb * 100);
}

/* ---------------- 解锁令牌 ---------------- */
const TOKEN_TTL_MS = 365 * 24 * 60 * 60 * 1000; // 1 年；与页面“1 年内可回看”一致

function tokenSecret() {
  const base = process.env.ALIPAY_VERIFY_SECRET || process.env.ALIPAY_PRIVATE_KEY || '';
  if (!base) return null;
  return crypto.createHash('sha256').update(`career-reboot:unlock:${base}`).digest();
}

/** 支付确认或邀请完成后签发令牌；未配置密钥时返回 null（前端退回每次打开都验单） */
export function signUnlockToken({ outTradeNo, tradeNo, paidAt, via = 'pay' }) {
  const secret = tokenSecret();
  if (!secret) return null;
  const payload = Buffer.from(JSON.stringify({
    o: outTradeNo,
    t: tradeNo || '',
    p: paidAt || '',
    v: via === 'share' ? 'share' : 'pay',
    exp: Date.now() + TOKEN_TTL_MS,
  })).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

/** 服务端校验令牌（当前前端不调用，保留给后续权益校验使用） */
export function verifyUnlockToken(token) {
  const secret = tokenSecret();
  if (!secret || typeof token !== 'string') return null;
  const [payload, sig] = token.split('.');
  if (!payload || !sig) return null;
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  const a = Buffer.from(sig), b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
    if (!data.exp || data.exp < Date.now()) return null;
    if (data.v === 'share') {
      if (!/^[A-Za-z0-9_-]{8,64}$/.test(String(data.o || ''))) return null;
    } else if (!isValidOutTradeNo(data.o)) {
      return null;
    }
    return data;
  } catch (_) {
    return null;
  }
}

export default {
  PRICE, SUBJECT, SITE_URL,
  nextOutTradeNo, nextOutRequestNo, isValidOutTradeNo, amountsEqual,
  signUnlockToken, verifyUnlockToken,
};
