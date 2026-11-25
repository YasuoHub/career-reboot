/* GET /api/invite/state?uid=xxx —— 邀请进度（未配置存储时 configured:false）
   满 3 人时返回 share 类型解锁令牌。 */
import { getInviteState } from '../../lib/invite.js';
import { signUnlockToken } from '../../lib/alipay-orders.js';

export const config = { api: { external: true } };

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
  const uid = req.query.uid;
  const state = await getInviteState(uid);
  res.setHeader('Cache-Control', 'no-store');
  if (state.unlocked) {
    const token = signUnlockToken({ outTradeNo: uid, via: 'share' });
    return res.status(200).json({ ...state, token });
  }
  return res.status(200).json(state);
}
