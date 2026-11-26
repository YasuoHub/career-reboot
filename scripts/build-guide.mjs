/* 生成岗位/城市/问题静态图鉴页与 sitemap。
   运行：npm run build:guide
   特点：一次性生成，之后每月数据更新时重跑即可；不依赖前端框架。 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://www.career-turn.icu';
const TODAY = new Date().toISOString().slice(0, 10);

function loadData() {
  const ctx = { window: {} };
  vm.createContext(ctx);
  for (const f of ['js/data.js', 'js/cities.js', 'js/jobs.js']) {
    vm.runInContext(fs.readFileSync(path.join(root, f), 'utf8'), ctx, { filename: f });
  }
  return ctx.window.RB_DATA;
}

const R = loadData();
const {
  JOBS = [], CITIES = [], L1_NAMES = {}, SKILLS = [],
  CITY_TIER_SALARY = {}, CITY_REGIONS = [],
} = R;

const SKILL_LABEL = Object.fromEntries(SKILLS.map(s => [s.id, s.label]));
const EDU = { 1: '中专/高中及以下', 2: '大专', 3: '本科', 4: '硕士及以上' };
const HEALTH = { 1: '体力精力好', 2: '可久坐、体力一般', 3: '有体力限制', 4: '体力有限、久站久蹲困难' };

const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const txt = arr => (arr || []).map(esc).join('、');
const slug = s => String(s).trim().replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, '-').slice(0, 80);
const enc = s => encodeURIComponent(s);
const fileUrl = (kind, file) => `/guide/${kind}/${enc(file)}`;
const absUrl = (kind, file) => `${SITE}${fileUrl(kind, file)}`;

/* ---------------- 选择要生成的页面 ---------------- */
const byL1 = new Map();
for (const j of JOBS) {
  if (!byL1.has(j.l1)) byL1.set(j.l1, []);
  byL1.get(j.l1).push(j);
}
const jobScore = j => (j.entry ? 3 : 0) + (j.mkt && j.mkt.shortage ? 2 : 0)
  + (j.mkt ? j.mkt.g / 10 : 0) + (j.self ? 1 : 0) + (j.badges && j.badges.length ? 1 : 0)
  + (j.salRange && j.salRange[1] >= 15 ? 1 : 0);
const selectedJobs = JOBS.slice().sort((a, b) => a.l1.localeCompare(b.l1) || a.name.localeCompare(b.name, 'zh'));

const firstTierCities = CITIES.filter(c => c.tier === '一线' || c.tier === '新一线');
const secondTierNames = ['合肥', '福州', '厦门', '南昌', '济南', '青岛', '郑州', '武汉', '长沙', '佛山', '东莞', '南宁', '重庆', '成都', '贵阳', '昆明', '沈阳', '大连', '长春', '哈尔滨', '西安', '无锡', '常州', '南通', '徐州', '温州', '嘉兴', '绍兴', '金华', '烟台', '洛阳'];
const selectedCities = [...new Map([
  ...firstTierCities,
  ...secondTierNames.map(n => CITIES.find(c => c.name === n)).filter(Boolean),
].map(c => [c.name, c])).values()];

