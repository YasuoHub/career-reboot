/* ============================================================
   重启人格图鉴 · 数据层（v2）
   结构：QUESTIONS(15题) / ARCHETYPES(8型) / CAREERS(32岗·约束版)
   计分口径：
     · v1 六维 → 八大原型（见 README 与 docs/岗位推荐系统-v2设计.md）
     · v2 个人要素（年龄/学历/行业/健康/技能/形态/城市）做硬过滤
       + 五维软打分（技能重合/行业迁移/性格延续/市场时机/投入可行）
   大典骨架说明：fam 取自《职业分类大典》8 大类名称（不含虚构细码），
   S 为人社部新职业序列、L 为绿色职业序列的展示标记；mkt 数值为
   公开报告的量级估算，仅用于排序信号，不作招聘承诺。
   ============================================================ */

/* ---------------- 答题维度 ----------------
   analytic 分析力 / maker 动手力 / creative 造梦力
   social 连接力 / leader 破局力 / stable 底盘力
   每个选项的 add.dims 累计原始分，上限见 AXES_MAX */
const QUESTIONS = [
  {
    id: 'q1',
    tag: '现状',
    text: '先同步一下你的状态：眼下这段日子，你更像——',
    opts: [
      { t: '刚从裁员名单下来，正在四处看机会', m: ['mode_urgent'] },
      { t: '主动跳出坑位，想换个跑道试试', m: ['mode_gap'] },
      { t: '班还在上，但心已经提前递了辞呈', m: ['mode_in'] },
      { t: '说不上裁员转行，就是心里那根弦松了', m: ['mode_blur'] },
    ],
  },
  {
    id: 'q2',
    tag: '现状',
    text: '重启之前得先谈钱，这一步躲不开：你的经济容错空间大概是——',
    opts: [
      { t: '一个人吃饱全家不饿，试错随便来', add: { risk: 2 } },
      { t: '有房租有存款，还能撑个半年一年', add: { risk: 1 } },
      { t: '有账单压着，容错大概只剩两三个月', add: { risk: 0 } },
      { t: '家里全指望这份收入，一分都不能少', add: { risk: -1 } },
    ],
  },
  {
    id: 'q3',
    tag: '能力',
    text: '过去几年，同事最常拉你帮忙解决的是哪类事？',
    opts: [
      { t: '数据表格一团糟，让我帮着理清楚', add: { dims: { analytic: 3 } } },
      { t: '新东西不会用，直接教我一下', add: { dims: { leader: 2, stable: 1 } } },
      { t: '方案写得太死板，帮我加点灵气', add: { dims: { creative: 3 } } },
      { t: '事情堆成山，帮我把节奏捋顺', add: { dims: { maker: 2, leader: 1 } } },
      { t: '情绪和关系出了状况，找我聊聊就好', add: { dims: { social: 3 } } },
    ],
  },
  {
    id: 'q4',
    tag: '能力',
    text: '突然接到一件完全没做过的新活儿，你的第一反应是——',
    opts: [
      { t: '先拆结构：把目标、变量、交付标准列清楚', add: { dims: { analytic: 3 } } },
      { t: '先找标杆，看看别人是怎么做的', add: { dims: { creative: 2 } } },
      { t: '先动手干一版，边做边改再说', add: { dims: { maker: 3 } } },
      { t: '先找行家聊十分钟，少走弯路', add: { dims: { social: 2, maker: 1 } } },
    ],
  },
  {
    id: 'q5',
    tag: '能力',
    text: '假如明天不用上班，你自己会去花时间做的事是——',
    opts: [
      { t: '啃一门能写进简历的新技能', add: { dims: { analytic: 1, maker: 1 } } },
      { t: '捣鼓点看得见摸得着的东西：修、装、做', add: { dims: { maker: 3 } } },
      { t: '拍点东西、写点东西、研究审美和内容', add: { dims: { creative: 3 } } },
      { t: '组局、串门、跟人瞎聊顺便把事办了', add: { dims: { social: 3 } } },
    ],
  },
  {
    id: 'q6',
    tag: '约束',
    text: '转型期需要投入学习时间，你的诚实答案是每周——',
    opts: [
      { t: '不超过 5 小时，恢复和生活也很重要', add: { hours: 2, dims: { stable: 1 } } },
      { t: '5 到 15 小时，有节奏地冲刺', add: { hours: 1 } },
      { t: '只要方向对，多少小时都行', add: { hours: 0, dims: { leader: 1 }, risk: 1 } },
    ],
  },
  {
    id: 'q7',
    tag: '约束',
    text: '给自己拉一条硬线：每月到手低于多少，你就必须回来上班？',
    opts: [
      { t: '5 千以内都得干', add: { floor: 5000 } },
      { t: '5 千 – 8 千', add: { floor: 8000 } },
      { t: '8 千 – 1 万 2', add: { floor: 12000 } },
      { t: '1 万 2 – 1 万 8', add: { floor: 18000 } },
      { t: '1 万 8 以上，或只要是我热爱的', add: { floor: 30000 } },
    ],
  },
  {
    id: 'q8',
    tag: '意愿',
    text: '重启的三年之后，你最希望听到的一句评价是——',
    opts: [
      { t: '「这人越赚越多，是高手」', add: { dims: { leader: 2 }, risk: 1 } },
      { t: '「一门手艺硬，谁也抢不走」', add: { dims: { maker: 2, stable: 1 } } },
      { t: '「干的是真爱的事，眼睛里有光」', add: { dims: { creative: 2 } } },
      { t: '「时间归自己，不用再看脸色」', add: { dims: { leader: 1, social: 1 } } },
    ],
  },
  /* ---- v2 个人要素题（q9–q15），写入 profile 供过滤与打分 ---- */
  {
    id: 'q9',
    tag: '来路',
    text: '先报个数：你今年——',
    opts: [
      { t: '18 – 24', add: { ageBand: 0 } },
      { t: '25 – 29', add: { ageBand: 1 } },
      { t: '30 – 34', add: { ageBand: 2 } },
      { t: '35 – 39', add: { ageBand: 3 } },
      { t: '40 – 45', add: { ageBand: 4 } },
      { t: '46 以上', add: { ageBand: 5 } },
    ],
  },
  {
    id: 'q10',
    tag: '来路',
    text: '学历到哪一步就停在哪了——',
    opts: [
      { t: '中专 / 高中及以下', add: { eduRank: 1 } },
      { t: '大专', add: { eduRank: 2 } },
      { t: '本科', add: { eduRank: 3 } },
      { t: '硕士及以上', add: { eduRank: 4 } },
    ],
  },
  {
    id: 'q11',
    tag: '来路',
    text: '过去几年，你的主阵地是哪个行业？',
    opts: [
      { t: 'IT / 互联网平台', add: { industry: 'IT/互联网' } },
      { t: '软件开发外包', add: { industry: '软件开发' } },
      { t: '制造 / 工厂', add: { industry: '制造/工厂' } },
      { t: '建筑工程', add: { industry: '建筑工程' } },
      { t: '金融财税', add: { industry: '金融财税' } },
      { t: '商贸零售', add: { industry: '商贸零售' } },
      { t: '教育培训', add: { industry: '教育培训' } },
      { t: '医疗健康', add: { industry: '医疗健康' } },
      { t: '物流运输', add: { industry: '物流运输' } },
      { t: '农林牧渔', add: { industry: '农林牧渔' } },
      { t: '文化传媒', add: { industry: '文化传媒' } },
      { t: '机关事业单位', add: { industry: '机关事业单位' } },
      { t: '家政 / 生活服务', add: { industry: '家政生活服务' } },
      { t: '其他或自由职业', add: { industry: '其他' } },
    ],
  },
  {
    id: 'q12',
    tag: '底子',
    text: '对自己身体诚实一把：现在这副状态是——',
    opts: [
      { t: '很好，体力精力都没问题', add: { health: 1 } },
      { t: '能久坐，体力算一般', add: { health: 2 } },
      { t: '有体力限制，久站、负重都吃力', add: { health: 3 } },
      { t: '得规律作息，倒班扛不住', add: { health: 4 } },
    ],
  },
  {
    id: 'q13',
    tag: '底子',
    text: '换赛道时能带走的手艺，勾上你会的——',
    multi: true,
    opts: [
      { t: 'Excel / 数据处理', add: { sk: 'data' } },
      { t: '写作 / 文案', add: { sk: 'writing' } },
      { t: '沟通 / 销售', add: { sk: 'sales' } },
      { t: '机械 / 设备操作', add: { sk: 'machinery' } },
      { t: '外语', add: { sk: 'language' } },
      { t: '驾照', add: { sk: 'driving' } },
      { t: '编程基础', add: { sk: 'coding' } },
      { t: '剪辑 / 摄影', add: { sk: 'av' } },
      { t: '教学 / 辅导', add: { sk: 'teach' } },
    ],
  },
  {
    id: 'q14',
    tag: '期待',
    text: '想要的工作形态更接近哪种？',
    opts: [
      { t: '坐班办公室，规律上下班', add: { pref: '坐班' } },
      { t: '外勤跑动，别把我钉在工位上', add: { pref: '外勤' } },
      { t: '可以接受倒班轮值，收入到位就行', add: { pref: '倒班' } },
      { t: '时间优先，能弹性最好', add: { pref: '弹性' } },
    ],
  },
  {
    id: 'q15',
    tag: '期待',
    text: '打算在哪片地面上重启？',
    opts: [
      { t: '北上广深', add: { cityTier: '一线' } },
      { t: '新一线 / 二线', add: { cityTier: '新一线' } },
      { t: '一般地市县城', add: { cityTier: '低能级' } },
      { t: '哪儿都行，看机会', add: { cityTier: '不限' } },
    ],
  },
];

