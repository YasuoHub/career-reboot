/* 多原型线上回归（真实浏览器点击，Playwright）
 *
 * 运行前提：
 *   1) npm i playwright（或复用本机已有安装）
 *   2) 无头内核未装时改用系统 Chrome：
 *      chromium.launch({ channel: 'chrome' })
 *   3) 本地/线上地址切换：把 URL 常量改成 'https://www.career-turn.icu'
 *      （本地时去掉 URL 参数，直接 window.open 相对路径亦可）
 *
 * 校验内容：8 大原型 + 2 组混答，每组走完整答题→结果页，
 * 断言页面无 JS 错误且结果原型名与离线复算一致。
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

global.window = {};
eval(fs.readFileSync(path.join(__dirname, '..', 'js', 'data.js'), 'utf8'));
const { QUESTIONS, AXES, AXES_MAX, ARCHETYPES } = window.RB_DATA;

function detect(a) {
  const d = {};
  QUESTIONS.forEach(q => { const o = q.opts[a[q.id]]; if (!o) return;
    if (o.add && o.add.dims) Object.entries(o.add.dims).forEach(([k, v]) => (d[k] = (d[k] || 0) + v)); });
  const n = {}; AXES.forEach(x => n[x.key] = Math.round(((d[x.key] || 0) / AXES_MAX[x.key]) * 100));
  const r = [...AXES].sort((x, y) => n[y.key] - n[x.key]);
  let id = r[0].key;
  for (const [iid, ac] of Object.entries(ARCHETYPES))
    if (ac.combo && ac.combo.includes(r[0].key) && ac.combo.includes(r[1].key) && n[r[1].key] >= n[r[0].key] * 0.55) id = iid;
  return id;
}

const URL = process.env.SITE_URL || 'https://www.career-turn.icu';

const patterns = [
  ['解题人', { q3: 0, q4: 0, q5: 0 }],
  ['造物者', { q3: 3, q4: 2, q5: 1 }],
  ['造梦师', { q3: 2, q4: 1, q5: 2 }],
  ['连接人', { q3: 4, q4: 3, q5: 3 }],
  ['破局者', { q3: 1, q6: 2, q8: 0 }],
  ['定盘星', { q3: 1, q6: 0, q8: 1 }],
  ['架构师', { q3: 3, q4: 0, q5: 1 }],
  ['舞台派', { q3: 2, q4: 3, q5: 2, q8: 3 }],
  ['混答A',  { q1: 2, q2: 2, q3: 0, q4: 1, q5: 0, q6: 1, q7: 1, q8: 2 }],
  ['混答B',  { q1: 0, q2: 1, q3: 4, q4: 2, q5: 3, q6: 2, q7: 2, q8: 3 }],
];

(async () => {
  const browser = await chromium.launch({ channel: 'chrome' }); // 系统 Chrome，勿下载内核
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const allErrs = [];
  page.on('pageerror', e => allErrs.push(e.message));

  let pass = 0;
  for (let pi = 0; pi < patterns.length; pi++) {
    const [name, patch] = patterns[pi];
    const answers = {}; QUESTIONS.forEach(q => answers[q.id] = 1);
    Object.assign(answers, patch);
    const expected = ARCHETYPES[detect(answers)].cn;

    let okGoto = false;
    for (let t = 0; !okGoto && t < 3; t++) {
      try { await page.goto(URL, { waitUntil: 'domcontentloaded', timeout: 20000 }); okGoto = true; }
      catch (_) { console.log(name, 'goto 重试', t + 1); }
    }
    if (!okGoto) { console.log(name, ': FETCH_FAIL'); continue; }

    if (pi === 0) {
      await page.waitForFunction(() => !document.getElementById('loader'), null, { timeout: 8000 })
        .then(() => console.log('loading层:', '已移除 OK'))
        .catch(() => console.log('loading层:', '残留(异常)'));
    }

    await page.click('#btn-start');
    for (let i = 0; i < 8; i++) {
      await page.waitForSelector('.q-panel .opt >> nth=0', { timeout: 5000 });
      await page.locator('.q-panel .opt').nth(answers[QUESTIONS[i].id]).click();
      await page.waitForTimeout(200);
    }
    try {
      await page.waitForSelector('#sc-result.active', { timeout: 15000 });
      const got = (await page.locator('.res-name').textContent()).trim();
      const mark = got === expected ? 'PASS' : 'MISMATCH';
      if (mark === 'PASS') pass++;
      console.log(name.padEnd(4), '->', got, '| 期望', expected, '|', mark);
    } catch (_) {
      console.log(name, ': RESULT_TIMEOUT');
    }
  }

  console.log(`回归结果: ${pass}/${patterns.length} PASS | 页面错误: ${allErrs.length ? JSON.stringify(allErrs.slice(0, 3)) : '无'}`);
  await browser.close();
})().catch(e => { console.error('FATAL:', e.message); process.exit(1); });