const TOPICS = [
  {
    slug: '35-laid-off',
    title: '35 岁被裁，下一步能做什么？',
    desc: '先算现金流，再把经验拆成可迁移能力，用两周做一次低成本验证；附适合先站稳的岗位方向。',
    intro: '35 岁被裁最难的不是“没工作”，而是“上有账单、下有年龄门槛，还被告知要选对方向”。先别急着找一辈子的答案，先把未来 3 个月的现金流和下一步动作稳住。',
    sections: [
      { h: '第一步：先算 3 个月现金流，不急着“规划人生”', p: ['把存款、赔偿、家庭固定支出、能接受的过渡收入写在一张纸上。先回答“我最多能撑几个月”，再回答“我要做什么”。', '如果只能撑 1–2 个月，优先找能快速上岗、当月有现金流的岗位；如果还能撑半年，再考虑需要 4–8 周学习的转行方向。'] },
      { h: '第二步：把“被裁”翻译成可迁移的三件事', p: ['不要从岗位名称出发，从你做过的事出发：你解决过什么问题、和谁协作、用什么工具、结果如何。把这三件事写成面试能讲的案例。', '年龄不是原罪，但“只会一种做法”是风险。把你的经验拆成“行业知识 + 客户/项目经验 + 工具方法”，再看哪些行业愿意为这三样付钱。'] },
      { h: '第三步：用两周做一次低成本验证', p: ['选一个方向，找 3 个正在做的人聊 20 分钟，问清楚一天做什么、最难的 3 件事、入门需要什么。比刷 20 个视频更有用。', '如果聊完发现不喜欢，及时换；如果聊完更想做，再投入学习。不要用“报个课”代替验证。'] },
    ],
    jobPick: j => j.entry || (j.mkt && j.mkt.shortage) || j.self || j.l1 === '3',
    faq: [
      ['35 岁转行是不是太晚了？', '不是“晚不晚”，而是“用多长时间、用什么路径”。优先选能复用已有经验的相邻岗位，比从零进入一个全新行业更稳。'],
      ['先找过渡工作会不会影响找正式工作？', '不会。过渡工作能稳住现金流和作息，反而让你在面试里更从容；关键是别把过渡岗位写成“长期方向”。'],
      ['要不要先报一个培训班？', '先验证再付费。找 3 个从业者聊过、确认岗位真实存在、确认自己能坚持，再考虑培训；不要用培训贷。'],
    ],
  },
  {
    slug: 'long-gap',
    title: '空窗一年以上，怎么重新回到职场？',
    desc: '空窗不是空白：把照护、兼职、自学、生活项目写成可验证的经历，先从小步返场开始。',
    intro: '长期空窗最伤人的不是简历上的时间，而是“我还能不能行”的自我怀疑。返场不需要一次到位，先找回节奏，再谈方向。',
    sections: [
      { h: '先处理“叙事”，再处理“简历”', p: ['空窗期不是一句“没工作”就能概括的。照顾家人、打零工、自学、备孕、生病恢复，都是经历；关键是你从中练出了什么可复用的能力。', '面试里不要道歉式解释，用“那段时间我承担了什么、解决了什么、现在为什么准备好回来”三句话讲清楚。'] },
      { h: '先找回节奏，再找回岗位', p: ['从每周 2–3 次、每次 2 小时的“工作状态”开始：固定时间学习、做一个小项目、接一个兼职单。先恢复“我能交付”的感觉。', '返场第一份工作不一定要“体面”，但要能让你重新进入协作、重新积累最近一段可验证的经历。'] },
      { h: '优先选“容错高、上手快”的入口', p: ['客服、门店、仓储、行政支持、家政/照护、内容助理等岗位，对空窗的容忍度通常高于强竞争的白领岗。', '如果你有明确技能（Excel、写作、剪辑、照护），优先找能用上它的岗位，而不是完全从零开始。'] },
    ],
    jobPick: j => j.entry || j.req.edu <= 2 || j.self,
    faq: [
      ['空窗期要不要写在简历上？', '要写，但写“做了什么”而不是“空白”。用 1–2 行说明你承担的责任、学习或产出，避免让面试官自己猜。'],
      ['返场第一份工作薪资低，要不要接受？', '如果它能帮你恢复状态、提供最近经历、且不长期消耗健康，可以把它当跳板；同时设定 6–12 个月的下一步目标。'],
      ['投了很多没有回音怎么办？', '先检查岗位匹配度和简历关键词，再缩小到 2–3 类岗位；同时用内推、线下招聘会、社区就业服务增加触达。'],
    ],
  },
  {
    slug: 'fresh-grad',
    title: '应届生第一份工作，怎么选不踩坑？',
    desc: '第一份工作优先看“能不能学到可迁移的能力”，而不是只看起薪；附低门槛入口与避坑清单。',
    intro: '应届生最容易被两个东西带偏：一是“先随便找一份”，二是“必须一步到位”。第一份工作更像一张入场券，重点是你能否在里面攒到下一步能用的能力。',
    sections: [
      { h: '先排掉“高流动、无成长”的坑', p: ['面试时问清楚：新人前 3 个月做什么、有没有人带、考核指标是什么、过去一年这个岗位走了几个人。答案含糊的，要谨慎。', '警惕“先交培训费/押金/服装费”“试用期不签合同”“底薪很低全靠拉人”的岗位。'] },
      { h: '优先选能积累“作品/客户/流程”的岗位', p: ['第一份工作最值钱的是可迁移资产：作品集、客户关系、项目流程、行业知识。哪怕起薪一般，只要能积累这些，后面换赛道会轻松很多。', '如果暂时进不了理想岗位，选一个离它最近的入口：想做运营先做内容助理，想做产品先做数据/用户支持。'] },
      { h: '给自己设一个 12 个月检查点', p: ['入职后每 3 个月问自己：我学到了什么、能拿出什么结果、下一步想去哪。不要把“先干着”变成“干到不敢动”。'] },
    ],
    jobPick: j => j.entry || j.req.edu <= 2,
    faq: [
      ['第一份工作要不要看薪资？', '要看，但不要只看。对新人来说，学习速度、带教质量、行业前景和可迁移能力，往往比第一年的几百块差价更重要。'],
      ['专业不对口怎么办？', '先找“专业相邻”或“能力可迁移”的岗位，再用项目/作品补足。完全跨行也可以，但要用低成本方式先验证。'],
      ['要不要为了大公司光环接受很边缘的岗位？', '如果你能在里面接触到核心业务、学到方法，可以考虑；如果只是打杂且没有成长路径，光环不值。'],
    ],
  },
  {
    slug: 'low-education',
    title: '学历不高，能做什么工作？',
    desc: '不拼学历的岗位集中在技能、服务、制造、物流、照护；先选能考证/能积累手艺的方向。',
    intro: '学历是门槛，但不是唯一的门槛。很多岗位更看重证书、手艺、稳定性和服务意识；关键是选一个能越做越值钱、而不是纯耗体力的方向。',
    sections: [
      { h: '先分清“体力活”和“手艺活”', p: ['纯体力活上手快、现金快，但可替代性高；手艺活前期收入一般，但越做越值钱，比如汽修、电工、焊工、烘焙、美业、护理。', '如果你现在急需现金流，可以先做体力/服务岗过渡，同时用业余时间学一门手艺，不要停在纯体力。'] },
      { h: '证书是低学历最划算的杠杆', p: ['电工证、焊工证、养老护理员证、母婴护理证、无人机执照、叉车证等，往往能直接提高入行和议价能力。', '先查清楚证书的报考条件、费用、周期和本地认可度，再报班；警惕“包就业”“高价速成”的培训贷。'] },
      { h: '优先选“本地有需求”的岗位', p: ['同样一个岗位，在不同城市的收入和需求差别很大。先看你所在城市的产业和招聘量，再决定学什么。'] },
    ],
    jobPick: j => j.req.edu <= 1 || j.entry,
    faq: [
      ['没有学历，进工厂还是做服务？', '看你的体力和性格。工厂稳定、流程清晰；服务岗与人打交道多、上升路径不同。先做 1–2 周实地了解，再选。'],
      ['学一门手艺要多久？', '入门通常 1–3 个月，能独立接活通常 6–12 个月；关键不是学多久，而是有没有真实练习和师傅带。'],
      ['要不要花钱考证？', '先确认本地招聘是否真的要求这个证，再考虑；优先选国家职业技能等级/行业认可度高的证书。'],
    ],
  },
  {
    slug: 'mom-return',
    title: '宝妈重返职场，先从哪一步开始？',
    desc: '先解决时间与照护约束，再选弹性/就近/可积累的岗位；附低门槛方向与返场节奏。',
    intro: '宝妈返场最难的是“时间不是自己的”。不要用全职白领的标准要求自己，先找到能嵌入现有照护节奏的工作，再逐步扩大。',
    sections: [
      { h: '先算“可用时间”，再选工作形态', p: ['把每天能稳定工作的时间段写出来：是上午 4 小时、下午 3 小时，还是只能周末？这决定了你适合坐班、倒班、弹性还是接单。', '不要先选岗位再硬塞时间，反过来更容易可持续。'] },
      { h: '优先选“就近、可积累、可中断”的方向', p: ['社区门店、家政/收纳、陪诊、托管、烘焙、内容助理、电商客服等，通常对时间弹性更友好。', '如果你有之前的职业经验，优先找能复用的远程/兼职/项目制工作，而不是完全从零开始。'] },
      { h: '用“小步返场”代替“一步到位”', p: ['先从每周 2–3 天、每天 4 小时开始，恢复工作节奏和收入；等照护安排稳定，再增加工时或换更好的岗位。'] },
    ],
    jobPick: j => j.req.pat !== '倒班' && (j.entry || j.self || j.l1 === '4' || j.l1 === '8'),
    faq: [
      ['空窗几年还能回去做原来的工作吗？', '可以尝试，但要做好“先从相邻岗位/兼职返场”的准备；用最近的项目、证书或兼职经历补足时间线。'],
      ['家人不支持我出去工作怎么办？', '先从小规模、低冲突的方式开始（兼职/接单/社区岗），用实际收入和时间安排证明可行性，再逐步扩大。'],
      ['要不要先考证？', '如果目标岗位明确要求证书，再考；否则先用兼职/志愿/小项目验证方向，避免把时间和钱花在不确定的培训上。'],
    ],
  },
  {
    slug: 'factory-exit',
    title: '工厂普工想转行，能往哪里走？',
    desc: '从流水线到技术岗、班组长、质检、仓储、设备维护；先利用现有现场经验，而不是从零开始。',
    intro: '工厂经历不是“没技术”，你熟悉产线、设备、质量、交期和安全规范，这些都是可以迁移的现场能力。关键是往“更值钱的那一端”走。',
    sections: [
      { h: '先盘点你已经在用的能力', p: ['设备操作、质量检查、排产、交接班、安全规范、异常处理——这些在制造、仓储、物业、售后、工程安装里都能用。', '把你处理过的异常、带过的新人、改进过的流程写下来，它们比“吃苦耐劳”更有说服力。'] },
      { h: '三条现实路径', p: ['技术线：设备维护、电工、焊工、CNC、新能源制造，前期学习但越做越值钱。', '管理线：班组长、仓管、生产计划，靠现场经验和协调能力；服务线：售后、安装、物业工程，离客户更近、收入结构不同。'] },
      { h: '用“在岗学习”降低转行成本', p: ['优先在工厂内部转岗（质检、设备、仓管、班组长），比裸辞出去学更稳；同时考一个与目标岗位直接相关的证。'] },
    ],
    jobPick: j => j.l1 === '6' || j.l1 === '7' || j.l1 === '4',
    faq: [
      ['普工转技术岗要多久？', '入门 1–3 个月，能独立处理常见问题通常 6–12 个月；关键是有没有师傅带和真实设备练习。'],
      ['要不要辞职去学？', '如果现金流不允许，优先在岗转岗/业余学习；裸辞学习只适合有存款且目标非常明确的人。'],
      ['年龄大了还能转吗？', '能，但要避开高强度倒班和重体力岗位，优先选设备维护、质检、仓管、物业工程等经验型方向。'],
    ],
  },
  {
    slug: 'small-business',
    title: '想摆摊/开小店，先算清哪几笔账？',
    desc: '启动成本、保本线、现金流、选址、证照与避坑；先小成本试水，再决定要不要开店。',
    intro: '小生意的第一步不是“选品”，而是算账。很多店不是不赚钱，是启动成本太高、保本线太高、现金流断得太快。',
    sections: [
      { h: '先算三笔账：启动、保本、现金流', p: ['启动成本：设备、押金、装修、首批进货、证照、3 个月生活费。保本线：每月固定成本 ÷ 毛利率 = 每月至少要卖多少。', '现金流：前 3 个月很可能不赚钱，你要准备好“即使不赚也能撑住”的钱。'] },
      { h: '先试水，再签约', p: ['能用摊位/市集/上门/社群验证，就不要先租店。用 1–2 周测试：有没有人买、复购如何、客单价多少、最忙时段需要几个人。', '试水时记录每一笔成本和收入，别用“感觉还行”做决策。'] },
      { h: '证照与避坑', p: ['餐饮、食品、美业、教育等有前置许可；先问清楚当地市场监管要求，再投入装修和设备。', '警惕“高转让费”“二房东”“必须从指定供应商进货”“先交加盟费”的坑。'] },
    ],
    jobPick: j => j.self,
    faq: [
      ['摆摊和开店先做哪个？', '优先摆摊/市集/上门，用最低成本验证需求和价格；验证后再考虑固定店。'],
      ['启动资金不够怎么办？', '先做轻资产、可移动、可接单的形态；不要借高息贷款或刷信用卡硬上。'],
      ['要不要加盟？', '先算清楚加盟费、供货价、区域保护和退出条款；多数小生意不适合高加盟费模式。'],
    ],
  },
  {
    slug: 'ai-risk',
    title: '哪些岗位容易被 AI 替代？普通人怎么避开？',
    desc: '规则化、重复性、纯文本处理的岗位风险更高；优先往“现场、手艺、关系、责任”方向靠。',
    intro: 'AI 替代的不是所有岗位，而是“规则固定、重复度高、结果可标准化”的任务。普通人不需要恐慌，但需要主动把工作往“AI 不擅长的那一端”挪。',
    sections: [
      { h: '先看任务，不看岗位名称', p: ['同一个岗位，有的任务容易被自动化，有的很难。数据录入、基础排版、会议纪要、标准客服话术，风险更高；现场判断、复杂沟通、手眼协调、责任承担，风险更低。', '问自己：我每天的工作里，有多少是“按固定规则处理信息”？这部分最值得优先升级或转移。'] },
      { h: '四个相对安全的方向', p: ['现场/手艺：维修、安装、护理、餐饮、美业、施工，AI 很难替代手和现场。', '关系/信任：销售、客户成功、社区服务、照护，靠长期关系。', '责任/合规：需要签字、担责、处理异常的岗位。', 'AI 协作：会用 AI 把效率提高的人，会替代不会用的人。'] },
      { h: '普通人的应对：把 AI 当工具，不当对手', p: ['先学一个能直接用在现有工作里的 AI 工具（写文案、做表、查资料、做图），把节省的时间用来做更有判断的事。', '同时积累“作品/案例/客户”，这些是 AI 替代不了的信任资产。'] },
    ],
    jobPick: j => j.req.phys || j.l1 === '4' || j.l1 === '5' || j.l1 === '7' || j.l1 === '6',
    faq: [
      ['AI 会让我失业吗？', '更准确地说，是会改变任务结构。重复性任务减少，判断、沟通、现场和责任型任务增加；主动升级技能的人更有优势。'],
      ['现在学什么最不容易被替代？', '与具体场景结合的技能：设备维护、护理、安装、销售、项目管理、AI 工具应用；纯记忆和标准文本处理要谨慎。'],
      ['要不要转去 AI 行业？', 'AI 行业也需要大量非算法岗位（产品、运营、数据标注、交付、销售），但竞争激烈；先看你能否用现有经验切入。'],
    ],
  },
  {
    slug: 'job-fit',
    title: '怎么判断一个岗位适不适合自己？',
    desc: '用“能力、约束、市场、代价”四个维度判断，而不是只看兴趣或薪资。',
    intro: '“适合”不是一种感觉，而是一组可检查的条件：你能不能做、愿不愿意承担代价、市场需不需要、这份工作会不会把你耗掉。',
    sections: [
      { h: '能力：你现在能做什么，缺口多大', p: ['把岗位要求拆成技能、经验、证书、体力四类，逐项对照。缺口在 1–2 项、且能在 3 个月内补上的，通常值得试；缺口超过一半，先找相邻岗位。'] },
      { h: '约束：时间、健康、家庭、现金流', p: ['再好的岗位，如果和你的照护责任、健康状态、收入底线冲突，也很难持续。先写清楚“我不能接受什么”，再筛岗位。'] },
      { h: '市场与代价：有没有需求，代价是什么', p: ['看本地招聘量、薪资区间、竞争程度和成长路径；同时问清楚倒班、出差、体力、业绩压力、职业寿命。', '如果一个岗位只有高薪、没有可持续性，要把它当“阶段性选择”，不要当长期答案。'] },
    ],
    jobPick: j => j.entry || (j.mkt && j.mkt.shortage),
    faq: [
      ['兴趣重要还是能力重要？', '先看能力能否迁移，再看兴趣能否支撑你度过学习期；只有兴趣、没有能力和市场，很难落地。'],
      ['薪资高但很累，要不要去？', '看你能承受多久、有没有退出路径、健康代价是否可逆；把它当阶段性选择，并设好退出时间。'],
      ['怎么知道岗位真实情况？', '找 2–3 个在职的人聊，问一天流程、最难的 3 件事、离职原因；再看招聘信息和薪资是否一致。'],
    ],
  },
  {
    slug: '12-week-plan',
    title: '转行 12 周计划，怎么排才不半途而废？',
    desc: '把 12 周拆成“验证—补缺—作品—投递”四段，每周只做一件能交付的事。',
    intro: '12 周计划最容易失败的地方，是把它排成“每天学 3 小时”的愿望清单。真正能执行的计划，每周只围绕一个可交付结果。',
    sections: [
      { h: '第 1–2 周：验证方向，不做无效努力', p: ['找 3 个从业者聊，确认岗位真实工作内容、入门门槛和收入；同时做一个小任务，看看自己是否真的愿意做。', '如果验证不通过，及时换方向；这比学完 8 周再后悔便宜得多。'] },
      { h: '第 3–6 周：补最小缺口，做出第一个作品', p: ['只补目标岗位最核心的 1–2 个技能，不要什么都学。每两周产出一个可展示的小作品/案例。'] },
      { h: '第 7–10 周：用真实场景练手，积累证据', p: ['接一个小单、做一次志愿项目、帮朋友解决一个问题；把过程、结果、复盘写成案例。'] },
      { h: '第 11–12 周：投递与复盘', p: ['按“匹配度”投 20–30 个岗位，记录回复率；根据反馈修简历和作品，不要只投不改。'] },
    ],
    jobPick: j => j.entry || (j.mkt && j.mkt.shortage),
    faq: [
      ['每天要学多久？', '按你的可用时间排，不要按别人的计划。每周能稳定投入 5 小时，比周末突击 10 小时更有效。'],
      ['12 周真的够吗？', '够完成“验证 + 入门 + 第一个作品”，不够成为高手；先把第一步走完，再决定是否继续深耕。'],
      ['中途想放弃怎么办？', '把目标缩小到“本周只交付一个小结果”，先恢复掌控感；如果连续两周做不动，可能是方向或节奏不对。'],
    ],
  },
  {
    slug: 'resume',
    title: '简历没有亮点，怎么写出一份能投的？',
    desc: '用“背景—动作—结果—证据”重写经历，把日常琐事翻译成可验证的能力。',
    intro: '简历没有亮点，往往不是经历太少，而是写得像岗位说明书。招聘方想看的是：你解决过什么问题、怎么解决、结果如何。',
    sections: [
      { h: '把“负责”改成“解决了什么”', p: ['不要写“负责订单管理”，写“把从采购到发货的订单流程重做成 SOP，把平均周转从 X 天降到 Y 天”。没有精确数字就用范围，但别编。'] },
      { h: '每段经历只留 3 个重点', p: ['一个业务结果、一个协作/推动、一个可迁移技能。把最相关的放前面，别按时间流水账。'] },
      { h: '用岗位关键词对齐', p: ['看 5–10 个目标岗位的 JD，把重复出现的技能/工具/场景写进简历；但只写你真的会的，面试会追问。'] },
    ],
    jobPick: j => j.entry || j.l1 === '3' || j.l1 === '2',
    faq: [
      ['没有数据怎么办？', '用范围、频率、规模、对比来描述，比如“每周处理 200+ 单”“覆盖 3 个门店”；不要编造精确数字。'],
      ['空窗期怎么写？', '写你做了什么、承担了什么、学到了什么，用 1–2 行说明；不要留空白让面试官猜。'],
      ['要不要一页纸？', '应届/转行优先一页；经历多的人可以两页，但每段都要和目标岗位相关。'],
    ],
  },
  {
    slug: 'gap-interview',
    title: '面试被问空窗期，怎么回答？',
    desc: '不道歉、不编造：用“承担—学习—准备—现在”四句话，把空窗讲成可验证的准备期。',
    intro: '空窗期问题本质上是风险问题：面试官想知道你是否稳定、是否还有工作状态、为什么现在回来。回答的关键是诚实、简短、有证据。',
    sections: [
      { h: '四句话结构', p: ['① 那段时间我主要在处理什么（照护/健康/家庭/学习）；② 我同时做了什么保持状态（兼职/项目/证书/学习）；③ 我现在为什么准备好回来；④ 我能立刻贡献什么。', '不要长篇解释，也不要抱怨前公司或市场；控制在 60–90 秒。'] },
      { h: '把“空白”变成“准备”', p: ['如果你学了课程、考了证、做了兼职、照顾家人，都可以说；重点是“我从中练了什么、怎么用到工作上”。'] },
      { h: '准备一个可验证的证据', p: ['一个作品、一个证书、一个兼职案例，比“我一直在学习”更有说服力。面试前把它整理成一页。'] },
    ],
    jobPick: j => j.entry || j.req.edu <= 2,
    faq: [
      ['空窗期太长，要不要编？', '不要。编造会被社保、背调或追问戳穿；用“承担 + 准备 + 现在”结构，诚实但简洁。'],
      ['面试官追问细节怎么办？', '只讲与工作相关的能力和准备，不展开隐私；如果涉及健康/家庭，说明“已安排妥当，不影响工作”。'],
      ['空窗后薪资被压怎么办？', '先确认岗位预算和职责，再用可验证的能力/作品谈；不要因为空窗接受明显低于市场的长期条件。'],
    ],
  },
];

