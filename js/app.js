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
    mode_urgent: '刚经历裁员 · 速返优先',
    mode_gap: '空窗转换中',
    mode_in: '在职过渡 · 双线布局',
    mode_blur: '心动未动 · 小步试错',
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

  const screens = { cover: $('#sc-cover'), quiz: $('#sc-quiz'), computing: $('#sc-computing'), result: $('#sc-result') };

  /* ---------- 状态 ---------- */
  const store = {
    get total() { const v = parseInt(localStorage.getItem('rb_total') || '', 10); return Number.isFinite(v) && v > 380000 ? v : 396447; },
    bumpTotal() { localStorage.setItem('rb_total', String(this.total + 1)); },
    saveLast(r) { localStorage.setItem('rb_last', JSON.stringify(r)); },
    getLast() { try { return JSON.parse(localStorage.getItem('rb_last')); } catch (_) { return null; } },
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

  /* ---------- 封面 ---------- */
  function initCover() {
    $('#stat-total').textContent = store.total.toLocaleString('zh-CN');
    const last = store.getLast(), lastEl = $('#cover-last');
    if (last && ARCHETYPES[last.archetype]) { lastEl.hidden = false; $('#cover-last-name').textContent = ARCHETYPES[last.archetype].cn; } else { lastEl.hidden = true; }
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
      }
    });

    // ---- 六维归一化 ----
    const norm = {};
    AXES.forEach(a => { norm[a.key] = Math.round(((dims[a.key] || 0) / AXES_MAX[a.key]) * 100); });

    // ---- 16 型分类 ----
    const archetypeId = classify(norm);
    const arc = ARCHETYPES[archetypeId] || ARCHETYPES['ii_at_sj_2']; // 防御：未知时兜底

    const chips = [
      { name: '试错胆量', pct: Math.max(45, Math.min(95, 50 + profile.risk * 11)) },
      { name: '转型续航', pct: profile.hours === 0 ? 92 : profile.hours === 1 ? 76 : 60 },
      { name: '重启紧迫度', pct: ({ mode_urgent: 88, mode_gap: 64, mode_in: 40, mode_blur: 55 })[profile.modes[0]] ?? 50 },
    ];

    // ---- 硬过滤 ----
    const lowSalOf = c => parseFloat(c.sal.split(/[-–]/)[0].replace(/[^\d.]/g, '')) * 1000;
    const pool = ACTIONS.filter(c => c.arc === archetypeId);
    const passPattern = c => !(profile.pref === '坐班' && c.req.pat === '倒班') && !(profile.pref === '弹性' && c.req.pat === '倒班');
    const passEdu = c => profile.eduRank >= c.req.edu;
    const passHealth = c => !((profile.health === 3 && c.req.pat === '外勤' && c.req.phys) || (profile.health === 4 && c.req.pat === '倒班'));
    const passFloor = c => { if (lowSalOf(c) >= profile.floor) return true; return c.mkt.g >= 30 || (c.mkt.shortage && profile.risk >= 0); };
    const skillHit = cs => profile.skills.filter(s => cs.includes(s)).length;
    const passHours = c => { const cs = c.req.skills || []; return !(profile.hours === 2 && c.req.edu >= 3 && c.req.pat === '坐班' && skillHit(cs) < Math.ceil(cs.length / 2)); };

    let cand = pool.filter(c => passPattern(c) && passEdu(c) && passHealth(c) && passFloor(c) && passHours(c));
    if (cand.length < 2) cand = pool.slice();

    // ---- 五维软打分 ----
    const userVec = {}; AXES.forEach(a => userVec[a.key] = norm[a.key]);
    const cosSim = (v1, v2) => { let dot = 0, n1 = 0, n2 = 0; for (const k in v1) { dot += v1[k] * (v2[k] || 0); n1 += v1[k] ** 2; n2 += (v2[k] || 0) ** 2; } return n1 && n2 ? dot / (Math.sqrt(n1) * Math.sqrt(n2)) : 0; };
    const hitN = cs => profile.skills.filter(s => cs.includes(s)).length;

    const scored = cand.map(c => {
      const cs = c.req.skills || [];
      const f1 = !cs.length ? 50 : Math.round(hitN(cs) / (new Set([...cs, ...profile.skills])).size * 100);
      const t = (c.tr || []).find(([ind]) => ind === profile.industry);
      const f2 = Math.round((t ? t[1] : 0.35) * 100);
      const cv = {}; cs.forEach(s => { const ax = SKILL_AXIS[s]; if (ax) Object.entries(ax).forEach(([k, v]) => (cv[k] = (cv[k] || 0) + v)); });
      const f3 = Math.round(cosSim(userVec, cv) * 100);
      let f4 = Math.log(1 + c.mkt.g) / Math.log(61) * 60;
      if (c.mkt.c < 20) f4 += 20; if (c.mkt.c > 150) f4 -= 25; if (c.mkt.shortage) f4 += 10;
      f4 = Math.round(Math.max(0, Math.min(90, f4)) / 90 * 100);
      const weeks = 4 + (cs.length - hitN(cs)) * 6 + Math.max(0, c.req.edu - profile.eduRank) * 6;
      const cap = profile.hours === 0 ? 95 : profile.hours === 1 ? 72 : 45;
      const f5 = Math.round(cap * Math.exp(-weeks / 18));
      const _rawScore = Math.round(f1 * .30 + f2 * .20 + f3 * .15 + f4 * .20 + f5 * .15);
      return { rank: 0, ...c, _rawScore, scoreNum: _rawScore, fb: { 技能重合: f1, 行业迁移: f2, 性格延续: f3, 市场时机: f4, 投入可行: f5 }, gapSkills: cs.filter(s => !profile.skills.includes(s)) };
    }).sort((a, b) => b._rawScore - a._rawScore);

    scored.forEach(c => {
      Object.entries(c.fb).forEach(([k, v]) => {
        const lo = Math.min(...scored.map(x => x.fb[k])), hi = Math.max(...scored.map(x => x.fb[k]));
        c.fb[k] = hi === lo ? 75 : Math.round(55 + 40 * ((v - lo) / (hi - lo)));
      });
      c.scoreNum = Math.round(c.fb['技能重合'] * .30 + c.fb['行业迁移'] * .20 + c.fb['性格延续'] * .15 + c.fb['市场时机'] * .20 + c.fb['投入可行'] * .15);
    });
    scored.slice(0, 3).forEach((c, i) => (c.rank = '#' + (i + 1)));

    const notes = [];
    if (profile.risk <= -1) notes.push('低风险路线优先'); else if (profile.floor >= 18000) notes.push('收入硬线优先于兴趣');

    return { archetype: archetypeId, arc, dims, norm, chips, context: (MODE_LABELS[profile.modes[0]] || '') + (notes.length ? ' · ' + notes.join(' · ') : ''), gender: profile.gender, top3: scored.slice(0, 3), ts: Date.now() };
  }

  /* ---------- 分析屏 ---------- */
  let computingTimer;
  function finish() {
    result = score(); purgeDrafts();
    if (!result || !result.arc) { console.error(new Error('SCORING_RESULT_EMPTY')); toast('分析出了点状况，返回重来一次吧'); go('cover'); return; }
    go('computing');
    const lines = [['正在读取你的作答指纹<b>…</b>', 0], ['比对 <b>六维</b> 职业倾向与权重<b>…</b>', 500], ['校验个人要素与约束<b>…</b>', 1100], ['为你校准方向<b>…</b>', 1700]];
    const ul = $('#compute-lines'); ul.innerHTML = '';
    lines.forEach(([html]) => { const li = document.createElement('li'); li.innerHTML = html; ul.appendChild(li); });
    [...ul.children].forEach((li, i) => setTimeout(() => li.classList.add('show'), i * 550));
    clearTimeout(computingTimer); computingTimer = setTimeout(() => renderResult(), 1900);
  }

  /* ---------- 结果页 ---------- */
  function renderResult() {
    if (!result || !result.arc) { go('cover'); toast('结果没接住，请重测一次'); return; }
    const r = result, arc = r.arc, colors = arc.colors;
    document.documentElement.style.setProperty('--accent', colors.accent);
    document.documentElement.style.setProperty('--deep', colors.deep);
    document.documentElement.style.setProperty('--glow', colors.glow);
    store.saveLast({ archetype: r.archetype, ts: r.ts });
    const skillLabel = id => (SKILLS.find(s => s.id === id) || {}).label || id;
    const avatarFile = arc.avatarF.replace(/-f\.webp$/, r.gender === '男' ? '-m.webp' : '-f.webp');

    $('#res-body').innerHTML = `
      <p class="res-context">为「${r.context}」的你校准</p>
      <div class="res-hero" data-num="${arc.num}">
        <div class="res-hero-text">
          <p class="res-badge">Reboot Personality 图鉴 №${arc.num}</p>
          <p class="res-en">${arc.en}</p>
          <h2 class="res-name">${arc.cn}</h2>
          <p class="res-slogan">${arc.slogan}</p>
        </div>
        <img class="arc-avatar" src="/avatars/${avatarFile}" alt="${arc.cn}" loading="lazy" />
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

      <div class="res-ctas">
        <button id="btn-poster" class="btn btn-primary">生成分享海报</button>
        <button id="btn-redo" class="btn btn-ghost">再测一次</button>
      </div>
      <p class="res-legal">本测试为趣味性格探索，不构成医疗、心理诊断或就业承诺。<br />数据仅保存在你的设备本地，不上传任何服务器。薪资与供需为公开报告量级参考。</p>
    `;

    $('#btn-poster').addEventListener('click', openPoster);
    $('#btn-redo').addEventListener('click', restart);
    go('result');
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
      const tEl = $('#toast'); tEl.classList.remove('show'); clearTimeout(toastTimer);
      $('#poster-img').src = url; $('#link-copy').textContent = location.href.split('#')[0];
      lockScroll(); $('#poster-modal').classList.remove('hidden');
    } catch (e) { console.error(e); toast('海报生成失败，刷新后重试'); }
  }
  async function saveImage() {
    const dataUrl = $('#poster-img').src; if (!dataUrl.startsWith('data:image')) { toast('海报还没生成好'); return; }
    let blob; try { blob = await (await fetch(dataUrl)).blob(); } catch (_) { toast('图片读取失败，长按图片保存试试'); return; }
    const file = new File([blob], '重启人格图鉴.png', { type: 'image/png' });
    try { if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: '重启人格图鉴' }); return; } } catch (_) {}
    if (window.showSaveFilePicker) { try { const h = await window.showSaveFilePicker({ suggestedName: file.name }); const w = await h.createWritable(); await w.write(file); await w.close(); return; } catch (_) {} }
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000); toast('已开始下载；若没进相册，长按上方图片保存');
  }
  async function doShare() {
    const shareUrl = location.href.split('#')[0];
    const ok = await RB_Poster.share(`${result.arc.cn} · 重启人格图鉴`, `测出我是「${result.arc.cn}」，你是哪种重启者？快来测👉${shareUrl}`);
    toast(ok ? '链接已复制，去发朋友圈吧' : '复制失败，请手动复制地址栏链接');
  }

  /* ---------- 重测 ---------- */
  function restart() { clearTimeout(computingTimer); answers = {}; purgeDrafts(); result = null; currentQi = 0; go('quiz'); renderQuiz(false); }
  function purgeDrafts() { for (const k in multiDraft) delete multiDraft[k]; }

  /* ---------- 事件绑定 ---------- */
  $('#btn-start').addEventListener('click', () => { currentQi = 0; go('quiz'); renderQuiz(false); });
  $('#btn-back').addEventListener('click', () => { answers = {}; purgeDrafts(); currentQi = 0; initCover(); go('cover'); });
  $('#poster-share').addEventListener('click', doShare);
  $('#poster-download').addEventListener('click', saveImage);
  document.querySelectorAll('[data-close]').forEach(el => el.addEventListener('click', closeModal));
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && !$('#poster-modal').classList.contains('hidden')) closeModal(); });

  initCover();
})();
