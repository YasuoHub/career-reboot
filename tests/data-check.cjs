/* 岗位与城市数据自检：不依赖浏览器，可在本地直接跑
 * 用法：node tests/data-check.js
 */
const fs = require('fs');
const path = require('path');

global.window = { RB_DATA: {} };
const base = path.join(__dirname, '..');
for (const f of ['js/data.js', 'js/cities.js', 'js/jobs.js']) {
  eval(fs.readFileSync(path.join(base, f), 'utf8'));
}

const { JOBS, CITIES, ARCHETYPES, SKILLS, QUESTIONS } = window.RB_DATA;
const errors = [];
const warn = [];
const expect = (ok, msg) => { if (!ok) errors.push(msg); };

expect(Array.isArray(JOBS) && JOBS.length >= 180, `岗位数应 >= 180，当前 ${JOBS ? JOBS.length : 0}`);
expect(Array.isArray(CITIES) && CITIES.length >= 150, `城市数应 >= 150，当前 ${CITIES ? CITIES.length : 0}`);
expect(QUESTIONS.some(q => q.city), '问卷中缺少城市多选题');

const l1 = {};
const names = new Set(), ids = new Set();
const arcCount = {};
const skills = new Set(SKILLS.map(s => s.id));
const arcs = new Set(Object.keys(ARCHETYPES));
const regions = new Set(['华北', '东北', '华东', '华中', '华南', '西南', '西北']);

JOBS.forEach(j => {
  l1[j.l1] = (l1[j.l1] || 0) + 1;
  if (names.has(j.name)) errors.push(`岗位重名：${j.name}`); names.add(j.name);
  if (ids.has(j.id)) errors.push(`岗位 ID 重复：${j.id}`); ids.add(j.id);
  if (!j.l2) errors.push(`${j.name} 缺少 L2`);
  if (!j.l1Name) errors.push(`${j.name} 缺少 L1 名称`);
  if (!Array.isArray(j.tasks) || j.tasks.length < 5) errors.push(`${j.name} 任务少于 5 条`);
  if (!Array.isArray(j.skills) || !j.skills.length) errors.push(`${j.name} 缺少技能`);
  j.skills.forEach(s => { if (!skills.has(s)) errors.push(`${j.name} 技能未知：${s}`); });
  if (!j.arcs || !Object.keys(j.arcs).length) errors.push(`${j.name} 缺少原型适配`);
  Object.keys(j.arcs || {}).forEach(a => {
    if (!arcs.has(a)) errors.push(`${j.name} 原型未知：${a}`);
    arcCount[a] = (arcCount[a] || 0) + 1;
  });
  if (!Array.isArray(j.tr) || !j.tr.length) errors.push(`${j.name} 缺少迁移矩阵`);
  if (!Array.isArray(j.salRange) || j.salRange.length !== 2) errors.push(`${j.name} 缺少薪资范围`);
  if (!Array.isArray(j.orgs) || j.orgs.length < 2) errors.push(`${j.name} 缺少门店/企业类型`);
  if (!j.week1) errors.push(`${j.name} 缺少本周动作`);
  if (!j.learn) errors.push(`${j.name} 缺少学习路线`);
  if (!j.J || !j.F) errors.push(`${j.name} 缺少求职/自由路径`);
  if (!j.req || typeof j.req.edu !== 'number') errors.push(`${j.name} 缺少准入要求`);
});

for (let n = 1; n <= 8; n++) {
  const k = String(n);
  expect((l1[k] || 0) >= 10, `L1 ${k} 岗位过少：${l1[k] || 0}`);
}
Object.keys(ARCHETYPES).forEach(a => {
  expect((arcCount[a] || 0) >= 20, `原型 ${a} 候选过少：${arcCount[a] || 0}`);
});

CITIES.forEach(c => {
  if (!c.name || !c.tier || !c.region) errors.push(`城市字段缺失：${JSON.stringify(c)}`);
  if (!regions.has(c.region)) errors.push(`城市区域未知：${c.name} ${c.region}`);
  if (!Array.isArray(c.industries)) errors.push(`城市产业标签缺失：${c.name}`);
});

const tierCount = CITIES.reduce((m, c) => (m[c.tier] = (m[c.tier] || 0) + 1, m), {});
console.log('岗位总数:', JOBS.length);
console.log('L1 分布:', l1);
console.log('原型覆盖:', arcCount);
console.log('城市总数:', CITIES.length, '| 能级:', tierCount);
console.log('城市区域:', CITIES.reduce((m, c) => (m[c.region] = (m[c.region] || 0) + 1, m), {}));
if (warn.length) console.log('警告:', warn);
if (errors.length) { console.error('\n数据校验失败：'); errors.slice(0, 30).forEach(e => console.error('- ' + e)); process.exit(1); }
console.log('\n数据校验通过。');