/* ---------------- 工具 ---------------- */
function jobFile(j) { return `${j.id}-${slug(j.name)}.html`; }
function cityFile(c) { return `${slug(c.name)}.html`; }
function topicFile(t, i) { return `q-${String(i + 1).padStart(2, '0')}-${slug(t.slug)}.html`; }

function salaryFor(j, city) {
  const mult = CITY_TIER_SALARY[city.tier] || 0.95;
  const lo = Math.max(1, Math.round(j.salRange[0] * mult * 2) / 2);
  const hi = Math.max(lo + 1, Math.round(j.salRange[1] * mult * 2) / 2);
  return { lo, hi, text: `${lo}–${hi}k` };
}

function jobCityMatch(j, c) {
  return (j.tr || []).reduce((m, [ind, w]) => m + ((c.industries || []).includes(ind) ? w : 0), 0);
}
function cityJobs(c) {
  const pool = selectedJobs.slice().sort((a, b) =>
    jobCityMatch(b, c) - jobCityMatch(a, c) || jobScore(b) - jobScore(a)
  );
  const out = [], seen = new Set();
  for (const j of pool) {
    if (seen.has(j.l2)) continue;
    seen.add(j.l2); out.push(j);
    if (out.length >= 10) break;
  }
  for (const j of pool) {
    if (out.length >= 10) break;
    if (!out.includes(j)) out.push(j);
  }
  return out.slice(0, 10);
}
function pickJobs(filter, n = 6) {
  const pool = selectedJobs.filter(filter).sort((a, b) => jobScore(b) - jobScore(a));
  const out = [], seen = new Set();
  for (const j of pool) {
    if (seen.has(j.l2)) continue;
    seen.add(j.l2); out.push(j);
    if (out.length >= n) break;
  }
  for (const j of pool) {
    if (out.length >= n) break;
    if (!out.includes(j)) out.push(j);
  }
  return out.slice(0, n);
}
function relatedJobs(j, n = 6) {
  const same = selectedJobs.filter(x => x.id !== j.id && x.l2 === j.l2);
  const sameL1 = selectedJobs.filter(x => x.id !== j.id && x.l1 === j.l1 && x.l2 !== j.l2);
  return [...same, ...sameL1].slice(0, n);
}
function jobBadges(j) {
  const out = [];
  if ((j.badges || []).includes('S')) out.push('人社部新职业名录');
  if ((j.badges || []).includes('L')) out.push('绿色职业');
  if (j.entry) out.push('低门槛入口');
  if (j.self) out.push('可自营');
  if (j.mkt && j.mkt.shortage) out.push('偏缺工');
  return out;
}

