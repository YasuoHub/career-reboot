/* ============================================================
   深度报告渲染（付费解锁页，价格由服务端配置）
   输入：result（app.js score() 返回的完整结果）
   输出：HTML 字符串，挂到 #report-body
   原则：数据全部来自本机作答，不上传；模板只做解释与行动建议，
        不虚构真实人物案例，不承诺就业结果。
   ============================================================ */
(() => {
  const { AXES, SKILLS, AGE_BANDS, EDU_RANK_LABEL, CASE_STORIES } = window.RB_DATA;

  const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ESC_MAP[c]);
  const pad = n => String(n).padStart(2, '0');
  const skillLabel = id => (SKILLS.find(s => s.id === id) || {}).label || id;

  function fmtDate(ts) {
    const d = new Date(Number(ts) || Date.now());
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  /* 本地摘要：AI 服务不可用时的兜底文案 */
  function localSummary(r) {
    if (!r || !r.arc) return '';
    const arc = r.arc, p = r.profile || {}, norm = r.norm || {};
    const maxAxis = AXES.reduce((a, b) => ((norm[a.key] || 0) >= (norm[b.key] || 0) ? a : b), AXES[0]);
    const top1 = (r.top3 || [])[0] || {};
    const pace = p.hours === 0 ? '全职冲刺' : p.hours === 1 ? '每周 5–15 小时' : '每周 2–5 小时';
    return `你是「${arc.cn}」：${arc.slogan} 你的「${maxAxis.label}」最突出，这让你在需要这种能力的场景里更省力。`
      + `当前最值得先验证的方向是「${top1.name || '你选的第一方向'}」；按 ${pace} 的节奏，先用 1 周做一次最低成本的小验证，`
      + `再决定要不要把时间押进去。`;
  }

  /* ---------------- 六维解读（高/中/低三档） ---------------- */
  const DIM_READ = {
    analytic: {
      high: '你处理问题的第一反应是「先拆结构」：把一团乱麻分成可排序的变量，再逐个验证。别人还在描述现象时，你已经在找因果链了。',
      mid: '你不会被数据绑架，也不完全靠直觉拍板，能在「算得清」和「来得及」之间找到可执行的平衡点。',
      low: '你更愿意先动手再校正，而不是在纸面上推到完美。这让你在信息不全时反而更快出发。',
    },
    maker: {
      high: '你要看得见摸得着的结果。想法不落地你会难受，所以你天然擅长把方案变成能交付的东西。',
      mid: '你既能想也能做，但更愿意把精力放在「做出来有人用」的环节，而不是无止境的打磨。',
      low: '你更擅长设计和协调，不必强迫自己成为执行机器——把动手环节交给工具或伙伴，效率更高。',
    },
    creative: {
      high: '你对「好不好看、有没有感觉」有近乎本能的判断。这让你在内容、产品或表达类工作里天然占优。',
      mid: '你有审美判断，但不会被它牵着走；需要时你能为了交付接受 80 分的方案。',
      low: '你更信任可验证的逻辑而不是感觉。这让你在需要稳定复现的场景里更可靠。',
    },
    social: {
      high: '你从人的反馈里获得能量，越聊越清楚。信息、机会和信任，往往是通过关系流到你这儿的。',
      mid: '你能处理关系，但不靠关系吃饭；需要时你能主动连接，独处时也能把事推进。',
      low: '你先想清楚再开口，独处是你恢复判断力的方式。深度协作比广泛社交更适合你。',
    },
    leader: {
      high: '你习惯对结果负责，遇到模糊局面会主动定方向。别人等指令时，你已经在拆下一步了。',
      mid: '你不抢方向盘，但关键时刻能站出来；适合做「专业 + 推进」的复合角色。',
      low: '你更愿意把决定权交给更合适的人，自己专注把事做扎实。这不是缺点，是分工。',
    },
    stable: {
      high: '你靠可预期性赢得信任：说到做到、交付稳定。长期关系里，这是最稀缺的资产。',
      mid: '你能守规则，也能接受变化；在秩序和弹性之间，你会按场景切换。',
      low: '你适应变化快，不喜欢被流程绑住。在需要快速试错的阶段，这是优势；在需要长期复利的阶段，要有意识地补一点「稳定输出」。',
    },
  };

  const D1_READ = {
    out: { k: '向外取能', v: '你从人的反馈里获得能量，越交流越清楚下一步。' },
    in: { k: '向内蓄能', v: '你先想清楚再行动，独处是你恢复判断力的方式。' },
  };
  const D2_READ = {
    intu: { k: '直觉优先', v: '你先看到整体和可能性，再回头补细节。' },
    ana: { k: '分析优先', v: '你先把变量拆开、验证假设，再决定要不要下注。' },
  };
  const D3_READ = {
    drv: { k: '驱动结果', v: '你习惯主动定方向，对「事情有没有往前推」高度敏感。' },
    sup: { k: '支撑系统', v: '你更擅长让系统稳定运转，把混乱整理成可复用的秩序。' },
  };
  const D4_READ = {
    orch: { k: '守序节奏', v: '你需要清晰的规则和节奏，讨厌反复推翻重来。' },
    flex: { k: '灵活节奏', v: '你能在变化里快速调整，计划被打断也不会崩。' },
  };

  /* ---------------- 12 周节奏（按每周可投入时间分档） ---------------- */
  function paceOf(hours) {
    if (hours === 0) return { label: '全职冲刺', week: '每天 4–6 小时', hint: '把 12 周压到 8 周，但要留出恢复日。' };
    if (hours === 1) return { label: '有节奏推进', week: '每周 5–15 小时', hint: '固定 3 个时间段，比「有空就学」有效得多。' };
    return { label: '轻量并行', week: '每周 2–5 小时', hint: '把 12 周拆成 4 个月慢节奏，先保证不断线。' };
  }

  function planOf(c, p) {
    const pace = paceOf(p.hours);
    const need = (c.gapSkills && c.gapSkills.length)
      ? c.gapSkills.map(skillLabel).join('、')
      : '把已有手艺整理成可展示的作品';
    return {
      pace,
      items: [
        { w: '第 1 周 · 先验证入口', t: c.week1 },
        { w: `第 2–4 周 · 补基础（${pace.week}）`, t: `按「${c.L}」拆成可打卡的小节；先完成第一轮通读 + 一个最小练习。重点补：${need}。` },
        { w: '第 5–8 周 · 做出作品', t: `围绕「${c.F}」做一个能发给别人看的小作品。不求赚钱，只求可展示、可被评价。` },
        { w: '第 9–12 周 · 换机会', t: `按「${c.J}」的路径投 10 个岗位或接 1 个低价单，带着作品换真实反馈，再决定要不要加码。` },
      ],
    };
  }

  function interviewQuestions(arc, c, p) {
    const isOut = p.social >= 40;
    const isAna = p.analytic >= p.creative;
    const isDrv = (p.leader || 0) >= Math.max(p.social || 0, p.stable || 0, p.maker || 0);
    const list = [
      isOut ? '讲一次你说服别人改变决定的经历：你看到了什么信号，怎么推进的？'
            : '讲一次你在不擅长社交的场合，仍然把事情推进下去的经历。',
      isAna ? '讲一次你把一个模糊问题拆成可执行步骤，并验证其中关键假设的经历。'
            : '讲一次你凭直觉先做、事后证明判断对了的经历。',
      isDrv ? '讲一次你主动发起、并推动到结果的项目；中途最大的阻力是什么？'
            : '讲一次你把团队或流程从混乱变有序的经历，具体改了哪几个环节？',
    ];
    if (p.stage === 'gap') {
      list.unshift('这段空窗期你具体在做什么？为什么现在决定回来？');
      list.push('如果重新上班，你打算怎么在前两周快速进入状态？');
    } else if (p.stage === 'fresh' || p.industry === '无经验') {
      list.unshift('你没有正式工作经验，凭什么觉得自己能做这个方向？');
      list.push('在校、兼职或自学期间，哪件事最能证明你上手快？');
    }
    list.push(`如果给你 3 个月从零进入「${c.name}」，你会按什么顺序学、先做哪个作品？`);
    return list;
  }

  function resumeSample(c, p) {
    const stage = p.stage || '';
    const own = (p.skills || []).map(skillLabel).filter(Boolean).slice(0, 2);
    const skillText = own.length ? own.join(' + ') : '你愿意学的入门技能';

    if (stage === 'gap') {
      return `空窗期不是空白，但别写成「待业」。把它写成一段主动安排：<br />`
        + `「空窗期（20XX.XX–20XX.XX）里，我系统学习了【课程 / 证书】，完成【一个作品 / 项目】，`
        + `同时承担【家庭照护 / 兼职】；现在希望把【能力】用到【${c.name}】方向。」<br />`
        + `<em>关键：说明这段时间你并没有停，只是换了一种方式积累。</em>`;
    }
    if (stage === 'fresh' || p.industry === '无经验') {
      return `没有正式工作也能写：把「在学校 / 兼职 / 自己做过的项目」改成可量化的一句：<br />`
        + `「在【社团 / 兼职 / 自学项目】里，用【${skillText}】把【某个具体问题】解决到【结果】，`
        + `服务或影响了【X】人。」<br />`
        + `<em>没有精确数字就写范围；重点写「你具体做了什么」，而不是「你参与过」。</em>`;
    }
    const industry = p.industry && p.industry !== '其他' ? p.industry : '上一份工作';
    return `把简历里「负责${industry}相关工作的执行与协调」这类描述，改成有变量、有结果的一句：<br />`
      + `「在【${industry}】项目中，用【${skillText}】把【某个混乱流程】重做成【可复用 SOP / 模板】，`
      + `让【耗时 / 返工 / 投诉】从【X】降到【Y】。」<br />`
      + `<em>把【】换成你的真实数据；没有精确数字就用范围，但别编。</em>`;
  }

  function bar(label, val) {
    const v = Math.max(0, Math.min(100, Math.round(Number(val) || 0)));
    return `<div class="rep-bar"><span>${esc(label)}</span><i><b style="width:${v}%"></b></i><em>${v}</em></div>`;
  }

  function build(r, ctx = {}) {
    if (!r || !r.arc) return '<p class="rep-empty">报告数据丢失，请重新测试。</p>';
    const arc = r.arc;
    const p = r.profile || {};
    const isGap = p.stage === 'gap';
    const isFresh = !isGap && (p.stage === 'fresh' || p.industry === '无经验');
    const norm = r.norm || {};
    const orderNo = ctx.order?.outTradeNo || ctx.unlock?.outTradeNo || '';
    const gender = r.gender === '男' ? 'm' : 'f';
    const avatarFile = String(arc.avatarF || '').replace(/-f\.webp$/, `-${gender}.webp`);

    const maxKey = AXES.reduce((a, b) => (norm[a.key] || 0) >= (norm[b.key] || 0) ? a : b).key;
    const minKey = AXES.reduce((a, b) => (norm[a.key] || 0) <= (norm[b.key] || 0) ? a : b).key;
    const maxLabel = (AXES.find(a => a.key === maxKey) || {}).label || '';
    const minLabel = (AXES.find(a => a.key === minKey) || {}).label || '';

    const d1 = norm.social >= 40 ? D1_READ.out : D1_READ.in;
    const d2 = norm.creative >= norm.analytic ? D2_READ.intu : D2_READ.ana;
    const d3 = norm.leader >= Math.max(norm.social || 0, norm.stable || 0, norm.maker || 0) ? D3_READ.drv : D3_READ.sup;
    const d4 = norm.stable >= 55 ? D4_READ.orch : D4_READ.flex;

    const kw = arc.keywords || [];
    const ageText = AGE_BANDS[p.ageBand] ? `${AGE_BANDS[p.ageBand]} 岁区间` : '';
    const eduText = EDU_RANK_LABEL[p.eduRank] || '';
    const hoursText = paceOf(p.hours).label;
    const prefText = p.pref || '';

    /* §1 你是谁 */
    const sec1 = `
      <section class="rep-sec">
        <div class="rep-sec-h"><span>01</span><h2>你是谁</h2><em>WHO YOU ARE</em></div>
        <div class="rep-prose">
          <h4>① 你的底色</h4>
          <p>你是「${esc(arc.cn)}」——${esc(arc.slogan)}。你的答案里反复出现 <b>${kw.map(k => `「${esc(k)}」`).join('')}</b> 三种倾向；
          ${ageText ? `结合你处在 ${esc(ageText)}、` : ''}${eduText ? `学历背景 ${esc(eduText)}、` : ''}当前更像是在「${esc(r.context || '重启期')}」的节奏里做选择。</p>

          <h4>② 为什么是这样</h4>
          <p>你的六维分布推导出四条主轴：<b>${esc(d1.k)}</b>（${esc(d1.v)}）、<b>${esc(d2.k)}</b>（${esc(d2.v)}）、
          <b>${esc(d3.k)}</b>（${esc(d3.v)}）、<b>${esc(d4.k)}</b>（${esc(d4.v)}）。
          四条叠在一起，就是「${esc(arc.cn)}」的行为骨架——不是标签，而是你在压力下更可能重复的那套反应。</p>

          <h4>③ 你可能没意识到的优势</h4>
          <p>你的 <b>${esc(maxLabel)}</b> 维度最突出（${norm[maxKey] ?? 0}/100）。这意味着在需要「${esc(maxLabel)}」的场景里，你不需要靠意志力硬撑，
          别人觉得费劲的事，你做起来更顺手。<br />
          反过来，<b>${esc(minLabel)}</b> 维度（${norm[minKey] ?? 0}/100）不是短板，而是提醒你：尽量别把职业重心押在它上面，
          用工具、伙伴或流程去补，比逼自己变成另一种人更划算。</p>
        </div>

        <h4 class="rep-h4">六维详细拆解</h4>
        <div class="rep-dims">
          ${AXES.map(a => {
            const v = norm[a.key] || 0;
            const read = DIM_READ[a.key] || {};
            const text = v >= 65 ? read.high : v >= 35 ? read.mid : read.low;
            return `<div class="rep-dim">
              ${bar(a.label, v)}
              <p>${esc(text || '')}</p>
            </div>`;
          }).join('')}
        </div>

        <h4 class="rep-h4">同型的人，怎么走过这段路</h4>
        <p class="rep-case-note">以下为示意性虚构场景（非真实人物访谈），用来看见几种可能路径，不是标准答案。</p>
        <div class="rep-cases">
          ${(CASE_STORIES[r.archetype] || []).map(cs => `
            <div class="rep-case">
              <p class="rep-case-who">${esc(cs.who)}</p>
              <p class="rep-case-path">${esc(cs.path)}</p>
              <p class="rep-case-note-in">${esc(cs.note)}</p>
              <blockquote>「${esc(cs.quote)}」</blockquote>
            </div>`).join('')}
        </div>

        <div class="rep-idcard">
          <span>${esc(ageText || '年龄未填')}</span>
          <span>${esc(eduText || '学历未填')}</span>
          <span>${esc(p.industry ? `前行业：${p.industry}` : '前行业未填')}</span>
          <span>${esc(prefText ? `工作形态：${prefText}` : '工作形态未填')}</span>
          <span>${esc(hoursText)}</span>
        </div>
      </section>`;

    /* §2 TOP3 展开 */
    const sec2 = `
      <section class="rep-sec">
        <div class="rep-sec-h"><span>02</span><h2>你可以做什么</h2><em>THREE ROADS</em></div>
        <p class="rep-lead">下面三条是你这份作答里匹配度最高的方向。每条都给出「为什么是你 + 12 周怎么走 + 怎么把经历讲成故事」。</p>
        ${(r.top3 || []).map((c, i) => {
          const plan = planOf(c, p);
          const fb = c.fb || {};
          return `
          <article class="rep-career">
            <header class="rep-career-h">
              <span class="rep-rank">#${i + 1}</span>
              <div>
                <h3>${esc(c.name)}</h3>
                <p>${esc(c.sal)}/月 · 适配度 ${esc(c.scoreNum)} <span class="rep-tags">${(c.tags || []).map(t => `#${esc(t)}`).join(' ')}</span></p>
              </div>
            </header>

            <h4>为什么适合你</h4>
            <div class="rep-fbs">
              ${Object.entries(fb).map(([k, v]) => bar(k, v)).join('')}
            </div>
            <p class="rep-note">这些分不是玄学：技能重合看你会的手艺，行业迁移看${isFresh ? '你的兴趣/专业与这个方向的距离' : '你上一段经历能不能复用'}，性格延续看你做得顺不顺手，市场时机看岗位供需，投入可行看你每周能挤出多少时间。</p>

            <h4>12 周路线（${esc(plan.pace.label)}）</h4>
            <p class="rep-note">${esc(plan.pace.hint)}</p>
            <ol class="rep-plan">
              ${plan.items.map(it => `<li><b>${esc(it.w)}</b><span>${esc(it.t)}</span></li>`).join('')}
            </ol>

            <h4>需要补的手艺</h4>
            <p>${(c.gapSkills && c.gapSkills.length)
              ? `你目前缺的是 <b>${c.gapSkills.map(skillLabel).map(esc).join('、')}</b>。先补最短缺的那一项，别同时开五个坑。`
              : '关键手艺你已经齐了，缺的只是把它们打包成作品和案例。'}</p>

            <h4>${isFresh ? '经历改写示例' : '简历改写示例'}</h4>
            <blockquote class="rep-resume">${resumeSample(c, p)}</blockquote>

            <h4>面试会问到的</h4>
            <ul class="rep-qa">${interviewQuestions(arc, c, { ...p, ...norm }).map(q => `<li>${esc(q)}</li>`).join('')}</ul>

            <p class="rep-week1"><em>本周就能做：</em>${esc(c.week1)}</p>
          </article>`;
        }).join('')}
      </section>`;

    /* §3 三件事 */
    const top1 = (r.top3 || [])[0] || {};
    const sec3 = `
      <section class="rep-sec">
        <div class="rep-sec-h"><span>03</span><h2>接下来三件事</h2><em>NEXT 3 MOVES</em></div>
        <div class="rep-moves">
          <div class="rep-move">
            <b>本周</b>
            <p>${esc(top1.week1 || '选一个方向，做一次最低成本的小验证：找一位在做这行的人聊 20 分钟。')}</p>
          </div>
          <div class="rep-move">
            <b>本月</b>
            <p>${isFresh
              ? `把一次课程设计、社团活动或兼职经历，从头到尾写成一份复盘：背景、你负责什么、结果如何。它会成为你面试「${esc(top1.name || '新方向')}」时最实在的弹药。`
              : isGap
                ? `把空窗期做过的学习、照护、接活整理成一条时间线，写成一段 150 字的「这段时间我在做什么」。面试被问到时，你能平静地讲完。`
                : `把上一份工作里最复杂的一个项目，从头到尾写成一份 SOP。它既是你面试的弹药，也是进入「${esc(top1.name || '新方向')}」的敲门砖。`}</p>
          </div>
          <div class="rep-move">
            <b>下月</b>
            <p>按「${esc(top1.L || '第 2–4 周计划')}」完成第一阶段，并产出一个能公开看的小作品（发到小红书 / 知乎 / GitHub 任一平台）。</p>
          </div>
        </div>
      </section>`;

    /* §4 尾卡 */
    const sec4 = `
      <section class="rep-sec rep-tail">
        <div class="rep-sec-h"><span>04</span><h2>带走这张卡</h2><em>YOUR KIT</em></div>
        <div class="rep-kit">
          <p class="rep-kit-title">${esc(arc.cn)} <small>${esc(arc.en)}</small></p>
          <p class="rep-kit-line">${esc(arc.slogan)}</p>
          <div class="rep-kit-meta">
            <span>${esc(ageText || '—')}</span>
            <span>${esc(p.industry || '—')}</span>
            <span>${esc(hoursText)}</span>
            <span>适配首选：${esc(top1.name || '—')}</span>
          </div>
          <p class="rep-kit-foot">保存报告卡，或回到结果页生成分享海报。</p>
          <button class="btn btn-primary rep-card-btn" id="report-card-save" type="button">保存报告卡</button>
        </div>
        <p class="rep-legal">
          本报告基于你在 ${esc(fmtDate(r.ts))} 的本地作答生成；同型人物案例为示意性虚构场景，非真实人物访谈；不构成医疗、心理诊断或就业承诺。
          ${orderNo ? `<br />订单号：<code>${esc(orderNo)}</code>（如需售后核验请保留）` : ''}
          <br /><a href="/legal.html#terms" target="_blank" rel="noopener">用户协议</a> · <a href="/legal.html#privacy" target="_blank" rel="noopener">隐私政策</a>
        </p>
      </section>`;

    return `
      <div class="rep-cover">
        <p class="rep-kicker">DEEP REPORT · 深度报告</p>
        <div class="rep-hero">
          <div class="rep-hero-text">
            <p class="rep-no">图鉴 №${esc(arc.num)} · 仅占 ${esc(arc.rarity)}%</p>
            <h1>${esc(arc.cn)}<small>${esc(arc.en)}</small></h1>
            <p class="rep-slogan">${esc(arc.slogan)}</p>
          </div>
          <img class="rep-avatar" src="/avatars/${esc(avatarFile)}" alt="${esc(arc.cn)}" loading="lazy" />
        </div>
        <p class="rep-meta">生成于 ${esc(fmtDate(r.ts))}${orderNo ? ` · 订单 ${esc(orderNo)}` : ''}</p>
      </div>
      <section class="rep-sec rep-ai">
        <div class="rep-sec-h"><span>00</span><h2>你的重启摘要</h2><em>SUMMARY</em></div>
        <p class="rep-ai-text" id="rep-ai-text">${esc(localSummary(r))}</p>
        <p class="rep-ai-note" id="rep-ai-note">基于您的作答智能生成</p>
      </section>
      ${sec1}
      ${sec2}
      ${sec3}
      ${sec4}`;
  }

  window.RB_Report = { build, localSummary };
})();
