/* /api/alipay/close —— 关闭未支付的订单
   POST { outTradeNo } → { success } */
import { createAlipaySdk } from '../../lib/alipay-sdk.js';
import { isValidOutTradeNo } from '../../lib/alipay-orders.js';

export const config = { api: { external: true } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });
  const { outTradeNo } = req.body || {};
  if (!isValidOutTradeNo(outTradeNo)) return res.status(400).json({ error: 'missing or invalid outTradeNo' });

  try {
    const sdk = createAlipaySdk();
    const result = await sdk.exec('alipay.trade.close', {
      bizContent: { out_trade_no: outTradeNo },
    });
    const resp = result?.alipay_trade_close_response;
    if (resp?.code === '10000') {
      return res.json({ success: true });
    }
    return res.status(502).json({ error: 'CLOSE_FAILED', detail: resp?.sub_msg || resp?.msg });
  } catch (e) {
    console.error('[alipay.close]', e.message);
    return res.status(500).json({ error: 'close_error', detail: e.message });
  }
}