function layout({ title, desc, canonical, body, jsonld = [], noindex = false }) {
  const ld = jsonld.filter(Boolean).map(x => `<script type="application/ld+json">${JSON.stringify(x).replace(/</g, '\\u003c')}</script>`).join('\n');
  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}" />
${noindex ? '<meta name="robots" content="noindex,follow" />' : '<meta name="robots" content="index,follow" />'}
<link rel="canonical" href="${esc(canonical)}" />
<meta property="og:title" content="${esc(title)}" />
<meta property="og:description" content="${esc(desc)}" />
<meta property="og:type" content="article" />
<meta property="og:url" content="${esc(canonical)}" />
<meta property="og:image" content="${SITE}/og-card.png" />
<link rel="stylesheet" href="/css/guide.css" />
${ld}
</head>
<body>
<header class="site-header"><div class="wrap">
  <a class="brand" href="/">重启<span>图鉴</span></a>
  <nav class="nav">
    <a href="/guide/">岗位与城市图鉴</a>
    <a href="/guide/#jobs">岗位</a>
    <a href="/guide/#cities">城市</a>
    <a href="/guide/#questions">问题</a>
    <a href="/">测一测</a>
  </nav>
</div></header>
<main class="wrap">
${body}
</main>
<footer class="footer"><div class="wrap">
  <p>「重启人格图鉴」是一个趣味性格探索 + 本地岗位信息参考工具，不构成医疗、心理诊断、职业咨询或就业承诺。</p>
  <p>薪资与供需为公开报告的量级估算，非实时招聘报价；不同企业、班次、经验会明显影响实际收入。数据更新：${TODAY}。</p>
  <p><a href="/">首页 / 测评</a> · <a href="/guide/">岗位与城市图鉴</a> · <a href="/legal.html#terms">用户协议</a> · <a href="/legal.html#privacy">隐私政策</a></p>
