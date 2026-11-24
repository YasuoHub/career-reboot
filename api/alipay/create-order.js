/* /api/alipay/create-order —— 手机网站支付下单
   POST { archetype? } → { payUrl, outTradeNo, amount }
   价格由服务端固定（lib/alipay-orders.js PRICE），前端传价格一律忽略。 */
import { createAlipaySdk } from '../../lib/alipay-sdk.js';
import { PRICE, SUBJECT, SITE_URL, nextOutTradeNo } from '../../lib/alipay-orders.js';

export const config = { api: { external: true } };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  const outTradeNo = nextOutTradeNo();
  const sdk = createAlipaySdk();

  const requestOptions = {
    // 异步通知：支付结果以服务端验签 + 主动查单为准
    notifyUrl: (process.env.ALIPAY_NOTIFY_URL || `${SITE_URL}/api/alipay/notify`).trim(),
    // 同步回跳：支付宝收银台完成后 302 回站内，由前端主动验单
    returnUrl: (process.env.ALIPAY_RETURN_URL || `${SITE_URL}/api/alipay/return`).trim(),
    bizContent: {
      out_trade_no: outTradeNo,
      total_amount: PRICE,
      subject: SUBJECT,
      product_code: 'QUICK_WAP_WAY',         // 手机网站支付固定值
      quit_url: (process.env.ALIPAY_QUIT_URL || `${SITE_URL}/`).trim(), // 用户中途退出返回
      timeout_express: '15m',
    },
  };

  try {
    // GET 模式返回可直接跳转的收银台 URL（POST 会返回 form HTML）
    const payUrl = await sdk.pageExec('alipay.trade.wap.pay', 'GET', requestOptions);
    if (typeof payUrl !== 'string' || !payUrl.startsWith('http')) {
      throw new Error('网关未返回有效支付链接');
    }
    console.log('[alipay.create] order=%s archetype=%s', outTradeNo, (req.body || {}).archetype || '-');
    return res.json({ payUrl, outTradeNo, amount: PRICE });
  } catch (err) {
    console.error('[alipay.create] pageExec error:', err.message);
    return res.status(500).json({ error: '下单失败', detail: err.message });
  }
}
