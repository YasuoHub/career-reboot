/* 邀请裂变：服务端进度存储与规则
 *
 * 规则：
 *  - 被邀请人完成测评后上报 1 次，同一 viewer 终身只能给一个邀请人贡献 1 次；
 *  - 邀请人 == 被邀请人 无效；
 *  - 满 3 人由服务端签发 share 类型解锁令牌（前端本地保存）。
 *
 * 说明：为不引入账号体系，viewer 是本机随机 UUID；这能防住重复计数，
 * 但无法像账号体系一样完全防脚本伪造。对 9.9 元产品足够，后续可加登录再收紧。
 */
import { isKvAvailable, kv } from './kv.js';

export const INVITE_NEED = (() => {
  const n = Number(process.env.INVITE_NEED);
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(10, Math.round(n)));
})();
const TTL_SECONDS = 90 * 24 * 60 * 60;
const UID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const ARCH_RE = /^(ei|ii)_(at|in)_(jp|sj)_[12]$/;

export function validUid(v) { return typeof v === 'string' && UID_RE.test(v); }
export function validArchetype(v) { return typeof v === 'string' && ARCH_RE.test(v); }

const progressKey = uid => `crb:invite:set:${uid}`;
const claimedKey = uid => `crb:invite:claimed:${uid}`;

export async function getInviteState(uid) {
  const base = { need: INVITE_NEED, progress: 0, unlocked: false };
  if (!validUid(uid) || !isKvAvailable()) return { ...base, configured: isKvAvailable() };
  try {
    const total = await kv.scard(progressKey(uid));
    const progress = Math.min(INVITE_NEED, total);
    return { configured: true, need: INVITE_NEED, progress, unlocked: progress >= INVITE_NEED };
  } catch (err) {
    console.error('[invite.state]', err.message);
    return { ...base, configured: true, error: 'STORAGE_FAILED' };
  }
}

export async function claimInvite({ ref, viewer, archetype }) {
  if (!isKvAvailable()) return { configured: false, counted: false, reason: 'NOT_CONFIGURED' };
  if (!validUid(ref) || !validUid(viewer) || !validArchetype(archetype)) {
    return { configured: true, counted: false, reason: 'INVALID' };
  }
  if (ref === viewer) return { configured: true, counted: false, reason: 'SELF' };

  try {
    if (await kv.exists(claimedKey(viewer))) {
      return { ...(await getInviteState(ref)), counted: false, reason: 'ALREADY' };
    }
    // 先记录 viewer 已使用，再累加邀请人进度，避免重复计数
    await kv.setex(claimedKey(viewer), TTL_SECONDS, ref);
    await kv.sadd(progressKey(ref), viewer);
    await kv.expire(progressKey(ref), TTL_SECONDS);
    return { ...(await getInviteState(ref)), counted: true };
  } catch (err) {
    console.error('[invite.claim]', err.message);
    return { configured: true, counted: false, reason: 'STORAGE_FAILED' };
  }
}

export default { INVITE_NEED, validUid, validArchetype, getInviteState, claimInvite };