</div></footer>
</body>
</html>`;
}

function breadcrumb(items) {
  return `<p class="crumbs">${items.map((x, i) => i === items.length - 1 ? `<b>${esc(x.name)}</b>` : `<a href="${esc(x.url)}">${esc(x.name)}</a>`).join('<span>/</span>')}</p>`;
}

function crumbsLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((x, i) => ({
      '@type': 'ListItem', position: i + 1, name: x.name, item: `${SITE}${x.url}`,
    })),
  };
}

/* ---------------- 岗位页 ---------------- */
function jobPage(j) {
  const file = jobFile(j);
  const url = absUrl('jobs', file);
  const cities = selectedCities.slice().sort((a, b) =>
    jobCityMatch(b, j) - jobCityMatch(a, j) || (CITY_TIER_SALARY[b.tier] || 0) - (CITY_TIER_SALARY[a.tier] || 0)
  ).slice(0, 8);
  const related = relatedJobs(j);
  const faqs = [
    [`${j.name}一般要求什么学历？`, `这个岗位常见的入门学历是「${EDU[j.req.edu] || '不限'}」；但不同企业会有差异，经验、证书和稳定性往往比学历更重要。`],
    [`${j.name}的薪资大概多少？`, `公开报告的量级参考是 ${j.sal}/月（全国口径），具体会受城市、企业类型、班次和经验影响；页面下方有按城市能级折算的参考区间。`],
    [`零经验能做${j.name}吗？`, j.entry ? '可以把这个岗位当作低门槛入口，先通过短期学习/跟岗/学徒进入，再逐步积累作品或客户。' : '通常需要相关技能或经验；建议先从相邻岗位、助理岗或兼职接单切入，补足核心技能后再转。'],
  ];

  const body = `
${breadcrumb([{ name: '首页', url: '/' }, { name: '岗位与城市图鉴', url: '/guide/' }, { name: j.name, url: fileUrl('jobs', file) }])}
<section class="hero">
  <span class="eyebrow">岗位图鉴 · ${esc(j.l1Name)} / ${esc(j.l2)}</span>
  <h1>${esc(j.name)}：做什么、门槛、薪资与入行路径</h1>
  <p class="lead">${esc(j.name)}属于「${esc(j.l1Name)}」下的「${esc(j.l2)}」。全国公开报告量级薪资约 <b>${esc(j.sal)}/月</b>，常见工作形态为${esc(j.req.pat)}，入门学历参考「${esc(EDU[j.req.edu] || '不限')}」。</p>
  <div class="meta-row">${jobBadges(j).map(x => `<span class="pill ${x === '偏缺工' ? 'good' : x === '可自营' ? 'warm' : ''}">${esc(x)}</span>`).join('')}</div>
</section>

