/* POST /api/invite/claim —— 被邀请人完成测评后上报一次
   body { ref, viewer, archetype } → { configured, counted, progress, need, unlocked, reason? } */
import { claimInvite } from '../../lib/invite.js';

export const config = { api: { external: true } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  const body = req.body || {};
  const result = await claimInvite({
    ref: body.ref,
    viewer: body.viewer,
    archetype: body.archetype,
  });
  res.setHeader('Cache-Control', 'no-store');
  if (result.reason === 'INVALID') return res.status(400).json(result);
  return res.status(200).json(result);
}
