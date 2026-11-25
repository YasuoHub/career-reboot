# 支付宝 AI 付 · Vibe Pay 接入（历史方案 · 已废弃）

> **⚠️ 已废弃（2026-11-25）**：项目最终采用支付宝**手机网站支付**（`alipay.trade.wap.pay`），已完成签约上线。本文仅保留作为历史备选方案参考，请以 [支付与变现现状](./支付与变现现状.md) 为准。

> 背景（2026-11 更新）：蚂蚁集团今年推出的「AI 付」专门面向 AI 开发者/创作者，**个人账户可签约，不需要企业资质，也完全不需要 ICP 备案**。这比你之前听说的"网站支付需要企业资质"宽松得多，是当前最适合 H5 单一开发者变现的通道。
> 关联文档：[微信支付接入（兜底通道）](./微信支付接入.md) / [深度报告设计](./深度报告设计.md) / [分享验证方案](./分享验证方案.md)
> 官网：[aipay.alipay.com](https://aipay.alipay.com) / [开发者激励计划第 3 期](https://aipay.alipay.com/incentive-mobile)

---

## 一 为什么首选 Vibe Pay

| 维度 | 之前判断 | 实际情况 |
|---|---|---|
| 个人账户能否收款 | ❌ "网站支付要企业资质" | ✅ **支持符合条件的个人创作者以个人身份开展应用收款**（官网原文）|
| ICP 备案要求 | ❌ .icu 未备案卡死 | ✅ **完全不需要**（走海外通道）|
| 开发成本 | ❌ 自写 Serverless Function × 3 + Supabase 3 张表 | ✅ **一行命令 `npx -y @alipay/alipay-aipay@latest install` + Agent 引导式完成代码生成、沙箱测试、签约入驻** |
| 费率 | 微信 0.6% | ✅ **个人开发者 0 费率至 2026-12-31** |
| 额外收益 | 无 | ✅ **开发者激励计划最高 ¥5660 Token 补贴**（50,000 有效交易用户解锁 5,000 元档）|

### Vibe Pay 的两种模式
| 模式 | 适用 | 推荐度 |
|---|---|---|
| **基础收款能力** | 高度定制支付体验，自行建设订单/权益管理 | P1 再考虑 |
| **智能收款套件** | 快速上线，不重复建设交易配套 | **✅ P0 用这个** |

---

## 二 产品矩阵（备查，只 Vibe Pay 是你 P0 要用的）

| 产品 | 对口场景 | 你的匹配度 |
|---|---|---|
| **Vibe Pay** | AI 做的网页/小程序收款 | ⭐⭐⭐⭐⭐ **P0 用这个** |
| Skill Pay | 把测评封装成可被 Agent 调用的 Skill，用户调用收费 | 远期重构可考虑 |
| Machine Pay | API 按量计费，AI 按调用次数自动收钱 | 远期（若接 AI 大模型摘要）|
| Agent Pay | 用户说一句话，Agent 代下单付款 | 与你的产品形态不直接相关 |
| Token Pay | 大模型订阅（Token 套餐、模型额度） | 不适用 |

---

## 三 一次性准备（P0 全程约 30 分钟，主要是签约审核等待）

### A. 支付宝账号状态确认
- 你已有的支付宝个人账户即可，**无需另开商户号**
- 若账户从未签约过任何支付宝产品，首次会进入实名签约流程（人脸+身份证），约 5~10 分钟

### B. 安装官方 Skill（一行命令）
```bash
npx -y @alipay/alipay-aipay@latest install
```
- 装完后对话中说明业务上下文即可，Agent 会逐步引导：
  - 业务与收费场景：「失业转行测评的深度报告解锁，9.9 元一次性买断」
  - 项目技术栈：「Vercel 静态站 + Serverless Function，域名 career-turn.icu」
  - 目标支付产品：`Vibe Pay`
  - 应用与商户信息：你的支付宝账号即商户主体

### C. 生成集成代码
Agent 根据上述上下文自动生成：
- 服务端下单接口（含签名/回调验签）
- 前端唤起逻辑（H5/JSAPI 双适配）
- 沙箱测试脚本

### D. 沙箱测试
官方提供沙箱环境，跑通一次完整链路（下单→支付→回调→权益放行）再切生产密钥。

### E. 签约上线
```
aipay.alipay.com/open-flow/products → 选择 Vibe Pay → 上传身份/人脸 → 签约
```
- 签约审核通常 1~3 个工作日
- 通过后获得 `appId` + 公私钥对，生产环境可直接用

---

## 四 商业模式适配

Vibe Pay 支持的五种模式里，你 P0 只需用**一次性买断**：

| 模式 | 你的场景 |
|---|---|
| **一次性买断** | ⭐ **9.9 元解锁深度报告** |
| 次数包 | P2 可选（比如"AI 30 天计划 3 次咨询包 ¥29.9"）|
| 积分包 | 远期 |
| 时长包 | 远期（若做会员制）|

---

## 五 前端接入流程（Vibe Pay 版）

跟微信版差异：
- **不需要拿 openid**：Vibe Pay 用 uuid 作为客户标识（你自己生成或让用户登录一次即可），比微信网页授权简单得多
- **唤起方式**：通过支付宝 Skill 生成付款卡片，用户在支付宝 App 内确认支付，回调结果回传到你的服务端
- **非支付宝环境**：用户用手机浏览器打开 → 唤起支付宝 App 收银台 → 付完跳回原页面

```
用户点「¥9.9 解锁深度报告」
   ↓
前端生成 uuid（若无则 sessionStorage 生成一个）
   ↓
POST /api/pay/create { uuid, archetype }
   ← Vibe Pay 返回付款链接/payment_id
   ↓
拉起支付宝付款卡片 / 跳转支付宝 App 收银台
   ↓
支付完成 → 支付宝回调 /api/pay/notify
   ↓
前端 GET /api/unlock?uuid=xxx → { unlocked: true, via: 'pay' }
   → 渲染 #sc-report 全屏沉浸报告页
```

---

## 六 分享验证的配合（关键简化）

相比微信版必须走公众号网页授权拿 openid，Vibe Pay 用 uuid 作为客户标识意味着：

- **uuid 可以本地生成**：`sessionStorage.uuid = crypto.randomUUID()`
- **无跨端授权跳转**：不引入微信 OAuth 那套重量级流程
- **推荐链传递**：链接带 `?ref=referrer_uuid&t=token`，推荐人完成计数通过服务端校验，跟微信版逻辑同构但更轻

**数据库表**可以极简（Supabase 单张表够 P0 用）：
```sql
create table if not exists unlocks (
  uuid text primary key,
  unlocked_at timestamptz default now(),
  expires_at timestamptz default now() + interval '30 days',
  via text check (via in ('pay','share')),
  pay_out_trade_no text unique,
  invite_progress int default 0
);

-- 推荐关系（可选，P1 再加）
create table if not exists invite_edges (
  referrer_uuid text not null,
  viewer_uuid text not null,
  created_at timestamptz default now(),
  unique(referrer_uuid, viewer_uuid)
);
```

---

## 七 合规清单

- [ ] 支付宝账户完成实名签约（含人脸认证）
- [ ] 应用场景与类目匹配：「数字内容购买」（具体类目问支付宝客服，Vibe Pay 场景下数字内容是默认类目）
- [ ] 站内挂《用户协议》+《隐私政策》（免责产品必须挂，作为 Vibe Pay 审核材料之一）
- [ ] 报告显著位置标注「趣味性格探索，不构成医疗、心理诊断或就业承诺」
- [ ] 数据不留存声明：「除匿名 uuid 外，不采集任何个人敏感信息，深度报告数据仅在本设备生成」
- [ ] 未成年人提示（可选："本测试建议 16 周岁以上用户使用"）

---

## 八 与微信通道的关系

| 用户入口 | 主通道 | 兜底 |
|---|---|---|
| 微信内打开（最常见）| **支付宝 Vibe Pay**（唤起卡片） | 微信 JSAPI 若微信通道也接了可用 |
| 手机浏览器打开 | **支付宝 Vibe Pay**（外跳支付宝 App） | — |
| PC 端访问 | **支付宝 Vibe Pay** | 微信 Native 扫码若接了可用 |

**建议策略**：
- **P0 只接支付宝 Vibe Pay**（一行命令开通，最快跑通付费闭环，验证产品付费意愿）
- **P1 观察转化漏斗后决定是否接微信**：如果发现大量微信内打开但唤起支付宝 App 有跳出流失，再补微信 JSAPI 通道
- 双通道并存会增加约 50% 开发+维护成本，没必要一上来就做

---

## 九 P0 交付清单

按时间顺序（1~2 天可完成）：
1. `npx -y @alipay/alipay-aipay@latest install` 装 Skill
2. 对话中给 Agent 提供业务上下文，让它生成集成代码
3. 沙箱环境跑通一次完整链路
4. 签约上线，等审核通过（通常 1~3 个工作日）
5. Supabase 建 1~2 张表
6. 前端加解锁入口 + 三态 UI（未解锁/付费解锁/分享解锁中）
7. 端到端测试：浏览器打开 → 点解锁 → 支付宝 App 付 9.9 → 跳回 → 出报告
8. 上线后埋点：转化率、分享裂变系数、复访率

---

## 十 激励计划参与（顺手领）

[开发者激励计划第 3 期](https://aipay.alipay.com/incentive-mobile)：报名+接入后，按累计有效交易用户数解锁五档奖励

| 累计有效交易用户 | Token 补贴 |
|---|---|
| 10 | ¥10 |
| 100 | ¥50 |
| 1,000 | ¥100 |
| 5,000 | ¥500 |
| **50,000** | **¥5,000** |

- 五档叠加最高累计 **¥5,660** Token 资源包
- T+7 解锁
- **报名截止 2026-08-21**——你当前是 2026-11，第 3 期可能已截止，接入前先到官网看是否有第 4 期或常态化激励
- 个人开发者 AI 按量付费享受 **0 费率至 2026-12-31**

---

## 十一 立即行动项

1. 现在就去 [aipay.alipay.com/open-flow/products](https://aipay.alipay.com/open-flow/products) 看 Vibe Pay 是否对你的账号开放（部分账号需邀测，若无开放权限先报名等审核）
2. 若已开放 → 一行命令装 Skill → 给我生成集成代码
3. 若未开放 → 先报名 waitlist，第 3 期激励截止前补上即可