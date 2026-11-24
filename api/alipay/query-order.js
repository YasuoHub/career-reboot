/* /api/alipay/query-order —— 查询订单支付状态（运维/兜底用）
   GET ?out_trade_no=CRB... → { status, tradeNo, ... }
   订单状态以支付宝侧为准，本地不做缓存。 */
import { createAlipaySdk } from '../../lib/alipay-sdk.js';
import { isValidOutTradeNo } from '../../lib/alipay-orders.js';

export const config = { api: { external: true } };

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });

  const outTradeNo = req.query.out_trade_no;
  if (!isValidOutTradeNo(outTradeNo)) {
    return res.status(400).json({ error: 'INVALID_OUT_TRADE_NO' });
  }

  try {
    const sdk = createAlipaySdk();
    const result = await sdk.exec('alipay.trade.query', {
      bizContent: { out_trade_no: outTradeNo },
    });
    const resp = result?.alipay_trade_query_response || {};

    if (resp.code !== '10000') {
      return res.status(404).json({
        error: 'ORDER_NOT_FOUND',
        status: resp.sub_code || resp.code,
        msg: resp.sub_msg || resp.msg,
      });
    }
    return res.json({
      outTradeNo: resp.out_trade_no,
      status: resp.trade_status,
      tradeNo: resp.trade_no,
      gmtPayment: resp.gmt_payment,
      totalAmount: resp.total_amount,
      source: 'alipay',
    });
  } catch (err) {
    console.error('[alipay.query] error:', err.message);
    return res.status(500).json({ error: '查询失败', detail: err.message });
  }
}