const AXES = [
  { key: 'analytic', label: '分析' },
  { key: 'maker', label: '动手' },
  { key: 'creative', label: '造梦' },
  { key: 'social', label: '连接' },
  { key: 'leader', label: '破局' },
  { key: 'stable', label: '底盘' },
];

/* 各维度全卷满分，用于归一化到 0-100 */
const AXES_MAX = { analytic: 7, maker: 10, creative: 10, social: 9, leader: 7, stable: 3 };

/* ---------------- 八大原型 ----------------
   combo: 双高合成型（配第二高维度达成） */
const ARCHETYPES = {
  analytic: {
    num: '01', cn: '解题人', en: 'The Analyst',
    slogan: '万物皆可拆解，是你给混乱开的药方。',
    keywords: ['结构化思维', '数据敏感', '逻辑闭环'],
    rarity: 11,
    colors: { accent: '#38e0c4', deep: '#0b4f45', glow: 'rgba(56,224,196,.32)' },
  },
  maker: {
    num: '02', cn: '造物者', en: 'The Maker',
    slogan: '两手空空能修好一台机器，这就是底气。',
    keywords: ['手上功夫', '工程直觉', '实物交付'],
    rarity: 14,
    colors: { accent: '#ffb020', deep: '#6b430d', glow: 'rgba(255,176,32,.3)' },
  },
  creative: {
    num: '03', cn: '造梦师', en: 'The Dreamer',
    slogan: '生活太素？你负责给它加滤镜。',
    keywords: ['审美在线', '内容直觉', '表达欲'],
    rarity: 9,
    colors: { accent: '#f06bf0', deep: '#5c1455', glow: 'rgba(240,107,240,.3)' },
  },
  social: {
    num: '04', cn: '连接人', en: 'The Connector',
    slogan: '房间因为你开场，人心因为你破冰。',
    keywords: ['关系资产', '场合感', '共情倾听'],
    rarity: 17,
    colors: { accent: '#54c5ff', deep: '#0c4a78', glow: 'rgba(84,197,255,.3)' },
  },
  leader: {
    num: '05', cn: '破局者', en: 'The Disruptor',
    slogan: '僵局在你手里，都是用来翻盘的。',
    keywords: ['抗压谈判', '资源整合', '结果导向'],
    rarity: 8,
    colors: { accent: '#ff7a59', deep: '#6e2410', glow: 'rgba(255,122,89,.32)' },
  },
  stable: {
    num: '06', cn: '定盘星', en: 'The Anchor',
    slogan: '风浪再大，你的底盘稳得像老树根。',
    keywords: ['流程本能', '风险厌恶', '可靠交付'],
    rarity: 16,
    colors: { accent: '#63e37c', deep: '#17502b', glow: 'rgba(99,227,124,.3)' },
  },
  /* 双高合成型：罕见，是传播稀缺感的主要来源 */
  architect: {
    num: '07', cn: '架构师', en: 'The Architect',
    combo: ['analytic', 'maker'],
    slogan: '既能算也能造，缺了这台机器就不成立。',
    keywords: ['分析×动手', '全链路', '系统思维'],
    rarity: 6,
    colors: { accent: '#9d7bff', deep: '#33186b', glow: 'rgba(157,123,255,.32)' },
  },
  spotlight: {
    num: '08', cn: '舞台派', en: 'The Spotlight',
    combo: ['creative', 'social'],
    slogan: '灵感加人脉，你在哪儿哪儿就是主场。',
    keywords: ['创意×社交', '氛围中心', '舞台直觉'],
    rarity: 9,
    colors: { accent: '#ff5fae', deep: '#5e1240', glow: 'rgba(255,95,174,.32)' },
  },
};

