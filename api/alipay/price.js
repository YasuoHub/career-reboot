/* /api/alipay/price —— 前端展示价格（与下单同源，唯一来源是 ALIPAY_PRICE）
   GET → { amount: '9.90', currency: 'CNY' } */
import { PRICE } from '../../lib/alipay-orders.js';

export const config = { api: { external: true } };

export default function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
  // 价格可能随环境变量调整，不做缓存
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).json({ amount: PRICE, currency: 'CNY' });
}
