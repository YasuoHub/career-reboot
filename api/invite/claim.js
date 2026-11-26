/* POST /api/invite/claim —— 邀请解锁已下线，不再接受新的邀请计数。 */
export const config = { api: { external: true } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  res.setHeader('Cache-Control', 'no-store');
  return res.status(410).json({ configured: false, retired: true, counted: false });
}