/* ---------------- 画像常量（v2） ---------------- */
const AGE_BANDS = ['18–24', '25–29', '30–34', '35–39', '40–45', '46+'];
const EDU_RANK_LABEL = { 1: '中专/高中', 2: '大专', 3: '本科', 4: '硕士+' };
const SKILLS = [
  { id: 'data', label: 'Excel/数据' },
  { id: 'writing', label: '写作文案' },
  { id: 'sales', label: '沟通销售' },
  { id: 'machinery', label: '机械设备操作' },
  { id: 'language', label: '外语' },
  { id: 'driving', label: '驾照' },
  { id: 'coding', label: '编程基础' },
  { id: 'av', label: '剪辑摄影' },
  { id: 'teach', label: '教学辅导' },
];
/* 技能 → 轴向映射（F3 性格延续用的岗位画像构建） */
const SKILL_AXIS = {
  data: { analytic: 3, stable: 1 },
  writing: { creative: 3 },
  sales: { social: 2, leader: 2 },
  machinery: { maker: 3 },
  language: { social: 1, creative: 1 },
  driving: { maker: 1 },
  coding: { analytic: 2, maker: 2 },
  av: { creative: 3, social: 1 },
  teach: { social: 3, leader: 1 },
};
const PAT_RANK = { '坐班': 0, '外勤': 1, '倒班': 2, '弹性': 3 };

