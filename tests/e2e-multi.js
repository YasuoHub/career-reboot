/* 多原型线上回归（真实浏览器点击，Playwright）· v3·16型
 *
 * 运行前提：
 *   1) npm i playwright（或复用本机已有安装）
 *   2) 无头内核未装时改用系统 Chrome：chromium.launch({ channel: 'chrome' })
 *   3) 本地/线上地址切换：把 URL 常量改成你的地址
 *
 * 校验内容：构造覆盖 4 组二值判别维度边界的代表答案组合，
 * 走完整答题→结果页，断言无 JS 错误且原型名与离线 classify() 一致。
 */
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

global.window = {};
eval(fs.readFileSync('D:/production/practice/career-reboot/js/data.js', 'utf8'));
const { QUESTIONS, AXES, AXES_MAX, ARCHETYPES, CLASSIFY_DIM } = window.RB_DATA;

function detect(a) {
  const d = {};
  QUESTIONS.forEach(q => {
    if (q.city) return;
    const o = q.opts[a[q.id]]; if (!o) return;
    if (o.add && o.add.dims) Object.entries(o.add.dims).forEach(([k, v]) => (d[k] = (d[k] || 0) + v));
  });
  const n = {}; AXES.forEach(x => n[x.key] = Math.round(((d[x.key] || 0) / AXES_MAX[x.key]) * 100));
  // 16型 classify 四组二值判别
  const ext = CLASSIFY_DIM.D1_ext(n);
  const intui = CLASSIFY_DIM.D2_intu(n);
  const drv = CLASSIFY_DIM.D3_drv(n);
  const orch = CLASSIFY_DIM.D4_orch(n);
  const id = `${ext ? 'ei' : 'ii'}_${intui ? 'in' : 'at'}_${drv ? 'jp' : 'sj'}_${orch ? '1' : '2'}`;
  return id;
}

const URL = process.env.SITE_URL || 'https://www.career-turn.icu';

/* 构造代表答案：每组拼出不同四值组合 */
function mk(patch) { const a = {}; QUESTIONS.forEach(q => a[q.id] = 1); Object.assign(a, patch); return a; }

// 基础全1分 → 各轴均分；再叠加单轴偏置看分类漂移
const patterns = [
  // 全1基线（无偏置）→ 应稳定落在一型
  ['基线-全1', {}],
  // 高social偏置 → D1外向
  ['高社交', { q3: 4, q4: 3, q5: 3, q8: 3 }],
  // 高analytic+maker偏置 → D2分析侧/D3驱动侧（leader也高时偏驱动）
  ['高分析', { q3: 0, q4: 0, q5: 0 }],
  // 高creative+social偏置 → D2直觉侧
  ['高直觉', { q3: 2, q4: 1, q5: 2 }],
  // 高stable偏置 → D4守序侧
  ['高稳定', { q3: 1, q6: 0, q8: 1 }],
  // 高leader偏置 → D3驱动侧
  ['高驱动', { q3: 1, q6: 2, q8: 0 }],
  // 混答A
  ['混答A',  { q1: 2, q2: 2, q3: 0, q4: 1, q5: 0, q6: 1, q7: 1, q8: 2 }],
  // 混答B
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
    for (let i = 0; i < QUESTIONS.length; i++) {
      const q = QUESTIONS[i];
      if (q.city) {
        await page.waitForSelector('#city-search', { timeout: 5000 });
        await page.locator('.city-chip').first().click();
        await page.click('#btn-city');
      } else if (q.multi) {
        // 多选：勾第一个选项后确认
        await page.waitForSelector('.multi-opts .opt-chip >> nth=0', { timeout: 5000 });
        await page.locator('.multi-opts .opt-chip').first().click();
        await page.click('#btn-multi');
      } else {
        await page.waitForSelector('.q-panel .opt >> nth=0', { timeout: 5000 });
        await page.locator('.q-panel .opt').nth(answers[q.id] !== undefined ? answers[q.id] : 0).click();
      }
      await page.waitForTimeout(450);
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