<section class="section">
  <h2>这个岗位每天在做什么</h2>
  <p>${esc(j.name)}的核心任务通常包括：${txt(j.tasks)}。不同企业会有侧重，但以上是判断“你是否愿意长期做”的最直接依据。</p>
  <div class="grid">
    <div class="card"><h3>常见工作场景</h3><p>${txt(j.orgs)}。工作形态以${esc(j.req.pat)}为主${j.req.phys ? '，有一定体力要求' : '，体力要求相对可控'}。</p></div>
    <div class="card"><h3>往上走的方向</h3><p>${esc(j.promote)}。如果你想把这份工作当跳板，入职前就问清楚这条路径在企业里是否真实存在。</p></div>
  </div>
</section>

<section class="section">
  <h2>门槛与适合的人</h2>
  <div class="table-wrap"><table>
    <tr><th>维度</th><th>参考要求</th><th>说明</th></tr>
    <tr><td>学历</td><td>${esc(EDU[j.req.edu] || '不限')}</td><td>低于要求不代表完全没机会，但需要用经验/证书/作品补足。</td></tr>
    <tr><td>体力</td><td>${esc(HEALTH[j.req.health] || '未标注')}</td><td>${j.req.phys ? '岗位有一定体力消耗，健康受限时要先确认实际强度。' : '以坐班/轻体力为主，仍建议确认实际班次。'}</td></tr>
    <tr><td>工作形态</td><td>${esc(j.req.pat)}</td><td>倒班/外勤/弹性会直接影响作息与家庭安排，入职前问清楚。</td></tr>
    <tr><td>核心技能</td><td>${txt((j.skills || []).map(s => SKILL_LABEL[s] || s))}</td><td>技能缺口可以在 1–3 个月内补一部分，但需要真实练习。</td></tr>
  </table></div>
  <p class="note">适合的人：愿意按流程交付、能接受${esc(j.req.pat)}、对${txt((j.tasks || []).slice(0, 3))}不排斥的人。不适合的人：强烈抗拒${esc(j.req.pat)}、无法接受${j.req.phys ? '体力消耗' : '重复性流程'}、或希望“完全不与人打交道”的人。</p>
</section>

<section class="section">
  <h2>薪资与市场参考</h2>
  <p>全国量级参考：<b>${esc(j.sal)}/月</b>。市场信号：增速约 ${esc(j.mkt.g)}%，竞争指数约 ${esc(j.mkt.c)}${j.mkt.shortage ? '，属于偏缺工方向' : ''}。这些数字用于排序和方向判断，不是招聘承诺。</p>
  <div class="table-wrap"><table>
    <tr><th>城市</th><th>能级</th><th>本地薪资参考</th><th>本地产业</th></tr>
    ${cities.map(c => { const s = salaryFor(j, c); return `<tr><td><a href="${esc(fileUrl('cities', cityFile(c)))}">${esc(c.name)}</a></td><td>${esc(c.tier)}</td><td class="salary">${esc(s.text)}/月</td><td>${esc(c.label || (c.industries || []).join(' / '))}</td></tr>`; }).join('')}
  </table></div>
  <p class="note">按城市能级系数折算，仅用于量级参考；实际薪资受企业、班次、经验、证书和招聘季节影响。</p>
</section>

<section class="section">
  <h2>三条入行路径</h2>
  <div class="grid three">
    <div class="card"><h3>先就业</h3><p>${esc(j.J)}</p></div>
    <div class="card"><h3>先接单/自营</h3><p>${esc(j.F)}</p></div>
    <div class="card"><h3>学习路线</h3><p>${esc(j.learn)}</p></div>
  </div>
  <div class="cta-box">
    <h2>本周就能做的一次验证</h2>
    <p>${esc(j.week1)}</p>
    <a class="btn" href="/?from=guide-job-${esc(j.id)}">测测你适不适合这个方向 →</a>
  </div>
</section>

