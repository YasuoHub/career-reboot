/* /api/alipay/verify —— 支付结果验单（前端回跳后调用）
   GET  ?out_trade_no=CRB...   或
   POST { outTradeNo: 'CRB...' }
   → { paid: true, outTradeNo, tradeNo, paidAt, amount, token }
   → { paid: false, status: 'WAIT_BUYER_PAY' | ... }

   说明：订单状态以支付宝侧为准，本接口直接调用 alipay.trade.query，
   不信任任何前端/URL 参数。支付成功才签发解锁令牌。 */
import { createAlipaySdk } from '../../lib/alipay-sdk.js';
import {
  PRICE, amountsEqual, isValidOutTradeNo, signUnlockToken,
} from '../../lib/alipay-orders.js';

export const config = { api: { external: true } };

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const body = req.body || {};
  const outTradeNo = req.method === 'GET'
    ? req.query.out_trade_no
    : (body.outTradeNo || body.out_trade_no);

  if (!isValidOutTradeNo(outTradeNo)) {
    return res.status(400).json({ paid: false, error: 'INVALID_OUT_TRADE_NO' });
  }

  try {
    const sdk = createAlipaySdk();
    const result = await sdk.exec('alipay.trade.query', {
      bizContent: { out_trade_no: outTradeNo },
    });
    const resp = result?.alipay_trade_query_response || {};

    if (resp.code !== '10000') {
      // 40004 = 订单不存在（尚未生成 / 已关闭过期超过可查期）
      return res.json({
        paid: false,
        outTradeNo,
        status: resp.sub_code || resp.code || 'QUERY_FAILED',
        msg: resp.sub_msg || resp.msg || '',
      });
    }
    if (resp.out_trade_no && resp.out_trade_no !== outTradeNo) {
      return res.status(409).json({ paid: false, error: 'ORDER_MISMATCH' });
    }

    const paid = resp.trade_status === 'TRADE_SUCCESS' || resp.trade_status === 'TRADE_FINISHED';
    if (!paid) {
      return res.json({ paid: false, outTradeNo, status: resp.trade_status || 'UNKNOWN' });
    }
    if (!amountsEqual(resp.total_amount, PRICE)) {
      console.error('[alipay.verify] amount mismatch order=%s actual=%s expected=%s',
        outTradeNo, resp.total_amount, PRICE);
      return res.status(409).json({ paid: false, error: 'AMOUNT_MISMATCH' });
    }

    const sellerId = (process.env.ALIPAY_SELLER_ID || '').trim();
    if (sellerId && resp.seller_id && resp.seller_id !== sellerId) {
      return res.status(409).json({ paid: false, error: 'SELLER_MISMATCH' });
    }

    const token = signUnlockToken({
      outTradeNo,
      tradeNo: resp.trade_no,
      paidAt: resp.gmt_payment || new Date().toISOString(),
    });

    return res.json({
      paid: true,
      outTradeNo,
      tradeNo: resp.trade_no,
      paidAt: resp.gmt_payment || null,
      amount: resp.total_amount,
      token,
    });
  } catch (err) {
    console.error('[alipay.verify] error:', err.message);
    return res.status(500).json({ paid: false, error: 'VERIFY_FAILED', detail: err.message });
  }
}