/* ---------------- 职业库（v2 约束版） ----------------
   fam    《职业分类大典》所属大类（展示溯源用）
   S/L   新职业序列 / 绿色职业序列标记（徽章用）
   req    准入约束：edu 学历要求 rank、phys 重体力、pat 工作形态、
          age 适龄段、skills 可迁移技能需求（SKILLS 的 id）
   tr     前行业迁移矩阵：[行业标签, 迁移度 0-1]，无记录按 0.35
   mkt    市场信号：g 职位增速%、c 竞争指数、shortage 缺工榜标记（均为公开报告量级估算）
   fit/week1 沿用 v1，不变 */
const CAREERS = [
  /* 解题人 */
  { arc: 'analytic', name: '商业/数据分析师', sal: '9k–25k', fam: '专业技术人员', tags: ['Excel+SQL', '通用性强'], fit: '你的拆解本能天生就是干这个用的。', week1: '拿一份公开财报，用三个图表讲出它的生意逻辑，发出去。', req: { edu: 3, pat: '坐班', skills: ['data', 'coding'] }, tr: [['软件开发', .6], ['商贸零售', .5]], mkt: { g: 30, c: 96, shortage: false } },
  { arc: 'analytic', name: 'AI 数据训练师', sal: '8k–15k', fam: '专业技术人员', S: true, tags: ['新兴赛道', '门槛友好'], fit: '大模型缺的就是你这种能把标准说清楚的人。', week1: '在标注平台注册一个账号，跑完第一单体验全流程。', req: { edu: 2, pat: '坐班', skills: ['data'] }, tr: [['软件开发', .5], ['IT/互联网', .5]], mkt: { g: 40, c: 52, shortage: true } },
  { arc: 'analytic', name: '财务助理→总账会计', sal: '5k–10k', fam: '办事人员和有关人员', tags: ['越老越值钱'], fit: '数字洁癖是会计的天赋型选手。', week1: '免费学会计基础课第一章，做完课后习题拍照打卡。', req: { edu: 1, pat: '坐班', skills: ['data'] }, tr: [['金融财税', .7], ['商贸零售', .5]], mkt: { g: 8, c: 223, shortage: false } },
  { arc: 'analytic', name: '研究助理/行业研究', sal: '7k–16k', fam: '专业技术人员', tags: ['知识复利'], fit: '查资料做归纳这件事，你比谁都快乐。', week1: '挑一个你好奇的行业，写一份 1500 字速览放上小红书。', req: { edu: 3, pat: '坐班', skills: ['data', 'writing'] }, tr: [['教育培训', .5], ['IT/互联网', .4]], mkt: { g: 12, c: 120, shortage: false } },

  /* 造物者 */
  { arc: 'maker', name: '自动化测试工程师', sal: '7k–14k', fam: '生产制造及有关人员', S: true, tags: ['IT 入口岗'], fit: '把东西测到不能崩，靠的就是你的较真劲儿。', week1: '用免费工具给一个常用 App 提 3 条真实 Bug 到社区。', req: { edu: 2, pat: '坐班', skills: ['coding'] }, tr: [['软件开发', .7], ['制造/工厂', .5]], mkt: { g: 22, c: 70, shortage: false } },
  { arc: 'maker', name: '设备维修技师', sal: '6k–15k', fam: '生产制造及有关人员', tags: ['手艺吃饭'], fit: '修好一台机器的成就感，白领岗位给不了。', week1: '去维修平台下单一次上门预约，全程观摩学习。', req: { edu: 1, pat: '外勤', phys: true, skills: ['machinery', 'driving'] }, tr: [['制造/工厂', .8], ['建筑工程', .5]], mkt: { g: 10, c: 45, shortage: true } },
  { arc: 'maker', name: '手工电商主理人', sal: '4k–20k', fam: '社会生产服务和生活服务人员', tags: ['副业试水'], fit: '你做出来的东西，本身就是货架。', week1: '把一件你的手作拍好图，挂上二手平台卖掉。', req: { edu: 1, pat: '弹性', skills: ['av', 'sales'] }, tr: [['商贸零售', .5], ['家政生活服务', .4]], mkt: { g: 25, c: 88, shortage: false } },
  { arc: 'maker', name: '前端开发（转岗）', sal: '12k–30k', fam: '专业技术人员', tags: ['高薪', '自学可行'], fit: '代码是新的木工活，逻辑和动手你都有底子。', week1: '跟着免费课写完第一个个人主页，部署上线。', req: { edu: 2, pat: '坐班', skills: ['coding'] }, tr: [['软件开发', .8], ['IT/互联网', .8]], mkt: { g: 28, c: 66, shortage: false } },

  /* 造梦师 */
  { arc: 'creative', name: 'AIGC 内容创作者', sal: '5k–18k', fam: '社会生产服务和生活服务人员', S: true, tags: ['风口红利'], fit: '审美 + 新工具，你恰好站在时代接口上。', week1: '用 AI 工具做完一组 9 张同系列插画发社交平台。', req: { edu: 1, pat: '弹性', skills: ['av', 'coding', 'writing'] }, tr: [['文化传媒', .6], ['IT/互联网', .5]], mkt: { g: 55, c: 118, shortage: false } },
  { arc: 'creative', name: '短视频策划/剪辑', sal: '6k–20k', fam: '社会生产服务和生活服务人员', tags: ['流量型'], fit: '会讲故事的人，永远不缺人要。', week1: '剪一条 60 秒的城市观察片，发两个平台看反馈。', req: { edu: 1, pat: '弹性', skills: ['av', 'writing'] }, tr: [['文化传媒', .7], ['IT/互联网', .4]], mkt: { g: 34, c: 95, shortage: false } },
  { arc: 'creative', name: 'UI/UX 设计师', sal: '8k–18k', fam: '专业技术人员', tags: ['作品集说话'], fit: '美的直觉是可以被系统地训练出来的天赋。', week1: '临摹 3 个优秀页面，产出一份 5P 作品集初稿。', req: { edu: 2, pat: '坐班', skills: ['av', 'coding'] }, tr: [['IT/互联网', .5], ['文化传媒', .4]], mkt: { g: 15, c: 84, shortage: false } },
  { arc: 'creative', name: '品牌文案/内容主理', sal: '6k–15k', fam: '社会生产服务和生活服务人员', tags: ['写手刚需'], fit: '一句话让人记住，你是天生的广告人。', week1: '为一家小店写 3 篇朋友圈式种草文案给它看。', req: { edu: 2, pat: '坐班', skills: ['writing'] }, tr: [['商贸零售', .5], ['文化传媒', .6]], mkt: { g: 10, c: 72, shortage: true } },

  /* 连接人 */
  { arc: 'social', name: 'HRBP/招聘顾问', sal: '8k–16k', fam: '专业技术人员', tags: ['人脉变现'], fit: '识人是你的本能，HR 是把你的本能变成工资。', week1: '约两位前同事喝咖啡，了解他们现在的真实需求。', req: { edu: 3, pat: '坐班', skills: ['sales', 'teach'] }, tr: [['商贸零售', .6], ['IT/互联网', .5]], mkt: { g: 9, c: 110, shortage: false } },
  { arc: 'social', name: '大客户销售/KA', sal: '8k–30k', fam: '社会生产服务和生活服务人员', tags: ['上限极高'], fit: '陪人聊天顺便成交，这份工作就是为你设计的。', week1: '列出 10 个熟人需求清单，本周试着帮一个人的忙。', req: { edu: 1, pat: '外勤', skills: ['sales'] }, tr: [['商贸零售', .6], ['金融财税', .5]], mkt: { g: 20, c: 80, shortage: false } },
  { arc: 'social', name: '社群运营/私域操盘', sal: '6k–12k', fam: '社会生产服务和生活服务人员', tags: ['轻量起步'], fit: '你在场子就热，社群就是要这种引力。', week1: '建一个 20 人小群，围绕共同兴趣运营一周。', req: { edu: 1, pat: '坐班', skills: ['sales', 'av'] }, tr: [['IT/互联网', .5], ['商贸零售', .5]], mkt: { g: 26, c: 62, shortage: false } },
  { arc: 'social', name: '研学/企业培训导师', sal: '5k–12k', fam: '社会生产服务和生活服务人员', L: true, tags: ['演讲型人格'], fit: '讲台记得住每一个让全场笑的人。', week1: '在社区活动报名一次 5 分钟闪电演讲。', req: { edu: 2, pat: '外勤', skills: ['teach', 'sales'] }, tr: [['教育培训', .7], ['文化传媒', .4]], mkt: { g: 18, c: 50, shortage: true } },

  /* 破局者 */
  { arc: 'leader', name: '项目经理/PMO', sal: '12k–28k', fam: '专业技术人员', tags: ['跨行业通用'], fit: '推得动事情的人，到哪儿都是核心。', week1: '主动认领同事间没人想接的一个麻烦事并推进。', req: { edu: 3, pat: '坐班', skills: ['sales', 'data'] }, tr: [['软件开发', .6], ['IT/互联网', .6], ['制造/工厂', .4]], mkt: { g: 12, c: 248, shortage: false } },
  { arc: 'leader', name: '销售主管', sal: '10k–35k', fam: '社会生产服务和生活服务人员', tags: ['管理入门'], fit: '带队伍打仗的逻辑，和带项目一模一样。', week1: '复盘一次你说服别人的经历，写出三步方法论。', req: { edu: 1, pat: '外勤', skills: ['sales'] }, tr: [['商贸零售', .7], ['金融财税', .5]], mkt: { g: 15, c: 85, shortage: false } },
  { arc: 'leader', name: '小店创业主理人', sal: '2k–30k', fam: '社会生产服务和生活服务人员', tags: ['全面试错'], fit: '你管得住混乱，这就够开一家店了。', week1: '周末摆摊/快闪一次，用最小成本验证一种需求。', req: { edu: 1, pat: '弹性', skills: ['sales'] }, tr: [['商贸零售', .6], ['家政生活服务', .4]], mkt: { g: 12, c: 55, shortage: true } },
  { arc: 'leader', name: '供应链跟单/采购', sal: '6k–12k', fam: '社会生产服务和生活服务人员', tags: ['幕后枢纽'], fit: '让链条咬合齿轮的人，是老板离不开的那种。', week1: '梳理你所在公司的订单流程，画一张全流程图。', req: { edu: 1, pat: '外勤', skills: ['data', 'sales'] }, tr: [['物流运输', .6], ['商贸零售', .5]], mkt: { g: 14, c: 58, shortage: true } },

  /* 定盘星 */
  { arc: 'stable', name: '行政/人事专员', sal: '4k–8k', fam: '办事人员和有关人员', tags: ['稳定兜底'], fit: '把琐事做得像仪式感，这是稀缺品质。', week1: '整理一份你过去的工作 SOP 文档，面试时就是证据。', req: { edu: 1, pat: '坐班', skills: [] }, tr: [['机关事业单位', .5], ['商贸零售', .4]], mkt: { g: 3, c: 160, shortage: false } },
  { arc: 'stable', name: '银行大堂/客户服务', sal: '6k–12k', fam: '社会生产服务和生活服务人员', tags: ['体系背书'], fit: '稳定有序的秩序感是你的舒适区也是价值。', week1: '预约一次银行客户经理，了解客户经理转岗路径。', req: { edu: 1, pat: '坐班', skills: ['sales'] }, tr: [['金融财税', .6], ['商贸零售', .4]], mkt: { g: 5, c: 102, shortage: false } },
  { arc: 'stable', name: '财务共享中心专员', sal: '6k–11k', fam: '办事人员和有关人员', tags: ['可认证'], fit: '流程化工作里，认真的人升级最快。', week1: '考一本入门级会计/办公认证，做备考计划表。', req: { edu: 2, pat: '坐班', skills: ['data'] }, tr: [['金融财税', .6], ['商贸零售', .4]], mkt: { g: 6, c: 140, shortage: false } },
  { arc: 'stable', name: '物业运营管家', sal: '5k–9k', fam: '社会生产服务和生活服务人员', tags: ['线下实体'], fit: '让人放心把家交给你的那种人。', week1: '调研你所在小区物业的差评清单，做成改善建议。', req: { edu: 1, pat: '外勤', skills: ['sales'] }, tr: [['家政生活服务', .6], ['建筑工程', .4]], mkt: { g: 7, c: 68, shortage: true } },

  /* 架构师（双高） */
  { arc: 'architect', name: '全栈软件工程师', sal: '15k–35k', fam: '专业技术人员', tags: ['高薪天花板'], fit: '既能想清楚也能做出来的复合体，市场缺口最大。', week1: '做一个带数据的小工具网站：从设计到上线全流程。', req: { edu: 2, pat: '坐班', skills: ['coding'] }, tr: [['软件开发', .8], ['IT/互联网', .8]], mkt: { g: 35, c: 74, shortage: false } },
  { arc: 'architect', name: '技术文档工程师', sal: '8k–16k', fam: '专业技术人员', tags: ['翻译官角色'], fit: '把复杂技术说成人话，就是你的母语。', week1: '把一个开源项目写成小白向导读，发在技术社区。', req: { edu: 2, pat: '坐班', skills: ['writing', 'coding'] }, tr: [['软件开发', .7], ['IT/互联网', .6]], mkt: { g: 18, c: 60, shortage: false } },
  { arc: 'architect', name: '解决方案工程师/售前', sal: '10k–22k', fam: '专业技术人员', tags: ['技术×表达'], fit: '算得清又讲得明，这是售前岗位的定义。', week1: '为一个真实产品录一段 3 分钟讲解视频。', req: { edu: 3, pat: '坐班', skills: ['sales', 'coding'] }, tr: [['IT/互联网', .6], ['软件开发', .6]], mkt: { g: 30, c: 64, shortage: false } },
  { arc: 'architect', name: 'ERP/信息化实施顾问', sal: '10k–20k', fam: '专业技术人员', tags: ['传统转型首选'], fit: '你既懂业务流程又能落地实施。', week1: '整理你上一份工作的完整业务流程图 20 张。', req: { edu: 2, pat: '坐班', skills: ['data', 'coding'] }, tr: [['制造/工厂', .6], ['商贸零售', .5]], mkt: { g: 20, c: 56, shortage: false } },

  /* 舞台派（双高） */
  { arc: 'spotlight', name: '私域操盘手', sal: '8k–25k', fam: '社会生产服务和生活服务人员', tags: ['创意×人脉'], fit: '有梗又有朋友圈，你天生就是私域体质。', week1: '为一款产品策划一场群内快闪活动，跑通一次。', req: { edu: 1, pat: '弹性', skills: ['sales', 'av'] }, tr: [['IT/互联网', .5], ['商贸零售', .5]], mkt: { g: 38, c: 70, shortage: false } },
  { arc: 'spotlight', name: '开放麦脱口秀演员', sal: '3k–15k', fam: '社会生产服务和生活服务人员', tags: ['副业属性'], fit: '灵感加舞台聚光灯，属于你的高光时刻。', week1: '写一个 3 分钟段子，在开放麦报名试讲一场。', req: { edu: 1, pat: '弹性', skills: ['writing'] }, tr: [['文化传媒', .5], ['教育培训', .4]], mkt: { g: 15, c: 40, shortage: false } },
  { arc: 'spotlight', name: '研学营地导师', sal: '5k–12k', fam: '社会生产服务和生活服务人员', L: true, tags: ['成长型行业'], fit: '让人又笑又学的主场感，就是这个岗位的 KPI。', week1: '申请一次研学机构的助教观摩日，亲身体验流程。', req: { edu: 1, pat: '外勤', skills: ['teach', 'av'] }, tr: [['教育培训', .7], ['文化传媒', .4]], mkt: { g: 18, c: 48, shortage: false } },
  { arc: 'spotlight', name: '直播助播/场控', sal: '5k–10k', fam: '社会生产服务和生活服务人员', S: true, tags: ['直播生态入口'], fit: '在线下控场，在线上控播，同一种天赋。', week1: '观察三次头部直播间的节奏，画一张话术时间轴。', req: { edu: 1, pat: '倒班', skills: ['av', 'sales'] }, tr: [['文化传媒', .6], ['商贸零售', .5]], mkt: { g: 20, c: 76, shortage: false } },
];

window.RB_DATA = { QUESTIONS, AXES, AXES_MAX, ARCHETYPES, SKILLS, SKILL_AXIS, AGE_BANDS, EDU_RANK_LABEL, PAT_RANK, CAREERS };