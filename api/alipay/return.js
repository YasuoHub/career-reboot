/* /api/alipay/return —— 支付宝同步回跳入口
   只做 302：把订单号带回站内，由前端调用 /api/alipay/verify 主动验单。
   ⚠️ 绝不信任这里的任何支付状态参数。 */
import { SITE_URL, isValidOutTradeNo } from '../../lib/alipay-orders.js';

export const config = { api: { external: true } };

export default function handler(req, res) {
  const raw = req.query.out_trade_no;
  const outTradeNo = isValidOutTradeNo(raw) ? raw : '';

  const qs = new URLSearchParams({ pay_return: '1' });
  if (outTradeNo) qs.set('out_trade_no', outTradeNo);

  res.setHeader('Cache-Control', 'no-store');
  res.statusCode = 302;
  res.setHeader('Location', `${SITE_URL}/?${qs.toString()}`);
  return res.end();
}
