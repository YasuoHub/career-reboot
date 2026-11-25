/* Upstash Redis REST 适配器（兼容 Vercel KV 环境变量）
 *
 * 用于邀请裂变的跨设备进度存储。未配置时 isKvAvailable() 返回 false，
 * 相关功能在服务端直接降级（返回 @{configured:false}），不影响付费链路。
 *
 * 支持环境变量：
 *   KV_REST_API_URL / KV_REST_API_TOKEN            （Vercel KV / Upstash 集成）
 *   UPSTASH_REDIS_REST_URL / UPSTASH_REDIS_REST_TOKEN
 */
const baseUrl = (process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL || '').trim().replace(/\/+$/, '');
const token = (process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || '').trim();

export function isKvAvailable() {
  return Boolean(baseUrl && token);
}

async function exec(command) {
  if (!isKvAvailable()) throw new Error('KV_NOT_CONFIGURED');
  const r = await fetch(baseUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
  });
  if (!r.ok) throw new Error(`KV_HTTP_${r.status}`);
  const data = await r.json();
  if (data && data.error) throw new Error(`KV_${data.error}`);
  return data ? data.result : null;
}

export const kv = {
  sadd: (key, member) => exec(['SADD', key, member]),
  smembers: async (key) => {
    const v = await exec(['SMEMBERS', key]);
    return Array.isArray(v) ? v : [];
  },
  scard: async (key) => Number(await exec(['SCARD', key])) || 0,
  get: (key) => exec(['GET', key]),
  setex: (key, seconds, value) => exec(['SETEX', key, seconds, value]),
  expire: (key, seconds) => exec(['EXPIRE', key, seconds]),
  exists: async (key) => Number(await exec(['EXISTS', key])) > 0,
};

export default { isKvAvailable, kv };
