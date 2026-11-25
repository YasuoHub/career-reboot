/* /api/ai-summary —— 深度报告的个性化摘要（可选能力）
   POST { archetype, norm, top3:[名称], context }
   → { summary, source:'ai' }；未配置密钥时返回 503，
     前端自动保留本地生成的摘要，不影响报告可用性。

   隐私：只发送人格类型、六维分值与方向名称，不发送姓名、性别、行业、订单等可识别信息。 */
export const config = { api: { external: true } };

const ARCH_RE = /^(ei|ii)_(at|in)_(jp|sj)_[12]$/;
const AXIS_KEYS = ['analytic', 'maker', 'creative', 'social', 'leader', 'stable'];
const ALLOWED_HOSTS = new Set(['www.career-turn.icu', 'career-turn.icu']);

/* 简单防滥用：只接受站内页面的调用，并按实例做基础限流（不追求严格） */
function fromSite(req) {
  const src = req.headers.origin || req.headers.referer || '';
  try {
    const u = new URL(src);
    return (u.protocol === 'https:' || u.protocol === 'http:') && ALLOWED_HOSTS.has(u.host);
  } catch (_) { return false; }
}

const hits = new Map();
function rateLimited(ip) {
  const now = Date.now();
  const slot = Math.floor(now / 60000);
  const key = `${ip}:${slot}`;
  const n = (hits.get(key) || 0) + 1;
  hits.set(key, n);
  if (hits.size > 500) hits.clear();
  return n > 12;
}

function clampText(v, max) {
  return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  if (!fromSite(req)) return res.status(403).json({ error: 'FORBIDDEN_ORIGIN' });
  const ip = String((req.headers['x-forwarded-for'] || '').split(',')[0] || 'unknown').trim();
  if (rateLimited(ip)) return res.status(429).json({ error: 'TOO_MANY_REQUESTS' });

  const apiKey = (process.env.AI_API_KEY || '').trim();
  if (!apiKey) {
    return res.status(503).json({ error: 'NOT_CONFIGURED', message: 'AI 摘要未启用' });
  }

  const body = req.body || {};
  const archetype = String(body.archetype || '');
  if (!ARCH_RE.test(archetype)) return res.status(400).json({ error: 'INVALID_ARCHETYPE' });

  const norm = {};
  for (const k of AXIS_KEYS) {
    const n = Number(body.norm && body.norm[k]);
    if (Number.isFinite(n)) norm[k] = Math.max(0, Math.min(100, Math.round(n)));
  }
  const top3 = Array.isArray(body.top3)
    ? body.top3.slice(0, 3).map(x => clampText(x, 60)).filter(Boolean)
    : [];
  const context = clampText(body.context, 40);

  const payload = { archetype, norm, top3, context };
  const base = (process.env.AI_BASE_URL || 'https://api.openai.com/v1').replace(/\/+$/, '');
  const model = (process.env.AI_MODEL || 'gpt-4o-mini').trim();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const r = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.7,
        max_tokens: 420,
        messages: [
          {
            role: 'system',
            content: [
              '你是一名务实、克制的职业转型教练，为一个性格测评产品写个性化摘要。',
              '要求：',
              '1) 使用第二人称，120–180 个汉字，一段话，不要分点、不要 Markdown。',
              '2) 结合给出的类型、六维分值、首个推荐方向和当前处境，解释“为什么是这个方向”。',
              '3) 给出本周可以立刻做的一次小验证，具体、低成本、可执行。',
              '4) 不夸大、不承诺薪资或就业结果，不做心理诊断，不虚构数据或人物。',
            ].join('\n'),
          },
          {
            role: 'user',
            content: `请根据以下匿名测评数据写摘要：${JSON.stringify(payload)}`,
          },
        ],
      }),
      signal: controller.signal,
    });

    if (!r.ok) {
      const detail = await r.text().catch(() => '');
      console.error('[ai-summary] upstream %s %s', r.status, detail.slice(0, 200));
      return res.status(502).json({ error: 'UPSTREAM_FAILED' });
    }
    const data = await r.json();
    const raw = data?.choices?.[0]?.message?.content;
    const summary = clampText(raw, 600);
    if (!summary) return res.status(502).json({ error: 'EMPTY_SUMMARY' });

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ summary, source: 'ai' });
  } catch (err) {
    console.error('[ai-summary]', err.message);
    return res.status(502).json({ error: 'AI_FAILED' });
  } finally {
    clearTimeout(timer);
  }
}
