/* /api/alipay/return —— 支付宝同步回跳入口（正常返回 / 中途退出共用）
   只做 302：把订单号带回站内，由前端调用 /api/alipay/verify 主动验单。
   ⚠️ 绝不信任这里的任何支付状态参数。
   quit=1 表示来自 quit_url（用户中途退出），前端会先静默核单再提示取消。 */
import { SITE_URL, isValidOutTradeNo } from '../../lib/alipay-orders.js';

export const config = { api: { external: true } };

function readCookie(req, name) {
  const raw = String((req.headers && req.headers.cookie) || '');
  for (const part of raw.split(';')) {
    const i = part.indexOf('=');
    if (i < 0) continue;
    if (part.slice(0, i).trim() === name) {
      try { return decodeURIComponent(part.slice(i + 1).trim()); } catch (_) { return ''; }
    }
  }
  return '';
}

export default function handler(req, res) {
  const raw = req.query.out_trade_no;
  let outTradeNo = isValidOutTradeNo(raw) ? raw : '';

  // 支付宝不一定回传 out_trade_no；下单时下发的 Cookie 作为兜底
  if (!outTradeNo) {
    const fromCookie = readCookie(req, 'rb_order').split('.')[0];
    if (isValidOutTradeNo(fromCookie)) outTradeNo = fromCookie;
  }

  const qs = new URLSearchParams(req.query.quit === '1' ? { pay_cancel: '1' } : { pay_return: '1' });
  if (outTradeNo) qs.set('out_trade_no', outTradeNo);

  res.setHeader('Cache-Control', 'no-store');
  res.statusCode = 302;
  res.setHeader('Location', `${SITE_URL}/?${qs.toString()}`);
  return res.end();
}
