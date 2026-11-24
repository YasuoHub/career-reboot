# 重启人格图鉴（H5 传播版 v1）

失业 / 被裁 / 转行 / 空窗场景的情绪向 H5 测评。纯静态、零依赖、零后端——
直接扔上 Vercel 即可运行。数据全部只存浏览器 `localStorage`，不上传任何服务器。

## 结构

```
career-reboot/
├── index.html        # 单入口，5 个屏：封面→答题→分析→结果+海报弹窗
├── vercel.json       # Vercel 部署配置（SPA rewrite + 安全头）
├── css/style.css     # 设计系统：深色编辑风 × 玻璃拟态，配色随原型注入
└── js/
    ├── data.js       # ★ 扩展入口：题库 / 八大原型 / 32 个职业
    ├── poster.js     # Canvas：六维雷达动画 / 彩带 / 分享海报 / 复制链接
    └── app.js        # 状态机 / 计分引擎 / 结果页渲染
```

## 计分引擎口径（v1，供迭代参考）

- 8 题 → 6 维原始分 → 按各维满分归一化到 0–100（`AXES_MAX`，改题务必同步上限）
- 原型识别 = 最高维单型，或**双高合成型**（第二高维 ≥ 最高维 × 0.55 时触发，见 `architect`/`spotlight`，稀有感的主要来源）
- 情境约束（经济容错 / 收入底线 / 可投入时间）做职业准入过滤，兜底保证 TOP3 不为空
- 三枚二次指标（试错胆量/续航/紧迫度）为趣味口径，非科学量表，结果页已标注

## 本地预览

```bash
npx serve .          # 或 VS Code Live Server / python -m http.server
```

手机同局域网访问即可真机预览海报与分享流程。

## 部署到 Vercel

CLI：

```bash
npm i -g vercel
vercel            # 首次，自动关联账号
vercel --prod     # 上线 production
```

面板：vercel.com → Import `career-reboot` 目录 → Deploy。

**绑自有域名**：Deploy 页 Domain → Add → 输入你的域名 → 按提示把 DNS 的
`CNAME` 指向 `cname.vercel-dns.com`（根域用 A 记录指 `76.76.21.21`）。

## 微信里分享的三件事（上线前必做）

1. **og:image**：微信抓链接卡片需要一张常驻静态图。把海报样式导出成
   `og-card.png` 放到项目根目录（index.html 已引用 `/og-card.png`）。
   内容与各型无关，做一张通用版即可。
2. **二维码**：海报二维码走 `api.qrserver.com`（公网服务，已内置失败降级）。
   若要彻底离线，把 `poster.js` 的 `loadQR()` 换成本地 qrcode 库即可。
3. **中文域名/短链**：海外二维码服务对长链支持良好，无需短链；保持
   `location.href` 原样生成即可。

## 扩展题库的守则

- `QUESTIONS[].opts[]`：`add.dims` 的键必须命中 `AXES` 的 key（`analytic/maker/creative/social/leader/stable`），否则该维度永远为 0
- `ARCHETYPES[].combo` 同理；组合型写两个轴 key，别写错拼写（曾有 `analyst/analytic` 一字之差导致双高型全灭的事故，以此校验为准）
- `CAREERS[]`：`need.minIncome/hours/risk` 是准入门槛，改完用 Node 快速自检：
  `node -e "eval(require('fs').readFileSync('js/data.js'))"` 后断言各键存在
- 参与人数目前是本机种子数（`store.total`），上线时换成真实埋点查询接口即可，仅封面一个展示位

## 合规红线（已内置，勿删改）

- 全部页面标注「趣味性格探索，不构成医疗、心理诊断或就业承诺」
- 无手机号收集、无登录授权、无诱导分享；数据不出设备
- 职业薪资为公开市场参考区间，免责写在海报底部

## 商业化钩子（预留位置，接 Phase 2 时用）

| 阶段 | 挂载点 |
|---|---|
| 流量主广告 | 结果页 `.res-body` 底部插 Banner 位 |
| 9.9 元详细报告 | `#sc-computing` 分析屏之后加付费墙 |
| 分销裂变 | `#btn-poster` 海报码换成带推荐参数的短链 |
| B 端白标 | `ARCHETYPES[].colors` 已参数化，换皮即成企业版 |