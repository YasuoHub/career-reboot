/* /api/alipay/notify —— 支付宝异步通知处理（必须返回纯文本 success/fail）
   application/x-www-form-urlencoded，不使用 JSON parser。

   无状态版：不依赖本地订单记录（Serverless 实例间不共享内存），
   以「验签 + 订单号格式 + 金额」为校验依据；业务状态最终仍由前端
   调用 /api/alipay/verify 主动查单确认。 */
import { createAlipaySdk } from '../../lib/alipay-sdk.js';
import { PRICE, amountsEqual, isValidOutTradeNo } from '../../lib/alipay-orders.js';

export const config = {
  api: {
    external: true,
    bodyParser: false,  // 手动读取 x-www-form-urlencoded
  },
};

function parseForm(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', c => raw += c);
    req.on('end', () => {
      try {
        const params = {};
        for (const pair of raw.split('&')) {
          if (!pair) continue;
          const idx = pair.indexOf('=');
          if (idx < 0) continue;
          const k = decodeURIComponent(pair.slice(0, idx));
          const v = decodeURIComponent(pair.slice(idx + 1));
          params[k] = v;
        }
        resolve(params);
      } catch (e) { reject(e); }
    });
    req.on('error', reject);
  });
}

function verifyNotify(sdk, params) {
  try {
    // checkNotifySignV2 为同步返回；兼容老版本 checkNotifySign
    const fn = sdk.checkNotifySignV2 || sdk.checkNotifySign;
    return Boolean(fn.call(sdk, params));
  } catch (err) {
    console.error('[alipay.notify] verify sign error:', err.message);
    return false;
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).type('text/plain').send('fail');

  let params;
  try {
    params = typeof req.body === 'object' && req.body
      ? req.body
      : await parseForm(req);
  } catch (_) {
    return res.type('text/plain').send('fail');
  }

  try {
    const sdk = createAlipaySdk();
    if (!verifyNotify(sdk, params)) {
      console.error('[alipay.notify] bad sign order=%s', params.out_trade_no);
      return res.type('text/plain').send('fail');
    }

    if (!isValidOutTradeNo(params.out_trade_no)) {
      console.error('[alipay.notify] invalid out_trade_no=%s', params.out_trade_no);
      return res.type('text/plain').send('fail');
    }

    const appId = (process.env.ALIPAY_APP_ID || '').trim();
    if (appId && params.app_id && params.app_id !== appId) {
      console.error('[alipay.notify] app_id mismatch got=%s', params.app_id);
      return res.type('text/plain').send('fail');
    }

    if (!amountsEqual(params.total_amount, PRICE)) {
      console.error('[alipay.notify] amount mismatch order=%s actual=%s expected=%s',
        params.out_trade_no, params.total_amount, PRICE);
      return res.type('text/plain').send('fail');
    }

    if (params.trade_status === 'TRADE_SUCCESS' || params.trade_status === 'TRADE_FINISHED') {
      console.log('[alipay.notify] PAID order=%s trade=%s amount=%s at=%s',
        params.out_trade_no, params.trade_no, params.total_amount, params.gmt_payment);
    } else {
      console.log('[alipay.notify] status=%s order=%s', params.trade_status, params.out_trade_no);
    }

    // 支付宝要求纯文本 success，否则会按策略重试
    return res.type('text/plain').send('success');
  } catch (err) {
    console.error('[alipay.notify]', err.message);
    return res.type('text/plain').send('fail');
  }
}
