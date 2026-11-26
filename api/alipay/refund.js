/* /api/alipay/refund —— 申请退款
   POST { outTradeNo, amount?, reason?, outRequestNo? } → { success, fundChange } */
import { createAlipaySdk } from '../../lib/alipay-sdk.js';
import { isValidOutTradeNo, nextOutRequestNo } from '../../lib/alipay-orders.js';

export const config = { api: { external: true } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  /* 退款是资金操作，必须带管理员令牌；未配置时默认关闭，避免匿名调用。
     日常退款优先走支付宝商家后台，此接口仅作自动化兜底。 */
  const adminToken = (process.env.ADMIN_TOKEN || process.env.REFUND_ADMIN_TOKEN || '').trim();
  if (!adminToken) return res.status(503).json({ error: 'REFUND_DISABLED' });
  const provided = String(req.headers['x-admin-token'] || '').trim();
  if (!provided || provided !== adminToken) {
    return res.status(401).json({ error: 'UNAUTHORIZED' });
  }

  const { outTradeNo, amount, reason, outRequestNo } = req.body || {};
  if (!isValidOutTradeNo(outTradeNo)) return res.status(400).json({ error: 'missing or invalid outTradeNo' });

  // 同一次退款重试必须复用原 outRequestNo；新一次退款使用新编号（由调用方决定）
  const requestNo = outRequestNo || nextOutRequestNo();

  try {
    const sdk = createAlipaySdk();
    const result = await sdk.exec('alipay.trade.refund', {
      bizContent: {
        out_trade_no: outTradeNo,
        out_request_no: requestNo,
        ...(amount ? { refund_amount: Number(amount).toFixed(2) } : {}),
        ...(reason ? { refund_reason: String(reason).slice(0, 256) } : {}),
      },
    });
    const resp = result?.alipay_trade_refund_response;
    if (resp?.code === '10000') {
      // 仅 fund_change=Y 才认定发生资金变化；否则返回受理但未退
      const fundChange = resp.fund_change === 'Y';
      return res.json({ success: true, fundChange, outRequestNo: requestNo });
    }
    return res.status(502).json({ error: 'REFUND_FAILED', detail: resp?.sub_msg || resp?.msg });
  } catch (e) {
    console.error('[alipay.refund]', e.message);
    return res.status(500).json({ error: 'refund_error', detail: e.message });
  }
}
