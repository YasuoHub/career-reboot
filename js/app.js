/* ============================================================
   主控制器：屏幕切换 / 答题流程 / 计分引擎 / 结果渲染
   ============================================================ */
(() => {
  const $ = s => document.querySelector(s);
  const { QUESTIONS, AXES, AXES_MAX, ARCHETYPES, CAREERS } = window.RB_DATA;

  const MODE_LABELS = {
    mode_urgent: '刚经历裁员 · 速返优先',
    mode_gap: '空窗转换中',
    mode_in: '在职过渡 · 双线布局',
    mode_blur: '心动未动 · 小步试错',
  };

  const screens = {
    cover: $('#sc-cover'),
    quiz: $('#sc-quiz'),
    computing: $('#sc-computing'),
    result: $('#sc-result'),
  };

  /* ---------- 状态 ---------- */
  const store = {
    get total() {
      const v = parseInt(localStorage.getItem('rb_total') || '', 10);
      return Number.isFinite(v) && v > 380000 ? v : 396447;
    },
    bumpTotal() { localStorage.setItem('rb_total', String(this.total + 1)); },
    saveLast(r) { localStorage.setItem('rb_last', JSON.stringify(r)); },
    getLast() { try { return JSON.parse(localStorage.getItem('rb_last')); } catch (_) { return null; } },
  };

  let answers = {};   // qid -> option index
  let result = null;  // 上一次计分结果

  /* ---------- Toast ---------- */
  let toastTimer;
  function toast(msg) {
    const el = $('#toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2400);
  }

  /* ---------- 屏幕切换 ---------- */
  function go(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
    screens[name].scrollTop = 0;
  }

  /* ---------- 封面 ---------- */
  function initCover() {
    $('#stat-total').textContent = store.total.toLocaleString('zh-CN');
    const last = store.getLast();
    const lastEl = $('#cover-last');
    if (last && ARCHETYPES[last.archetype]) {
      lastEl.hidden = false;
      $('#cover-last-name').textContent = ARCHETYPES[last.archetype].cn;
    }
  }

  /* ---------- 答题 ---------- */
  const dotsEl = $('#progress-dots');
  QUESTIONS.forEach(() => dotsEl.appendChild(document.createElement('li')));

  function currentQIndex() {
    for (let i = 0; i < QUESTIONS.length; i++) {
      if (answers[QUESTIONS[i].id] === undefined) return i;
    }
    return QUESTIONS.length;
  }

  function renderQuiz(animate = true) {
    const qi = currentQIndex();
    if (qi >= QUESTIONS.length) return finish();
    const q = QUESTIONS[qi];
    const letters = 'ABCDEFGH';

    // 进度点
    [...dotsEl.children].forEach((d, i) => {
      d.className = answers[QUESTIONS[i].id] !== undefined ? 'done' : (i === qi ? 'now' : '');
    });
    $('#quiz-stage').textContent = `第 ${qi + 1} / ${QUESTIONS.length} 弹`;

    const panel = $('#q-panel');
    if (!animate) panel.style.animation = 'none';
    panel.innerHTML = `
      <span class="q-tag">${q.tag} · 第 ${qi + 1} 问</span>
      <h2 class="q-text">${q.text}</h2>
      <div class="q-opts">
        ${q.opts.map((o, i) => `
          <button class="opt" data-i="${i}" aria-label="选项 ${letters[i]}：${o.t}">
            <span class="opt-mark">${letters[i]}</span>
            <span>${o.t}</span>
          </button>`).join('')}
      </div>`;
    panel.querySelectorAll('.opt').forEach(btn =>
      btn.addEventListener('click', () => pick(q, +btn.dataset.i)));
  }

  function pick(q, optIdx) {
    answers[q.id] = optIdx;
    store.bumpTotal();
    const panel = $('#q-panel');
    panel.style.animation = 'none';
    void panel.offsetWidth;           // 重启动画
    panel.style.animation = '';
    renderQuiz(true);
  }

  /* ---------- 计分引擎 ---------- */
  function score() {
    const dims = {}, profile = { modes: [], risk: 0, floor: 0, hours: 1 };

    QUESTIONS.forEach(q => {
      const o = q.opts[answers[q.id]];
      if (!o) return;
      if (o.m) profile.modes.push(...o.m);
      if (o.add) {
        if (o.add.dims) Object.entries(o.add.dims).forEach(([k, v]) => (dims[k] = (dims[k] || 0) + v));
        if (typeof o.add.risk === 'number') profile.risk += o.add.risk;
        if (typeof o.add.floor === 'number') profile.floor = o.add.floor;
        if (typeof o.add.hours === 'number') profile.hours = o.add.hours;
      }
    });

    // 归一化六维
    const norm = {};
    AXES.forEach(a => {
      norm[a.key] = Math.round(((dims[a.key] || 0) / AXES_MAX[a.key]) * 100);
    });

    // 原型识别：单维最高 vs 双高合成（0.55 阈值保证稀有型可达但不触手可及）
    const ranked = [...AXES].sort((a, b) => norm[b.key] - norm[a.key]);
    const top = ranked[0].key, second = ranked[1].key;
    let archetypeId = top;
    for (const [id, arc] of Object.entries(ARCHETYPES)) {
      if (arc.combo && arc.combo.includes(top) && arc.combo.includes(second)
        && norm[second] >= norm[top] * 0.55) {
        archetypeId = id;
        break;
      }
    }

    // 三枚二次指标（趣味口径，非科学量表）
    const chips = [
      { name: '试错胆量', pct: Math.max(45, Math.min(95, 50 + profile.risk * 11)) },
      { name: '转型续航', pct: profile.hours === 0 ? 92 : profile.hours === 1 ? 76 : 60 },
      { name: '重启紧迫度', pct: ({ mode_urgent: 88, mode_gap: 64, mode_in: 40, mode_blur: 55 })[profile.modes[0]] ?? 50 },
    ];

    // 情境标签
    const notes = [];
    if (profile.risk <= -1) notes.push('低风险路线优先');
    else if (profile.floor >= 18000) notes.push('收入硬线优先于兴趣');

    // 职业准入过滤
    const arc = ARCHETYPES[archetypeId];
    let pool = CAREERS.filter(c => c.arc === archetypeId);
    const feasible = pool.filter(c => {
      if (!c.need) return true;
      const lowSal = parseFloat(c.sal.split(/[-–]/)[0].replace(/[^\d.]/g, '')) * 1000;
      if (c.need.minIncome && lowSal < profile.floor && !c.need.risk) return false;
      if (c.need.risk && profile.risk < 1) return false;
      if (c.need.hours === 'high' && profile.hours === 2) return false;
      return true;
    });
    if (feasible.length < 2) feasible.push(...pool.filter(c => !feasible.includes(c)));
    const top3 = feasible.slice(0, 3).map((c, i) => ({
      rank: '#' + (i + 1), ...c,
      hotTag: c.tags.find(t => /风口|高薪|红利|天花板/.test(t)) || null,
    }));

    return {
      archetype: archetypeId,
      arc, dims, norm, chips,
      context: (MODE_LABELS[profile.modes[0]] || '') +
               (notes.length ? ' · ' + notes.join(' · ') : ''),
      top3,
      ts: Date.now(),
    };
  }

  /* ---------- 分析屏（蓄力 1.9s） ---------- */
  let computingTimer;
  function finish() {
    result = score();
    go('computing');
    const lines = [
      ['正在读取你的作答指纹<b>…</b>', 0],
      ['比对 <b>六维</b> 职业倾向与权重<b>…</b>', 640],
      ['校验经济与时间约束<b>…</b>', 1280],
      ['为你校准方向<b>…</b>', 1920],
    ];
    const ul = $('#compute-lines');
    ul.innerHTML = '';
    lines.forEach(([html], i) => {
      const li = document.createElement('li');
      li.innerHTML = html;
      ul.appendChild(li);
    });
    [...ul.children].forEach((li, i) =>
      setTimeout(() => li.classList.add('show'), i * 630));

    clearTimeout(computingTimer);
    computingTimer = setTimeout(() => renderResult(), 2050);
  }

  /* ---------- 结果页 ---------- */
  function renderResult() {
    const r = result;
    const arc = r.arc;
    const colors = arc.colors;

    // 注入配色
    document.documentElement.style.setProperty('--accent', colors.accent);
    document.documentElement.style.setProperty('--deep', colors.deep);
    document.documentElement.style.setProperty('--glow', colors.glow);

    store.saveLast({ archetype: r.archetype, ts: r.ts });

    $('#res-body').innerHTML = `
      <p class="res-context">为「${r.context}」的你校准</p>
      <div class="res-watermark" data-num="${arc.num}">
        <p class="res-badge">Reboot Personality 图鉴 №${arc.num}</p>
        <p class="res-en">${arc.en}</p>
        <h2 class="res-name">${arc.cn}</h2>
        <p class="res-slogan">${arc.slogan}</p>
      </div>
      <p class="rarity-chip"><span class="pip"></span>这类重启者仅占全部被测者的 ${arc.rarity}%</p>

      <div class="panel">
        <div class="panel-h"><h3>重启指数</h3><span>REBOOT INDEX</span></div>
        <div class="metric-row">
          ${r.chips.map(c => `<div class="metric"><b>${c.pct}</b><small>${c.name}</small></div>`).join('')}
        </div>
      </div>

      <div class="panel">
        <div class="panel-h"><h3>六维画像</h3><span>RADAR PROFILE</span></div>
        <div class="radar-wrap"><canvas id="radar-canvas"></canvas></div>
        <div class="axes-list">
          ${AXES.map(a => `<div class="axis-item">${a.label} <b>${r.norm[a.key]}</b></div>`).join('')}
        </div>
      </div>

      <div class="panel">
        <div class="panel-h"><h3>为你校准的方向 TOP3</h3><span>FIT ROADMAP</span></div>
        ${r.top3.map(c => `
          <div class="career-card">
            <div class="career-top">
              <span class="career-rank">${c.rank}</span>
              <span class="career-name">${c.name}</span>
              <span class="career-sal">${c.sal}/月</span>
            </div>
            <p class="career-why">${c.fit}</p>
            <div class="tags">${c.tags.map(t => `<span class="tag${t === c.hotTag ? ' hot' : ''}">#${t}</span>`).join('')}</div>
            <p class="career-week"><em>本周就能做：</em>${c.week1}</p>
          </div>`).join('')}
      </div>

      <div class="res-ctas">
        <button id="btn-poster" class="btn btn-primary">生成分享海报</button>
        <button id="btn-redo" class="btn btn-ghost">再测一次</button>
      </div>
      <p class="res-legal">本测试为趣味性格探索，不构成医疗、心理诊断或就业承诺。<br />数据仅保存在你的设备本地，不上传任何服务器。</p>
    `;

    $('#btn-poster').addEventListener('click', openPoster);
    $('#btn-redo').addEventListener('click', restart);

    go('result');
    RB_Poster.confetti(colors.accent);
    requestAnimationFrame(() =>
      RB_Poster.drawRadar($('#radar-canvas'), AXES.map(a => r.norm[a.key]), colors.accent));
  }

  /* ---------- 海报 ---------- */
  async function openPoster() {
    toast('正在画海报…');
    try {
      const url = await RB_Poster.buildShare(result);
      $('#poster-img').src = url;
      $('#poster-download').href = url;
      $('#poster-download').download = `重启人格-${result.arc.cn}.png`;
      $('#poster-modal').classList.remove('hidden');
    } catch (e) {
      console.error(e);
      toast('海报生成失败，刷新后重试');
    }
  }

  /* ---------- 分享按钮（结果页顶部可加，此处藏在弹窗外） ---------- */
  async function doShare() {
    const ok = await RB_Poster.share(`${result.arc.cn} · 重启人格图鉴`,
      `测出我是「${result.arc.cn}」，你呢？`);
    toast(ok ? '链接已复制，去发朋友圈吧' : '复制失败，请手动复制地址栏链接');
  }

  /* ---------- 重测 ---------- */
  function restart() {
    answers = {};
    result = null;
    go('quiz');
    renderQuiz(false);
  }

  /* ---------- 事件绑定 ---------- */
  $('#btn-start').addEventListener('click', () => {
    if (currentQIndex() >= QUESTIONS.length) finish();
    else { go('quiz'); renderQuiz(false); }
  });
  $('#btn-back').addEventListener('click', () => { initCover(); go('cover'); });

  $('#poster-share').addEventListener('click', doShare);

  document.querySelectorAll('[data-close]').forEach(el =>
    el.addEventListener('click', () => $('#poster-modal').classList.add('hidden')));

  /* ---------- 启动 ---------- */
  initCover();
})();