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

function parseQS(raw) {
  const params = {};
  for (const pair of String(raw || '').split('&')) {
    if (!pair) continue;
    const idx = pair.indexOf('=');
    if (idx < 0) continue;
    const k = decodeURIComponent(pair.slice(0, idx));
    const v = decodeURIComponent(pair.slice(idx + 1));
    params[k] = v;
  }
  return params;
}

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', c => raw += c);
    req.on('end', () => resolve(raw));
    req.on('error', reject);
  });
}

/** 兼容运行时差异：body 可能是已解析对象、原始字符串或 Buffer，也可能尚未读取 */
async function resolveParams(req) {
  const body = req.body;
  if (body && typeof body === 'object' && !Buffer.isBuffer(body)) return body;
  if (Buffer.isBuffer(body)) return parseQS(body.toString('utf8'));
  if (typeof body === 'string' && body) return parseQS(body);
  return parseQS(await readRawBody(req));
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

/** 支付宝要求纯文本响应；用 setHeader+end 避免不同运行时对 res.type 的支持差异 */
function reply(res, code, body) {
  res.statusCode = code;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end(body);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return reply(res, 405, 'fail');

  let params;
  try {
    params = await resolveParams(req);
  } catch (_) {
    return reply(res, 200, 'fail');
  }

  try {
    const sdk = createAlipaySdk();
    if (!verifyNotify(sdk, params)) {
      console.error('[alipay.notify] bad sign order=%s', params.out_trade_no);
      return reply(res, 200, 'fail');
    }

    if (!isValidOutTradeNo(params.out_trade_no)) {
      console.error('[alipay.notify] invalid out_trade_no=%s', params.out_trade_no);
      return reply(res, 200, 'fail');
    }

    const appId = (process.env.ALIPAY_APP_ID || '').trim();
    if (appId && params.app_id && params.app_id !== appId) {
      console.error('[alipay.notify] app_id mismatch got=%s', params.app_id);
      return reply(res, 200, 'fail');
    }

    if (!amountsEqual(params.total_amount, PRICE)) {
      console.error('[alipay.notify] amount mismatch order=%s actual=%s expected=%s',
        params.out_trade_no, params.total_amount, PRICE);
      return reply(res, 200, 'fail');
    }

    if (params.trade_status === 'TRADE_SUCCESS' || params.trade_status === 'TRADE_FINISHED') {
      console.log('[alipay.notify] PAID order=%s trade=%s amount=%s at=%s',
        params.out_trade_no, params.trade_no, params.total_amount, params.gmt_payment);
    } else {
      console.log('[alipay.notify] status=%s order=%s', params.trade_status, params.out_trade_no);
    }

    // 支付宝要求纯文本 success，否则会按策略重试
    return reply(res, 200, 'success');
  } catch (err) {
    console.error('[alipay.notify]', err.message);
    return reply(res, 200, 'fail');
  }
}
