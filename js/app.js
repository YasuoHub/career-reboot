/* ============================================================
   主控制器：屏幕切换 / 答题流程 / 打分引擎 / 结果渲染（v3·16型）
   框架依据：
     · 六维归一化 → 四组二值判别(D1×D2×D3×D4) → 16型人格图鉴
     · 硬过滤(学历/健康/收入/形态)+五维软打分→方向行动排序
   ============================================================ */
(() => {
  const $ = s => document.querySelector(s);
  const { QUESTIONS, AXES, AXES_MAX, ARCHETYPES, SKILLS, SKILL_AXIS, CLASSIFY_DIM, ACTIONS } = window.RB_DATA;

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
  document.addEventListener('DOMContentLoaded', () => setTimeout(hideLoader, 650));
  window.addEventListener('load', () => setTimeout(hideLoader, 200));
  setTimeout(hideLoader, 4000);

  const screens = { cover: $('#sc-cover'), quiz: $('#sc-quiz'), computing: $('#sc-computing'), result: $('#sc-result'), report: $('#sc-report') };

  /* ---------- 状态 ---------- */
  const store = {
    get total() { const v = parseInt(localStorage.getItem('rb_total') || '', 10); return Number.isFinite(v) && v > 380000 ? v : 396447; },
    bumpTotal() { localStorage.setItem('rb_total', String(this.total + 1)); },
    /* 存完整结果，支付回跳/刷新后可恢复并生成深度报告 */
    saveLast(r) { try { localStorage.setItem('rb_last', JSON.stringify(r)); } catch (_) {} },
    getLast() {
      try {
        const r = JSON.parse(localStorage.getItem('rb_last'));
        return r && r.arc && Array.isArray(r.top3) ? r : null;
      } catch (_) { return null; }
    },
    /* 最近一次下单（用于支付回跳后没有带 out_trade_no 时兜底） */
    saveOrder(o) { try { localStorage.setItem('rb_order', JSON.stringify(o)); } catch (_) {} },
    getOrder() { try { return JSON.parse(localStorage.getItem('rb_order')); } catch (_) { return null; } },
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

  /* ---------- 价格（以服务端 ALIPAY_PRICE 为准） ---------- */
  let payPrice = null;
  function priceLabel(p) {
    const n = Number(p);
    return Number.isFinite(n) && n > 0 ? `¥${n.toFixed(2)}` : '¥--';
  }
  async function getPrice() {
    if (payPrice) return payPrice;
    try {
      const r = await fetch('/api/alipay/price', { headers: { Accept: 'application/json' } });
      const d = await r.json();
      if (r.ok && Number(d.amount) > 0) payPrice = Number(d.amount);
    } catch (_) { /* 失败时保留占位；实际支付金额始终以服务端下单结果为准 */ }
    return payPrice;
  }
  function applyPrice(p) {
    if (!p) return;
    document.querySelectorAll('[data-price]').forEach(el => { el.textContent = priceLabel(p); });
  }
  function refreshPrice() { getPrice().then(applyPrice); }

  /* ---------- 业务埋点（GTM dataLayer） ---------- */
  function track(name, params = {}) {
    try {
      window.dataLayer = window.dataLayer || [];
      window.dataLayer.push({ event: name, ...params });
    } catch (_) { /* 统计失败不影响业务 */ }
  }

  /* 本机匿名标识：用于邀请进度与跨设备解锁，不含任何身份信息 */
  const uid = (() => {
    try {
      let v = localStorage.getItem('rb_uid');
      if (!v || !/^[A-Za-z0-9_-]{8,64}$/.test(v)) {
        v = (window.crypto && crypto.randomUUID)
          ? crypto.randomUUID()
          : `u${Date.now()}${Math.random().toString(36).slice(2, 10)}`;
        localStorage.setItem('rb_uid', v);
      }
      return v;
    } catch (_) { return `u${Date.now()}`; }
  })();

  /* ---------- 封面 ---------- */
  function initCover() {
    $('#stat-total').textContent = store.total.toLocaleString('zh-CN');
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

  function renderQuiz(animate = true) {
    if (currentQi >= QUESTIONS.length) { finish(); return; }
    const q = QUESTIONS[currentQi];
    const panel = $('#q-panel');
    if (!animate) panel.style.animation = 'none';
    [...dotsEl.children].forEach((d, i) => {
      d.className = (i < currentQi || (i === currentQi && answered(QUESTIONS[i]))) ? 'done' : (i === currentQi ? 'now' : '');
    });
    $('#quiz-stage').textContent = `第 ${currentQi + 1} / ${QUESTIONS.length} 弹`;

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
      skills: [], pref: '坐班', cityTier: '不限', gender: '',
      stage: '', capital: 0, selfBiz: false,
    };
    QUESTIONS.forEach(q => {
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
        if (o.add.cityTier) profile.cityTier = o.add.cityTier;
        if (o.add.gender) profile.gender = o.add.gender;
        if (o.add.stage) profile.stage = o.add.stage;
        if (typeof o.add.capital === 'number') profile.capital = o.add.capital;
        if (typeof o.add.selfBiz === 'boolean') profile.selfBiz = o.add.selfBiz;
      }
    });

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

    // ---- 硬过滤 ----
    const lowSalOf = c => parseFloat(c.sal.split(/[-–]/)[0].replace(/[^\d.]/g, '')) * 1000;
    const pool = ACTIONS.filter(c => c.arc === archetypeId);
    const passPattern = c => !(profile.pref === '坐班' && c.req.pat === '倒班') && !(profile.pref === '弹性' && c.req.pat === '倒班');
    const passEdu = c => profile.eduRank >= c.req.edu;
    const passHealth = c => !((profile.health >= 3 && c.req.phys) || (profile.health === 4 && c.req.pat === '倒班'));
    const passFloor = c => { if (lowSalOf(c) >= profile.floor) return true; return c.mkt.g >= 30 || (c.mkt.shortage && profile.risk >= 0); };
    const skillHit = cs => profile.skills.filter(s => cs.includes(s)).length;
    const passHours = c => { const cs = c.req.skills || []; return !(profile.hours === 2 && c.req.edu >= 3 && c.req.pat === '坐班' && skillHit(cs) < Math.ceil(cs.length / 2)); };

    let cand = pool.filter(c => passPattern(c) && passEdu(c) && passHealth(c) && passFloor(c) && passHours(c));
    if (cand.length < 3) {
      // 保留最重要的人身与收入约束，放宽形态/学历/时间，保证 TOP3 完整
      const relaxed = pool.filter(c => passHealth(c) && passFloor(c));
      cand = [...new Set([...cand, ...relaxed])];
      if (cand.length < 3) cand = pool.slice();
    }

    // ---- 五维软打分 ----
    const userVec = {}; AXES.forEach(a => userVec[a.key] = norm[a.key]);
    const cosSim = (v1, v2) => { let dot = 0, n1 = 0, n2 = 0; for (const k in v1) { dot += v1[k] * (v2[k] || 0); n1 += v1[k] ** 2; n2 += (v2[k] || 0) ** 2; } return n1 && n2 ? dot / (Math.sqrt(n1) * Math.sqrt(n2)) : 0; };
    const hitN = cs => profile.skills.filter(s => cs.includes(s)).length;

    const scored = cand.map(c => {
      const cs = c.req.skills || [];
      const f1 = !cs.length ? 50 : (profile.skills.length
        ? Math.round(hitN(cs) / (new Set([...cs, ...profile.skills])).size * 100)
        : 40); // 零经验：不做“技能空白”惩罚
      const t = (c.tr || []).find(([ind]) => ind === profile.industry);
      const f2 = freshLike ? 50 : Math.round((t ? t[1] : 0.35) * 100);
      const cv = {}; cs.forEach(s => { const ax = SKILL_AXIS[s]; if (ax) Object.entries(ax).forEach(([k, v]) => (cv[k] = (cv[k] || 0) + v)); });
      const f3 = Math.round(cosSim(userVec, cv) * 100);
      let f4 = Math.log(1 + c.mkt.g) / Math.log(61) * 60;
      if (c.mkt.c < 20) f4 += 20; if (c.mkt.c > 150) f4 -= 25; if (c.mkt.shortage) f4 += 10;
      f4 = Math.round(Math.max(0, Math.min(90, f4)) / 90 * 100);
      const weeks = 4 + (cs.length - hitN(cs)) * 6 + Math.max(0, c.req.edu - profile.eduRank) * 6;
      const cap = profile.hours === 0 ? 95 : profile.hours === 1 ? 72 : 45;
      const f5 = Math.round(cap * Math.exp(-weeks / 18));
      // 自营倾向 / 启动资金 / 零经验入行友好度，作为排序修正项
      const selfBonus = (profile.selfBiz && c.self) ? 6 : 0;
      const capGap = (profile.selfBiz && c.self && Number.isFinite(c.cap)) ? Math.max(0, c.cap - profile.capital) : 0;
      const capPenalty = capGap ? -5 * capGap : 0;
      const entryBonus = (freshLike && c.entry) ? 5 : 0;
      const _rawScore = Math.round(f1 * .30 + f2 * .20 + f3 * .15 + f4 * .20 + f5 * .15 + selfBonus + capPenalty + entryBonus);
      return { rank: 0, ...c, _rawScore, scoreNum: _rawScore, fb: { 技能重合: f1, 行业迁移: f2, 性格延续: f3, 市场时机: f4, 投入可行: f5 }, gapSkills: cs.filter(s => !profile.skills.includes(s)) };
    }).sort((a, b) => b._rawScore - a._rawScore);

    const raws = scored.map(c => c._rawScore);
    const rawHi = Math.max(...raws), rawLo = Math.min(...raws);

    // 五项适配因子：按本岗位内部强弱排序，映射到 81–98 的高分区间，保证互不相同
    const factorLadder = [98, 94, 90, 86, 84];
    const rankShift = [2, 0, -2];
    scored.forEach((c, i) => {
      const rawFb = { ...c.fb };
      const order = Object.entries(rawFb).sort((a, b) => b[1] - a[1]);
      const rawPct = rawHi === rawLo ? 0.5 : (c._rawScore - rawLo) / (rawHi - rawLo);
      const shift = (rankShift[i] ?? -2) + (rawPct >= 0.5 ? 1 : 0);
      order.forEach(([k], idx) => {
        c.fb[k] = Math.max(81, Math.min(98, (factorLadder[idx] ?? 84) + shift));
      });
    });

    // 展示分：统一映射到 80+ 区间，并按名次拉开差异（前三档不重叠）
    const baseByRank = [96, 90, 85];
    scored.forEach((c, i) => {
      const spread = rawHi === rawLo
        ? 1 - Math.min(1, i / Math.max(1, scored.length - 1))
        : (c._rawScore - rawLo) / (rawHi - rawLo);
      const base = baseByRank[i] ?? 82;
      const adj = Math.round((spread - 0.5) * 4);
      c.scoreNum = Math.max(80, Math.min(98, base + adj));
    });
    scored.slice(0, 3).forEach((c, i) => (c.rank = '#' + (i + 1)));

    const notes = [];
    if (freshLike) notes.push('先选能快速上手的入口');
    else if (profile.stage === 'gap') notes.push('空窗期用学习或作品补叙事');
    if (profile.risk <= -1) notes.push('低风险路线优先'); else if (profile.floor >= 18000) notes.push('收入硬线优先于兴趣');

    return { archetype: archetypeId, arc, dims, norm, chips, context: (MODE_LABELS[profile.modes[0]] || '') + (notes.length ? ' · ' + notes.join(' · ') : ''), gender: profile.gender, profile, top3: scored.slice(0, 3), ts: Date.now() };
  }

  /* ---------- 分析屏 ---------- */
  let computingTimer;
  function finish() {
    result = score(); purgeDrafts();
    if (!result || !result.arc) { console.error(new Error('SCORING_RESULT_EMPTY')); toast('分析出了点状况，返回重来一次吧'); go('cover'); return; }
    track('quiz_complete', { archetype: result.archetype });
    claimReferral(result.archetype);
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

  /* ---------- 邀请裂变 ---------- */
  function inviteLink() {
    const origin = (location.origin && location.origin !== 'null')
      ? location.origin
      : 'https://www.career-turn.icu';
    return `${origin}/?ref=${encodeURIComponent(uid)}`;
  }

  function updateInviteUI(d) {
    const card = $('#invite-card');
    if (!card) return;
    card.hidden = false;
    const need = Number(d.need) || 1;
    const progress = Math.min(need, Number(d.progress) || 0);
    document.querySelectorAll('[data-invite-need]').forEach(el => { el.textContent = String(need); });
    const fill = $('#invite-bar-fill');
    if (fill) fill.style.width = `${Math.round(progress / need * 100)}%`;
    const label = $('#invite-progress');
    if (label) label.textContent = progress >= need ? '已达成，正在解锁…' : `当前进度 ${progress} / ${need}`;
  }

  async function loadInviteState() {
    if (store.isUnlocked()) return;
    const card = $('#invite-card');
    if (!card) return;
    try {
      const r = await fetch(`/api/invite/state?uid=${encodeURIComponent(uid)}`, { headers: { Accept: 'application/json' } });
      const d = await r.json().catch(() => ({}));
      if (!d.configured) { card.hidden = true; return; }
      updateInviteUI(d);
      if (d.unlocked && d.token) {
        store.saveUnlock({ via: 'share', token: d.token, exp: parseTokenExp(d.token) });
        track('invite_unlock', { progress: d.progress });
        toast('邀请已达成，深度报告解锁');
        renderResult();
      }
    } catch (_) { card.hidden = true; }
  }

  async function shareInvite() {
    const url = inviteLink();
    const lead = `我在「重启人格图鉴」测出了「${result?.arc?.cn || '我的重启人格'}」，你也来测测，顺便帮我解锁深度报告👉`;
    const fullText = `${lead} ${url}`;

    // 先把链接展示出来：即使剪贴板权限被拒，也能长按手动复制
    const row = $('#invite-link-row');
    const input = $('#invite-link');
    if (row && input) {
      row.hidden = false;
      input.value = url;
      try { input.focus(); input.select(); } catch (_) {}
    }

    track('invite_share');
    if (navigator.share) {
      try {
        await navigator.share({ title: '重启人格图鉴', text: fullText, url });
        return;
      } catch (_) { /* 用户取消或系统分享不可用，回落复制 */ }
    }
    const ok = await copyText(fullText);
    if (ok) {
      toast('邀请链接已复制，发给好友即可');
    } else {
      if (input) {
        try { input.focus(); input.select(); } catch (_) {}
      }
      toast('已生成邀请链接，请长按上方链接手动复制');
    }
  }

  async function claimReferral(archetype) {
    let ref = '';
    try { ref = sessionStorage.getItem('rb_ref') || ''; } catch (_) {}
    if (!ref || ref === uid) return;
    try {
      const r = await fetch('/api/invite/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ref, viewer: uid, archetype }),
      });
      const d = await r.json().catch(() => ({}));
      if (r.ok && d.counted) {
        try { sessionStorage.removeItem('rb_ref'); } catch (_) {}
        toast('已为好友的邀请进度 +1');
        track('invite_claimed', { progress: d.progress });
      }
    } catch (_) { /* 静默失败，不影响测评 */ }
  }

  function renderResult() {
    if (!result || !result.arc) { go('cover'); toast('结果没接住，请重测一次'); return; }
    const r = result, arc = r.arc, colors = arc.colors;
    document.documentElement.style.setProperty('--accent', colors.accent);
    document.documentElement.style.setProperty('--deep', colors.deep);
    document.documentElement.style.setProperty('--glow', colors.glow);
    store.saveLast(r);
    const skillLabel = id => (SKILLS.find(s => s.id === id) || {}).label || id;
    const avatarFile = arc.avatarF.replace(/-f\.webp$/, r.gender === '男' ? '-m.webp' : '-f.webp');
    const unlocked = store.isUnlocked();
    track('result_view', { archetype: r.archetype, top1: (r.top3 && r.top3[0] && r.top3[0].name) || '' });

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
      <p class="rarity-chip"><span class="pip"></span>这类重启者仅占全部被测者的 ${arc.rarity}%</p>

      <div class="panel">
        <div class="panel-h"><h3>重启指数</h3><span>REBOOT INDEX</span></div>
        <div class="metric-row">${r.chips.map(c => `<div class="metric"><b>${c.pct}</b><small>${c.name}</small></div>`).join('')}</div>
      </div>

      <div class="panel">
        <div class="panel-h"><h3>六维画像</h3><span>RADAR PROFILE</span></div>
        <div class="radar-wrap"><canvas id="radar-canvas"></canvas></div>
      </div>

      <div class="panel">
        <div class="panel-h"><h3>方向行动 TOP3</h3><span>FIT ROADMAP</span></div>
        ${r.top3.map(c => `
          <div class="career-card">
            <div class="career-top">
              <span class="career-rank">${c.rank}</span>
              <span class="career-name">${c.name}</span>
            </div>
            <div class="career-meta">
              <span class="career-badges">${c.S ? '<i class="badge-official s">国家新职业</i>' : ''}${c.L ? '<i class="badge-official l">绿色职业</i>' : ''}</span>
              <span class="career-sal">${c.sal}/月</span>
            </div>
            <p class="career-fit">适配度 <b>${c.scoreNum}</b><span class="dim-dots">${'●'.repeat(Math.round(c.scoreNum / 20))}${'○'.repeat(5 - Math.round(c.scoreNum / 20))}</span></p>
            <div class="action-paths">
              <div class="action-path"><b>🏢 求职路径</b>${c.J}</div>
              <div class="action-path"><b>🌱 自由事业</b>${c.F}</div>
              <div class="action-path"><b>📚 学习路线</b>${c.L}</div>
            </div>
            <div class="tags">${(c.tags || []).map(t => `<span class="tag">#${t}</span>`).join('')}</div>
            ${c.gapSkills.length ? `<p class="career-gap">补上这几块就能平移过去：<b>${c.gapSkills.map(skillLabel).join('、')}</b></p>` : `<p class="career-gap done">关键手艺你已经齐了，直接上。</p>`}
            <p class="career-week"><em>本周就能做：</em>${c.week1}</p>
          </div>`).join('')}
      </div>

      ${unlocked ? '' : `
      <div class="teaser-wrap" id="teaser-wrap">
        <section class="report-teaser is-collapsed" id="report-teaser" role="button" tabindex="0" aria-expanded="false" aria-label="展开查看完整深度报告内容">
          <div class="teaser-body">
            <div class="teaser-h"><span>深度报告</span><em>DEEP REPORT</em></div>
            <h3>找准了方向，距离成功就只差一份深度报告。</h3>
            <ul class="teaser-list">
              <li><b>你是谁</b>三段式人格解读 + 六维逐项拆解，解释你为什么会这样选。</li>
              <li><b>往哪走</b>TOP3 方向的 12 周落地路线，按你每周能投入的时间安排节奏。</li>
              <li><b>怎么讲</b>经历改写示例 + 面试高频问题，把你的经历讲成优势。</li>
              <li><b>先做什么</b>本周 / 本月 / 下月三件事，不用再自己找第一步。</li>
            </ul>
            <p class="teaser-note">一次买断 <b data-price>${priceLabel(payPrice)}</b>，可随时回看；全部基于你的 17 道作答生成，不套模板，数据只在本机。</p>
          </div>
        </section>
        <button class="teaser-expand" id="teaser-expand" type="button" aria-controls="report-teaser" aria-expanded="false">
          <span>展开看完整报告内容</span><i aria-hidden="true">↓</i>
        </button>
      </div>`}

      <div class="res-ctas">
        <button id="btn-unlock" class="btn-unlock${unlocked ? ' is-owned' : ' is-hidden'}" type="button">
          <span class="unlock-main">${unlocked ? '查看深度报告' : `解锁深度报告 <b data-price>${priceLabel(payPrice)}</b>`}</span>
          <span class="unlock-sub">${unlocked ? '已解锁 · 可随时回看' : '人格深读 · 12 周路线 · 简历与面试话术'}</span>
          ${unlocked ? '' : '<i class="unlock-spark" aria-hidden="true">✦</i>'}
        </button>
        <div class="cta-row">
          <button id="btn-poster" class="btn btn-primary">生成分享海报</button>
          <button id="btn-redo" class="btn btn-ghost">再测一次</button>
        </div>
      </div>
      ${unlocked ? '' : `
      <div class="invite-card" id="invite-card" hidden>
        <div class="invite-head"><span>免费解锁</span><em>INVITE &amp; UNLOCK</em></div>
        <p class="invite-copy">不想付费？邀请 <b data-invite-need>1</b> 位好友完成测评，也能免费解锁这份深度报告。</p>
        <div class="invite-bar"><i id="invite-bar-fill"></i></div>
        <p class="invite-progress" id="invite-progress">当前进度 0 / <span data-invite-need>1</span></p>
        <button class="btn btn-ghost invite-btn" id="btn-invite" type="button">生成邀请链接</button>
        <div class="invite-link-row" id="invite-link-row" hidden>
          <input id="invite-link" class="invite-link" type="text" readonly aria-label="邀请链接" />
          <span class="invite-link-hint">长按链接可手动复制</span>
        </div>
      </div>`}
      <p class="res-legal">本测试为趣味性格探索，不构成医疗、心理诊断或就业承诺。<br />作答与报告默认仅保存在本机；邀请功能仅同步匿名标识与人格类型代号。薪资与供需为公开报告量级参考。<br /><a href="/legal.html#terms" target="_blank" rel="noopener">用户协议</a> · <a href="/legal.html#privacy" target="_blank" rel="noopener">隐私政策</a></p>
    `;

    $('#btn-poster').addEventListener('click', openPoster);
    $('#btn-unlock').addEventListener('click', () => { if (store.isUnlocked()) openReport(); else openUnlock(); });
    $('#btn-redo').addEventListener('click', restart);
    const inviteBtn = $('#btn-invite');
    if (inviteBtn) inviteBtn.addEventListener('click', shareInvite);
    bindTeaser();
    loadInviteState();
    go('result');
    bindAvatar();
    refreshPrice();
    RB_Poster.confetti(colors.accent);
    requestAnimationFrame(() => RB_Poster.drawRadar($('#radar-canvas'), AXES.map(a => ({ val: r.norm[a.key], label: a.label })), colors.accent));
  }

  /* ---------- 海报 ---------- */
  function lockScroll() { document.documentElement.classList.add('lock'); document.body.classList.add('lock'); }
  function unlockScroll() { document.documentElement.classList.remove('lock'); document.body.classList.remove('lock'); }
  function closeModal() { $('#poster-modal').classList.add('hidden'); unlockScroll(); }
  async function openPoster() {
    try {
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
    track('unlock_click', { price: payPrice || '' });
    if (isWeChat()) { showWechatTip(); return; }

    // 弹窗立刻出现；对上一笔订单的核单放到后台，不阻塞点击反馈
    const overlay = overlayShell(`
      <div class="unlock-card">
        <p class="unlock-kicker">DEEP REPORT · 一次买断</p>
        <h3>解锁深度报告 <span class="unlock-price" data-price>${priceLabel(payPrice)}</span></h3>
        <ul class="unlock-includes">
          <li>三段式人格深读 + 六维逐项拆解</li>
          <li>TOP3 方向的 12 周落地路线</li>
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
  function openReport() {
    if (!result || !window.RB_Report) { toast('报告数据丢失，请重新测一次'); return; }
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
      if (note) note.textContent = '基于您的作答智能生成';
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
        if (note) note.textContent = '基于您的作答智能生成';
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
  async function composeReportImage(baseUrl, node, avatar, padCss = 24) {
    const base = await loadImageEl(baseUrl);
    if (!base) return baseUrl;
    const sx = base.naturalWidth / Math.max(1, node.scrollWidth);
    const sy = base.naturalHeight / Math.max(1, node.scrollHeight);
    const pad = Math.round(padCss * Math.min(sx, sy));
    const W = base.naturalWidth + pad * 2;
    const H = base.naturalHeight + pad * 2;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#0b0b14'; ctx.fillRect(0, 0, W, H);
    ctx.drawImage(base, pad, pad);

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
    showBusy('正在生成完整报告图片… 包含摘要、六维、TOP3 与 12 周路线');
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
      if (!window.htmlToImage) throw new Error('html-to-image 未加载');

      const w = Math.max(320, node.scrollWidth);
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
      const url = await composeReportImage(rawUrl, node, { box: avatarBox, src: avatarSrc }, 24);
      imageKind = 'report-full';
      showImageInModal(url, '完整报告图片已生成：点「保存到相册」或<b>长按图片</b>保存');
      track('report_image_open', { height: h, ratio });
    } catch (e) {
      console.error('[report image]', e);
      try {
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

  async function handlePayReturn() {
    const params = new URLSearchParams(location.search);
    const payReturn = params.get('pay_return') === '1';
    const canceled = params.get('pay_cancel') === '1';
    if (!payReturn && !canceled) return;

    const outTradeNo = params.get('out_trade_no') || store.getOrder()?.outTradeNo || '';
    const last = store.getLast();
    if (last) result = last;           // 同浏览器可恢复完整结果
    cleanPayQuery();

    if (canceled) {
      toast('已取消支付');
      if (result) renderResult(); else initCover();
      return;
    }

    const overlay = overlayShell(`
      <div class="unlock-card">
        <h3>正在确认支付结果…</h3>
        <p class="unlock-tip">请不要关闭本页</p>
      </div>`, 'pay-confirm-overlay');

    const ok = outTradeNo ? await verifyOrderWithRetry(outTradeNo) : false;
    overlay.remove();

    if (ok) {
      if (result) {
        renderResult();
        toast('支付成功，深度报告已解锁');
        openReport();
      } else {
        go('cover');
        toast('支付成功，但本机已无测试结果，请重新测试后查看报告');
      }
      return;
    }

    toast('暂未查到支付成功；若已扣款，请点「解锁深度报告」再核实一次');
    if (result) renderResult(); else initCover();
  }

  async function doShare() {
    const shareUrl = location.href.split('#')[0];
    const ok = await RB_Poster.share(`${result.arc.cn} · 重启人格图鉴`, `测出我是「${result.arc.cn}」，你是哪种重启者？快来测👉${shareUrl}`);
    track('poster_share', { ok });
    toast(ok ? '链接已复制，去发朋友圈吧' : '复制失败，请手动复制地址栏链接');
  }

  /* ---------- 重测 ---------- */
  function restart() { clearTimeout(computingTimer); answers = {}; purgeDrafts(); result = null; currentQi = 0; track('quiz_restart'); go('quiz'); renderQuiz(false); }
  function purgeDrafts() { for (const k in multiDraft) delete multiDraft[k]; }

  /* ---------- 事件绑定 ---------- */
  $('#btn-start').addEventListener('click', () => { track('quiz_start'); currentQi = 0; go('quiz'); renderQuiz(false); });
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
    if (document.visibilityState === 'visible' && result && screens.result.classList.contains('active')) {
      loadInviteState();
    }
  });

  /* 记录来自分享链接的推荐人（好友完成测评后上报） */
  (function captureRef() {
    try {
      const ref = new URLSearchParams(location.search).get('ref');
      if (ref && ref !== uid) {
        sessionStorage.setItem('rb_ref', ref);
        track('referral_visit');
      }
    } catch (_) { /* 忽略存储异常 */ }
  })();

  initCover();
  handlePayReturn();
})();
