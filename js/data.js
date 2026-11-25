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
      { t: '刚毕业 / 还没正式工作过，正在找出路', m: ['mode_fresh'], add: { stage: 'fresh' } },
      { t: '空窗半年以上，想重新回到职场', m: ['mode_gap'], add: { stage: 'gap' } },
      { t: '刚被裁 / 刚裸辞，最近正在找机会', m: ['mode_urgent'], add: { stage: 'recent' } },
      { t: '班还在上，但已经在偷偷看机会', m: ['mode_in'], add: { stage: 'in' } },
      { t: '说不上具体原因，就是不想再这样下去', m: ['mode_blur'], add: { stage: 'blur' } },
    ],
  },
  {
    id: 'q2',
    tag: '现状',
    text: '重启之前得先谈钱，这一步躲不开：你的经济容错空间大概是——',
    opts: [
      { t: '刚毕业或单身，暂时没养家压力，试错空间大', add: { risk: 2 } },
      { t: '有点存款，能撑半年到一年', add: { risk: 1 } },
      { t: '有账单压着，最多撑两三个月', add: { risk: 0 } },
      { t: '家里主要靠我，收入不能断', add: { risk: -1 } },
    ],
  },
  {
    id: 'q3',
    tag: '能力',
    text: '身边人最常找你搭把手的是哪类事？',
    opts: [
      { t: '理账、整表格、查数据，帮我把数字弄明白', add: { dims: { analytic: 3, social: 2, leader: 2, stable: 1 } } },
      { t: '教我用新东西、做攻略，带我上手', add: { dims: { leader: 2, stable: 1 } } },
      { t: '出点子、写文案、做图剪视频，帮我加点灵气', add: { dims: { creative: 3, social: 2, leader: 1, stable: 1 } } },
      { t: '把活动张罗起来、把事推进下去', add: { dims: { maker: 2, leader: 1, social: 1 } } },
      { t: '听我吐槽、帮我协调关系、照顾人', add: { dims: { social: 3 } } },
    ],
  },
  {
    id: 'q4',
    tag: '节奏',
    text: '下班后或周末，精力允许时你的默认动作是——',
    opts: [
      { t: '研究一件没弄明白的事，直到搞清楚为止', add: { dims: { analytic: 2, social: 1, leader: 1 } } },
      { t: '刷内容、看别人的作品，边看边琢磨标杆在哪', add: { dims: { creative: 2, analytic: 1, social: 1 } } },
      { t: '修东西、做吃的、做手工，折腾看得见摸得着的东西', add: { dims: { maker: 3 } } },
      { t: '约人出来走走，边走边聊，顺便把事聊明白了', add: { dims: { social: 2, maker: 1 } } },
    ],
  },
  {
    id: 'q5',
    tag: '未来',
    text: '重启的头三个月，你最想把时间砸在——',
    opts: [
      { t: '搞懂一门能写进简历的新技能，系统学一遍', add: { dims: { analytic: 1, maker: 1, social: 1, leader: 1 } } },
      { t: '先找份能上手的活或小生意跑起来，边干边学', add: { dims: { maker: 1, leader: 1 }, risk: 1 } },
      { t: '把脑子里想的做成看得见摸得着的东西', add: { dims: { maker: 3 } } },
      { t: '把审美和内容感觉打磨到能出活、能变现', add: { dims: { creative: 3, social: 2, leader: 1 } } },
      { t: '先把圈子、人脉攒起来，事儿自然跟着来', add: { dims: { social: 3 } } },
    ],
  },
  {
    id: 'q6',
    tag: '约束',
    text: '转型期需要投入学习时间，你的诚实答案是每周——',
    opts: [
      { t: '不超过 5 小时，恢复和生活也很重要', add: { hours: 2, dims: { stable: 1 } } },
      { t: '5 到 15 小时，有节奏地冲刺', add: { hours: 1 } },
      { t: '全职冲刺，能投多少投多少', add: { hours: 0, dims: { leader: 1 }, risk: 1 } },
    ],
  },
  {
    id: 'q7',
    tag: '约束',
    text: '给自己拉一条硬线：每月到手低于多少，你会觉得不如先干着？',
    opts: [
      { t: '3 千以内也接受，先入行 / 先活下来', add: { floor: 3000 } },
      { t: '3 千 – 5 千', add: { floor: 5000 } },
      { t: '5 千 – 8 千', add: { floor: 8000 } },
      { t: '8 千 – 1 万 2', add: { floor: 12000 } },
      { t: '1 万 2 以上，或只要是我热爱的', add: { floor: 18000 } },
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
      { t: '「不靠任何人，自己撑起一条路」', add: { dims: { leader: 2 } } },
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
    text: '过去几年，你的主阵地更接近哪一块？（还没工作过就选「学生 / 无经验」）',
    opts: [
      { t: 'IT / 互联网 / 软件开发', add: { industry: 'IT/互联网' } },
      { t: '制造 / 工厂', add: { industry: '制造/工厂' } },
      { t: '建筑工程', add: { industry: '建筑工程' } },
      { t: '金融财税', add: { industry: '金融财税' } },
      { t: '商贸零售 / 门店', add: { industry: '商贸零售' } },
      { t: '教育培训', add: { industry: '教育培训' } },
      { t: '医疗健康 / 护理', add: { industry: '医疗健康' } },
      { t: '物流运输 / 配送', add: { industry: '物流运输' } },
      { t: '农林牧渔', add: { industry: '农林牧渔' } },
      { t: '文化传媒', add: { industry: '文化传媒' } },
      { t: '餐饮 / 夜市 / 小吃', add: { industry: '餐饮住宿' } },
      { t: '家政 / 保洁 / 生活服务', add: { industry: '家政生活服务' } },
      { t: '个体小生意 / 摆摊 / 自由职业', add: { industry: '个体经营' } },
      { t: '还没正式工作过 / 在校学生', add: { industry: '无经验' } },
      { t: '其他', add: { industry: '其他' } },
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
      { t: '体力有限，久站或久蹲都不行', add: { health: 4 } },
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
      { t: '机械 / 设备操作（含驾驶）', add: { sk: 'machinery' } },
      { t: '外语', add: { sk: 'language' } },
      { t: '编程基础', add: { sk: 'coding' } },
      { t: '剪辑 / 摄影 / 出镜', add: { sk: 'av' } },
      { t: '教学 / 辅导', add: { sk: 'teach' } },
      { t: 'PPT / 办公自动化', add: { sk: 'office' } },
      { t: '平面设计 / UI', add: { sk: 'design' } },
      { t: '新媒体运营 / 投流', add: { sk: 'newmedia' } },
      { t: '客户服务 / 售后跟进', add: { sk: 'service' } },
      { t: '做饭 / 烘焙 / 餐饮手艺', add: { sk: 'food' } },
      { t: '开车 / 配送 / 跑腿', add: { sk: 'driving' } },
      { t: '维修 / 木工 / 水电 / 手工', add: { sk: 'craft' } },
      { t: '摆摊 / 开店 / 进货 / 算账', add: { sk: 'business' } },
      { t: '照顾老人小孩 / 护理', add: { sk: 'care' } },
      { t: '暂时没有特别拿得出手的，愿意从零学', add: {} },
    ],
  },
  {
    id: 'q14',
    tag: '期待',
    text: '想要的工作形态更接近哪种？',
    opts: [
      { t: '固定坐班，规律上下班最安心', add: { pref: '坐班' } },
      { t: '外勤跑动，别把我钉在工位上', add: { pref: '外勤' } },
      { t: '倒班轮值可以接受，收入到位就行', add: { pref: '倒班' } },
      { t: '时间自主安排，自己定节奏最好', add: { pref: '弹性' } },
      { t: '自己支个摊 / 开小店 / 做点小生意', add: { pref: '弹性', selfBiz: true } },
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
  {
    id: 'q16',
    tag: '约束',
    text: '如果考虑自己干点什么，你现在能拿出的启动成本是——',
    opts: [
      { t: '基本没有，最多几千块试水', add: { capital: 1 } },
      { t: '3 千 – 2 万，能备货 / 租个小摊', add: { capital: 2 } },
      { t: '2 万 – 10 万，可以认真开个小店', add: { capital: 3 } },
      { t: '10 万以上，想认真做一门生意', add: { capital: 4 } },
      { t: '不想投钱，只想先找份工作 / 接单', add: { capital: 0, selfBiz: false } },
    ],
  },
  /* ---- q17 性别：写入 profile.gender，用于匹配角色头像男女双版 ---- */
  {
    id: 'q17',
    tag: '来路',
    text: '最后给自己贴个标签，你认可是——',
    opts: [
      { t: '男', add: { gender: '男' } },
      { t: '女', add: { gender: '女' } },
    ],
  },
];

const AXES = [
  { key: 'analytic', label: '逻辑' },
  { key: 'maker', label: '动手' },
  { key: 'creative', label: '审美' },
  { key: 'social', label: '社交' },
  { key: 'leader', label: '魄力' },
  { key: 'stable', label: '靠谱' },
];

/* 各维度全卷满分，用于归一化到 0-100 */
const AXES_MAX = { analytic: 7, maker: 10, creative: 10, social: 9, leader: 7, stable: 3 };

/* ---------------- 十六型重启人格图鉴 ----------------
   框架依据：Big Five/O*NET 职业胜任力模型将六维折叠为四组二值判别，
   组合产出 16 种离散原型——与 MBTI 的四极二分法同构，
   且每型有独立职业领域锚定。 */

const ARCHETYPES = {
  /* ── D1外向 × D2分析 × D3驱动 × D4守序 ── */
  ei_at_jp_1: { num: '01', cn: '猎手', en: 'The Hunter', slogan: '人海茫茫，你一眼锁定目标，然后直线拿下。', keywords: ['目标锁定', '直线拿下', '结果证明一切'], avatarF: '01-hunter-f.webp', avatarM: '01-hunter-m.webp', rarity: 3, colors: { accent: '#ff7a59', deep: '#6e2410', glow: 'rgba(255,122,89,.32)' } },
  /* ── D1外向 × D2分析 × D3驱动 × D4灵活 ── */
  ei_at_jp_2: { num: '02', cn: '先锋', en: 'The Pioneer', slogan: '新市场、新赛道，别人犹豫时你已经出发了。', keywords: ['拓荒嗅觉', '快速试错', '先发制人'], avatarF: '02-pioneer-f.webp', avatarM: '02-pioneer-m.webp', rarity: 8, colors: { accent: '#ffb020', deep: '#6b430d', glow: 'rgba(255,176,32,.3)' } },
  /* ── D1外向 × D2分析 × D3支撑 × D4守序 ── */
  ei_at_sj_1: { num: '03', cn: '守望者', en: 'The Sentinel', slogan: '你把稳定做成品牌，客户因为你可靠而不换人。', keywords: ['客户信赖', '流程精进', '守正出奇'], avatarF: '03-sentinel-f.webp', avatarM: '03-sentinel-m.webp', rarity: 5, colors: { accent: '#63e37c', deep: '#17502b', glow: 'rgba(99,227,124,.3)' } },
  /* ── D1外向 × D2分析 × D3支撑 × D4灵活 ── */
  ei_at_sj_2: { num: '04', cn: '外交官', en: 'The Diplomat', slogan: '谈判桌上你来我往，最终都笑着签了字。', keywords: ['关系润滑', '弹性应变', '和而不同'], avatarF: '04-diplomat-f.webp', avatarM: '04-diplomat-m.webp', rarity: 4, colors: { accent: '#54c5ff', deep: '#0c4a78', glow: 'rgba(84,197,255,.3)' } },
  /* ── D1外向 × D2直觉 × D3驱动 × D4守序 ── */
  ei_in_jp_1: { num: '05', cn: '主理人', en: 'The Director', slogan: '审美与商业你都懂，而且管得住两头。', keywords: ['审美×商业', '品控本能', '全案操盘'], avatarF: '05-director-f.webp', avatarM: '05-director-m.webp', rarity: 3, colors: { accent: '#f06bf0', deep: '#5c1455', glow: 'rgba(240,107,240,.3)' } },
  /* ── D1外向 × D2直觉 × D3驱动 × D4灵活 ── */
  ei_in_jp_2: { num: '06', cn: '天赋者', en: 'The Muse', slogan: '一个创意能撬动千万人，你天生就会做爆点。', keywords: ['爆款直觉', '人格魅力', '内容势能'], avatarF: '06-muse-f.webp', avatarM: '06-muse-m.webp', rarity: 7, colors: { accent: '#ff5fae', deep: '#5e1240', glow: 'rgba(255,95,174,.32)' } },
  /* ── D1外向 × D2直觉 × D3支撑 × D4守序 ── */
  ei_in_sj_1: { num: '07', cn: '守护者', en: 'The Guardian', slogan: '把混乱变有序，再给秩序加一点温度。', keywords: ['品质管家', '温暖守护', '秩序之美'], avatarF: '07-guardian-f.webp', avatarM: '07-guardian-m.webp', rarity: 8, colors: { accent: '#38e0c4', deep: '#0b4f45', glow: 'rgba(56,224,196,.32)' } },
  /* ── D1外向 × D2直觉 × D3支撑 × D4灵活 ── */
  ei_in_sj_2: { num: '08', cn: '社交家', en: 'The Connector', slogan: '哪里有人的地方，哪里就有你的主场。', keywords: ['关系网罗', '气氛担当', '热闹中心'], avatarF: '08-connector-f.webp', avatarM: '08-connector-m.webp', rarity: 8, colors: { accent: '#9d7bff', deep: '#33186b', glow: 'rgba(157,123,255,.32)' } },

  /* ── D1内向 × D2分析 × D3驱动 × D4守序 ── */
  ii_at_jp_1: { num: '09', cn: '架构师', en: 'The Architect', slogan: '你画的那张图，团队照着走从不迷路。', keywords: ['系统构建', '逻辑拆解', '蓝图大师'], avatarF: '09-architect-f.webp', avatarM: '09-architect-m.webp', rarity: 4, colors: { accent: '#7c6cff', deep: '#3a2e8f', glow: 'rgba(124,108,255,.35)' } },
  /* ── D1内向 × D2分析 × D3驱动 × D4灵活 ── */
  ii_at_jp_2: { num: '10', cn: '谋士', en: 'The Strategist', slogan: '你打的每一场仗，都在开战前已经赢了八成。', keywords: ['战局预判', '资源调配', '降维打击'], avatarF: '10-strategist-f.webp', avatarM: '10-strategist-m.webp', rarity: 2, colors: { accent: '#22d3ee', deep: '#0e4a52', glow: 'rgba(34,211,238,.28)' } },
  /* ── D1内向 × D2分析 × D3支撑 × D4守序 ── */
  ii_at_sj_1: { num: '11', cn: '精算师', en: 'The Auditor', slogan: '数字不会说谎，你恰好是最信数字的人。', keywords: ['数据严审', '合规风控', '零误差交付'], avatarF: '11-auditor-f.webp', avatarM: '11-auditor-m.webp', rarity: 4, colors: { accent: '#38e0c4', deep: '#0b4f45', glow: 'rgba(56,224,196,.32)' } },
  /* ── D1内向 × D2分析 × D3支撑 × D4灵活 ── */
  ii_at_sj_2: { num: '12', cn: '解题人', en: 'The Analyst', slogan: '乱麻到你手里，三分钟出答案。', keywords: ['结构化思维', '数据敏感', '逻辑闭环'], avatarF: '12-analyst-f.webp', avatarM: '12-analyst-m.webp', rarity: 10, colors: { accent: '#7dd3fc', deep: '#1e3a5f', glow: 'rgba(125,211,252,.3)' } },
  /* ── D1内向 × D2直觉 × D3驱动 × D4守序 ── */
  ii_in_jp_1: { num: '13', cn: '工程师', en: 'The Engineer', slogan: '既要造得出，又要造得美，缺一不可。', keywords: ['手上功夫', '工程直觉', '精密制造'], avatarF: '13-engineer-f.webp', avatarM: '13-engineer-m.webp', rarity: 8, colors: { accent: '#ffb020', deep: '#6b430d', glow: 'rgba(255,176,32,.3)' } },
  /* ── D1内向 × D2直觉 × D3驱动 × D4灵活 ── */
  ii_in_jp_2: { num: '14', cn: '艺术家', en: 'The Artist', slogan: '世界是素材，你是执笔人。', keywords: ['审美在线', '内容直觉', '表达欲'], avatarF: '14-artist-f.webp', avatarM: '14-artist-m.webp', rarity: 7, colors: { accent: '#f06bf0', deep: '#5c1455', glow: 'rgba(240,107,240,.3)' } },
  /* ── D1内向 × D2直觉 × D3支撑 × D4守序 ── */
  ii_in_sj_1: { num: '15', cn: '手艺人', en: 'The Craftsman', slogan: '别人看到的是产品，你看到的是每一道工序。', keywords: ['匠心手感', '质量信仰', '日拱一卒'], avatarF: '15-craftsman-f.webp', avatarM: '15-craftsman-m.webp', rarity: 9, colors: { accent: '#63e37c', deep: '#17502b', glow: 'rgba(99,227,124,.3)' } },
  /* ── D1内向 × D2直觉 × D3支撑 × D4灵活 ── */
  ii_in_sj_2: { num: '16', cn: '探索者', en: 'The Explorer', slogan: '什么都想弄明白，什么都想亲手试试。', keywords: ['好奇驱动', '自学科幻', '体验至上'], avatarF: '16-explorer-f.webp', avatarM: '16-explorer-m.webp', rarity: 10, colors: { accent: '#a78bfa', deep: '#2e1065', glow: 'rgba(167,139,250,.3)' } },
};

/* 四组二值判别常量（由六维归一化分值推得） */
const CLASSIFY_DIM = {
  D1_ext: n => n.social >= 40,           // 外向/内向
  D2_intu: n => n.creative >= n.analytic, // 直觉/分析
  D3_drv:  n => n.leader >= Math.max(n.social, n.stable, n.maker), // 驱动/支撑
  D4_orch: n => n.stable >= 55,           // 守序/灵活
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
  { id: 'coding', label: '编程基础' },
  { id: 'av', label: '剪辑摄影' },
  { id: 'teach', label: '教学辅导' },
  { id: 'office', label: 'PPT/办公' },
  { id: 'design', label: '平面设计/UI' },
  { id: 'newmedia', label: '新媒体运营' },
  { id: 'service', label: '客户服务' },
  { id: 'food', label: '做饭/烘焙' },
  { id: 'driving', label: '开车/配送' },
  { id: 'craft', label: '维修/手工' },
  { id: 'business', label: '摆摊/开店' },
  { id: 'care', label: '照护/护理' },
];
/* 技能 → 轴向映射（F3 性格延续用的岗位画像构建） */
const SKILL_AXIS = {
  data: { analytic: 3, stable: 1 },
  writing: { creative: 3 },
  sales: { social: 2, leader: 2 },
  machinery: { maker: 3 },
  language: { social: 1, creative: 1 },
  coding: { analytic: 2, maker: 2 },
  av: { creative: 3, social: 1 },
  teach: { social: 3, leader: 1 },
  office: { analytic: 2, stable: 1 },
  design: { creative: 2, av: 1 },
  newmedia: { social: 1, creative: 1, av: 1 },
  service: { social: 2, stable: 1 },
  food: { maker: 3, stable: 1 },
  driving: { maker: 2, stable: 1 },
  craft: { maker: 3 },
  business: { social: 1, leader: 2, maker: 1 },
  care: { social: 2, stable: 2 },
};
const PAT_RANK = { '坐班': 0, '外勤': 1, '倒班': 2, '弹性': 3 };

/* ---------------- 方向行动库（v3） ----------------
   设计理念：不限于「职业名称」——每条推荐覆盖三种可行动路径：
     path: 求职(J)→对应工种 / 自由(F)→副业或创业 / 学习(L)→入门认证路线
   fam 大典大类 / S·L 标记 / req 准入约束 / tr 迁移矩阵 / mkt 市场信号 */
const ACTIONS = [
  /* ── 01 猎手型：外向×分析×驱动×守序 ── */
  { arc: 'ei_at_jp_1', name: '销售总监/KA大客户', sal: '12k–40k', fam: '社会生产服务和生活服务人员', tags: ['上限极高', '管理入门'], J: '大客户销售经理→区域总监。', F: '代账/财税代理工作室，以客户关系为核心获客。', L: '销售方法论认证（Sandler/Miller-Heiman）+行业知识。', week1: '列出 20 个熟人清单，标注他们的核心需求，本周尝试帮一个人解决问题。', req: { edu: 1, pat: '外勤', skills: ['sales'] }, tr: [['商贸零售', .7], ['金融财税', .5], ['IT/互联网', .4]], mkt: { g: 18, c: 85, shortage: false } },
  { arc: 'ei_at_jp_1', name: '投资理财顾问', sal: '8k–30k+提成', fam: '专业技术人员', tags: ['收入弹性', '门槛灵活'], J: '银行/券商/三方财富顾问。', F: '独立投顾工作室，以高净值客户关系运营为核心。', L: 'AFP/CFP 认证 + 资产配置基础课程。', week1: '梳理你身边 10 位朋友的理财需求，做一份对比分析表私下发给他们看。', req: { edu: 2, pat: '坐班', skills: ['sales', 'data'] }, tr: [['金融财税', .6], ['商贸零售', .5]], mkt: { g: 10, c: 90, shortage: false } },
  { arc: 'ei_at_jp_1', name: '政府关系/产业招商', sal: '10k–25k', fam: '专业技术人员', tags: ['稀缺赛道', '体制内通'], J: '产业园招商经理→政府事务总监。', F: '产业咨询公司对接政策资源。', L: '政策解读能力 + 公共管理基础知识。', week1: '调研你所在城市的产业扶持政策，整理一份"补贴申报指南"。', req: { edu: 2, pat: '外勤', skills: ['sales', 'data'] }, tr: [['机关事业单位', .5], ['制造/工厂', .4]], mkt: { g: 15, c: 55, shortage: true } },

  /* ── 02 先锋型：外向×分析×驱动×灵活 ── */
  { arc: 'ei_at_jp_2', name: '增长黑客/用户运营', sal: '10k–30k', fam: '专业技术人员', S: true, tags: ['高薪', '增长风口'], J: '增长负责人→VP Growth。', F: '私域代运营工作室。', L: '数据分析工具（SQL/A/B测试）+增长框架（HubSpot/Sean Ellis）。', week1: '选一个你常用的 App，画出它的用户激活路径图，标注流失环节。', req: { edu: 2, pat: '坐班', skills: ['coding', 'data'] }, tr: [['IT/互联网', .7], ['商贸零售', .5]], mkt: { g: 45, c: 82, shortage: false } },
  { arc: 'ei_at_jp_2', name: '跨境电商操盘手', sal: '5k–30k+提成', fam: '社会生产服务和生活服务人员', S: true, tags: ['出海红利'], J: '跨境运营经理→品类负责人。', F: 'Shopify 独立站品牌。', L: 'Amazon/Shopee 平台规则 + 数字营销基础。', week1: '在 AliExpress 上选一个你感兴趣的品类，比较前 10 的定价策略和标题写法。', req: { edu: 1, pat: '坐班', skills: ['data', 'language'] }, tr: [['商贸零售', .6], ['物流运输', .4]], mkt: { g: 35, c: 68, shortage: false } },
  { arc: 'ei_at_jp_2', name: '管理咨询/战略顾问', sal: '12k–35k', fam: '专业技术人员', tags: ['高端赛道', '跳板型'], J: '咨询顾问→项目经理→合伙人。', F: '独立咨询师（细分行业）。', L: '咨询方法论框架（McKinsey/BCG 结构化拆解）+行业速览。', week1: '找一个你熟悉行业的效率痛点，写一份 1000 字"诊断书+解决方案"。', req: { edu: 3, pat: '坐班', skills: ['data', 'writing'] }, tr: [['金融财税', .5], ['IT/互联网', .4]], mkt: { g: 20, c: 120, shortage: false } },

  /* ── 03 守望者型：外向×分析×支撑×守序 ── */
  { arc: 'ei_at_sj_1', name: '客户成功经理(CSM)', sal: '8k–18k', fam: '专业技术人员', tags: ['SaaS刚需', '留存专家'], J: 'CSM→客户成功总监→VP CS。', F: '企业数字化转型顾问。', L: 'CRM 工具（Salesforce/HubSpot）+客户健康度指标体系。', week1: '列出你用过的 3 款软件的付费理由，制作一份"满意度打分表"。', req: { edu: 2, pat: '坐班', skills: ['sales', 'data'] }, tr: [['IT/互联网', .6], ['商贸零售', .5]], mkt: { g: 28, c: 70, shortage: false } },
  { arc: 'ei_at_sj_1', name: '高级行政/总裁助理', sal: '6k–15k', fam: '办事人员和有关人员', tags: ['核心岗', '发展快'], J: '行政→办公室主任→董秘。', F: '高端家庭管家/私人助理。', L: '商务礼仪+办公自动化+多任务统筹。', week1: '用一周时间整理你的时间块管理表，找出浪费最多的三小时并优化。', req: { edu: 2, pat: '坐班', skills: ['data'] }, tr: [['机关事业单位', .5], ['金融财税', .4]], mkt: { g: 8, c: 150, shortage: false } },
  { arc: 'ei_at_sj_1', name: '银行客户经理/理财经理', sal: '6k–20k+提成', fam: '社会生产服务和生活服务人员', tags: ['稳定平台', '收入弹性'], J: '理财经理→网点行长→分行管理层。', F: '独立财富管理咨询。', L: '银行从业资格+AFP/CFP。', week1: '走访附近三家银行的理财经理，了解他们目前主推的产品线和获客方式。', req: { edu: 1, pat: '外勤', skills: ['sales'] }, tr: [['金融财税', .6], ['商贸零售', .4]], mkt: { g: 10, c: 95, shortage: false } },

  /* ── 04 外交官型：外向×分析×支撑×灵活 ── */
  { arc: 'ei_at_sj_2', name: '猎头顾问/招聘合伙人', sal: '8k–25k+提成', fam: '专业技术人员', tags: ['人脉变现', '入门友好'], J: 'R/E 猎头→团队负责人→合伙人。', F: '独立职业教练/人才寻访顾问。', L: 'ATS 系统+行业人才地图绘制方法论。', week1: '约两位不同行业的前同事喝咖啡，了解他们的工作满意度与跳槽意向。', req: { edu: 2, pat: '坐班', skills: ['sales', 'teach'] }, tr: [['IT/互联网', .5], ['商贸零售', .5]], mkt: { g: 15, c: 110, shortage: false } },
  { arc: 'ei_at_sj_2', name: '采购经理/供应链协调', sal: '7k–20k', fam: '社会生产服务和生活服务人员', tags: ['幕后枢纽', '管理跳板'], J: '采购专员→采购经理→供应链总监。', F: '采购代理/集采平台。', L: '采购管理流程（CIPS 基础模块）+谈判技巧。', week1: '为你自己家做一次月度采购复盘——找出三个可以优化成本的开支项。', req: { edu: 2, pat: '外勤', skills: ['data', 'sales'] }, tr: [['商贸零售', .5], ['物流运输', .5]], mkt: { g: 14, c: 58, shortage: true } },
  { arc: 'ei_at_sj_2', name: '保险经纪/高端医疗险顾问', sal: '5k–25k+提成', fam: '社会生产服务和生活服务人员', tags: ['时间自由', '深度经营'], J: '经纪→资深顾问→团队长。', F: '独立财富风险管理顾问。', L: '寿险/健康险产品体系+需求分析法（KYC）。', week1: '跟身边三位已购买保险的朋友了解他们购买时的决策过程，整理成笔记。', req: { edu: 1, pat: '弹性', skills: ['sales'] }, tr: [['医疗健康', .5], ['金融财税', .5]], mkt: { g: 12, c: 78, shortage: false } },

  /* ── 05 主理人型：外向×直觉×驱动×守序 ── */
  { arc: 'ei_in_jp_1', name: '品牌主理人/内容总监', sal: '10k–30k', fam: '社会生产服务和生活服务人员', tags: ['品控核心', '创意×商业'], J: '内容编辑→内容总监→CMO。', F: '内容工作室/自媒体品牌。', L: '品牌方法论（奥格威/特劳特）+内容日历管理工具。', week1: '选三个你喜欢的品牌，分析它们的视觉、声音、调性各有什么一致性。', req: { edu: 2, pat: '坐班', skills: ['writing', 'av'] }, tr: [['文化传媒', .6], ['商贸零售', .5]], mkt: { g: 22, c: 75, shortage: false } },
  { arc: 'ei_in_jp_1', name: '产品负责人(CPO)', sal: '15k–40k', fam: '专业技术人员', tags: ['高薪天花板'], J: '产品经理→高级PM→CPO。', F: '独立产品顾问。', L: '产品方法论（North Star Metric/OKR）+数据驱动决策。', week1: '选一款你日常使用的 App，从用户视角写一份 PRD：功能描述+目标人群+成功指标。', req: { edu: 3, pat: '坐班', skills: ['coding', 'data'] }, tr: [['IT/互联网', .6], ['软件开发', .5]], mkt: { g: 38, c: 115, shortage: false } },
  { arc: 'ei_in_jp_1', name: '买手/时尚主理人', sal: '8k–25k', fam: '社会生产服务和生活服务人员', tags: ['审美变现'], J: '买手店店长→时尚电商选品总监。', F: '个人风格品牌/小红书博主。', L: '色彩学+趋势预测方法论+供应链基础。', week1: '在小红书上以"一周穿搭日记"为主题连发 7 篇，记录你自己的搭配逻辑。', req: { edu: 1, pat: '外勤', skills: ['av'] }, tr: [['商贸零售', .5], ['文化传媒', .4]], mkt: { g: 18, c: 60, shortage: false } },

  /* ── 06 灵感型：外向×直觉×驱动×灵活 ── */
  { arc: 'ei_in_jp_2', name: '短视频 IP/独立创作者', sal: '3k–30k+商单', fam: '社会生产服务和生活服务人员', S: true, tags: ['IP红利', '人格势能'], J: 'MCN 签约达人→头部 IP→自组团队。', F: '独立 IP——你就是品牌。', L: '镜头表现力训练+爆款选题公式+平台算法逻辑。', week1: '在本周持续拍 3 条 30 秒竖屏短视频发抖音，看哪些选题有自然互动。', req: { edu: 1, pat: '弹性', skills: ['av', 'writing'] }, tr: [['文化传媒', .6], ['教育培训', .4]], mkt: { g: 55, c: 105, shortage: false } },
  { arc: 'ei_in_jp_2', name: '活动策划/策展人', sal: '6k–18k', fam: '社会生产服务和生活服务人员', tags: ['体验经济', '幕后推手'], J: '活动专员→策展总监→自有公司。', F: '快闪活动品牌/体验式营销公司。', L: '活动全流程管理（从 brief 到复盘）+创意提案方法。', week1: '策划一场 30 人规模的线下分享会，选定主题、场地、嘉宾，发出邀请。', req: { edu: 2, pat: '外勤', skills: ['av', 'sales'] }, tr: [['文化传媒', .6], ['教育培训', .5]], mkt: { g: 22, c: 68, shortage: true } },
  { arc: 'ei_in_jp_2', name: '社群主理人/知识 IP', sal: '5k–20k+课程分成', fam: '社会生产服务和生活服务人员', tags: ['轻量起步', '长尾收入'], J: '社群运营→社群主理人→知识付费产品负责人。', F: '自己的付费社区/专栏。', L: '社群运营方法论（活跃三板斧）+课程设计基础。', week1: '围绕你的一个专长领域建一个 20 人微信群，分享一篇实操干货，观察互动率。', req: { edu: 1, pat: '弹性', skills: ['teach', 'writing'] }, tr: [['IT/互联网', .5], ['教育培训', .6]], mkt: { g: 32, c: 65, shortage: false } },

  /* ── 07 守护者型：外向×直觉×支撑×守序 ── */
  { arc: 'ei_in_sj_1', name: '高端管家/私人助理', sal: '8k–20k', fam: '社会生产服务和生活服务人员', tags: ['稀缺岗位', '跨界核心'], J: '私人助理→高管秘书→行政总监。', F: '高端家政管理工作室。', L: '商务英语+日程统筹工具+危机处理 SOP。', week1: '为一位模拟客户规划"东京 5 天商务差旅"完整行程表，包括航班/酒店/餐厅预订。', req: { edu: 2, pat: '坐班', skills: ['language', 'teach'] }, tr: [['机关事业单位', .4], ['金融财税', .4]], mkt: { g: 6, c: 35, shortage: true } },
  { arc: 'ei_in_sj_1', name: '高端民宿主理人', sal: '4k–15k', fam: '社会生产服务和生活服务人员', tags: ['审美×运营'], J: '民宿店长→品牌连锁运营总监。', F: '自有特色民宿品牌。', L: 'Airbnb/Booking 平台运营+OTA 渠道管理+摄影构图。', week1: '在本市住三家评分最高的民宿，记录每家的亮点和改进空间。', req: { edu: 1, pat: '弹性', skills: ['av'] }, tr: [['商贸零售', .5], ['家政生活服务', .4]], mkt: { g: 20, c: 48, shortage: false } },
  { arc: 'ei_in_sj_1', name: '精品门店主理人', sal: '5k–20k', fam: '社会生产服务和生活服务人员', tags: ['实体美学'], J: '精品买手店副店长→主理人→合伙人。', F: '你的线下体验店。', L: '商品陈列美学（VMD 基础）+库存周转管理。', week1: '逛一家你最喜欢的实体店，用手机拍下它在陈列、灯光、音乐上的三个绝妙之处。', req: { edu: 1, pat: '外勤', skills: ['av'] }, tr: [['商贸零售', .6], ['文化传媒', .4]], mkt: { g: 15, c: 72, shortage: false } },

  /* ── 08 社交型：外向×直觉×支撑×灵活 ── */
  { arc: 'ei_in_sj_2', name: '研学营地主理人', sal: '6k–15k', fam: '社会生产服务和生活服务人员', L: true, tags: ['成长型行业'], J: '营地导师→运营经理→营地总监。', F: '自研研学课程品牌。', L: '自然教育方法论+安全管理资质。', week1: '在你所在城市找 3 家研学机构，去实地旁听一次课程，观察孩子们的投入度。', req: { edu: 1, pat: '外勤', skills: ['teach', 'av'] }, tr: [['教育培训', .7], ['文化传媒', .4]], mkt: { g: 18, c: 50, shortage: true } },
  { arc: 'ei_in_sj_2', name: '社交电商团长/社群裂变师', sal: '5k–15k+佣金', fam: '社会生产服务和生活服务人员', tags: ['轻量试水'], J: '社区团购站长→区域负责人。', F: '自有社群团购渠道。', L: '选品方法论+社群活跃三板斧。', week1: '拉一个 20 人微信小群，围绕一个共同话题（比如养猫/健身）做一周 SOP 运营。', req: { edu: 1, pat: '弹性', skills: ['sales', 'av'] }, tr: [['商贸零售', .5], ['家政生活服务', .4]], mkt: { g: 26, c: 62, shortage: false } },
  { arc: 'ei_in_sj_2', name: '婚礼策划/宴会统筹', sal: '6k–18k', fam: '社会生产服务和生活服务人员', tags: ['情感刚需', '场景感强'], J: '婚礼策划师→工作室主理人→品牌化。', F: '独立婚礼/定制宴会工作室。', L: '婚礼全流程管理（从沟通到执行 checklist）+供应商资源库。', week1: '为你自己的理想婚礼（或一场宴席）画一张执行流程图，标注 10 个关键节点。', req: { edu: 1, pat: '弹性', skills: ['av', 'sales'] }, tr: [['文化传媒', .5], ['家政生活服务', .4]], mkt: { g: 12, c: 58, shortage: false } },

  /* ── 09 架构师型：内向×分析×驱动×守序 ── */
  { arc: 'ii_at_jp_1', name: '全栈工程师/技术合伙人', sal: '15k–40k', fam: '专业技术人员', tags: ['高薪天花板'], J: '高级工程师→架构师→CTO。', F: '技术外包/独立开发者。', L: '编程训练营+系统设计模式+云原生基础。', week1: '用免费课程写一个带数据库 CRUD 的小应用，部署上线让别人能访问。', req: { edu: 2, pat: '坐班', skills: ['coding'] }, tr: [['软件开发', .8], ['IT/互联网', .7]], mkt: { g: 35, c: 74, shortage: false } },
  { arc: 'ii_at_jp_1', name: 'ERP 实施顾问/信息化架构师', sal: '12k–25k', fam: '专业技术人员', tags: ['传统转型首选'], J: '实施顾问→项目经理→行业方案总监。', F: '独立信息化咨询顾问。', L: 'SAP/Oracle 基础模块+业务流程建模（BPMN）。', week1: '整理你上一份工作中最复杂的 5 个业务流程，画成泳道图。', req: { edu: 2, pat: '坐班', skills: ['data', 'coding'] }, tr: [['制造/工厂', .6], ['商贸零售', .5]], mkt: { g: 20, c: 56, shortage: false } },
  { arc: 'ii_at_jp_1', name: '技术文档工程师/API 专家', sal: '10k–22k', fam: '专业技术人员', tags: ['翻译官角色'], J: '技术写作→DevRel→CTO。', F: 'API 文档/SDK 教程独立开发者。', L: 'Markdown/AsciiDoc+RESTful API 设计规范。', week1: '为一个开源项目写一份 500 字的小白向使用指南，发 GitHub。', req: { edu: 2, pat: '坐班', skills: ['coding', 'writing'] }, tr: [['软件开发', .7], ['IT/互联网', .6]], mkt: { g: 18, c: 60, shortage: false } },

  /* ── 10 策略型：内向×分析×驱动×灵活 ── */
  { arc: 'ii_at_jp_2', name: '数据科学家/ML 应用工程师', sal: '15k–40k', fam: '专业技术人员', S: true, tags: ['AI高薪', '门槛友好'], J: '数据分析师→ML 工程师→AI 产品负责人。', F: 'AI 工具独立开发者/咨询。', L: 'Python+Scikit-learn+大模型 API 应用（Prompt Engineering）。', week1: '用 Python 调通一个大模型 API，写一个帮你自动总结邮件的脚本。', req: { edu: 3, pat: '坐班', skills: ['coding', 'data'] }, tr: [['软件开发', .6], ['IT/互联网', .5]], mkt: { g: 53, c: 88, shortage: false } },
  { arc: 'ii_at_jp_2', name: '量化交易工程师/FinTech 开发者', sal: '15k–50k+分成', fam: '专业技术人员', tags: ['小众高薪', '复合赛道'], J: '量化研究员→策略工程师→基金经理。', F: '独立量化策略开发。', L: 'C++/Python 量化框架+统计学基础+金融市场微观结构。', week1: '用 Python 回测一个简单均线策略，在历史数据上看它的胜率和回撤。', req: { edu: 3, pat: '坐班', skills: ['coding', 'data'] }, tr: [['金融财税', .5], ['软件开发', .5]], mkt: { g: 30, c: 52, shortage: false } },
  { arc: 'ii_at_jp_2', name: '产品策略师/独立产品顾问', sal: '10k–30k', fam: '专业技术人员', tags: ['咨询+产品'], J: '产品经理→高级 PM→产品VP→独立顾问。', F: 'MVP 验证工作室——接小单快交付。', L: '精益创业方法论+数据驱动产品迭代。', week1: '以一个痛点为切入，写一份 MVP 规格文档+技术选型+三个月里程碑计划。', req: { edu: 3, pat: '坐班', skills: ['coding', 'data'] }, tr: [['IT/互联网', .5], ['软件开发', .5]], mkt: { g: 30, c: 64, shortage: false } },

  /* ── 11 精算型：内向×分析×支撑×守序 ── */
  { arc: 'ii_at_sj_1', name: '审计/税务专家', sal: '8k–25k', fam: '专业技术人员', tags: ['越老越值钱'], J: '审计助理→审计经理→合伙人。', F: '中小企业财税托管工作室。', L: 'CPA/CMA 备考路线+行业准则深入。', week1: '免费帮一家小企业做一次账务健康检查，输出问题与建议清单。', req: { edu: 2, pat: '坐班', skills: ['data'] }, tr: [['金融财税', .7], ['商贸零售', .5]], mkt: { g: 8, c: 223, shortage: false } },
  { arc: 'ii_at_sj_1', name: '数据合规官/隐私安全顾问', sal: '10k–25k', fam: '专业技术人员', tags: ['合规刚需', '政策驱动'], J: '合规专员→DPO→CDO。', F: '中小企业数据合规顾问。', L: 'GDPR/PIPL 框架+CIA 三性方法论。', week1: '为你自己/一个朋友的网站做一轮隐私政策审查，标注五个可改进点。', req: { edu: 3, pat: '坐班', skills: ['data'] }, tr: [['IT/互联网', .5], ['金融财税', .4]], mkt: { g: 25, c: 52, shortage: true } },
  { arc: 'ii_at_sj_1', name: '财务 BP/经营分析', sal: '8k–20k', fam: '专业技术人员', tags: ['跨职能跳板'], J: '财务分析→FP&A→CFO。', F: '中小企业 CFO 兼职顾问。', L: 'Power BI/Tableau+管理会计+财务建模。', week1: '用 Excel 为一家模拟餐厅搭建收入-成本-利润模型，设三种情景。', req: { edu: 3, pat: '坐班', skills: ['data'] }, tr: [['商贸零售', .6], ['餐饮住宿', .4]], mkt: { g: 14, c: 130, shortage: false } },

  /* ── 12 解题型：内向×分析×支撑×灵活 ── */
  { arc: 'ii_at_sj_2', name: '商业分析师/行业研究', sal: '9k–25k', fam: '专业技术人员', tags: ['通用性强', '知识复利'], J: '分析师→高级分析师→首席分析师。', F: '行业研究自媒体/付费订阅。', L: 'Excel/SQL+公司研究方法论（一页纸财报分析）。', week1: '挑一个你好奇的行业，写一份 800 字速览（市场规模+竞争格局+趋势），发社交平台。', req: { edu: 3, pat: '坐班', skills: ['data', 'writing'] }, tr: [['金融财税', .5], ['教育培训', .4]], mkt: { g: 12, c: 120, shortage: false } },
  { arc: 'ii_at_sj_2', name: '用户研究员/UX 分析师', sal: '8k–18k', fam: '专业技术人员', tags: ['产品核心岗'], J: 'UX 研究员→UX 总监。', F: 'UX 咨询工作室。', L: '可用性测试方法论+统计显著性基础+NPS/CSAT 体系。', week1: '找 3 个朋友对你的常用 App 做一次认知走查，记录他们的困惑点。', req: { edu: 2, pat: '坐班', skills: ['data'] }, tr: [['IT/互联网', .5], ['文化传媒', .4]], mkt: { g: 18, c: 80, shortage: false } },
  { arc: 'ii_at_sj_2', name: 'BI 分析师/数据可视化专家', sal: '9k–20k', fam: '专业技术人员', tags: ['需求稳定'], J: 'BI 专员→BI 经理→数据总监。', F: '数据报告独立生成服务。', L: 'SQL+Tableau/Power BI+Dashboard 设计美学。', week1: '用 Power BI 或 Google Sheets 为一个公开数据集做一张可交互仪表盘。', req: { edu: 2, pat: '坐班', skills: ['coding', 'data'] }, tr: [['软件开发', .5], ['商贸零售', .4]], mkt: { g: 22, c: 75, shortage: false } },

  /* ── 13 工程师型：内向×直觉×驱动×守序 ── */
  { arc: 'ii_in_jp_1', name: '前端工程师/UI 工程师', sal: '12k–30k', fam: '专业技术人员', tags: ['高薪自学可行'], J: '初级前端→高级→架构师。', F: '自由接单/模板市场售卖。', L: 'React/Vue 完整教程+GitHub 项目积累。', week1: '跟着一个免费课程写完第一个个人主页，部署到 Vercel 并发朋友圈。', req: { edu: 2, pat: '坐班', skills: ['coding'] }, tr: [['软件开发', .8], ['IT/互联网', .7]], mkt: { g: 28, c: 66, shortage: false } },
  { arc: 'ii_in_jp_1', name: '硬件工程师/嵌入式开发', sal: '10k–25k', fam: '生产制造及有关人员', S: true, tags: ['硬科技'], J: '嵌入式工程师→硬件架构师→CTO。', F: '智能硬件独立设计工作室。', L: 'C 语言+Arduino/Raspberry Pi 入门套件。', week1: '买一套 Arduino 入门套装（百元级），跟着教程点亮第一个 LED→传感器→蜂鸣器。', req: { edu: 2, pat: '坐班', skills: ['coding'] }, tr: [['制造/工厂', .5], ['建筑工程', .4]], mkt: { g: 25, c: 50, shortage: true } },
  { arc: 'ii_in_jp_1', name: '建筑/室内设计师（执业）', sal: '8k–20k', fam: '专业技术人员', tags: ['作品说话'], J: '绘图员→设计师→主创设计师→工作室负责人。', F: '独立住宅设计工作室。', L: 'AutoCAD/Revit+设计史+材料工艺。', week1: '临摹三张优秀住宅平面布局图，标注动线、功能分区、采光逻辑。', req: { edu: 2, pat: '坐班', skills: ['av'] }, tr: [['建筑工程', .6], ['商贸零售', .3]], mkt: { g: 10, c: 95, shortage: false } },

  /* ── 14 艺术家型：内向×直觉×驱动×灵活 ── */
  { arc: 'ii_in_jp_2', name: 'AIGC 内容创作者', sal: '5k–20k', fam: '社会生产服务和生活服务人员', S: true, tags: ['风口红利'], J: '内容创作者→工作室主理人→品牌。', F: 'AIGC 代写/配图/视频代工。', L: '主流 AI 工具（Midjourney/Stable Diffusion/Sora）+提示词工程。', week1: '用 AI 工具做一组 9 张同主题插画，保持统一风格发到社交平台。', req: { edu: 1, pat: '弹性', skills: ['av', 'writing'] }, tr: [['文化传媒', .6], ['IT/互联网', .5]], mkt: { g: 55, c: 118, shortage: false } },
  { arc: 'ii_in_jp_2', name: '插画师/游戏美术', sal: '6k–18k', fam: '社会生产服务和生活服务人员', tags: ['天赋变现'], J: '初级美术→原画师→主美→艺术总监。', F: '自由插画师（Behance/站酷）。', L: '人体结构+色彩理论+Procreate 工作流。', week1: '每天画一张练习，连续 7 天发社交平台，主题可轮换（人物/动物/场景）。', req: { edu: 1, pat: '弹性', skills: ['av'] }, tr: [['文化传媒', .5], ['IT/互联网', .4]], mkt: { g: 20, c: 90, shortage: false } },
  { arc: 'ii_in_jp_2', name: '独立游戏开发者/Game Jam', sal: '自由（可版权变现）', fam: '专业技术人员', tags: ['全栈创造'], J: '游戏公司初级→主程→技术总监。', F: 'Steam/App Store 独立发行。', L: 'Unity/Godot/Phaser 入门+游戏设计基础（GDC talks）。', week1: '用 Construct 3 或 GDevelop 在一天内做一个超小型可玩游戏 Demo。', req: { edu: 1, pat: '弹性', skills: ['coding'] }, tr: [['IT/互联网', .5], ['文化传媒', .4]], mkt: { g: 22, c: 45, shortage: false } },

  /* ── 15 手艺型：内向×直觉×支撑×守序 ── */
  { arc: 'ii_in_sj_1', name: '烘焙/咖啡主理人', sal: '5k–15k', fam: '社会生产服务和生活服务人员', tags: ['手艺吃饭', '低门槛开店'], J: '学徒→面包师→主厨→合伙人/店主。', F: '烘焙品牌/精品咖啡品牌。', L: '烘焙师认证+SCA 咖啡师认证。', week1: '在自己家做出第一批像样的面包（欧包/吐司均可），拍照记录步骤与难点。', req: { edu: 1, pat: '弹性', skills: [] }, tr: [['家政生活服务', .5], ['商贸零售', .4]], mkt: { g: 15, c: 72, shortage: false } },
  { arc: 'ii_in_sj_1', name: '汽车维修技师/新能源车技师', sal: '6k–15k', fam: '生产制造及有关人员', tags: ['紧缺蓝领', '技术壁垒高'], J: '学徒→技师→技术主管→技术合伙人。', F: '独立修理厂/上门维修服务。', L: '1+X 证书+高压电安全认证（三电方向）。', week1: '预约一次新能源车上门维修观摩日，全程观察师傅的操作步骤和安全规程。', req: { edu: 1, pat: '外勤', phys: true, skills: ['machinery'] }, tr: [['制造/工厂', .8], ['物流运输', .4]], mkt: { g: 38, c: 45, shortage: true } },
  { arc: 'ii_in_sj_1', name: '乐器匠/手工木作师傅', sal: '5k–12k', fam: '生产制造及有关人员', tags: ['匠人精神', '社群支持'], J: '学徒→工匠师傅→作坊合伙人→品牌化。', F: '木工/乐器修复/定制家具工坊。', L: '木材学基础+榫卯结构+数控木工入门。', week1: '在一个周末完成一个简单的木工小件（如砧板/小凳），记录每个工序的时间和质量控制点。', req: { edu: 1, pat: '弹性', skills: ['machinery'] }, tr: [['制造/工厂', .5], ['建筑工程', .3]], mkt: { g: 10, c: 30, shortage: true } },

  /* ── 16 探索者型：内向×直觉×支撑×灵活 ── */
  { arc: 'ii_in_sj_2', name: '旅行博主/文旅体验师', sal: '3k–20k+商单', fam: '社会生产服务和生活服务人员', tags: ['体验经济', '轻资产'], J: '旅游策划→线路设计→目的地营销。', F: 'Vlog 频道/城市体验地图。', L: '视频剪辑+叙事结构+当地文化知识储备。', week1: '选本市一条冷门路线，走一遍并拍摄 3 分钟纪实短片，标注三个值得推荐的体验点。', req: { edu: 1, pat: '弹性', skills: ['av'] }, tr: [['文化传媒', .5], ['教育培训', .4]], mkt: { g: 20, c: 68, shortage: false } },
  { arc: 'ii_in_sj_2', name: '技能博主/知识类自媒体', sal: '3k–15k+广告分成', fam: '社会生产服务和生活服务人员', tags: ['可持续变现', '兴趣驱动'], J: '内容编辑→垂类主编→自媒体品牌。', F: '你的一人媒体公司。', L: '剪辑节奏+脚本结构+平台算法适配。', week1: '选定你的第一个系列主题（比如"如何用 100 元搞定一顿饭"），连拍 3 集，看哪个素材反响最好。', req: { edu: 1, pat: '弹性', skills: ['av', 'writing'] }, tr: [['文化传媒', .5], ['教育培训', .6]], mkt: { g: 28, c: 95, shortage: false } },
  { arc: 'ii_in_sj_2', name: '二手/收藏品鉴定师', sal: '4k–12k+佣金', fam: '社会生产服务和生活服务人员', tags: ['小众稳定', '经验变现'], J: '鉴定学徒→鉴定师→平台合作专家→自营店铺。', F: '二手寄卖/拍卖经纪独立工作室。', L: '品类知识积累（球鞋/包袋/数码/珠宝选一）+鉴定方法论。', week1: '在得物上选一个你感兴趣的品类，每周至少浏览 20 条鉴定帖并记录特征关键词。', req: { edu: 1, pat: '弹性', skills: ['av'] }, tr: [['商贸零售', .5], ['文化传媒', .4]], mkt: { g: 18, c: 40, shortage: false } },

  /* ── 低门槛 / 小生意 / 零经验可入 岗位（v4 新增） ── */
  /* 01 猎手 */
  { arc: 'ei_at_jp_1', name: '水果生鲜店长 / 水果贩子', sal: '5k–15k+分成', fam: '社会生产服务和生活服务人员', tags: ['现金流快', '可自营', '社区生意'], J: '店员→店长→片区加盟。', F: '社区水果店/水果摊自营。', L: '生鲜损耗管理+进货渠道+社群接龙。', week1: '去本地批发市场蹲一次早市，记录 3 种水果的进价、售价和损耗。', req: { edu: 1, pat: '弹性', skills: ['sales', 'business'] }, tr: [['商贸零售', .7], ['餐饮住宿', .4]], mkt: { g: 18, c: 95, shortage: false }, self: true, cap: 2, entry: true },
  { arc: 'ei_at_jp_1', name: '房产 / 贷款中介', sal: '5k–20k+提成', fam: '社会生产服务和生活服务人员', tags: ['上手快', '提成制'], J: '经纪人→店长→合伙人。', F: '独立经纪/贷款咨询。', L: '房源谈判+信贷产品+合规话术。', week1: '跟一位中介跑半天盘，记录客户最常问的 5 个问题。', req: { edu: 1, pat: '外勤', skills: ['sales', 'service'] }, tr: [['商贸零售', .6], ['金融财税', .5]], mkt: { g: 12, c: 120, shortage: false }, entry: true },
  /* 02 先锋 */
  { arc: 'ei_at_jp_2', name: '夜市小吃摊主 / 地摊烧烤', sal: '6k–18k（旺季更高）', fam: '社会生产服务和生活服务人员', tags: ['可自营', '现金流快', '辛苦'], J: '帮摊→自营→多摊/小店。', F: '夜市烧烤/铁板小吃摊。', L: '选品+出摊动线+食品安全+短视频引流。', week1: '连续 3 晚去本地夜市数人流，记下最火的 3 个品类和客单价。', req: { edu: 1, pat: '弹性', phys: true, skills: ['food', 'business'] }, tr: [['餐饮住宿', .8], ['个体经营', .6]], mkt: { g: 25, c: 90, shortage: false }, self: true, cap: 2, entry: true },
  { arc: 'ei_at_jp_2', name: '尾货 / 地摊服饰选品', sal: '4k–15k', fam: '社会生产服务和生活服务人员', tags: ['低门槛', '可自营'], J: '档口帮卖→买手→自营。', F: '尾货摊/直播清仓。', L: '面料基础+拿货渠道+定价。', week1: '去一次尾货市场，用 500 元以内进一小批货，周末试卖 3 小时。', req: { edu: 1, pat: '弹性', skills: ['sales', 'business'] }, tr: [['商贸零售', .8], ['个体经营', .5]], mkt: { g: 10, c: 100, shortage: false }, self: true, cap: 1, entry: true },
  /* 03 守望者 */
  { arc: 'ei_at_sj_1', name: '快递驿站 / 社区代收点', sal: '5k–12k', fam: '社会生产服务和生活服务人员', tags: ['稳定', '社区生意'], J: '店员→站长→多驿站。', F: '社区驿站/代收+团购。', L: '入库出库系统+投诉处理+社区运营。', week1: '找你所在小区驿站老板聊 20 分钟，问清一天单量和罚款点。', req: { edu: 1, pat: '坐班', skills: ['service', 'office'] }, tr: [['物流运输', .8], ['商贸零售', .5]], mkt: { g: 15, c: 60, shortage: false }, self: true, cap: 2, entry: true },
  { arc: 'ei_at_sj_1', name: '物业管家 / 社区运营', sal: '5k–9k', fam: '社会生产服务和生活服务人员', tags: ['稳定', '离家近'], J: '管家→主管→项目经理。', F: '社区团购/家政对接。', L: '物业流程+沟通安抚+应急处理。', week1: '在小区业主群做一次小调研：大家最不满意的 3 件事是什么。', req: { edu: 2, pat: '坐班', skills: ['service', 'office'] }, tr: [['家政生活服务', .6], ['商贸零售', .4]], mkt: { g: 12, c: 55, shortage: false }, entry: true },
  /* 04 外交官 */
  { arc: 'ei_at_sj_2', name: '社区团购团长', sal: '5k–15k+佣金', fam: '社会生产服务和生活服务人员', tags: ['可自营', '关系变现'], J: '团长→片区运营→平台 BD。', F: '社区团购/社群小店。', L: '选品+社群维护+履约售后。', week1: '拉一个 50 人的小区试团，跑通一次从接龙到分发的全流程。', req: { edu: 1, pat: '弹性', skills: ['sales', 'business', 'service'] }, tr: [['商贸零售', .7], ['家政生活服务', .4]], mkt: { g: 20, c: 80, shortage: false }, self: true, cap: 1, entry: true },
  { arc: 'ei_at_sj_2', name: '门店导购 / 店长', sal: '5k–12k+提成', fam: '社会生产服务和生活服务人员', tags: ['上手快', '可晋升'], J: '导购→店长→区域督导。', F: '小品牌代理/社区店。', L: '销售话术+陈列+库存。', week1: '去 3 家同类门店各逛 10 分钟，记录店员第一句话怎么开场。', req: { edu: 1, pat: '坐班', skills: ['sales', 'service'] }, tr: [['商贸零售', .8], ['餐饮住宿', .3]], mkt: { g: 14, c: 85, shortage: false }, entry: true },
  /* 05 主理人 */
  { arc: 'ei_in_jp_1', name: '小餐饮主理人 / 早餐店', sal: '8k–20k', fam: '社会生产服务和生活服务人员', tags: ['可自营', '辛苦但实在'], J: '学徒→店长→自营。', F: '早餐/小吃/社区餐饮店。', L: '产品标准化+选址+成本核算。', week1: '连续 3 天早起观察一家早餐店，记录 6–9 点的客流和出餐节奏。', req: { edu: 1, pat: '弹性', phys: true, skills: ['food', 'business'] }, tr: [['餐饮住宿', .8], ['个体经营', .6]], mkt: { g: 22, c: 100, shortage: false }, self: true, cap: 3 },
  { arc: 'ei_in_jp_1', name: '社区咖啡 / 奶茶小店', sal: '5k–15k', fam: '社会生产服务和生活服务人员', tags: ['可自营', '审美变现'], J: '店员→店长→自营。', F: '社区咖啡/奶茶店。', L: '出品 SOP+选址+小红书引流。', week1: '选 3 家社区咖啡馆，蹲点记录下午客流与客单价。', req: { edu: 1, pat: '弹性', skills: ['food', 'service', 'business'] }, tr: [['餐饮住宿', .7], ['商贸零售', .3]], mkt: { g: 20, c: 110, shortage: false }, self: true, cap: 3, entry: true },
  /* 06 天赋者 */
  { arc: 'ei_in_jp_2', name: '直播带货 / 农产品直播', sal: '4k–20k+佣金', fam: '社会生产服务和生活服务人员', tags: ['低门槛', '可自营'], J: '助播→主播→团队/自营。', F: '农产品/本地生活直播。', L: '镜头表达+选品+投流基础。', week1: '用手机拍 3 条 30 秒产品介绍，挑一条发出去看数据。', req: { edu: 1, pat: '弹性', skills: ['av', 'sales', 'newmedia'] }, tr: [['文化传媒', .6], ['商贸零售', .5]], mkt: { g: 30, c: 120, shortage: false }, entry: true },
  { arc: 'ei_in_jp_2', name: '婚礼跟拍 / 活动摄影', sal: '5k–18k', fam: '社会生产服务和生活服务人员', tags: ['手艺变现', '可接单'], J: '摄影助理→跟拍师→工作室。', F: '婚礼/活动跟拍接单。', L: '相机基础+布光+剪辑交付。', week1: '免费帮一位朋友拍一组活动照片，按交付标准修 9 张。', req: { edu: 1, pat: '弹性', skills: ['av'] }, tr: [['文化传媒', .7], ['家政生活服务', .3]], mkt: { g: 15, c: 70, shortage: false }, entry: true },
  /* 07 守护者 */
  { arc: 'ei_in_sj_1', name: '月嫂 / 育儿嫂', sal: '8k–18k', fam: '社会生产服务和生活服务人员', tags: ['高客单', '需培训'], J: '育儿嫂→月嫂→金牌。', F: '母婴护理接单/工作室。', L: '母婴护理证+婴幼儿照护+沟通。', week1: '咨询一家正规培训机构，问清证书、学费和接单渠道。', req: { edu: 1, pat: '弹性', phys: true, skills: ['care'] }, tr: [['家政生活服务', .9], ['医疗健康', .5]], mkt: { g: 35, c: 60, shortage: true }, entry: true },
  { arc: 'ei_in_sj_1', name: '养老护理员 / 医院护工', sal: '5k–10k', fam: '社会生产服务和生活服务人员', tags: ['缺口大', '稳定'], J: '护理员→组长→机构主管。', F: '居家照护/陪诊服务。', L: '基础护理+急救+老人沟通。', week1: '联系一家养老机构，申请半天的陪护观摩。', req: { edu: 1, pat: '倒班', phys: true, skills: ['care', 'service'] }, tr: [['家政生活服务', .8], ['医疗健康', .6]], mkt: { g: 45, c: 50, shortage: true }, entry: true },
  /* 08 社交家 */
  { arc: 'ei_in_sj_2', name: '夜市套圈 / 小游戏摊主', sal: '4k–12k', fam: '社会生产服务和生活服务人员', tags: ['低成本', '可自营'], J: '帮摊→自营→多摊。', F: '夜市游戏摊/亲子小游戏。', L: '选点位+道具成本+现场招揽。', week1: '周末去夜市观察 3 个游戏摊，记录围观人数与成交率。', req: { edu: 1, pat: '弹性', skills: ['business', 'sales'] }, tr: [['个体经营', .8], ['餐饮住宿', .4]], mkt: { g: 12, c: 60, shortage: false }, self: true, cap: 1, entry: true },
  { arc: 'ei_in_sj_2', name: '亲子活动 / 社区活动组织', sal: '5k–15k', fam: '社会生产服务和生活服务人员', tags: ['关系驱动', '可接单'], J: '执行→策划→自营工作室。', F: '亲子活动/社区活动接单。', L: '活动流程+安全预案+招募。', week1: '在小区组织一次 10 组家庭的周末小活动，收个成本价。', req: { edu: 1, pat: '弹性', skills: ['sales', 'service'] }, tr: [['教育培训', .5], ['家政生活服务', .5]], mkt: { g: 15, c: 50, shortage: false }, entry: true },
  /* 09 架构师 */
  { arc: 'ii_at_jp_1', name: '家电 / 手机维修师傅', sal: '6k–15k', fam: '生产制造及有关人员', tags: ['手艺', '可自营'], J: '学徒→师傅→店长。', F: '维修店/上门维修。', L: '电路基础+主板/家电拆装+配件渠道。', week1: '找一家维修店谈半天学徒观摩，记录最常见的 3 类故障。', req: { edu: 1, pat: '坐班', skills: ['craft', 'machinery'] }, tr: [['制造/工厂', .4], ['家政生活服务', .5]], mkt: { g: 20, c: 70, shortage: true }, self: true, cap: 2, entry: true },
  { arc: 'ii_at_jp_1', name: '水电 / 装修施工队长', sal: '8k–20k', fam: '生产制造及有关人员', tags: ['手艺', '可自营'], J: '水电工→工长→包工头。', F: '家装水电/维修接单。', L: '水电规范+看图+报价。', week1: '跟一个装修工地待半天，记录水电阶段的工序和材料。', req: { edu: 1, pat: '外勤', phys: true, skills: ['craft', 'machinery'] }, tr: [['建筑工程', .8], ['家政生活服务', .4]], mkt: { g: 18, c: 60, shortage: true }, self: true, cap: 2 },
  /* 10 谋士 */
  { arc: 'ii_at_jp_2', name: '二手车 / 二手数码回收评估', sal: '6k–20k', fam: '社会生产服务和生活服务人员', tags: ['眼力', '可自营'], J: '评估助理→评估师→合伙人。', F: '回收/寄卖小店。', L: '车况/机型鉴定+行情定价+渠道。', week1: '在二手平台看 30 条同款商品，整理一份价格区间表。', req: { edu: 1, pat: '外勤', skills: ['business', 'data'] }, tr: [['商贸零售', .7], ['物流运输', .3]], mkt: { g: 20, c: 80, shortage: false }, self: true, cap: 1, entry: true },
  { arc: 'ii_at_jp_2', name: '生鲜供应链 / 采购买手', sal: '7k–18k', fam: '社会生产服务和生活服务人员', tags: ['行业刚需', '可迁移'], J: '采购助理→买手→供应链主管。', F: '生鲜代采/社区供应链。', L: '品类知识+议价+损耗控制。', week1: '去一次本地批发市场，问 5 个档口的起订量和账期。', req: { edu: 2, pat: '外勤', skills: ['data', 'business', 'sales'] }, tr: [['商贸零售', .7], ['农林牧渔', .5]], mkt: { g: 15, c: 60, shortage: false }, entry: true },
  /* 11 精算师 */
  { arc: 'ii_at_sj_1', name: '便利店 / 小店主理人', sal: '5k–15k', fam: '社会生产服务和生活服务人员', tags: ['可自营', '现金流稳'], J: '店员→店长→自营。', F: '便利店/社区小店。', L: '选址+订货+库存周转。', week1: '蹲点 3 家便利店，记录早晚高峰客流和畅销品类。', req: { edu: 1, pat: '弹性', skills: ['business', 'service'] }, tr: [['商贸零售', .8], ['个体经营', .6]], mkt: { g: 10, c: 90, shortage: false }, self: true, cap: 3, entry: true },
  { arc: 'ii_at_sj_1', name: '仓储 / 库存管理员', sal: '5k–9k', fam: '社会生产服务和生活服务人员', tags: ['稳定', '门槛低'], J: '仓管→主管→仓储经理。', F: '小仓代管/电商打包。', L: 'WMS/Excel+盘点+库位规划。', week1: '找一家电商仓问半天，记录入库到出库的 5 个关键节点。', req: { edu: 1, pat: '坐班', skills: ['data', 'office', 'machinery'] }, tr: [['物流运输', .8], ['商贸零售', .5]], mkt: { g: 12, c: 70, shortage: false }, entry: true },
  /* 12 解题人 */
  { arc: 'ii_at_sj_2', name: '数据标注 / AI 训练师', sal: '4k–10k', fam: '社会生产服务和生活服务人员', tags: ['零经验可入', '远程友好'], J: '标注员→质检→项目组长。', F: '标注团队/数据服务接单。', L: '标注规范+质检+基础 Python。', week1: '在一个公开标注平台完成 100 条试标任务，记录易错点。', req: { edu: 2, pat: '坐班', skills: ['data', 'office'] }, tr: [['IT/互联网', .7], ['文化传媒', .3]], mkt: { g: 25, c: 100, shortage: false }, entry: true },
  { arc: 'ii_at_sj_2', name: '电商运营助理 / 客服主管', sal: '5k–10k', fam: '社会生产服务和生活服务人员', tags: ['上手快', '可晋升'], J: '客服→运营助理→店长。', F: '店铺代运营/客服外包。', L: '平台规则+客服话术+基础数据。', week1: '开一个个人店铺后台逛一遍，把上新流程写成 10 步清单。', req: { edu: 1, pat: '坐班', skills: ['office', 'service', 'data'] }, tr: [['商贸零售', .8], ['IT/互联网', .4]], mkt: { g: 15, c: 110, shortage: false }, entry: true },
  /* 13 工程师 */
  { arc: 'ii_in_jp_1', name: '电动车 / 新能源维修技师', sal: '6k–15k', fam: '生产制造及有关人员', tags: ['紧缺手艺', '可自营'], J: '学徒→技师→技术主管。', F: '维修店/上门维修。', L: '三电基础+检测设备+安全规范。', week1: '找一家电动车维修店谈半天观摩，记录 3 个高频维修项目。', req: { edu: 1, pat: '坐班', phys: true, skills: ['craft', 'machinery'] }, tr: [['制造/工厂', .6], ['物流运输', .4]], mkt: { g: 35, c: 55, shortage: true }, self: true, cap: 2, entry: true },
  { arc: 'ii_in_jp_1', name: '智能家居 / 弱电安装', sal: '6k–15k', fam: '生产制造及有关人员', tags: ['手艺', '可接单'], J: '安装工→技术员→项目主管。', F: '智能家居安装/弱电接单。', L: '弱电布线+设备调试+现场沟通。', week1: '跟着一位安装师傅跑一单，记录从量尺到调试的完整流程。', req: { edu: 1, pat: '外勤', skills: ['craft', 'machinery', 'service'] }, tr: [['建筑工程', .7], ['制造/工厂', .4]], mkt: { g: 20, c: 50, shortage: false }, self: true, cap: 2, entry: true },
  /* 14 艺术家 */
  { arc: 'ii_in_jp_2', name: '短视频剪辑接单 / 代运营', sal: '4k–15k', fam: '社会生产服务和生活服务人员', tags: ['远程', '可自营'], J: '剪辑助理→剪辑师→工作室。', F: '剪辑接单/账号代运营。', L: '剪辑节奏+字幕包装+平台规则。', week1: '用现有素材剪 3 条 30 秒成片，挑一条挂到接单平台。', req: { edu: 1, pat: '弹性', skills: ['av', 'newmedia'] }, tr: [['文化传媒', .8], ['IT/互联网', .3]], mkt: { g: 30, c: 130, shortage: false }, self: true, cap: 1, entry: true },
  { arc: 'ii_in_jp_2', name: '手作 / 文创摊主', sal: '3k–12k', fam: '社会生产服务和生活服务人员', tags: ['低成本', '可自营'], J: '摊主→工作室→品牌。', F: '市集摊/手作电商。', L: '产品设计+成本定价+市集报名。', week1: '做 10 件同一款小手工，周末去市集试卖并记录问价人数。', req: { edu: 1, pat: '弹性', skills: ['craft', 'business', 'design'] }, tr: [['文化传媒', .5], ['个体经营', .6]], mkt: { g: 15, c: 70, shortage: false }, self: true, cap: 1, entry: true },
  /* 15 手艺人 */
  { arc: 'ii_in_sj_1', name: '夜市烧烤 / 铁板小吃', sal: '6k–18k', fam: '社会生产服务和生活服务人员', tags: ['辛苦', '现金流快'], J: '帮工→师傅→自营。', F: '烧烤摊/小吃车。', L: '腌制配方+出餐速度+食品安全。', week1: '去一家烧烤店打一晚零工，记录备货和出餐流程。', req: { edu: 1, pat: '弹性', phys: true, skills: ['food', 'business'] }, tr: [['餐饮住宿', .9], ['个体经营', .5]], mkt: { g: 25, c: 100, shortage: false }, self: true, cap: 2, entry: true },
  { arc: 'ii_in_sj_1', name: '家政保洁 / 收纳师', sal: '5k–12k', fam: '社会生产服务和生活服务人员', tags: ['上门服务', '可接单'], J: '保洁员→组长→自营团队。', F: '家政保洁/收纳接单。', L: '清洁流程+收纳方法+客户沟通。', week1: '免费帮两户朋友做一次深度保洁，记录耗时和客户最在意的点。', req: { edu: 1, pat: '弹性', phys: true, skills: ['service', 'care'] }, tr: [['家政生活服务', .9], ['商贸零售', .3]], mkt: { g: 30, c: 60, shortage: true }, self: true, cap: 1, entry: true },
  /* 16 探索者 */
  { arc: 'ii_in_sj_2', name: '同城跑腿 / 代驾 / 外卖骑手', sal: '5k–12k', fam: '社会生产服务和生活服务人员', tags: ['上手快', '时间灵活'], J: '骑手→队长→调度。', F: '跑腿小队/代驾接单。', L: '路线规划+服务规范+安全。', week1: '注册一个跑腿/众包平台，跑 3 单并记录时薪与高峰时段。', req: { edu: 1, pat: '弹性', phys: true, skills: ['driving', 'service'] }, tr: [['物流运输', .9], ['家政生活服务', .4]], mkt: { g: 25, c: 120, shortage: false }, entry: true },
  { arc: 'ii_in_sj_2', name: '宠物寄养 / 宠物美容', sal: '4k–12k', fam: '社会生产服务和生活服务人员', tags: ['兴趣变现', '可自营'], J: '助理→美容师→自营。', F: '宠物寄养/上门喂养。', L: '宠物护理+美容基础+寄养管理。', week1: '帮朋友照看 2 天宠物，记录喂养、清洁和应急处理流程。', req: { edu: 1, pat: '弹性', skills: ['care', 'service', 'business'] }, tr: [['家政生活服务', .6], ['商贸零售', .3]], mkt: { g: 25, c: 65, shortage: false }, self: true, cap: 2, entry: true },
];

/* ---------------- 同型人物案例（示意性虚构场景，非真实人物） ----------------
   每个类型 2 个不同行业/年龄的转型切片，用于让被测者找到参照系。
   报告中会明确标注“示意性场景”，不冒充真实访谈。 */
const CASE_STORIES = {
  ei_at_jp_1: [
    { who: '34 岁 · 教培行业 · 销售主管', path: '裁员后先做 2 个月保险经纪，发现更喜欢企业客户，转投 SaaS 客户成功', note: '短期试错换来更长的客户周期，收入从提成波动变成底薪+续费。', quote: '不是我不敢冲了，是学会挑值得冲的单子。' },
    { who: '29 岁 · 房产经纪 · 门店组长', path: '用 3 个月补新能源商用车知识，进入车企大客户销售', note: '把「搞定人」的能力迁移到更长决策链，反而更吃香。', quote: '客户没变难搞，是我以前只会打短线。' },
  ],
  ei_at_jp_2: [
    { who: '31 岁 · 连锁零售 · 采购主管', path: '自学独立站与选品，半年后加入跨境品牌做增长', note: '先小成本验证一个品类，再带着数据跳。', quote: '我不是等风口，我先拿一百单试水温。' },
    { who: '27 岁 · 4A 广告 · 策划', path: '转做 AI 内容工具的增长运营，从投放转产品增长', note: '把创意当实验，跑得比同事快半步就够了。', quote: '旧方法失效的时候，先动的人先拿到反馈。' },
  ],
  ei_at_sj_1: [
    { who: '36 岁 · 银行柜员 · 大堂主管', path: '考下基金从业，转财富管理客户经理', note: '十年客户关系没白攒，只是换了一个更值钱的场景。', quote: '我不擅长从零开始，但我擅长让老客户愿意跟我走。' },
    { who: '30 岁 · 制造跟单 · 计划员', path: '补齐 Excel/SQL，转供应链计划专员', note: '把「答应的事一定交付」变成流程能力，反而更不可替代。', quote: '稳定不是没野心，是把每件事都做到可预期。' },
  ],
  ei_at_sj_2: [
    { who: '33 岁 · 酒店前厅 · 值班经理', path: '转企业差旅客户成功，负责大客户关系维护', note: '处理投诉的能力，在 B 端变成续约率。', quote: '我不怕难缠的人，我怕没人愿意跟我说真话。' },
    { who: '28 岁 · 外贸业务 · 跟单', path: '转跨境渠道经理，专做海外经销商关系', note: '语言+耐心+会来事，在渠道岗位上是组合拳。', quote: '关系不是喝酒喝出来的，是一次次把事办成攒出来的。' },
  ],
  ei_in_jp_1: [
    { who: '35 岁 · 消费品牌 · 市场经理', path: '离职后接 2 个长期品牌顾问，做小而美的独立主理人', note: '先接单再注册公司，现金流比名分重要。', quote: '我不想再替别人的品牌熬夜，我要为作品熬夜。' },
    { who: '30 岁 · 电商运营 · 店长', path: '转消费品产品经理，负责从选品到包装', note: '审美和算账都要，主理人型做产品经理很顺。', quote: '好看和好卖不冲突，冲突的是没人同时对两边负责。' },
  ],
  ei_in_jp_2: [
    { who: '26 岁 · MCN · 短视频编导', path: '做个人账号+接品牌内容，半年后成立小型内容工作室', note: '先用自己的号验证选题，再拿案例接商单。', quote: '我不想等爆款，我先保证每周都在发。' },
    { who: '32 岁 · 活动执行 · 项目经理', path: '转品牌体验策划，专做线下快闪与联名', note: '把「会来事」变成可复用的创意流程。', quote: '点子不值钱，能让点子落地的人才值钱。' },
  ],
  ei_in_sj_1: [
    { who: '31 岁 · 幼儿园老师 · 班主任', path: '转企业员工关怀/培训专员，做新人融入项目', note: '照顾人的能力，在组织里是稀缺的软基建。', quote: '我不站台前，但团队散了我第一个知道。' },
    { who: '37 岁 · 行政主管 · 办公室主任', path: '补组织发展知识，转 OD/培训发展', note: '把行政经验翻译成流程与文化建设。', quote: '让一个组织变好，不一定要当老板。' },
  ],
  ei_in_sj_2: [
    { who: '29 岁 · 社群运营 · 用户运营', path: '转私域增长顾问，帮中小品牌搭社群体系', note: '会聊不是本事，会把聊天变成复购才是。', quote: '我最擅长的，是把一群陌生人变成互相认识的人。' },
    { who: '34 岁 · 公关专员 · 媒介经理', path: '转品牌合作经理，负责联名与达人合作', note: '关系网+判断力，在商务拓展上直接变现。', quote: '我的人脉不是名片，是别人愿意先回我消息。' },
  ],
  ii_at_jp_1: [
    { who: '38 岁 · 传统软件 · 实施顾问', path: '补云与数据栈，转数据平台架构师', note: '先做一个小型数据中台项目，再带着案例跳。', quote: '我画图慢，但团队照着走不会返工。' },
    { who: '33 岁 · 制造工艺 · 工程师', path: '转工业互联网解决方案架构师', note: '懂现场又懂系统的人，在制造业数字化里很缺。', quote: '我不追新技术，我追能落地的技术。' },
  ],
  ii_at_jp_2: [
    { who: '35 岁 · 战略咨询 · 高级分析师', path: '独立做中小企业商业顾问，按项目收费', note: '先用一个老客户验证定价，再扩。', quote: '我不是会讲大词，我是能把选择算清楚。' },
    { who: '30 岁 · 投资助理 · 研究员', path: '转产业研究/投后管理，专做细分赛道', note: '把一个行业吃透，比追十个热点更值钱。', quote: '信息差会消失，判断框架不会。' },
  ],
  ii_at_sj_1: [
    { who: '36 岁 · 会计 · 总账', path: '转财务 BP，进入业务预算与经营分析', note: '从记账走向解释业务，是会计最重要的一次换位。', quote: '数字不是结果，数字是业务留下的脚印。' },
    { who: '32 岁 · 审计助理 · 项目成员', path: '补数据合规知识，转隐私/数据合规顾问', note: '审计的严谨性正好适配合规岗位。', quote: '我不怕麻烦，我怕风险没人看见。' },
  ],
  ii_at_sj_2: [
    { who: '29 岁 · 运营专员 · 活动运营', path: '补 SQL/Excel 与商业分析，转商业分析师', note: '先帮业务回答一个具体问题，再谈转型。', quote: '乱麻不可怕，可怕的是没人愿意先找线头。' },
    { who: '34 岁 · 客服主管 · 质检', path: '转用户研究员，做访谈与可用性测试', note: '听多了投诉，反而更懂怎么问对问题。', quote: '用户说的不一定是需求，但一定是一条线索。' },
  ],
  ii_in_jp_1: [
    { who: '30 岁 · 机械绘图 · 技术员', path: '自学前端，8 个月后进入小公司做前端工程师', note: '先做一个能上线的作品，比刷完教程更有说服力。', quote: '我不是天赋型，我是那种会把 bug 一个个熬掉的人。' },
    { who: '38 岁 · 设备维修 · 技师', path: '转自动化/嵌入式，做设备数据采集', note: '现场经验+编程，在工业自动化里是稀缺组合。', quote: '机器不会骗人，会骗人的是没看懂机器的人。' },
  ],
  ii_in_jp_2: [
    { who: '27 岁 · 平面设计 · 视觉设计师', path: '转向 AIGC 视觉/插画，接品牌内容与绘本', note: '把 AI 当画笔，不当替身。', quote: '工具越强，品味越值钱。' },
    { who: '33 岁 · 摄影助理 · 自由摄影师', path: '做独立影像创作者，接纪实与品牌短片', note: '先固定一个主题连拍 10 组，风格才会长出来。', quote: '我不是在等灵感，我是在训练自己看见。' },
  ],
  ii_in_sj_1: [
    { who: '31 岁 · 餐饮后厨 · 厨师', path: '转烘焙主理人，先私房后小店', note: '先用周末摆摊验证产品，再谈门店。', quote: '手艺骗不了人，好不好吃一口就知道。' },
    { who: '40 岁 · 木工学徒 · 家具厂', path: '转定制家具工坊，做小批量高客单', note: '把工序标准化，手艺才能变成生意。', quote: '慢不是问题，重复做不好才是问题。' },
  ],
  ii_in_sj_2: [
    { who: '28 岁 · 旅游计调 · 产品助理', path: '转文旅内容创作者，做城市路线与体验内容', note: '先做一个本地系列，积累素材再接商单。', quote: '我不是爱玩，我是爱把玩过的东西讲明白。' },
    { who: '35 岁 · 采购 · 品类专员', path: '转二手鉴定/买手，专注一个品类', note: '先在一个平台做 100 条鉴定笔记，再开小店。', quote: '看得多不是本事，能说清为什么才是。' },
  ],
};

/* ---------------- 应届 / 长期空窗 / 低门槛起步 补充案例 ----------------
   每个类型再补 1 个更接地气的路径切片，同样为示意性虚构场景。 */
const EXTRA_CASES = {
  ei_at_jp_1: { who: '28 岁 · 空窗 1 年 · 做过销售', path: '先做社区水果店店长，半年后盘下自己的小摊', note: '没急着找“体面工作”，先把每天现金流跑正。', quote: '面子不值钱，账上每天多两百才值钱。' },
  ei_at_jp_2: { who: '23 岁 · 应届 · 市场营销', path: '夜市柠檬茶摊起步，边摆摊边拍短视频引流', note: '小摊是最好的市场调研，一周就知道哪个口味能卖。', quote: '先让一百个人掏钱，再谈品牌。' },
  ei_at_sj_1: { who: '26 岁 · 毕业待业 1 年', path: '从快递驿站店员做到站长，承包一个社区代收点', note: '不挑活，先占住一个社区的位置。', quote: '每天把件数对清楚，比想清楚人生更重要。' },
  ei_at_sj_2: { who: '30 岁 · 空窗 2 年（照顾家人）', path: '从小区团购团长做起，做到片区运营', note: '原来会处关系，在社区里就是生产力。', quote: '我不需要重新证明自己，我只需要重新开始。' },
  ei_in_jp_1: { who: '24 岁 · 应届 · 视觉设计', path: '先在社区咖啡馆当店员，一年后合伙开小店', note: '用审美做产品，用打工学经营。', quote: '先学会算房租，再谈风格。' },
  ei_in_jp_2: { who: '22 岁 · 应届 · 播音', path: '从农产品直播间助播做起，三个月后独立开播', note: '镜头感是真本事，先上场再补货盘。', quote: '没人看也要播，播到有人看为止。' },
  ei_in_sj_1: { who: '35 岁 · 空窗 3 年（带娃）', path: '考母婴护理证后做育儿嫂，再转养老护理', note: '带娃的三年不是空白，是照护经验。', quote: '我最会看人的状态，这是练出来的。' },
  ei_in_sj_2: { who: '25 岁 · 应届 · 社团活跃', path: '从亲子活动执行做起，周末接社区活动', note: '会张罗人，在活动行业直接变现。', quote: '我不怕热闹，我怕没人来。' },
  ii_at_jp_1: { who: '27 岁 · 大专 · 零经验', path: '家电维修学徒 8 个月，出师后进售后网点', note: '先把手艺练到能独立上门，再谈收入。', quote: '拆坏三台，就学会修一台。' },
  ii_at_jp_2: { who: '29 岁 · 空窗 1 年 · 做过采购', path: '转二手车评估，从看 100 台车开始', note: '采购的议价能力，在回收生意里直接复用。', quote: '我不猜价格，我查成交。' },
  ii_at_sj_1: { who: '23 岁 · 应届 · 会计', path: '先做仓储管理员，一年后转库存主管', note: '先把库存账做成表，再谈分析。', quote: '数字对不上，先别谈管理。' },
  ii_at_sj_2: { who: '22 岁 · 应届 · 文科', path: '从数据标注做起，转质检和项目组长', note: '零经验也能入行，关键是细致和稳定。', quote: '我做的不是标注，是让别人能信任的数据。' },
  ii_in_jp_1: { who: '25 岁 · 中专 · 喜欢拆车', path: '电动车维修学徒，两年后自己开店', note: '兴趣先变成手艺，手艺再变成生意。', quote: '我喜欢的东西，终于能换钱了。' },
  ii_in_jp_2: { who: '24 岁 · 应届 · 编导', path: '接短视频剪辑单，半年后做账号代运营', note: '先按单交付，再谈长期合作。', quote: '我不等伯乐，我先把片子剪好。' },
  ii_in_sj_1: { who: '32 岁 · 空窗 2 年 · 工厂', path: '转家政保洁与收纳，半年后带小团队接单', note: '把体力活做成标准化服务，收入更稳。', quote: '干净不干净，客户一眼就知道。' },
  ii_in_sj_2: { who: '21 岁 · 应届 · 旅游专业', path: '一边跑同城跑腿，一边做本地文旅内容', note: '先养活自己，再慢慢把兴趣做成内容。', quote: '我先跑起来，方向会在路上出现。' },
};

Object.entries(EXTRA_CASES).forEach(([k, v]) => {
  if (CASE_STORIES[k]) CASE_STORIES[k].push(v);
});

window.RB_DATA = { QUESTIONS, AXES, AXES_MAX, ARCHETYPES, SKILLS, SKILL_AXIS, AGE_BANDS, EDU_RANK_LABEL, PAT_RANK, CLASSIFY_DIM, ACTIONS, CASE_STORIES };
