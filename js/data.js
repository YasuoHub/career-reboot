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
    text: '过去几年，你的主阵地更接近哪一块？',
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
      { t: '后厨 / 切配 / 面点', add: { sk: 'kitchen' } },
      { t: '仓储 / 分拣 / 叉车', add: { sk: 'warehouse' } },
      { t: '美发 / 美甲 / 美容', add: { sk: 'beauty' } },
      { t: '洗车 / 汽修 / 贴膜', add: { sk: 'auto' } },
      { t: '酒店 / 客房 / 民宿', add: { sk: 'hotel' } },
      { t: '理货 / 收银 / 陈列', add: { sk: 'retail' } },
      { t: '建筑 / 装修 / 水电', add: { sk: 'build' } },
      { t: '种植 / 养殖 / 农机', add: { sk: 'farm' } },
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
    text: '打算在哪片地面上重启？选具体城市，可以多选',
    hint: '最多选 5 个；推荐会按城市能级修正薪资，并结合本地产业给具体岗位。',
    city: true,
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
  { id: 'kitchen', label: '后厨/切配' },
  { id: 'warehouse', label: '仓储/分拣' },
  { id: 'beauty', label: '美发/美甲/美容' },
  { id: 'auto', label: '洗车/汽修' },
  { id: 'hotel', label: '酒店/客房' },
  { id: 'retail', label: '理货/收银/陈列' },
  { id: 'build', label: '建筑/装修' },
  { id: 'farm', label: '种植/养殖' },
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
  kitchen: { maker: 3, stable: 1 },
  warehouse: { maker: 2, data: 1 },
  beauty: { creative: 2, social: 1 },
  auto: { maker: 3 },
  hotel: { social: 2, stable: 1 },
  retail: { social: 1, stable: 1 },
  build: { maker: 3 },
  farm: { maker: 3, stable: 1 },
};
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

window.RB_DATA = { QUESTIONS, AXES, AXES_MAX, ARCHETYPES, SKILLS, SKILL_AXIS, AGE_BANDS, EDU_RANK_LABEL, CLASSIFY_DIM, CASE_STORIES };
