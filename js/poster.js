/* ============================================================
   海报 / 雷达图 / 彩带 / 分享 —— 纯 Canvas，无依赖
   ============================================================ */

const RB_Poster = (() => {

  /* ---------- 通用 ---------- */
  function rr(ctx, x, y, w, h, r) {
    const radius = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.arcTo(x + w, y, x + w, y + h, radius);
    ctx.arcTo(x + w, y + h, x, y + h, radius);
    ctx.arcTo(x, y + h, x, y, radius);
    ctx.arcTo(x, y, x + w, y, radius);
    ctx.closePath();
  }

  function wrap(ctx, text, maxWidth) {
    const lines = [];
    let line = '';
    for (const ch of text) {
      if (line && ctx.measureText(line + ch).width > maxWidth) { lines.push(line); line = ch; }
      else line += ch;
    }
    if (line) lines.push(line);
    return lines;
  }

  const FS = "system-ui, -apple-system, 'PingFang SC', 'Microsoft YaHei', sans-serif";
  const FD = "'ZCOOL KuaiLe', 'PingFang SC', 'Microsoft YaHei', sans-serif";

  /* ---------- 雷达图（结果页） ----------
     axesData = [{ val: number(0-100), label: string }, ...]
     展示口径：原始值映射到 60–100 区间（最低 60，其余同比递增），
     顶点标注维度文字而非数字。 */
  function drawRadar(canvas, axesData, accent) {
    const dpr = window.devicePixelRatio || 1;
    const size = 268;
    canvas.width = size * dpr; canvas.height = size * dpr;
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);

    const cx = size / 2, cy = size / 2, R = size * 0.37;
    const n = axesData.length;

    // 映射：原始 0→60，100→100；最低不低于 60
    const mappedScores = axesData.map(d => 60 + d.val * 0.4);

    const angle = i => -Math.PI / 2 + (Math.PI * 2 * i) / n;

    const hex = accent.replace('#', '');
    const cr = parseInt(hex.slice(0, 2), 16), cg = parseInt(hex.slice(2, 4), 16), cb = parseInt(hex.slice(4, 6), 16);

    let t = 0;
    const dur = 650;
    const step = ts => {
      if (!t) t = ts;
      const p = Math.min((ts - t) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      ctx.clearRect(0, 0, size, size);

      // 网格环
      for (let ring = 1; ring <= 3; ring++) {
        ctx.beginPath();
        const rr_ = R * ring / 3;
        for (let i = 0; i < n; i++) {
          const a = angle(i);
          const x = cx + Math.cos(a) * rr_, y = cy + Math.sin(a) * rr_;
          i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.strokeStyle = `rgba(255,255,255,${0.07 + ring * 0.02})`;
        ctx.stroke();
      }
      // 轴线 + 维度文字标签
      ctx.font = `500 11.5px ${FS}`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let i = 0; i < n; i++) {
        const a = angle(i);
        ctx.beginPath();
        ctx.moveTo(cx, cy);
        ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
        ctx.strokeStyle = 'rgba(255,255,255,.06)';
        ctx.stroke();
        const lx = cx + Math.cos(a) * (R + 20), ly = cy + Math.sin(a) * (R + 20);
        ctx.fillStyle = 'rgba(255,255,255,.55)';
        ctx.fillText(axesData[i].label, lx, ly);
      }
      // 数据面（使用映射后的分值，最低 60）
      ctx.beginPath();
      for (let i = 0; i < n; i++) {
        const a = angle(i);
        const v = R * mappedScores[i] / 100 * eased;
        const x = cx + Math.cos(a) * v, y = cy + Math.sin(a) * v;
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fillStyle = `rgba(${cr},${cg},${cb},.16)`;
      ctx.fill();
      ctx.strokeStyle = `rgba(${cr},${cg},${cb},.9)`;
      ctx.lineWidth = 1.6;
      ctx.stroke();
      // 顶点圆点
      for (let i = 0; i < n; i++) {
        const a = angle(i);
        const v = R * mappedScores[i] / 100 * eased;
        ctx.beginPath();
        ctx.arc(cx + Math.cos(a) * v, cy + Math.sin(a) * v, 3, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${cr},${cg},${cb},1)`;
        ctx.fill();
      }
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ---------- 彩带 ---------- */
  function confetti(color) {
    const cv = document.createElement('canvas');
    cv.className = 'confetti';
    cv.width = innerWidth; cv.height = innerHeight;
    document.body.appendChild(cv);
    const ctx = cv.getContext('2d');
    const palette = ['#ffffff', color, '#ff5fae', '#54c5ff', '#ffb020'];
    const parts = Array.from({ length: 90 }, () => ({
      x: innerWidth * (.3 + Math.random() * .4),
      y: -20 - Math.random() * innerHeight * .3,
      vx: (Math.random() - .5) * 3.4,
      vy: 2.6 + Math.random() * 3.4,
      s: 4 + Math.random() * 7,
      r: Math.random() * Math.PI,
      vr: (Math.random() - .5) * .24,
      c: palette[(Math.random() * palette.length) | 0],
      a: Math.random() > .5,
    }));
    let start = performance.now(), alive = true;
    setTimeout(() => (alive = false), 2400);
    (function loop(now) {
      const el = now - start;
      ctx.clearRect(0, 0, cv.width, cv.height);
      const fade = el > 1800 ? Math.max(0, 1 - (el - 1800) / 600) : 1;
      for (const p of parts) {
        p.x += p.vx; p.y += p.vy; p.r += p.vr; p.vy += .045;
        ctx.save();
        ctx.globalAlpha = fade * (.9 - p.y / innerHeight * .4);
        ctx.translate(p.x, p.y); ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        if (p.a) {
          ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.s / 2.6, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      }
      if (alive && el < 3200) requestAnimationFrame(loop);
      else cv.remove();
    })(performance.now());
  }

  /* ---------- QR（外网服务，失败自动降级为短链文字） ---------- */
  function loadQR(url, size) {
    return new Promise(resolve => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      const timer = setTimeout(() => resolve(null), 3500);
      img.onload = () => { clearTimeout(timer); resolve(img); };
      img.onerror = () => { clearTimeout(timer); resolve(null); };
      img.src = url;
    });
  }

  /* ---------- 任意图片加载（超时降级 null，供海报叠角色头像用） ---------- */
  function loadImg(src, timeout = 2500) {
    return new Promise(resolve => {
      if (!src) return resolve(null);
      const img = new Image();
      const timer = setTimeout(() => resolve(null), timeout);
      img.onload = () => { clearTimeout(timer); resolve(img); };
      img.onerror = () => { clearTimeout(timer); resolve(null); };
      img.src = src;
    });
  }

  /* ---------- 分享海报 ---------- */
  async function buildShare(result) {
    const W = 750, H = 1334;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const { ARCHETYPES } = window.RB_DATA;
    const arc = ARCHETYPES[result.archetype];
    const colors = arc.colors;

    // 按性别取对应版本的头像（无 gender 或其他默认女版兜底）
    const gender = result.gender || '';
    const avatarFile = arc.avatarF.replace(/-f\.webp$/, gender === '男' ? '-m.webp' : '-f.webp');
    const arcImg = await loadImg('/avatars/' + avatarFile, 2500);

    // 底
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#12101f');
    bg.addColorStop(.55, colors.deep);
    bg.addColorStop(1, '#070610');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // 光斑
    const glow = ctx.createRadialGradient(W * .82, 150, 30, W * .82, 150, 430);
    glow.addColorStop(0, colors.glow);
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, 640);
    const glow2 = ctx.createRadialGradient(W * .1, 1050, 30, W * .1, 1050, 400);
    glow2.addColorStop(0, 'rgba(84,197,255,.14)');
    glow2.addColorStop(1, 'transparent');
    ctx.fillStyle = glow2; ctx.fillRect(0, 700, W, 634);

    // 内边框
    ctx.strokeStyle = 'rgba(255,255,255,.14)';
    ctx.lineWidth = 1.5;
    rr(ctx, 26, 26, W - 52, H - 52, 44); ctx.stroke();

    const ink = '#f5f3ff', dim = 'rgba(245,243,255,.62)';

    // 顶部小字
    ctx.textAlign = 'left';
    ctx.font = `700 21px ${FS}`;
    ctx.fillStyle = colors.accent;
    ctx.fillText('REBOOT PERSONALITY №' + arc.num, 64, 112);
    ctx.font = `400 24px ${FS}`;
    ctx.fillStyle = dim;
    ctx.fillText('人生重启 · 人格图鉴', 64, 148);

    // 角色头像（右上区域 · 大尺寸跟结果页 .res-hero 同款沉浸感）
    if (arcImg) {
      const aw = 254, ah = 317;               // 4:5 · 原 330×412 ÷1.3
      const ax = W - 56 - aw;                  // 右留 56px
      const ay = 190;                         // 上方留空给 header；头像底部 y=602 与下方文字留 20px 间隙
      ctx.save();
      ctx.shadowColor = colors.glow; ctx.shadowBlur = 80; ctx.shadowOffsetY = 12;
      rr(ctx, ax, ay, aw, ah, 24); ctx.fillStyle = 'rgba(255,255,255,.04)'; ctx.fill();
      ctx.clip();
      ctx.drawImage(arcImg, ax, ay, aw, ah);
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 1;
      rr(ctx, ax, ay, aw, ah, 24); ctx.stroke();
    } else {
      // 无头像时降级为半透明水印大数字（fallback）
      ctx.save();
      ctx.font = `400 300px ${FD}`;
      ctx.fillStyle = 'rgba(255,255,255,.05)';
      ctx.textAlign = 'right';
      ctx.fillText(arc.num, W - 48, 380);
      ctx.restore();
    }

    // EN 名（左对齐，头像下方区域全宽）
    ctx.textAlign = 'left';
    ctx.font = `700 25px ${FS}`;
    ctx.fillStyle = dim;
    const enSpaced = arc.en.split('').join('\u200a') + '\u200a';
    ctx.fillText(enSpaced, 64, 372);

    // CN 大名（左对齐）
    ctx.font = `400 128px ${FD}`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(arc.cn, 60, 500);

    // 口号（左对齐 · 全宽使用）
    ctx.font = `400 31px ${FS}`;
    ctx.fillStyle = 'rgba(245,243,255,.8)';
    const sl = wrap(ctx, arc.slogan, 580);
    sl.forEach((ln, i) => ctx.fillText(ln, 63, 568 + i * 46));

    // 关键词（自动换行排布）
    ctx.font = `700 22px ${FS}`;
    let kx = 64, ky = 668;
    arc.keywords.forEach(kw => {
      const w = ctx.measureText(kw).width + 44;
      if (kx > 64 && kx + w > W - 64) { kx = 64; ky += 62; }
      ctx.strokeStyle = 'rgba(255,255,255,.18)';
      rr(ctx, kx, ky, w, 46, 23); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.85)';
      ctx.textBaseline = 'middle';
      ctx.fillText(kw, kx + 22, ky + 24);
      kx += w + 14;
    });
    ctx.textBaseline = 'alphabetic';

    // 分隔线
    ctx.strokeStyle = 'rgba(255,255,255,.12)';
    ctx.beginPath(); ctx.moveTo(64, 770); ctx.lineTo(W - 64, 770); ctx.stroke();

    // 三指标条
    ctx.font = `900 40px ${FS}`;
    result.chips.forEach((c, i) => {
      const cw = (W - 64 * 2 - 32 * 2) / 3, x = 64 + i * (cw + 32), y = 800;
      ctx.fillStyle = 'rgba(255,255,255,.045)';
      rr(ctx, x, y, cw, 108, 20); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.12)';
      rr(ctx, x, y, cw, 108, 20); ctx.stroke();
      ctx.fillStyle = colors.accent;
      ctx.textAlign = 'center';
      ctx.fillText(c.pct + '', x + cw / 2, y + 60);
      ctx.font = `400 21px ${FS}`;
      ctx.fillStyle = dim;
      ctx.fillText(c.name, x + cw / 2, y + 92);
      ctx.font = `900 40px ${FS}`;
      ctx.textAlign = 'left';
    });

    // 稀有度
    ctx.font = `700 24px ${FS}`;
    ctx.fillStyle = colors.accent;
    ctx.fillText('— 和你相似的人不少，你不是一个人', 64, 990);

    // 二维码（位置在稀有度右侧）
    const link = location.href.split('#')[0];
    const qr = await loadQR(
      'https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=8&bgcolor=14121f&color=ffffff&data=' + encodeURIComponent(link),
      220
    );
    const qx = W - 64 - 150, qy = 1030;
    if (qr) {
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,.4)'; ctx.shadowBlur = 20; ctx.shadowOffsetY = 8;
      rr(ctx, qx, qy, 150, 150, 18); ctx.fillStyle = '#fff'; ctx.fill();
      ctx.restore();
      ctx.drawImage(qr, qx + 10, qy + 10, 130, 130);
    } else {
      rr(ctx, qx, qy, 150, 150, 18);
      ctx.fillStyle = 'rgba(255,255,255,.08)'; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.2)'; ctx.stroke();
      ctx.font = `700 14px ${FS}`;
      ctx.fillStyle = dim; ctx.textAlign = 'center';
      ctx.fillText('长按识别小程序码', qx + 75, qy + 78);
    }

    // 左下引导文案（压缩到两行，底不溢出）
    ctx.textAlign = 'left';
    ctx.font = `900 30px ${FD}`;
    ctx.fillStyle = '#fff';
    ctx.fillText('测测你适合怎样重启', 64, 1098);
    ctx.font = `400 17px ${FS}`;
    ctx.fillStyle = dim;
    const host = location.hostname.replace(/^www\./, '');
    ctx.fillText(host + ' · 17 道题 · 趣味性格探索 · 不构成医疗或就业承诺', 64, 1148);

    const url = cv.toDataURL('image/png');
    return url;
  }

  /* ---------- 深度报告分享卡（3:4，可保存/转发） ---------- */
  async function buildReportCard(result, summary) {
    const W = 750, H = 1000;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');
    const { ARCHETYPES, AXES } = window.RB_DATA;
    const arc = ARCHETYPES[result.archetype] || ARCHETYPES['ii_at_sj_2'];
    const colors = arc.colors;
    const norm = result.norm || {};

    // 底与光斑
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, '#12101f');
    bg.addColorStop(.55, colors.deep);
    bg.addColorStop(1, '#070610');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(W * .86, 110, 20, W * .86, 110, 360);
    glow.addColorStop(0, colors.glow); glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, W, 520);
    ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 1.5;
    rr(ctx, 24, 24, W - 48, H - 48, 40); ctx.stroke();

    const ink = '#f5f3ff', dim = 'rgba(245,243,255,.62)', faint = 'rgba(245,243,255,.42)';

    // 顶栏 + 角色头像（右上）
    ctx.textAlign = 'left';
    ctx.font = `700 19px ${FS}`;
    ctx.fillStyle = colors.accent;
    ctx.fillText('DEEP REPORT · 重启人格图鉴', 56, 86);
    ctx.font = `400 17px ${FS}`;
    ctx.fillStyle = faint;
    ctx.fillText(`图鉴 №${arc.num}`, 56, 116);

    const gender = result.gender === '男' ? 'm' : 'f';
    const avatarFile = String(arc.avatarF || '').replace(/-f\.webp$/, `-${gender}.webp`);
    const arcImg = await loadImg('/avatars/' + avatarFile, 2500);
    const aw = 104, ah = 130, ax = W - 56 - aw, ay = 50;
    if (arcImg) {
      ctx.save();
      ctx.shadowColor = colors.glow; ctx.shadowBlur = 48; ctx.shadowOffsetY = 8;
      rr(ctx, ax, ay, aw, ah, 16); ctx.fillStyle = 'rgba(255,255,255,.04)'; ctx.fill(); ctx.clip();
      ctx.drawImage(arcImg, ax, ay, aw, ah);
      ctx.restore();
      ctx.strokeStyle = 'rgba(255,255,255,.14)'; ctx.lineWidth = 1;
      rr(ctx, ax, ay, aw, ah, 16); ctx.stroke();
    } else {
      rr(ctx, ax, ay, aw, ah, 16); ctx.fillStyle = 'rgba(255,255,255,.06)'; ctx.fill();
    }

    // 类型
    ctx.font = `400 104px ${FD}`;
    ctx.fillStyle = '#fff';
    ctx.fillText(arc.cn, 52, 222);
    ctx.font = `700 21px ${FS}`;
    ctx.fillStyle = dim;
    ctx.fillText(arc.en.split('').join('\u200a'), 58, 258);
    ctx.font = `400 25px ${FS}`;
    ctx.fillStyle = 'rgba(245,243,255,.78)';
    const sl = wrap(ctx, arc.slogan, W - 128);
    sl.slice(0, 2).forEach((ln, i) => ctx.fillText(ln, 56, 304 + i * 34));

    // 关键词
    ctx.font = `700 18px ${FS}`;
    let kx = 56, ky = 380;
    arc.keywords.slice(0, 3).forEach(kw => {
      const w = ctx.measureText(kw).width + 34;
      if (kx + w > W - 56) return;
      ctx.strokeStyle = 'rgba(255,255,255,.18)'; rr(ctx, kx, ky, w, 38, 19); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.84)'; ctx.textBaseline = 'middle';
      ctx.fillText(kw, kx + 17, ky + 20);
      kx += w + 10;
    });
    ctx.textBaseline = 'alphabetic';

    // 六维
    ctx.font = `900 21px ${FS}`;
    ctx.fillStyle = ink;
    ctx.fillText('六维画像', 56, 468);
    let by = 492;
    AXES.forEach(a => {
      const v = Math.max(0, Math.min(100, Math.round(norm[a.key] || 0)));
      ctx.font = `400 16px ${FS}`;
      ctx.fillStyle = dim;
      ctx.fillText(a.label, 56, by + 4);
      const tx = 112, tw = W - 56 - tx - 46;
      ctx.fillStyle = 'rgba(255,255,255,.08)'; rr(ctx, tx, by - 6, tw, 12, 6); ctx.fill();
      ctx.fillStyle = colors.accent; rr(ctx, tx, by - 6, Math.max(6, tw * v / 100), 12, 6); ctx.fill();
      ctx.font = `700 15px ${FS}`;
      ctx.fillStyle = colors.accent;
      ctx.textAlign = 'right';
      ctx.fillText(String(v), W - 56, by + 5);
      ctx.textAlign = 'left';
      by += 48;
    });

    // 摘要
    const txt = String(summary || arc.slogan || '').replace(/\s+/g, ' ');
    ctx.font = `400 22px ${FS}`;
    ctx.fillStyle = 'rgba(245,243,255,.76)';
    const lines = wrap(ctx, txt, W - 112);
    let sy = 806;
    lines.slice(0, 3).forEach((ln, i) => {
      const clipped = (i === 2 && lines.length > 3) ? ln.slice(0, Math.max(0, ln.length - 1)) + '…' : ln;
      ctx.fillText(clipped, 56, sy + i * 32);
    });

    // 首选方向
    const top1 = (result.top3 || [])[0];
    if (top1) {
      ctx.fillStyle = 'rgba(255,255,255,.055)';
      rr(ctx, 56, 900, W - 112, 58, 16); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.12)'; rr(ctx, 56, 900, W - 112, 58, 16); ctx.stroke();
      ctx.font = `700 15px ${FS}`;
      ctx.fillStyle = faint;
      ctx.fillText(top1.routeLabel || '稳健路线', 76, 924);
      ctx.font = `900 21px ${FS}`;
      ctx.fillStyle = ink;
      const nm = wrap(ctx, top1.name, W - 260)[0] || top1.name;
      ctx.fillText(nm, 76, 950);
      ctx.font = `700 16px ${FS}`;
      ctx.fillStyle = colors.accent;
      ctx.textAlign = 'right';
      ctx.fillText(top1.sal + '/月', W - 76, 950);
      ctx.textAlign = 'left';
    }

    // 页脚
    ctx.font = `400 14px ${FS}`;
    ctx.fillStyle = 'rgba(245,243,255,.34)';
    ctx.fillText('17 道题 · 趣味性格探索 · 不构成医疗或就业承诺', 56, 984);

    return cv.toDataURL('image/png');
  }

  /* ---------- 分享动作 ---------- */
  async function share(title, text) {
    const full = text || location.href;
    try {
      if (navigator.share) {
        await navigator.share({ title, text: full, url: location.href.split('#')[0] });
        return true;
      }
    } catch (_) { /* 用户取消，忽略 */ }
    try {
      await navigator.clipboard.writeText(full);
      return true;
    } catch (_) {
      try {
        const ta = document.createElement('textarea');
        ta.value = full;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.top = '-9999px';
        document.body.appendChild(ta);
        ta.focus(); ta.select(); ta.setSelectionRange(0, full.length);
        const ok = document.execCommand('copy');
        ta.remove();
        return ok;
      } catch (_) { return false; }
    }
  }

  return { drawRadar, confetti, buildShare, buildReportCard, share, loadQR, loadImg };
})();