<section class="section">
  <h2>常见问题</h2>
  <div class="faq">${faqs.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div>
</section>

<section class="section">
  <h2>相关岗位</h2>
  <div class="job-list">${related.map(x => `<div class="job-item"><div><a href="${esc(fileUrl('jobs', jobFile(x)))}">${esc(x.name)}</a><div class="small muted">${esc(x.l2)} · ${esc(x.req.pat)}</div></div><span class="salary">${esc(x.sal)}/月</span></div>`).join('')}</div>
</section>
`;

  return layout({
    title: `${j.name}：做什么、门槛、薪资与入行路径｜重启图鉴`,
    desc: `${j.name}岗位图鉴：日常任务、学历/体力/班次门槛、核心技能、全国与城市薪资参考、三条入行路径和本周验证动作。`,
    canonical: url,
    body,
    jsonld: [
      {
        '@context': 'https://schema.org', '@type': 'Article',
        headline: `${j.name}：做什么、门槛、薪资与入行路径`,
        description: `${j.name}的岗位任务、门槛、技能、薪资与入行路径。`,
        datePublished: TODAY, dateModified: TODAY,
        mainEntityOfPage: url,
        author: { '@type': 'Organization', name: '重启人格图鉴' },
        publisher: { '@type': 'Organization', name: '重启人格图鉴' },
      },
      {
        '@context': 'https://schema.org', '@type': 'FAQPage',
        mainEntity: faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
      },
      crumbsLd([{ name: '首页', url: '/' }, { name: '岗位与城市图鉴', url: '/guide/' }, { name: j.name, url: fileUrl('jobs', jobFile(j)) }]),
    ],
  });
}

/* ---------------- 城市页 ---------------- */
function cityPage(c) {
  const file = cityFile(c);
  const url = absUrl('cities', file);
  const jobs = cityJobs(c);
  const relatedCities = selectedCities.filter(x => x.region === c.region && x.name !== c.name).slice(0, 6);
  const faqs = [
    [`${c.name}哪些行业比较集中？`, `${c.name}较有辨识度的方向是：${(c.industries || []).join('、') || '本地生活服务与制造业'}。具体岗位需求会随季节和企业变化，建议结合招聘平台与本地就业服务核实。`],
    [`${c.name}的薪资水平怎么样？`, `${c.name}属于${c.tier}城市，本页薪资按能级系数折算，仅用于量级参考；同一岗位在不同企业、班次和经验下差异很大。`],
  ];

  const body = `
${breadcrumb([{ name: '首页', url: '/' }, { name: '岗位与城市图鉴', url: '/guide/' }, { name: c.name, url: fileUrl('cities', file) }])}
<section class="hero">
  <span class="eyebrow">城市图鉴 · ${esc(c.region)} / ${esc(c.tier)}</span>
  <h1>${esc(c.name)}找工作：本地主要行业、岗位与薪资参考</h1>
  <p class="lead">${esc(c.name)}的本地产业标签是「${esc(c.label || (c.industries || []).join(' / '))}」。如果你打算在这里重启，先看本地哪些岗位更容易找到、入门门槛和薪资大概在什么区间。</p>
  <div class="meta-row"><span class="pill">${esc(c.tier)}</span><span class="pill">${esc(c.region)}</span>${(c.industries || []).map(x => `<span class="pill">${esc(x)}</span>`).join('')}</div>
</section>

<section class="section">
  <h2>本地岗位与薪资参考</h2>
  <p>按本地产业匹配度和岗位常见度排序，取前 10 个方向。薪资按${esc(c.tier)}能级系数折算，仅作量级参考。</p>
  <div class="table-wrap"><table>
    <tr><th>岗位</th><th>行业</th><th>学历参考</th><th>班次</th><th>本地薪资参考</th></tr>
    ${jobs.map(j => { const s = salaryFor(j, c); return `<tr><td><a href="${esc(fileUrl('jobs', jobFile(j)))}">${esc(j.name)}</a></td><td>${esc(j.l2)}</td><td>${esc(EDU[j.req.edu] || '不限')}</td><td>${esc(j.req.pat)}</td><td class="salary">${esc(s.text)}/月</td></tr>`; }).join('')}
  </table></div>
</section>

<section class="section">
  <h2>在${esc(c.name)}起步，优先看这三类方向</h2>
  <div class="grid three">
    ${jobs.slice(0, 3).map(j => `<div class="card"><h3><a href="${esc(fileUrl('jobs', jobFile(j)))}">${esc(j.name)}</a></h3><p>${esc(j.sal)}/月（全国口径）· ${esc(j.req.pat)} · ${esc(j.req.phys ? '有体力要求' : '轻体力')}</p></div>`).join('')}
  </div>
  <p class="note">“优先”只代表本地产业匹配度较高，不代表一定好找或适合你；还要结合你的经验、健康、家庭时间和收入底线。</p>
</section>

<section class="section">
  <h2>本地重启的第一步</h2>
  <div class="grid">
    <div class="card"><h3>先看本地招聘量</h3><p>在招聘平台搜 3–5 个目标岗位，记录：在招数量、薪资区间、学历/经验要求、班次。不要只看一个平台。</p></div>
    <div class="card"><h3>再找 2–3 个本地从业者</h3><p>问清楚一天流程、最难的 3 件事、实际收入结构和离职原因；这比看岗位描述更真实。</p></div>
    <div class="card"><h3>最后再投简历</h3><p>按岗位关键词改简历，优先投匹配度高的 20–30 个，不要海投；记录回复率，再调整。</p></div>
    <div class="card"><h3>用测评缩小范围</h3><p>如果你还不确定方向，可以先做 17 道题，拿到三条路线，再回到本页对照本地岗位。</p></div>
  </div>
  <div class="cta-box"><h2>不确定从哪开始？</h2><p>先测一次，再结合${esc(c.name)}的本地岗位做筛选。</p><a class="btn" href="/?from=guide-city-${esc(encodeURIComponent(c.name))}">开始测评 →</a></div>
</section>

<section class="section">
  <h2>常见问题</h2>
  <div class="faq">${faqs.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div>
</section>

<section class="section">
  <h2>同区域城市</h2>
  <div class="job-list">${relatedCities.map(x => `<div class="job-item"><div><a href="${esc(fileUrl('cities', cityFile(x)))}">${esc(x.name)}</a><div class="small muted">${esc(x.tier)} · ${esc(x.label || '')}</div></div></div>`).join('')}</div>
</section>
`;

  return layout({
    title: `${c.name}找工作：本地行业、岗位与薪资参考｜重启图鉴`,
    desc: `${c.name}岗位与薪资图鉴：本地主要行业、常见岗位、学历/班次门槛和按城市能级折算的薪资参考。`,
    canonical: url,
    body,
    jsonld: [
      {
        '@context': 'https://schema.org', '@type': 'Article',
        headline: `${c.name}找工作：本地行业、岗位与薪资参考`,
        description: `${c.name}本地岗位、行业与薪资参考。`,
        datePublished: TODAY, dateModified: TODAY, mainEntityOfPage: url,
        author: { '@type': 'Organization', name: '重启人格图鉴' },
        publisher: { '@type': 'Organization', name: '重启人格图鉴' },
      },
      {
        '@context': 'https://schema.org', '@type': 'FAQPage',
        mainEntity: faqs.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
      },
      crumbsLd([{ name: '首页', url: '/' }, { name: '岗位与城市图鉴', url: '/guide/' }, { name: c.name, url: fileUrl('cities', cityFile(c)) }]),
    ],
  });
}

/* ---------------- 问题页 ---------------- */
function topicPage(t, index) {
  const file = topicFile(t, index);
  const url = absUrl('questions', file);
  const jobs = pickJobs(t.jobPick);
  const fallback = pickJobs(j => j.entry);
  const picked = jobs.length >= 3 ? jobs : fallback;

  const body = `
${breadcrumb([{ name: '首页', url: '/' }, { name: '岗位与城市图鉴', url: '/guide/' }, { name: t.title, url: fileUrl('questions', file) }])}
<section class="hero">
  <span class="eyebrow">重启问题 · 行动指南</span>
  <h1>${esc(t.title)}</h1>
  <p class="lead">${esc(t.intro)}</p>
</section>

${t.sections.map(s => `<section class="section"><h2>${esc(s.h)}</h2>${s.p.map(p => `<p>${esc(p)}</p>`).join('')}</section>`).join('')}

<section class="section">
  <h2>可以先看这些岗位</h2>
  <p>不是让你立刻选一个，而是先用真实岗位信息校准“我愿不愿意做、够不够得着”。</p>
  <div class="job-list">${picked.map(j => `<div class="job-item"><div><a href="${esc(fileUrl('jobs', jobFile(j)))}">${esc(j.name)}</a><div class="small muted">${esc(j.l2)} · ${esc(EDU[j.req.edu] || '不限')} · ${esc(j.req.pat)}</div></div><span class="salary">${esc(j.sal)}/月</span></div>`).join('')}</div>
</section>

<div class="cta-box">
  <h2>先做一次 100 秒的自我校准</h2>
  <p>17 道题，生成三条路线和本周动作；结果只保存在本机，不要求注册。</p>
  <a class="btn" href="/?from=guide-question-${esc(t.slug)}">开始测评 →</a>
</div>

<section class="section">
  <h2>常见问题</h2>
  <div class="faq">${t.faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('')}</div>
</section>
`;

  return layout({
    title: `${t.title}｜重启图鉴`,
    desc: t.desc,
    canonical: url,
    body,
    jsonld: [
      {
        '@context': 'https://schema.org', '@type': 'Article',
        headline: t.title, description: t.desc,
        datePublished: TODAY, dateModified: TODAY, mainEntityOfPage: url,
        author: { '@type': 'Organization', name: '重启人格图鉴' },
        publisher: { '@type': 'Organization', name: '重启人格图鉴' },
      },
      {
        '@context': 'https://schema.org', '@type': 'FAQPage',
        mainEntity: t.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
      },
      crumbsLd([{ name: '首页', url: '/' }, { name: '岗位与城市图鉴', url: '/guide/' }, { name: t.title, url: fileUrl('questions', file) }]),
    ],
  });
}

/* ---------------- 索引页 ---------------- */
function indexPage() {
  const groups = [...byL1.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  const citiesByRegion = Object.fromEntries(CITY_REGIONS.map(r => [r, selectedCities.filter(c => c.region === r)]));
  const body = `
<section class="hero">
  <span class="eyebrow">免费 · 可被搜索的岗位与城市图鉴</span>
  <h1>先看清有什么活，再决定往哪走</h1>
  <p class="lead">这里把 180 个岗位、203 个城市和常见转行问题整理成可读的页面：岗位每天做什么、门槛多少、本地薪资大概什么区间、第一周能做什么。不用先付费，也不用注册。</p>
  <div class="stat-grid">
    <div class="stat"><b>180</b><span>个 L3 岗位</span></div>
    <div class="stat"><b>203</b><span>个城市</span></div>
    <div class="stat"><b>8</b><span>大职业类别</span></div>
  </div>
  <div class="cta-box"><h2>不确定自己适合哪类？</h2><p>先做 17 道题，拿到稳健 / 成长 / 上限三条路线，再回到图鉴对照具体岗位。</p><a class="btn" href="/?from=guide-index">开始测评 →</a></div>
</section>

<section class="section" id="questions">
  <h2>先看问题：你可能正在经历的处境</h2>
  <div class="grid">
    ${TOPICS.map((t, i) => `<div class="card"><h3><a href="${esc(fileUrl('questions', topicFile(t, i)))}">${esc(t.title)}</a></h3><p>${esc(t.desc)}</p></div>`).join('')}
  </div>
</section>

<section class="section" id="jobs">
  <h2>按职业大类看岗位</h2>
  <p class="muted">按职业大类列出全部 180 个岗位；点进岗位页可看任务、门槛、城市薪资和入行路径。</p>
  ${groups.map(([l1, list]) => `<h3>${esc(L1_NAMES[l1] || l1)}</h3><div class="job-list">${list.slice().sort((a, b) => jobScore(b) - jobScore(a)).map(j => `<div class="job-item"><div><a href="${esc(fileUrl('jobs', jobFile(j)))}">${esc(j.name)}</a><div class="small muted">${esc(j.l2)} · ${esc(j.req.pat)}</div></div><span class="salary">${esc(j.sal)}/月</span></div>`).join('')}</div>`).join('')}
</section>

<section class="section" id="cities">
  <h2>按城市看本地机会</h2>
  <p class="muted">先覆盖一线/新一线和部分二线；每个城市页有本地行业、常见岗位和按能级折算的薪资参考。</p>
  ${CITY_REGIONS.map(r => `<h3>${esc(r)}</h3><div class="job-list">${(citiesByRegion[r] || []).map(c => `<div class="job-item"><div><a href="${esc(fileUrl('cities', cityFile(c)))}">${esc(c.name)}</a><div class="small muted">${esc(c.tier)} · ${esc(c.label || '')}</div></div></div>`).join('')}</div>`).join('')}
</section>

<section class="section">
  <h2>使用说明</h2>
  <div class="grid">
    <div class="card"><h3>先看免费内容</h3><p>岗位、城市、问题页都免费；薪资和供需为公开报告量级参考，不是招聘承诺。</p></div>
    <div class="card"><h3>再做测评</h3><p>17 道题生成三条路线；免费结果就包含具体岗位、城市薪资和本周动作。</p></div>
    <div class="card"><h3>需要更深再付费</h3><p>9.9 元深度报告包含人格深读、12 周路线、简历与面试话术；解锁后 1 年内可回看。</p></div>
    <div class="card"><h3>数据会更新</h3><p>每月检查一次数据；发现明显偏差可通过 legal.html 里的邮箱反馈。</p></div>
  </div>
</section>
`;

  return layout({
    title: '岗位与城市图鉴：180 个岗位、203 个城市的门槛与薪资参考｜重启图鉴',
    desc: '免费查看 180 个岗位、203 个城市的任务、门槛、薪资与入行路径；覆盖蓝领、服务业、制造业、新职业和低门槛方向。',
    canonical: `${SITE}/guide/`,
    body,
    jsonld: [
      {
        '@context': 'https://schema.org', '@type': 'CollectionPage',
        name: '岗位与城市图鉴', description: '180 个岗位、203 个城市的门槛与薪资参考。',
        url: `${SITE}/guide/`, datePublished: TODAY, dateModified: TODAY,
      },
      crumbsLd([{ name: '首页', url: '/' }, { name: '岗位与城市图鉴', url: '/guide/' }]),
    ],
  });
}

/* ---------------- 写入 ---------------- */
const pages = [];
function write(rel, html) {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, html, 'utf8');
  pages.push(rel.replace(/\\/g, '/'));
}

write('guide/index.html', indexPage());
for (const j of selectedJobs) write(`guide/jobs/${jobFile(j)}`, jobPage(j));
for (const c of selectedCities) write(`guide/cities/${cityFile(c)}`, cityPage(c));
TOPICS.forEach((t, i) => write(`guide/questions/${topicFile(t, i)}`, topicPage(t, i)));

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${[
  { loc: `${SITE}/`, pri: '1.0' },
  { loc: `${SITE}/guide/`, pri: '0.9' },
  { loc: `${SITE}/legal.html`, pri: '0.3' },
  ...selectedJobs.map(j => ({ loc: absUrl('jobs', jobFile(j)), pri: '0.7' })),
  ...selectedCities.map(c => ({ loc: absUrl('cities', cityFile(c)), pri: '0.7' })),
  ...TOPICS.map((t, i) => ({ loc: absUrl('questions', topicFile(t, i)), pri: '0.7' })),
].map(x => `  <url><loc>${x.loc.replace(/&/g, '&amp;')}</loc><lastmod>${TODAY}</lastmod><changefreq>monthly</changefreq><priority>${x.pri}</priority></url>`).join('\n')}
</urlset>
`;
fs.writeFileSync(path.join(root, 'sitemap.xml'), sitemap, 'utf8');
fs.writeFileSync(path.join(root, 'robots.txt'), `User-agent: *\nAllow: /\nDisallow: /api/\nDisallow: /restore.html\n\nSitemap: ${SITE}/sitemap.xml\n`, 'utf8');

console.log(`生成完成：${pages.length} 个页面`);
console.log(`岗位：${selectedJobs.length}，城市：${selectedCities.length}，问题：${TOPICS.length}`);
console.log(`sitemap.xml / robots.txt 已更新`);