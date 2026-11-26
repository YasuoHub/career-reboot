/* GET /api/invite/state?uid=xxx —— 邀请解锁已下线。
   付费报告只通过购买或订单号恢复解锁，避免“邀请免费解锁”与付费互相打架。 */
export const config = { api: { external: true } };

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
  res.setHeader('Cache-Control', 'no-store');
  return res.status(410).json({ configured: false, retired: true });
}