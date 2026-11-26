/* ============================================================
   主控制器：屏幕切换 / 答题流程 / 打分引擎 / 结果渲染（v3·16型）
   框架依据：
     · 六维归一化 → 四组二值判别(D1×D2×D3×D4) → 16型人格图鉴
     · 硬过滤(学历/健康/收入/形态)+五维软打分→方向行动排序
   ============================================================ */
(() => {
  const $ = s => document.querySelector(s);
  const R = window.RB_DATA;
  const { QUESTIONS, AXES, AXES_MAX, ARCHETYPES, SKILLS, SKILL_AXIS, CLASSIFY_DIM } = R;
  const skillLabel = id => (SKILLS.find(s => s.id === id) || {}).label || id;
  const EDU_LABEL = { 1: '中专/高中', 2: '大专', 3: '本科', 4: '硕士+' };

  /* ---------- 非首屏脚本按需加载 ----------
     首屏只保留题库/原型/主控制器；岗位库、城市库、报告、海报与截图库
     在用户开始答题或进入结果页时再加载，避免拖慢 F1 首屏。 */
  const LAZY_SCRIPTS = {
    cities: './js/cities.js?v=1',
    jobs: './js/jobs.js?v=1',
    report: './js/report.js?v=8',
    poster: './js/poster.js?v=36',
    htmlToImage: './js/vendor/html-to-image.min.js?v=1',
  };
  const scriptLoads = {};
  function loadScript(key) {
    if (scriptLoads[key]) return scriptLoads[key];
    const src = LAZY_SCRIPTS[key];
    if (!src) return Promise.reject(new Error(`未知脚本：${key}`));
    scriptLoads[key] = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src;
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => { delete scriptLoads[key]; reject(new Error(`脚本加载失败：${src}`)); };
      document.head.appendChild(s);
    });
    return scriptLoads[key];
  }
  const ensureData = () => Promise.all([loadScript('cities'), loadScript('jobs')]);
  const ensurePoster = () => (window.RB_Poster ? Promise.resolve() : loadScript('poster'));
  const ensureReport = () => (window.RB_Report ? Promise.resolve() : loadScript('report'));
  const ensureHtmlToImage = () => (window.htmlToImage ? Promise.resolve() : loadScript('htmlToImage'));
  function prefetchLazy() {
    const warm = () => ensureData().catch(() => {});
    const kick = () => {
      if ('requestIdleCallback' in window) requestIdleCallback(warm, { timeout: 2500 });
      else warm();
    };
    setTimeout(kick, 1200);
  }

  const MODE_LABELS = {
    mode_urgent: '刚离职 · 速返优先',
    mode_gap: '长期空窗 · 重回职场',
    mode_in: '在职过渡 · 双线布局',
    mode_blur: '心动未动 · 小步试错',
    mode_fresh: '应届 / 零经验 · 第一份工作',
  };

  /* ---------- Loading ---------- */
  let loaderDone = false;
  function hideLoader() {
    if (loaderDone) return; loaderDone = true;
    const l = document.getElementById('loader'); if (!l) return;
    l.classList.add('done'); setTimeout(() => l.remove(), 500);
  }
  document.addEventListener('DOMContentLoaded', () => setTimeout(hideLoader, 350));
  window.addEventListener('load', () => setTimeout(hideLoader, 200));
  setTimeout(hideLoader, 4000);

  const screens = { cover: $('#sc-cover'), quiz: $('#sc-quiz'), computing: $('#sc-computing'), result: $('#sc-result'), report: $('#sc-report') };

  /* ---------- 支付订单兜底（Cookie + localStorage 双写）
     Safari 从支付宝返回时可能是新标签，无痕模式/存储清理会让 localStorage 为空；
     host-only 的 Lax Cookie 在顶级回跳导航中一定会带上，因此再存一份。 ---------- */
  const ORDER_TTL_MS = 15 * 60 * 1000; // 与支付宝 timeout_express(15m) 对齐
  function readCookie(name) {
    try {
      const raw = document.cookie || '';
      for (const part of raw.split(';')) {
        const i = part.indexOf('=');
        if (i < 0) continue;
        if (part.slice(0, i).trim() !== name) continue;
        return decodeURIComponent(part.slice(i + 1).trim());
      }
    } catch (_) { /* 忽略存储异常 */ }
    return '';
  }
  function writeCookie(name, value, maxAgeSec) {
    try {
      const secure = location.protocol === 'https:' ? '; Secure' : '';
      document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAgeSec}; SameSite=Lax${secure}`;
    } catch (_) { /* 忽略存储异常 */ }
  }
  function deleteCookie(name) {
    try { document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax`; } catch (_) {}
  }

  /* ---------- 状态 ---------- */
  const store = {
    get total() { const v = parseInt(localStorage.getItem('rb_total') || '', 10); return Number.isFinite(v) && v > 0 ? v : null; },
    bumpTotal() { const v = this.total; if (v) localStorage.setItem('rb_total', String(v + 1)); },
    /* 存完整结果，支付回跳/刷新后可恢复并生成深度报告 */
    saveLast(r) { try { localStorage.setItem('rb_last', JSON.stringify(r)); } catch (_) {} },
    getLast() {
      try {
        const r = JSON.parse(localStorage.getItem('rb_last'));
        return r && r.arc && Array.isArray(r.routes) && Array.isArray(r.top3) ? r : null;
      } catch (_) { return null; }
    },
    /* 最近一次下单（用于支付回跳后没有带 out_trade_no 时兜底） */
    saveOrder(o) {
      try { localStorage.setItem('rb_order', JSON.stringify(o)); } catch (_) {}
      if (o && o.outTradeNo) writeCookie('rb_order', `${o.outTradeNo}.${o.ts || Date.now()}`, Math.floor(ORDER_TTL_MS / 1000));
    },
    getOrder() {
      let local = null;
      try {
        const r = JSON.parse(localStorage.getItem('rb_order'));
        if (r && r.outTradeNo) local = r;
      } catch (_) { /* 继续读 Cookie 兜底 */ }
      let cookie = null;
      const c = readCookie('rb_order');
      if (c) {
        const [outTradeNo, ts] = c.split('.');
        if (/^CRB\d{17}$/.test(outTradeNo)) cookie = { outTradeNo, ts: Number(ts) || 0 };
      }
      if (local && cookie) return Number(cookie.ts) >= Number(local.ts || 0) ? cookie : local;
      return local || cookie;
    },
    clearOrderCookie() { deleteCookie('rb_order'); },
    /* 解锁凭证：服务端签发的令牌（含 90 天有效期） */
    saveUnlock(u) { try { localStorage.setItem('rb_unlock', JSON.stringify(u)); } catch (_) {} },
    getUnlock() { try { return JSON.parse(localStorage.getItem('rb_unlock')); } catch (_) { return null; } },
    isUnlocked() {
      const u = this.getUnlock();
      return !!(u && u.token && (!u.exp || u.exp > Date.now()));
    },
    /* v3 清理：旧版原型键名不再兼容，强制清空防 undefined */
    purgeLegacy() { localStorage.removeItem('rb_last'); },
  };
  let answers = {}, result = null;
  const multiDraft = {};
  const cityDraft = {};
  let currentQi = 0;

  let toastTimer;
  function toast(msg) {
    const el = $('#toast'); el.textContent = msg; el.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
  }
  function go(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active'); window.scrollTo(0, 0);
  }

  /* ---------- 价格（以服务端 ALIPAY_PRICE 为准；0 表示免费开放） ---------- */
  let payPrice = null;
  function priceLabel(p) {
    const n = Number(p);
    if (Number.isFinite(n) && n === 0) return '免费';
    return Number.isFinite(n) && n > 0 ? `¥${n.toFixed(2)}` : '¥--';
  }
  async function getPrice() {
    if (payPrice !== null) return payPrice;
    try {
      const r = await fetch('/api/alipay/price', { headers: { Accept: 'application/json' } });
      const d = await r.json();
      const n = Number(d.amount);
      if (r.ok && Number.isFinite(n) && n >= 0) payPrice = n;
    } catch (_) { /* 失败时保留占位；实际支付金额始终以服务端下单结果为准 */ }
    return payPrice;
  }
  function applyPrice(p) {
    if (p === null || p === undefined) return;
    document.querySelectorAll('[data-price]').forEach(el => { el.textContent = priceLabel(p); });
  }
  function refreshPrice() {
    getPrice().then(applyPrice);
  }

  /* ---------- 业务埋点（GTM dataLayer） ---------- */
  function track(name, params = {}) {
    try {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event: name, ...params });
    } catch (_) { /* 统计失败不影响业务 */ }
  }

  /* ---------- 封面 ---------- */
  function initCover() {
    const last = store.getLast(), lastEl = $('#cover-last');
    if (last && ARCHETYPES[last.archetype]) {
      lastEl.hidden = false;
      lastEl.classList.add('clickable');
      $('#cover-last-name').textContent = ARCHETYPES[last.archetype].cn;
    } else { lastEl.hidden = true; }
  }

  /* ---------- 答题 ---------- */
  const dotsEl = $('#progress-dots');
  QUESTIONS.forEach(() => dotsEl.appendChild(document.createElement('li')));

  function answered(q) { const a = answers[q.id]; return Array.isArray(a) ? a.length > 0 : a !== undefined; }

  function goNextQ() { if (currentQi < QUESTIONS.length - 1) { currentQi++; renderQuiz(true); } else finish(); }
  function goPrevQ() { if (currentQi > 0) { currentQi--; renderQuiz(true); } }

  function cityGroupsHtml(selected, term) {
    const { CITIES = [], CITY_REGIONS = [] } = R;
    const t = String(term || '').trim();
    const list = t ? CITIES.filter(c => c.name.includes(t) || (c.label || '').includes(t)) : CITIES;
    if (!list.length) return '<p class="city-empty">没找到这个城市，换个关键词试试</p>';
    const groups = {};
    list.forEach(c => { (groups[c.region] = groups[c.region] || []).push(c); });
    return CITY_REGIONS.filter(r => groups[r] && groups[r].length).map(r => `
      <div class="city-group">
        <p class="city-group-h">${r}</p>
        <div class="city-chips">
          ${groups[r].map(c => `<button class="city-chip${selected.has(c.name) ? ' sel' : ''}" data-city="${c.name}" type="button"><span>${c.name}</span><em>${c.tier}</em></button>`).join('')}
        </div>
      </div>`).join('');
  }

  function renderCityQuestion(q, panel, qi) {
    const draft = cityDraft[q.id] || (cityDraft[q.id] = new Set(answers[q.id] || []));
    panel.innerHTML = `
      <span class="q-tag">${q.tag} · 第 ${qi + 1} 问</span>
      <h2 class="q-text">${q.text}</h2>
      <p class="city-hint">${q.hint || '最多选 5 个城市；也可以选「不限城市」。'}<br /><span class="city-hint-sub">城市列表可上下滑动；切到别的区域继续选。</span></p>
      <div class="city-toolbar">
        <input id="city-search" class="city-search" type="search" placeholder="搜索城市，如 成都、佛山、义乌" autocomplete="off" />
        <button id="city-unlimited" class="city-unlimited${draft.has('不限城市') ? ' sel' : ''}" type="button">不限城市</button>
      </div>
      <div class="city-selected" id="city-selected"></div>
      <div class="city-groups" id="city-groups">${cityGroupsHtml(draft, '')}</div>
      <div class="confirm-row"><button id="btn-city" class="btn btn-primary">确认城市（已选 ${draft.size}）</button></div>
      ${qi > 0 ? '<button id="btn-prev-q" class="btn btn-ghost btn-prev">← 上一题</button>' : ''}`;

    const selEl = panel.querySelector('#city-selected');
    const groupsEl = panel.querySelector('#city-groups');
    const btn = panel.querySelector('#btn-city');
    const unlimited = panel.querySelector('#city-unlimited');
    const search = panel.querySelector('#city-search');

    const renderSelected = () => {
      const names = [...draft];
      selEl.innerHTML = names.length
        ? `<span class="city-selected-h">已选 ${names.length} 个：</span>${names.map(n => `<button class="city-pill" data-remove="${n}" type="button">${n}<i>×</i></button>`).join('')}`
        : '<span class="city-selected-empty">还没选城市；选 1–5 个，推荐会带上本地行业和薪资差异。</span>';
      btn.textContent = `确认城市（已选 ${draft.size}）`;
    };
    const refreshGroups = () => {
      const keep = groupsEl.scrollTop;
      groupsEl.innerHTML = cityGroupsHtml(draft, search.value);
      groupsEl.scrollTop = keep;
    };
    const toggle = name => {
      if (name === '不限城市') {
        draft.clear(); draft.add('不限城市');
      } else {
        draft.delete('不限城市');
        if (draft.has(name)) draft.delete(name);
        else if (draft.size >= 5) { toast('最多选 5 个城市'); return; }
        else draft.add(name);
      }
      renderSelected();
      refreshGroups();
      unlimited.classList.toggle('sel', draft.has('不限城市'));
    };

    search.addEventListener('input', () => { groupsEl.scrollTop = 0; refreshGroups(); });
    groupsEl.addEventListener('click', e => {
      const b = e.target.closest('.city-chip'); if (!b) return;
      toggle(b.dataset.city);
    });
    selEl.addEventListener('click', e => {
      const b = e.target.closest('[data-remove]'); if (!b) return;
      draft.delete(b.dataset.remove);
      renderSelected(); refreshGroups();
      unlimited.classList.toggle('sel', draft.has('不限城市'));
    });
    unlimited.addEventListener('click', () => toggle('不限城市'));
    btn.addEventListener('click', () => {
      if (!draft.size) { toast('至少选 1 个城市，或选「不限城市」'); return; }
      answers[q.id] = [...draft];
      delete cityDraft[q.id];
      store.bumpTotal();
      goNextQ();
    });
    const prev = panel.querySelector('#btn-prev-q');
    if (prev) prev.addEventListener('click', goPrevQ);
    renderSelected();
  }

  function renderQuiz(animate = true) {
    if (currentQi >= QUESTIONS.length) { finish(); return; }
    const q = QUESTIONS[currentQi];
    const panel = $('#q-panel');
    if (!animate) panel.style.animation = 'none';
    [...dotsEl.children].forEach((d, i) => {
      d.className = (i < currentQi || (i === currentQi && answered(QUESTIONS[i]))) ? 'done' : (i === currentQi ? 'now' : '');
    });
    $('#quiz-stage').textContent = `第 ${currentQi + 1} / ${QUESTIONS.length} 弹`;

    if (q.city) { renderCityQuestion(q, panel, currentQi); return; }

    const letters = 'ABCDEFGHIJKLMNO';
    if (q.multi) {
      const draft = multiDraft[q.id] || (multiDraft[q.id] = new Set(answers[q.id] || []));
      const selArr = [...draft];
      panel.innerHTML = `
        <span class="q-tag">${q.tag} · 第 ${currentQi + 1} 问</span>
        <h2 class="q-text">${q.text}</h2>
        <div class="multi-opts">
          ${q.opts.map((o, i) => `<button class="opt opt-chip${selArr.includes(i) ? ' sel' : ''}" data-i="${i}"><span class="opt-mark">${selArr.includes(i) ? '✓' : ''}</span><span>${o.t}</span></button>`).join('')}
        </div>
        <div class="confirm-row"><button id="btn-multi" class="btn btn-primary">确认本题（已选 ${draft.size}）</button></div>
        ${currentQi > 0 ? '<button id="btn-prev-q" class="btn btn-ghost btn-prev">← 上一题</button>' : ''}`;
      panel.querySelectorAll('.opt-chip').forEach(btn =>
        btn.addEventListener('click', () => {
          const idx = +btn.dataset.i;
          draft.has(idx) ? draft.delete(idx) : draft.add(idx);
          btn.classList.toggle('sel', draft.has(idx));
          btn.querySelector('.opt-mark').textContent = draft.has(idx) ? '✓' : '';
          $('#btn-multi').textContent = `确认本题（已选 ${draft.size}）`;
        }));
      $('#btn-multi').addEventListener('click', () => {
        if (!draft.size) { toast('至少勾一项，不然没法给你校准'); return; }
        answers[q.id] = [...draft]; delete multiDraft[q.id]; store.bumpTotal(); goNextQ();
      });
    } else {
      const selIdx = answers[q.id];
      panel.innerHTML = `
        <span class="q-tag">${q.tag} · 第 ${currentQi + 1} 问</span>
        <h2 class="q-text">${q.text}</h2>
        <div class="q-opts">
          ${q.opts.map((o, i) => `<button class="opt${selIdx === i ? ' sel' : ''}" data-i="${i}"><span class="opt-mark">${letters[i]}</span><span>${o.t}</span></button>`).join('')}
        </div>
        ${currentQi > 0 ? '<button id="btn-prev-q" class="btn btn-ghost btn-prev">← 上一题</button>' : ''}`;
      panel.querySelectorAll('.opt').forEach(btn =>
        btn.addEventListener('click', () => {
          // 先给选中反馈：只点亮当前项，其余变淡
          panel.querySelectorAll('.opt').forEach(b => { b.classList.remove('sel'); b.style.opacity = '.35'; });
          btn.classList.add('sel'); btn.style.opacity = '1';
          answers[q.id] = +btn.dataset.i; store.bumpTotal();
          setTimeout(() => goNextQ(), 320);
        }));
    }
    const prevBtn = panel.querySelector('#btn-prev-q');
    if (prevBtn) prevBtn.addEventListener('click', goPrevQ);
  }

  /* ---------- 16 型分类器 ---------- */
  function classify(norm) {
    // D1 外向/内向
    const ext = CLASSIFY_DIM.D1_ext(norm);
    // D2 分析/直觉
    const intui = CLASSIFY_DIM.D2_intu(norm);
    // D3 驱动/支撑
    const drv = CLASSIFY_DIM.D3_drv(norm);
    // D4 守序/灵活
    const orch = CLASSIFY_DIM.D4_orch(norm);
    // 组合映射
    const e = ext ? 'e' : 'i';
    const c2 = intui ? 'in' : 'at';       // creative≥analytic→in(直觉), 否则 at(分析+直觉)
    const c3 = drv ? 'jp' : 'sj';         // leader最高→jp(驱动), 否则 sj(支撑)
    const c4 = orch ? '1' : '2';          // stable≥55→1(守序), 否则2(灵活)
    return `${ext ? 'ei' : 'ii'}_${intui ? 'in' : 'at'}_${drv ? 'jp' : 'sj'}_${orch ? '1' : '2'}`;          // 如 ei_at_jp_1
  }

  /* ---------- 打分引擎 ---------- */
  function score() {
    const dims = {}, profile = {
      modes: [], risk: 0, floor: 0, hours: 1,
      ageBand: 2, eduRank: 2, industry: '其他', health: 2,
      skills: [], pref: '坐班', cities: [], cityTier: '不限', cityNames: [], gender: '',
      stage: '', capital: 0, selfBiz: false,
    };
    QUESTIONS.forEach(q => {
      if (q.city) { const arr = answers[q.id]; profile.cities = Array.isArray(arr) ? arr.slice() : []; return; }
      if (q.multi) { (answers[q.id] || []).forEach(i => { const o = q.opts[i]; if (o && o.add && o.add.sk && !profile.skills.includes(o.add.sk)) profile.skills.push(o.add.sk); }); return; }
      const o = q.opts[answers[q.id]]; if (!o) return;
      if (o.m) profile.modes.push(...o.m);
      if (o.add) {
        if (o.add.dims) Object.entries(o.add.dims).forEach(([k, v]) => (dims[k] = (dims[k] || 0) + v));
        if (typeof o.add.risk === 'number') profile.risk += o.add.risk;
        if (typeof o.add.floor === 'number') profile.floor = o.add.floor;
        if (typeof o.add.hours === 'number') profile.hours = o.add.hours;
        if (typeof o.add.ageBand === 'number') profile.ageBand = o.add.ageBand;
        if (typeof o.add.eduRank === 'number') profile.eduRank = o.add.eduRank;
        if (o.add.industry) profile.industry = o.add.industry;
        if (typeof o.add.health === 'number') profile.health = o.add.health;
        if (o.add.pref) profile.pref = o.add.pref;
        if (o.add.gender) profile.gender = o.add.gender;
        if (o.add.stage) profile.stage = o.add.stage;
        if (typeof o.add.capital === 'number') profile.capital = o.add.capital;
        if (typeof o.add.selfBiz === 'boolean') profile.selfBiz = o.add.selfBiz;
      }
    });

    const { JOBS = [], CITIES = [], CITY_TIER_RANK = {}, CITY_TIER_SALARY = {} } = R;

    const selectedCities = (profile.cities || [])
      .filter(n => n !== '不限城市')
      .map(n => CITIES.find(c => c.name === n)).filter(Boolean);
    profile.cityNames = selectedCities.length
      ? selectedCities.map(c => c.name)
      : ((profile.cities || []).includes('不限城市') ? ['不限城市'] : []);
    const topTier = selectedCities.slice().sort((a, b) => (CITY_TIER_RANK[b.tier] || 1) - (CITY_TIER_RANK[a.tier] || 1))[0];
    profile.cityTier = topTier ? topTier.tier : '不限';

    // ---- 六维归一化 ----
    const norm = {};
    AXES.forEach(a => { norm[a.key] = Math.round(((dims[a.key] || 0) / AXES_MAX[a.key]) * 100); });

    // ---- 16 型分类 ----
    const archetypeId = classify(norm);
    const arc = ARCHETYPES[archetypeId] || ARCHETYPES['ii_at_sj_2']; // 防御：未知时兜底

    const freshLike = profile.stage === 'fresh' || profile.industry === '无经验';
    const chips = [
      { name: '试错胆量', pct: Math.max(45, Math.min(95, 50 + profile.risk * 11)) },
      { name: '转型续航', pct: profile.hours === 0 ? 92 : profile.hours === 1 ? 76 : 60 },
      { name: '重启紧迫度', pct: ({ mode_urgent: 88, mode_gap: 68, mode_in: 40, mode_blur: 55, mode_fresh: 72 })[profile.modes[0]] ?? 50 },
    ];

    // ---- 硬过滤：学历 / 健康；收入与形态改为软惩罚，保证三维度都有候选 ----
    const pool = JOBS.filter(c => (c.arcs[archetypeId] || 0) > 0);
    const passEdu = c => profile.eduRank >= c.req.edu;
    const passHealth = c => !((profile.health >= 3 && c.req.phys) || (profile.health === 4 && c.req.pat === '倒班'));
    let cand = pool.filter(c => passEdu(c) && passHealth(c));
    if (cand.length < 3) cand = pool.filter(passHealth);
    if (cand.length < 3) cand = pool.slice();

    const userVec = {}; AXES.forEach(a => userVec[a.key] = norm[a.key]);
    const cosSim = (v1, v2) => { let dot = 0, n1 = 0, n2 = 0; for (const k in v1) { dot += v1[k] * (v2[k] || 0); n1 += v1[k] ** 2; n2 += (v2[k] || 0) ** 2; } return n1 && n2 ? dot / (Math.sqrt(n1) * Math.sqrt(n2)) : 0; };
    const hitN = cs => profile.skills.filter(s => cs.includes(s)).length;

    const resolveL4 = c => {
      let bestCity = null, bestScore = -1;
      selectedCities.forEach(ct => {
        const match = (c.tr || []).reduce((m, [ind, w]) => m + ((ct.industries || []).includes(ind) ? w : 0), 0);
        const s = match * 12 + (CITY_TIER_RANK[ct.tier] || 1) * 2;
        if (s > bestScore) { bestScore = s; bestCity = ct; }
      });
      const tier = bestCity ? bestCity.tier : '新一线';
      const rank = CITY_TIER_RANK[tier] || 3;
      const mult = CITY_TIER_SALARY[tier] || 0.95;
      const org = c.orgs[rank >= 3 ? 0 : rank === 2 ? 1 : 2] || c.orgs[0] || '本地企业';
      const cityLabel = bestCity
        ? `${bestCity.name}${profile.cityNames.length > 1 ? ' 优先' : ''}`
        : '全国机会';
      const lo = Math.max(1, Math.round(c.salRange[0] * mult * 2) / 2);
      const hi = Math.max(lo + 1, Math.round(c.salRange[1] * mult * 2) / 2);
      return { bestCity, tier, rank, mult, org, cityLabel, salRange: [lo, hi], salText: `${lo}–${hi}k`, title: `${cityLabel} · ${org} · ${c.name}` };
    };

    const cityFitOf = c => {
      if (!selectedCities.length) return 55;
      let best = 0;
      selectedCities.forEach(ct => {
        const match = (c.tr || []).reduce((m, [ind, w]) => m + ((ct.industries || []).includes(ind) ? w : 0), 0);
        const s = 38 + Math.min(45, match * 24) + (CITY_TIER_RANK[ct.tier] || 1) * 3;
        if (s > best) best = s;
      });
      return Math.min(100, Math.round(best));
    };

    const scored = cand.map(c => {
      const cs = c.skills || [];
      const hitList = cs.filter(s => profile.skills.includes(s));
      const f1 = !cs.length ? 50 : (profile.skills.length
        ? Math.round(hitN(cs) / (new Set([...cs, ...profile.skills])).size * 100)
        : 40);
      const t = (c.tr || []).find(([ind]) => ind === profile.industry);
      const f2 = freshLike ? 50 : Math.round((t ? t[1] : 0.35) * 100);
      const cv = {}; cs.forEach(s => { const ax = SKILL_AXIS[s]; if (ax) Object.entries(ax).forEach(([k, v]) => (cv[k] = (cv[k] || 0) + v)); });
      const f3 = Math.round(cosSim(userVec, cv) * 100);
      let f4 = Math.log(1 + c.mkt.g) / Math.log(61) * 60;
      if (c.mkt.c < 20) f4 += 20; if (c.mkt.c > 150) f4 -= 25; if (c.mkt.shortage) f4 += 10;
      f4 = Math.round(Math.max(0, Math.min(90, f4)) / 90 * 100);
      const weeks = 4 + (cs.length - hitN(cs)) * 5 + Math.max(0, c.req.edu - profile.eduRank) * 6;
      const cap = profile.hours === 0 ? 95 : profile.hours === 1 ? 72 : 45;
      const f5 = Math.round(cap * Math.exp(-weeks / 18));
      const cityFit = cityFitOf(c);
      const arcFit = Math.min(100, Math.round((c.arcs[archetypeId] || 0) * 10));
      const base = Math.round(f1 * .26 + f2 * .16 + f3 * .14 + f4 * .18 + f5 * .10 + cityFit * .08 + arcFit * .08);
      const l4 = resolveL4(c);
      const salLo = l4.salRange[0], salHi = l4.salRange[1];
      const floorK = profile.floor / 1000;
      const underFloor = profile.floor > 0 && salLo < floorK;
      const capGap = (profile.selfBiz && c.self && c.cap) ? Math.max(0, c.cap - profile.capital) : 0;
      let patternPenalty = 0;
      if (profile.pref === '坐班' && c.req.pat === '倒班') patternPenalty -= 8;
      if (profile.pref === '弹性' && c.req.pat === '倒班') patternPenalty -= 4;
      if (profile.pref === '倒班') patternPenalty += 2;
      let agePenalty = 0;
      if (profile.ageBand >= 4 && (c.req.phys || c.req.pat === '倒班')) agePenalty -= 4;
      if (profile.ageBand >= 5 && c.req.phys) agePenalty -= 4;

      const steady = Math.round(base * .50 + c.tracks.steady * 10 * .25
        + (c.entry ? 3 : 0) + (c.mkt.shortage ? 4 : 0)
        + (c.req.pat === profile.pref ? 3 : 0)
        + (underFloor ? -6 : 2) + patternPenalty + agePenalty);
      const growth = Math.round(base * .42 + c.tracks.growth * 10 * .30
        + f2 * .10 + f5 * .08 + (c.mkt.g >= 25 ? 3 : 0)
        + (c.promote ? 3 : 0) + patternPenalty + agePenalty);
      const ceiling = Math.round(base * .38 + c.tracks.ceiling * 10 * .32
        + Math.min(10, salHi / 2.5) * 10 * .20 + (c.self ? 4 : 0)
        + (c.mkt.g >= 25 ? 2 : 0) + (underFloor ? 0 : 1)
        + (l4.rank >= 3 ? 1 : 0) - capGap * 6 + patternPenalty + agePenalty);

      return {
        ...c,
        _base: base,
        _dim: { steady, growth, ceiling },
        metrics: { f1, f2, f3, f4, f5, cityFit, arcFit, base, weeks, underFloor, salLo, salHi, hitList, l4, capGap, patternPenalty },
        l4Title: l4.title, cityLabel: l4.cityLabel, org: l4.org,
        salRange: l4.salRange, sal: l4.salText,
        scoreNum: Math.max(0, Math.min(100, base)),
        fb: { 技能重合: f1, 行业迁移: f2, 性格延续: f3, 市场时机: f4, 投入可行: f5, 城市匹配: cityFit, 原型契合: arcFit },
        gapSkills: cs.filter(s => !profile.skills.includes(s)),
        alternatives: [],
      };
    }).sort((a, b) => b._base - a._base);

    const buildRoute = (c, def) => {
      const m = c.metrics;
      const reasons = [];
      if (def.key === 'steady') reasons.push(`门槛 ${EDU_LABEL[c.req.edu] || ''}、${c.req.pat}，约 ${m.weeks} 周能上手，适合先站稳`);
      if (def.key === 'growth') reasons.push(`往上可走到「${c.promote}」，技能会越做越值钱`);
      if (def.key === 'ceiling') reasons.push(`上限约 ${m.salHi}k${c.self ? `，也能自己干（${c.selfBiz}）` : ''}`);
      if (m.hitList.length) reasons.push(`你勾的「${m.hitList.map(skillLabel).join('、')}」能直接用上`);
      if (m.arcFit >= 70) reasons.push(`这个岗位和你的「${arc.cn}」画像贴合度较高`);
      if (!freshLike && m.f2 >= 50) reasons.push(`你之前的「${profile.industry}」经历可以迁移`);
      if (m.cityFit >= 68) {
        const localLabel = m.l4.bestCity && m.l4.bestCity.label ? m.l4.bestCity.label : '本地产业';
        const bestName = m.l4.bestCity ? m.l4.bestCity.name : profile.cityNames[0];
        reasons.push(`你选的「${bestName}」里，${localLabel}更集中，这类岗位更好找`);
      }
      if (c.mkt.shortage) reasons.push('这个岗位目前偏缺工，入行窗口比红海岗位大');
      else if (c.mkt.g >= 25) reasons.push(`行业还在增长（约 ${c.mkt.g}%），不是夕阳岗`);
      if (m.underFloor) reasons.push(`本地起薪 ${m.salLo}k 低于你的收入底线，适合当过渡或跳板`);
      else if (profile.floor > 0) reasons.push(`本地起薪 ${m.salLo}k，覆盖你设的收入底线`);
      const uniq = [...new Set(reasons)].slice(0, 3);

      let caveat = '';
      if (m.capGap > 0) caveat = `自营启动资金约需 ${c.cap} 档，你目前预算还差一截；先打工学流程更稳。`;
      else if (m.patternPenalty < 0) caveat = `这个岗位和你偏好的「${profile.pref}」不完全一致，入职前先确认班次。`;
      else if (m.underFloor) caveat = `收入低于你的底线，建议只作为过渡，不要长期停留。`;

      c.routeKey = def.key; c.routeLabel = def.label; c.routeSub = def.sub; c.routeIcon = def.icon;
      c.reasons = uniq; c.caveat = caveat;
      const range = dimRange[def.key];
      const pct = range.max === range.min ? 1 : (c._dim[def.key] - range.min) / (range.max - range.min);
      c.scoreNum = Math.round(30 + pct * 60);
      return { key: def.key, label: def.label, sub: def.sub, icon: def.icon, job: c, reasons: uniq, caveat };
    };

    const dimRange = {};
    ['steady', 'growth', 'ceiling'].forEach(k => {
      const vals = scored.map(x => x._dim[k]);
      dimRange[k] = { min: Math.min(...vals), max: Math.max(...vals) };
    });

    const dimDefs = [
      { key: 'steady', label: '稳健路线', sub: '先站稳，现金流为正', icon: '🛡' },
      { key: 'growth', label: '成长路线', sub: '能积累，越做越值钱', icon: '📈' },
      { key: 'ceiling', label: '上限路线', sub: '看天花板，高薪或自营', icon: '🚀' },
    ];
    const usedIds = new Set(), usedL2 = new Set();
    const routes = dimDefs.map(def => {
      const ordered = [...scored].sort((a, b) => b._dim[def.key] - a._dim[def.key]);
      const pick = ordered.find(c => !usedIds.has(c.id) && !usedL2.has(c.l2))
        || ordered.find(c => !usedIds.has(c.id))
        || ordered[0];
      usedIds.add(pick.id); usedL2.add(pick.l2);
      return buildRoute(pick, def);
    });
    routes.forEach(r => {
      r.job.alternatives = scored
        .filter(x => x.l2 === r.job.l2 && x.id !== r.job.id)
        .slice(0, 3)
        .map(x => ({ name: x.name, sal: x.sal }));
    });

    const notes = [];
    if (freshLike) notes.push('先选能快速上手的入口');
    else if (profile.stage === 'gap') notes.push('空窗期用学习或作品补叙事');
    if (profile.risk <= -1) notes.push('低风险路线优先'); else if (profile.floor >= 18000) notes.push('收入硬线优先于兴趣');
    if (selectedCities.length) notes.push(`按 ${profile.cityNames.slice(0, 2).join('/')} 的薪资与产业修正`);

    return {
      archetype: archetypeId, arc, dims, norm, chips,
      context: (MODE_LABELS[profile.modes[0]] || '') + (notes.length ? ' · ' + notes.join(' · ') : ''),
      gender: profile.gender, profile, routes, top3: routes.map(r => r.job), ts: Date.now(),
    };
  }

  /* ---------- 分析屏 ---------- */
  let computingTimer;
  function finish() {
    result = score(); purgeDrafts();
    if (!result || !result.arc) { console.error(new Error('SCORING_RESULT_EMPTY')); toast('分析出了点状况，返回重来一次吧'); go('cover'); return; }
    track('quiz_complete', { archetype: result.archetype });
    go('computing');
    const lines = [['正在读取你的作答指纹<b>…</b>', 0], ['比对 <b>六维</b> 职业倾向与权重<b>…</b>', 500], ['校验个人要素与约束<b>…</b>', 1100], ['为你校准方向<b>…</b>', 1700]];
    const ul = $('#compute-lines'); ul.innerHTML = '';
    lines.forEach(([html]) => { const li = document.createElement('li'); li.innerHTML = html; ul.appendChild(li); });
    [...ul.children].forEach((li, i) => setTimeout(() => li.classList.add('show'), i * 550));
    clearTimeout(computingTimer); computingTimer = setTimeout(() => renderResult(), 1900);
  }

  /* ---------- 结果页 ---------- */
  function bindAvatar() {
    const img = document.querySelector('.arc-avatar');
    if (!img || !img.parentElement) return;
    const wrap = img.parentElement;
    const ok = () => wrap.classList.add('loaded');
    if (img.complete && img.naturalWidth > 0) ok();
    else {
      img.addEventListener('load', ok, { once: true });
      img.addEventListener('error', () => wrap.classList.add('error'), { once: true });
    }
  }

  /* 深度报告卡片：默认只露一半，展开后出现解锁按钮 */
  function bindTeaser() {
    const card = document.getElementById('report-teaser');
    const expandBtn = document.getElementById('teaser-expand');
    const unlockBtn = document.getElementById('btn-unlock');
    if (!card || !expandBtn || !unlockBtn) return;

    const body = card.querySelector('.teaser-body');
    let expanded = false;
    const expand = () => {
      if (expanded) return;
      expanded = true;
      track('report_teaser_expand');
      const target = body ? body.scrollHeight + 42 : 560;
      card.classList.remove('is-collapsed');
      card.classList.add('is-expanded');
      card.style.maxHeight = `${Math.min(target, 960)}px`;
      card.setAttribute('aria-expanded', 'true');
      expandBtn.setAttribute('aria-expanded', 'true');
      expandBtn.classList.add('gone');
      unlockBtn.classList.remove('is-hidden');
      unlockBtn.classList.add('reveal');
      setTimeout(() => { card.style.maxHeight = 'none'; }, 520);
      setTimeout(() => unlockBtn.classList.remove('reveal'), 700);
      // 展开后把解锁按钮带入视野，避免被新增内容推到屏幕外
      setTimeout(() => {
        if (!unlockBtn.isConnected) return;
        const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        unlockBtn.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
      }, 360);
    };

    expandBtn.addEventListener('click', e => { e.stopPropagation(); expand(); });
    card.addEventListener('click', expand);
    card.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); expand(); }
    });
  }

  /* 邀请裂变已下线：付费报告只通过购买或订单号恢复，不再有“邀请免费解锁”。 */

  function renderResult() {
    if (!result || !result.arc) { go('cover'); toast('结果没接住，请重测一次'); return; }
    const r = result, arc = r.arc, colors = arc.colors;
    document.documentElement.style.setProperty('--accent', colors.accent);
    document.documentElement.style.setProperty('--deep', colors.deep);
    document.documentElement.style.setProperty('--glow', colors.glow);
    store.saveLast(r);
    const avatarFile = arc.avatarF.replace(/-f\.webp$/, r.gender === '男' ? '-m.webp' : '-f.webp');
    const unlocked = store.isUnlocked();
    track('result_view', { archetype: r.archetype, top1: (r.routes && r.routes[0] && r.routes[0].job.name) || '' });

    $('#res-body').innerHTML = `
      <p class="res-context">为「${r.context}」的你校准</p>
      <div class="res-hero" data-num="${arc.num}">
        <div class="res-hero-text">
          <p class="res-badge">Reboot Personality 图鉴 №${arc.num}</p>
          <p class="res-en">${arc.en}</p>
          <h2 class="res-name">${arc.cn}</h2>
          <p class="res-slogan">${arc.slogan}</p>
        </div>
        <div class="arc-avatar-wrap">
          <span class="arc-avatar-skel" aria-hidden="true"></span>
          <img class="arc-avatar" src="/avatars/${avatarFile}" alt="${arc.cn}" width="147" height="184" loading="eager" decoding="async" />
        </div>
      </div>
      <p class="rarity-chip"><span class="pip"></span>和你相似的人不少，你不是一个人</p>

      <div class="panel">
        <div class="panel-h"><h3>重启指数</h3><span>REBOOT INDEX</span></div>
        <div class="metric-row">${r.chips.map(c => `<div class="metric"><b>${c.pct}</b><small>${c.name}</small></div>`).join('')}</div>
      </div>

      <div class="panel">
        <div class="panel-h"><h3>六维画像</h3><span>RADAR PROFILE</span></div>
        <div class="radar-wrap"><canvas id="radar-canvas"></canvas></div>
      </div>

      <div class="panel">
        <div class="panel-h"><h3>三条路线</h3><span>WHY THESE THREE</span></div>
        <p class="route-lead">不是按分数取前三，而是分别回答三个问题：先站稳、能积累、看上限。每张卡都写清为什么给你。</p>
        ${r.routes.map(route => {
          const c = route.job;
          const badges = c.badges || [];
          const dots = Math.max(0, Math.min(5, Math.round((c.scoreNum || 0) / 20)));
          return `
          <div class="career-card route-card route-${route.key}">
            <div class="career-top route-head">
              <span class="route-badge"><i>${route.icon}</i>${route.label}</span>
              <span class="career-badges">${badges.includes('S') ? '<i class="badge-official s">国家新职业</i>' : ''}${badges.includes('L') ? '<i class="badge-official l">绿色职业</i>' : ''}</span>
              <span class="career-sal">${c.sal}/月</span>
            </div>
            <h3 class="career-name route-name">${c.l4Title}</h3>
            <p class="route-sub">${route.sub}</p>
            <p class="route-taxonomy">行业：${c.l2} · ${c.l1Name}</p>
            <p class="career-fit">${c.routeLabel.replace('路线', '指数')} <b>${c.scoreNum}</b><span class="dim-dots">${'●'.repeat(dots)}${'○'.repeat(5 - dots)}</span><small>${c.req.pat} · ${c.cityLabel}</small></p>
            <div class="route-why">
              <b>为什么推荐给你</b>
              <ul>${route.reasons.map(x => `<li>${x}</li>`).join('')}</ul>
            </div>
            <p class="route-tasks"><em>日常核心：</em>${(c.tasks || []).slice(0, 4).join(' · ')}</p>
            <div class="action-paths">
              <div class="action-path"><b>🏢 求职路径</b>${c.J}</div>
              <div class="action-path"><b>🌱 自由事业</b>${c.F}</div>
              <div class="action-path"><b>📚 学习路线</b>${c.learn}</div>
            </div>
            <div class="tags">${(c.tags || []).map(t => `<span class="tag">#${t}</span>`).join('')}</div>
            ${c.gapSkills.length ? `<p class="career-gap">补上这几块就能平移过去：<b>${c.gapSkills.map(skillLabel).join('、')}</b></p>` : `<p class="career-gap done">关键手艺你已经齐了，直接上。</p>`}
            ${route.caveat ? `<p class="route-caveat">注意：${route.caveat}</p>` : ''}
            <p class="career-week"><em>本周就能做：</em>${c.week1}</p>
            ${c.alternatives && c.alternatives.length ? `<p class="route-alt">相似岗位：${c.alternatives.map(a => `<span>${a.name}<em>${a.sal}</em></span>`).join('')}</p>` : ''}
          </div>`;
        }).join('')}
      </div>

      ${unlocked ? '' : `
      <div class="teaser-wrap" id="teaser-wrap">
        <section class="report-teaser is-collapsed" id="report-teaser" role="button" tabindex="0" aria-expanded="false" aria-label="展开查看完整深度报告内容">
          <div class="teaser-body">
            <div class="teaser-h"><span>深度报告</span><em>DEEP REPORT</em></div>
            <h3>找准了方向，距离成功就只差一份深度报告。</h3>
            <ul class="teaser-list">
              <li><b>你是谁</b>三段式人格解读 + 六维逐项拆解，解释你为什么会这样选。</li>
              <li><b>往哪走</b>三条路线（稳健 / 成长 / 上限）的 12 周落地路线，按你每周能投入的时间安排节奏。</li>
              <li><b>怎么讲</b>经历改写示例 + 面试高频问题，把你的经历讲成优势。</li>
              <li><b>先做什么</b>本周 / 本月 / 下月三件事，不用再自己找第一步。</li>
            </ul>
            <p class="teaser-note">解锁深度报告：<b data-price>${priceLabel(payPrice)}</b>，解锁后 1 年内可回看；基于你的 17 道作答组合生成，作答默认存本机。</p>
          </div>
        </section>
        <button class="teaser-expand" id="teaser-expand" type="button" aria-controls="report-teaser" aria-expanded="false">
          <span>展开看完整报告内容</span><i aria-hidden="true">↓</i>
        </button>
      </div>`}

      <div class="res-ctas">
        <button id="btn-unlock" class="btn-unlock${unlocked ? ' is-owned' : ' is-hidden'}" type="button">
          <span class="unlock-main">${unlocked ? '查看深度报告' : `解锁深度报告 <b data-price>${priceLabel(payPrice)}</b>`}</span>
          <span class="unlock-sub">${unlocked ? '已解锁 · 1 年内可回看' : '人格深读 · 12 周路线 · 简历与面试话术'}</span>
          ${unlocked ? '' : '<i class="unlock-spark" aria-hidden="true">✦</i>'}
        </button>
        <div class="cta-row">
          <button id="btn-poster" class="btn btn-primary">生成分享海报</button>
          <button id="btn-redo" class="btn btn-ghost">再测一次</button>
        </div>
      </div>
      <p class="res-guide"><a href="/guide/">先看看岗位与城市图鉴 →</a></p>
      <p class="res-restore"><a href="/restore.html">已购买？凭订单号恢复 →</a></p>
      <p class="res-legal">本测试为趣味性格探索，不构成医疗、心理诊断或就业承诺。<br />作答与报告默认保存在本机；仅在你使用 AI 摘要时发送匿名画像。薪资与供需为公开报告量级参考。<br /><a href="/legal.html#terms" target="_blank" rel="noopener">用户协议</a> · <a href="/legal.html#privacy" target="_blank" rel="noopener">隐私政策</a></p>
    `;

    $('#btn-poster').addEventListener('click', openPoster);
    $('#btn-unlock').addEventListener('click', () => { if (store.isUnlocked()) openReport(); else openUnlock(); });
    $('#btn-redo').addEventListener('click', restart);
    bindTeaser();
    go('result');
    bindAvatar();
    refreshPrice();
    ensurePoster().then(() => {
      RB_Poster.confetti(colors.accent);
      requestAnimationFrame(() => RB_Poster.drawRadar($('#radar-canvas'), AXES.map(a => ({ val: r.norm[a.key], label: a.label })), colors.accent));
    }).catch(() => {});
  }

  /* ---------- 海报 ---------- */
  function lockScroll() { document.documentElement.classList.add('lock'); document.body.classList.add('lock'); }
  function unlockScroll() { document.documentElement.classList.remove('lock'); document.body.classList.remove('lock'); }
  function closeModal() { $('#poster-modal').classList.add('hidden'); unlockScroll(); }
  async function openPoster() {
    try {
      await ensurePoster();
      const url = await RB_Poster.buildShare(result);
      imageKind = 'poster';
      const tEl = $('#toast'); tEl.classList.remove('show'); clearTimeout(toastTimer);
      $('#poster-img').src = url; $('#link-copy').textContent = location.href.split('#')[0];
      const hint = document.querySelector('#poster-modal .modal-hint');
      if (hint) hint.innerHTML = '点「保存到相册」或<b>长按图片</b>均可存到手机';
      $('#poster-modal').classList.remove('mode-report');
      lockScroll(); $('#poster-modal').classList.remove('hidden');
      track('poster_open');
    } catch (e) { console.error(e); toast('海报生成失败，刷新后重试'); }
  }
  async function saveImage() {
    const dataUrl = $('#poster-img').src; if (!dataUrl.startsWith('data:image')) { toast('海报还没生成好'); return; }
    track('image_save', { kind: imageKind });
    let blob; try { blob = await (await fetch(dataUrl)).blob(); } catch (_) { toast('图片读取失败，长按图片保存试试'); return; }
    const name = imageKind === 'report-full' ? '重启人格图鉴-深度报告.png'
      : imageKind === 'report-card' ? '重启人格图鉴-报告摘要.png'
      : '重启人格图鉴.png';
    const file = new File([blob], name, { type: 'image/png' });
    try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: name.replace('.png', '') }); return; } } catch (_) {}
    if (window.showSaveFilePicker) { try { const h = await window.showSaveFilePicker({ suggestedName: file.name }); const w = await h.createWritable(); await w.write(file); await w.close(); return; } catch (_) {} }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000); toast('已开始下载；若没进相册，长按上方图片保存');
  }

  /* ---------- 深度报告解锁（支付宝手机网站支付） ---------- */
  function isWeChat() { return /MicroMessenger/i.test(navigator.userAgent); }

  function overlayShell(inner, id = 'unlock-overlay') {
    const overlay = document.createElement('div');
    overlay.id = id;
    overlay.className = 'unlock-overlay';
    overlay.innerHTML = inner;
    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    return overlay;
  }

  async function copyText(text) {
    const value = String(text || '');
    if (!value) return false;
    if (navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(value);
        return true;
      } catch (_) { /* 权限被拒或非用户手势，继续走 textarea 兜底 */ }
    }
    try {
      const ta = document.createElement('textarea');
      ta.value = value;
      ta.setAttribute('readonly', '');
      ta.style.position = 'fixed';
      ta.style.top = '-9999px';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      ta.setSelectionRange(0, value.length);
      let ok = false;
      try { ok = document.execCommand('copy'); } catch (_) { ok = false; }
      ta.remove();
      return ok;
    } catch (_) {
      return false;
    }
  }

  function showWechatTip() {
    track('wechat_block');
    const link = location.href.split('#')[0];
    const overlay = overlayShell(`
      <div class="unlock-card">
        <h3>请用浏览器打开后付款</h3>
        <p>微信内无法直接唤起支付宝。请点右上角「···」<br />→「在浏览器打开」，再回来付款解锁。</p>
        <button id="wx-copy" class="btn btn-primary">复制本页链接</button>
        <button id="wx-close" class="btn btn-ghost">知道了</button>
      </div>`);
    overlay.querySelector('#wx-close').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#wx-copy').addEventListener('click', async () => {
      const btn = overlay.querySelector('#wx-copy');
      const ok = await copyText(link);
      btn.textContent = ok ? '已复制，去浏览器粘贴打开' : '复制失败，请手动复制地址栏';
    });
  }

  async function openUnlock() {
    if (store.isUnlocked()) { openReport(); return; }
    if (payPrice === null) await getPrice(); // 首屏价格可能尚未返回
    track('unlock_click', { price: payPrice ?? '' });
    if (isWeChat()) { showWechatTip(); return; }

    // 弹窗立刻出现；对上一笔订单的核单放到后台，不阻塞点击反馈
    const overlay = overlayShell(`
      <div class="unlock-card">
        <p class="unlock-kicker">DEEP REPORT · 一次解锁 · 1 年内可回看</p>
        <h3>解锁深度报告 <span class="unlock-price" data-price>${priceLabel(payPrice)}</span></h3>
        <ul class="unlock-includes">
          <li>三段式人格深读 + 六维逐项拆解</li>
          <li>三条路线（稳健 / 成长 / 上限）的 12 周落地路线</li>
          <li>简历改写示例 + 面试高频问题</li>
          <li>本周 / 本月 / 下月三件事</li>
        </ul>
        <button id="unlock-pay" class="btn btn-primary">支付宝支付 <span data-price>${priceLabel(payPrice)}</span></button>
        <button id="unlock-cancel" class="btn btn-ghost">取消</button>
        <p class="unlock-tip">付款完成后会跳回本页自动解锁；若没自动跳回，回本页再点一次「解锁深度报告」会先核实上一笔付款。</p>
        <p class="unlock-legal">支付即表示同意 <a href="/legal.html#terms" target="_blank" rel="noopener">《用户协议》</a> 与 <a href="/legal.html#privacy" target="_blank" rel="noopener">《隐私政策》</a></p>
      </div>`);
    refreshPrice();
    const payBtn = overlay.querySelector('#unlock-pay');
    overlay.querySelector('#unlock-cancel').addEventListener('click', () => overlay.remove());

    // 只核最近 30 分钟内的订单（更早的多半已取消/超时），且最多等 4 秒
    const prev = store.getOrder();
    const prevRecent = !!(prev && prev.outTradeNo && Date.now() - Number(prev.ts || 0) < 30 * 60 * 1000);
    if (prevRecent) {
      const payHtml = `支付宝支付 <span data-price>${priceLabel(payPrice)}</span>`;
      payBtn.disabled = true;
      payBtn.textContent = '正在核实上一笔付款…';
      let settled = false;
      const restore = () => {
        if (!overlay.isConnected) return;
        payBtn.disabled = false;
        payBtn.innerHTML = payHtml;
        applyPrice(payPrice);
      };
      const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        restore();
      }, 4000);
      verifyOrder(prev.outTradeNo)
        .then(ok => {
          clearTimeout(timer);
          if (!overlay.isConnected) return;
          if (!ok) {
            if (!settled) { settled = true; restore(); }
            return;
          }
          settled = true;
          overlay.remove();
          if (result) renderResult();
          toast('已确认付款，深度报告解锁完成');
          openReport();
        })
        .catch(() => {
          clearTimeout(timer);
          if (!settled) { settled = true; restore(); }
        });
    }

    payBtn.addEventListener('click', async () => {
      payBtn.disabled = true;
      payBtn.textContent = '正在创建订单…';
      track('order_request', { price: payPrice || '' });
      try {
        const res = await fetch('/api/alipay/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ archetype: result?.archetype }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data.payUrl) throw new Error(data.error || data.detail || `HTTP ${res.status}`);
        store.saveOrder({ outTradeNo: data.outTradeNo, amount: data.amount, ts: Date.now() });
        track('order_created', { amount: data.amount });
        overlay.remove();
        location.href = data.payUrl;  // 跳转支付宝手机网站收银台
      } catch (e) {
        payBtn.disabled = false;
        payBtn.textContent = '重试';
        track('order_fail', { message: String(e.message || '').slice(0, 80) });
        toast('下单失败：' + e.message);
      }
    });
  }

  /* ---------- 深度报告 ---------- */
  async function openReport() {
    if (!result) { toast('报告数据丢失，请重新测一次'); return; }
    try { await ensureReport(); } catch (_) { toast('报告模块加载失败，请检查网络后重试'); return; }
    if (!window.RB_Report) { toast('报告数据丢失，请重新测一次'); return; }
    const body = $('#report-body');
    if (!body) return;
    body.innerHTML = window.RB_Report.build(result, { order: store.getOrder(), unlock: store.getUnlock() });
    bindReportAvatar();
    track('report_open', { archetype: result.archetype, via: (store.getUnlock() || {}).via || 'pay' });
    const cardBtn = $('#report-card-save');
    if (cardBtn) cardBtn.addEventListener('click', saveReportCard);
    loadAiSummary();
    go('report');
  }

  /* 报告摘要：优先 AI，失败保留本地文案 */
  async function loadAiSummary() {
    if (!result) return;
    const el = $('#rep-ai-text'), note = $('#rep-ai-note');
    if (!el) return;
    if (result.aiSummary) {
      el.textContent = result.aiSummary;
      if (note) note.textContent = 'AI 生成，仅供参考';
      return;
    }
    try {
      const r = await fetch('/api/ai-summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          archetype: result.archetype,
          norm: result.norm,
          top3: (result.top3 || []).slice(0, 3).map(c => c.name),
          context: result.context || '',
        }),
      });
      if (!r.ok) return;
      const d = await r.json().catch(() => ({}));
      if (d.summary) {
        result.aiSummary = d.summary;
        el.textContent = d.summary;
        if (note) note.textContent = 'AI 生成，仅供参考';
        track('ai_summary_ok');
      }
    } catch (_) { /* 静默降级为本地摘要 */ }
  }

  /* 报告完整图片 / 摘要卡 */
  let imageKind = 'poster';

  function showBusy(text) {
    let el = document.getElementById('busy-overlay');
    if (!el) {
      el = document.createElement('div');
      el.id = 'busy-overlay';
      el.innerHTML = '<div class="busy-card"><span class="busy-spinner"></span><p id="busy-text"></p></div>';
      document.body.appendChild(el);
    }
    const t = document.getElementById('busy-text');
    if (t) t.textContent = text;
    el.classList.add('show');
  }
  function hideBusy() {
    const el = document.getElementById('busy-overlay');
    if (!el) return;
    el.classList.remove('show');
    setTimeout(() => { if (el && !el.classList.contains('show')) el.remove(); }, 320);
  }

  function showImageInModal(url, hintHtml) {
    $('#poster-img').src = url;
    $('#link-copy').textContent = location.href.split('#')[0];
    const hint = document.querySelector('#poster-modal .modal-hint');
    if (hint) hint.innerHTML = hintHtml;
    $('#poster-modal').classList.toggle('mode-report', imageKind === 'report-full');
    lockScroll(); $('#poster-modal').classList.remove('hidden');
  }

  function bindReportAvatar() {
    const img = document.querySelector('#report-body .rep-avatar');
    if (!img) return;
    const wrap = img.parentElement;
    const done = () => wrap.classList.add('loaded');
    if (img.complete && img.naturalWidth) done();
    else {
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', () => wrap.classList.add('error'), { once: true });
    }
  }

  async function waitImages(node) {
    const imgs = [...node.querySelectorAll('img')];
    await Promise.all(imgs.map(img => (img.complete && img.naturalWidth)
      ? Promise.resolve()
      : new Promise(resolve => {
        img.addEventListener('load', resolve, { once: true });
        img.addEventListener('error', resolve, { once: true });
        setTimeout(resolve, 4000);
      })));
  }

  function loadImageEl(src) {
    return new Promise(resolve => {
      if (!src) return resolve(null);
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  /** 给截图加左右留白，并把头像用 Canvas 叠上去，避免截图库渲染 img 失败 */
  async function composeReportImage(baseUrl, node, avatar, padCss = 24, cropCssW = 0) {
    const base = await loadImageEl(baseUrl);
    if (!base) return baseUrl;
    const fullW = Math.max(1, node.scrollWidth);
    const cssW = Math.max(320, Math.min(fullW, cropCssW || fullW));
    const sx = base.naturalWidth / fullW;
    const sy = base.naturalHeight / Math.max(1, node.scrollHeight);
    // 截图宽度按内容宽度裁掉右侧多余背景，避免长图标题旁出现黑色空块
    const cropW = Math.max(1, Math.round(base.naturalWidth * cssW / fullW));
    const pad = Math.round(padCss * Math.min(sx, sy));
    const W = cropW + pad * 2;
    const H = base.naturalHeight + pad * 2;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#0b0b14'; ctx.fillRect(0, 0, W, H);
    ctx.drawImage(base, 0, 0, cropW, base.naturalHeight, pad, pad, cropW, base.naturalHeight);

    if (avatar && avatar.src && avatar.box) {
      const im = await loadImageEl(avatar.src);
      if (im) {
        const x = pad + avatar.box.x * sx;
        const y = pad + avatar.box.y * sy;
        const w = avatar.box.w * sx;
        const h = avatar.box.h * sy;
        const r = Math.min(18 * sx, w / 2, h / 2);
        ctx.save();
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
        ctx.clip();
        const scale = Math.max(w / im.naturalWidth, h / im.naturalHeight);
        const dw = im.naturalWidth * scale;
        const dh = im.naturalHeight * scale;
        ctx.drawImage(im, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
        ctx.restore();
        ctx.strokeStyle = 'rgba(255,255,255,.14)';
        ctx.lineWidth = Math.max(1, sx);
        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.arcTo(x + w, y, x + w, y + h, r);
        ctx.arcTo(x + w, y + h, x, y + h, r);
        ctx.arcTo(x, y + h, x, y, r);
        ctx.arcTo(x, y, x + w, y, r);
        ctx.closePath();
        ctx.stroke();
      }
    }
    return cv.toDataURL('image/png');
  }

  async function inlineImages(node) {
    const restores = [];
    for (const img of node.querySelectorAll('img')) {
      const src = img.getAttribute('src') || '';
      if (!src || src.startsWith('data:')) continue;
      try {
        const res = await fetch(src, { credentials: 'same-origin' });
        if (!res.ok) continue;
        const blob = await res.blob();
        const dataUrl = await new Promise(resolve => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        });
        if (!dataUrl) continue;
        restores.push([img, src]);
        img.src = dataUrl;
        try { await img.decode(); } catch (_) {}
      } catch (_) { /* 保留原图，交给库处理 */ }
    }
    return () => restores.forEach(([img, src]) => { img.src = src; });
  }

  async function saveReportCard() {
    if (!result) return;
    const btn = $('#report-card-save');
    const label = '保存完整报告图片';
    if (btn) { btn.disabled = true; btn.textContent = '正在生成…'; }
    showBusy('正在生成完整报告图片… 包含摘要、六维、三条路线与 12 周路线');
    let hideEls = [], prevDisplay = [];
    let restoreImgs = null, avatarEl = null, avatarPrev = null, skelEl = null, skelDisplay = '';
    let avatarBox = null, avatarSrc = '';
    try {
      const node = $('#report-body');
      if (!node) throw new Error('报告节点缺失');
      // 图片里不要出现“保存图片”按钮与操作提示
      hideEls = [node.querySelector('#report-card-save'), node.querySelector('.rep-kit-foot')].filter(Boolean);
      prevDisplay = hideEls.map(el => el.style.display);
      hideEls.forEach(el => { el.style.display = 'none'; });

      avatarEl = node.querySelector('.rep-avatar');
      skelEl = node.querySelector('.rep-avatar-skel');
      if (skelEl) { skelDisplay = skelEl.style.display; skelEl.style.display = 'none'; }
      if (avatarEl) {
        avatarPrev = { transition: avatarEl.style.transition, opacity: avatarEl.style.opacity, visibility: avatarEl.style.visibility };
        // 截图时强制不透明，避免过渡未完成被截成黑色占位
        avatarEl.style.transition = 'none';
        avatarEl.style.opacity = '1';
        try {
          if (!avatarEl.complete) await new Promise(resolve => {
            avatarEl.addEventListener('load', resolve, { once: true });
            avatarEl.addEventListener('error', resolve, { once: true });
            setTimeout(resolve, 3000);
          });
          if (avatarEl.parentElement) avatarEl.parentElement.classList.add('loaded');
        } catch (_) { /* 忽略头像异常，继续生成 */ }
      }

      try { if (document.fonts && document.fonts.ready) await document.fonts.ready; } catch (_) {}
      await waitImages(node);
      // 把头像等图片转成 dataURL，避免截图库跨域/缓存问题导致占位
      restoreImgs = await inlineImages(node);
      await new Promise(resolve => setTimeout(resolve, 60));
      if (avatarEl) {
        const nr = node.getBoundingClientRect();
        const ar = avatarEl.getBoundingClientRect();
        avatarBox = { x: ar.left - nr.left, y: ar.top - nr.top, w: ar.width, h: ar.height };
        avatarSrc = avatarEl.currentSrc || avatarEl.src || '';
        avatarEl.style.visibility = 'hidden'; // 截图留空，头像稍后由 Canvas 叠加
      }
      try { await ensureHtmlToImage(); } catch (_) {}
      if (!window.htmlToImage) throw new Error('html-to-image 未加载');

      const w = Math.max(320, node.scrollWidth);
      const contentW = Math.max(320, Math.round(node.getBoundingClientRect().width));
      const h = Math.max(400, node.scrollHeight);
      const maxArea = 16e6;
      let ratio = Math.max(1.5, Math.min(2, window.devicePixelRatio || 1.5));
      if (w * h * ratio * ratio > maxArea) ratio = Math.max(1, Math.sqrt(maxArea / (w * h)));

      const rawUrl = await window.htmlToImage.toPng(node, {
        pixelRatio: ratio,
        backgroundColor: '#0b0b14',
        width: w,
        height: h,
        cacheBust: false,
        style: { margin: '0', paddingBottom: '24px' },
      });
      const url = await composeReportImage(rawUrl, node, { box: avatarBox, src: avatarSrc }, 24, contentW);
      imageKind = 'report-full';
      showImageInModal(url, '完整报告图片已生成：点「保存到相册」或<b>长按图片</b>保存');
      track('report_image_open', { height: h, ratio });
    } catch (e) {
      console.error('[report image]', e);
      try {
        await ensurePoster();
        const summary = result.aiSummary || (window.RB_Report && window.RB_Report.localSummary(result)) || '';
        const url = await RB_Poster.buildReportCard(result, summary);
        imageKind = 'report-card';
        showImageInModal(url, '完整图片生成失败，已生成摘要卡：点「保存到相册」或<b>长按图片</b>保存');
        toast('完整图片生成失败，已改为摘要卡');
      } catch (e2) {
        console.error('[report card fallback]', e2);
        toast('图片生成失败，请重试');
      }
    } finally {
      try { if (restoreImgs) restoreImgs(); } catch (_) {}
      try {
        if (avatarEl && avatarPrev) {
          avatarEl.style.transition = avatarPrev.transition;
          avatarEl.style.opacity = avatarPrev.opacity;
          avatarEl.style.visibility = avatarPrev.visibility;
        }
        if (skelEl) skelEl.style.display = skelDisplay;
      } catch (_) {}
      try { hideEls.forEach((el, i) => { el.style.display = prevDisplay[i] || ''; }); } catch (_) {}
      hideBusy();
      if (btn) { btn.disabled = false; btn.textContent = label; }
    }
  }

  /* ---------- 支付回跳验单 ---------- */
  function cleanPayQuery() {
    try { window.history.replaceState(null, '', location.pathname + (location.hash || '')); } catch (_) {}
  }

  function parseTokenExp(token) {
    try {
      let b64 = token.split('.')[0].replace(/-/g, '+').replace(/_/g, '/');
      b64 += '='.repeat((4 - b64.length % 4) % 4);
      const payload = JSON.parse(atob(b64));
      return Number(payload.exp) || 0;
    } catch (_) { return 0; }
  }

  async function verifyOrder(outTradeNo) {
    try {
      const res = await fetch('/api/alipay/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ outTradeNo }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.paid || !data.token) return false;
      store.saveUnlock({
        outTradeNo,
        via: 'pay',
        tradeNo: data.tradeNo || '',
        paidAt: data.paidAt || '',
        token: data.token,
        exp: parseTokenExp(data.token),
      });
      store.clearOrderCookie();
      track('pay_success', { amount: data.amount || '', via: 'pay' });
      return true;
    } catch (e) {
      console.error('[verifyOrder]', e);
      return false;
    }
  }

  /* 支付宝回跳瞬间订单可能尚未同步，留 3 次重试 */
  async function verifyOrderWithRetry(outTradeNo, tries = 3) {
    for (let i = 0; i < tries; i++) {
      if (await verifyOrder(outTradeNo)) return true;
      if (i < tries - 1) await new Promise(r => setTimeout(r, 1500));
    }
    return false;
  }

  /* 已付款但本机拿不到测过结果时的兜底提示：购买凭证已存本机，重测后可直接查看 */
  function showPaidWithoutResult() {
    go('cover');
    const overlay = overlayShell(`
      <div class="unlock-card">
        <p class="unlock-kicker">PAYMENT RECEIVED</p>
        <h3>支付已到账，报告数据不在本机</h3>
        <p class="unlock-tip">购买凭证已记录在本机。请重新完成一次测评，完成后点「查看深度报告」即可直接打开，无需再次付款。</p>
        <button id="paid-retest" class="btn btn-primary">重新测试</button>
        <button id="paid-ok" class="btn btn-ghost">知道了</button>
      </div>`, 'paid-no-result-overlay');
    overlay.querySelector('#paid-ok').addEventListener('click', () => overlay.remove());
    overlay.querySelector('#paid-retest').addEventListener('click', () => { overlay.remove(); restart(); });
  }

  /** 已确认付款后统一收尾：有结果直接开报告，无结果明确提示（不再静默回封面） */
  function restoreSoldReport(message) {
    if (result) {
      renderResult();
      toast(message);
      openReport();
      return;
    }
    showPaidWithoutResult();
  }

  /* 静默核单：没有回跳参数时（原标签恢复 / 新标签打开）用本机订单兜底 */
  let pendingCheckAt = 0;
  async function checkPendingOrder() {
    if (store.isUnlocked()) return false;
    const o = store.getOrder();
    const ts = Number(o?.ts || 0);
    if (!o?.outTradeNo || !ts || Date.now() - ts > ORDER_TTL_MS) return false;
    if (Date.now() - pendingCheckAt < 5000) return false; // 页面切换时避免重复查单
    pendingCheckAt = Date.now();
    const ok = await verifyOrder(o.outTradeNo);
    if (!ok) return false;
    const last = store.getLast();
    if (last) result = last;
    restoreSoldReport('已确认付款，深度报告解锁完成');
    return true;
  }

  /** 处理支付宝同步回跳；返回 true 表示本次 URL 已带回跳参数 */
  async function handlePayReturn() {
    const params = new URLSearchParams(location.search);
    const payReturn = params.get('pay_return') === '1';
    const canceled = params.get('pay_cancel') === '1';
    if (!payReturn && !canceled) return false;

    const outTradeNo = params.get('out_trade_no') || store.getOrder()?.outTradeNo || '';
    const last = store.getLast();
    if (last) result = last;           // 同浏览器可恢复完整结果
    cleanPayQuery();

    if (canceled) {
      // 支付宝走 quit_url 不一定代表未付款：先核一次，未到账再提示取消
      const paid = outTradeNo ? await verifyOrder(outTradeNo) : false;
      if (paid) { restoreSoldReport('支付成功，深度报告已解锁'); return true; }
      toast('已取消支付');
      if (result) renderResult(); else initCover();
      // 后台再核一次，避免「已付款但同步延迟」被误判为取消
      if (outTradeNo) {
        verifyOrderWithRetry(outTradeNo, 2).then(ok => { if (ok) restoreSoldReport('支付成功，深度报告已解锁'); });
      }
      return true;
    }

    const overlay = overlayShell(`
      <div class="unlock-card">
        <h3>正在确认支付结果…</h3>
        <p class="unlock-tip">请不要关闭本页</p>
      </div>`, 'pay-confirm-overlay');

    const ok = outTradeNo ? await verifyOrderWithRetry(outTradeNo) : false;
    overlay.remove();

    if (ok) { restoreSoldReport('支付成功，深度报告已解锁'); return true; }

    toast('暂未查到支付成功；若已扣款，请点「解锁深度报告」再核实一次');
    if (result) renderResult(); else initCover();
    return true;
  }

  async function doShare() {
    const shareUrl = location.href.split('#')[0];
    try { await ensurePoster(); } catch (_) { toast('分享模块加载失败，请检查网络后重试'); return; }
    const ok = await RB_Poster.share(`${result.arc.cn} · 重启人格图鉴`, `测出我是「${result.arc.cn}」，你是哪种重启者？快来测👉${shareUrl}`);
    track('poster_share', { ok });
    toast(ok ? '链接已复制，去发朋友圈吧' : '复制失败，请手动复制地址栏链接');
  }

  /* ---------- 重测 ---------- */
  function restart() { clearTimeout(computingTimer); answers = {}; purgeDrafts(); result = null; currentQi = 0; track('quiz_restart'); go('quiz'); renderQuiz(false); }
  function purgeDrafts() { for (const k in multiDraft) delete multiDraft[k]; for (const k in cityDraft) delete cityDraft[k]; }

  /* ---------- 事件绑定 ---------- */
  $('#btn-start').addEventListener('click', async () => {
    track('quiz_start');
    const btn = $('#btn-start');
    if (!R.CITIES || !R.JOBS) {
      const old = btn.innerHTML;
      btn.disabled = true;
      btn.textContent = '正在准备岗位库…';
      try { await ensureData(); } catch (_) { toast('岗位库加载失败，请检查网络后重试'); }
      btn.disabled = false;
      btn.innerHTML = old;
      if (!R.CITIES || !R.JOBS) return;
    }
    currentQi = 0;
    go('quiz');
    renderQuiz(false);
    ensurePoster().catch(() => {});
    ensureReport().catch(() => {});
  });
  $('#btn-back').addEventListener('click', () => { answers = {}; purgeDrafts(); currentQi = 0; initCover(); go('cover'); });
  $('#cover-last').addEventListener('click', () => {
    const last = store.getLast();
    if (!last) return;
    result = last;
    renderResult();
  });
  $('#report-back').addEventListener('click', () => { if (result) go('result'); else go('cover'); });
  $('#poster-share').addEventListener('click', doShare);
  $('#poster-download').addEventListener('click', saveImage);
  document.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', closeModal));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#poster-modal').classList.contains('hidden')) closeModal(); });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    // 从支付宝切回原标签时不会有回跳参数，靠本机订单静默核单
    if (!store.isUnlocked()) checkPendingOrder();
  });

  initCover();
  prefetchLazy();
  handlePayReturn().then(handled => { if (!handled) checkPendingOrder(); });
})();
