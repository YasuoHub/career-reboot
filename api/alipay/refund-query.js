/* /api/alipay/refund-query —— 查询退款状态
   GET ?out_trade_no=xxx&out_request_no=xxx → { status, totalRefund } */
import { createAlipaySdk } from '../../lib/alipay-sdk.js';

export const config = { api: { external: true } };

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
  const { out_trade_no, out_request_no } = req.query;
  if (!out_trade_no) return res.status(400).json({ error: 'missing out_trade_no' });

  try {
    const sdk = createAlipaySdk();
    const result = await sdk.exec('alipay.trade.fastpay.refund.query', {
      bizContent: {
        out_trade_no: out_trade_no,
        ...(out_request_no ? { out_request_no: out_request_no } : {}),
      },
    });
    const resp = result?.alipay_trade_fastpay_refund_query_response;
    if (resp?.code === '10000') {
      const refundStatus = resp.refund_status || 'UNKNOWN';
      return res.json({
        success: true,
        status: refundStatus,
        isRefundSuccess: refundStatus === 'REFUND_SUCCESS',
        fundChange: resp.fund_change,
        totalRefund: resp.total_refund_amount,
        totalPayment: resp.total_payment_amount,
      });
    }
    return res.status(404).json({ error: 'REFUND_QUERY_FAILED', detail: resp?.sub_msg });
  } catch (e) {
    console.error('[alipay.refund-query]', e.message);
    return res.status(500).json({ error: 'query_error', detail: e.message });
  }
}