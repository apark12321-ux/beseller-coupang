const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

function loadLocalEnv() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx <= 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = value;
  }
}

loadLocalEnv();

const PORT = Number(process.env.PORT || 8787);
const BASE_URL = (process.env.COUPANG_BASE_URL || 'https://api-gateway.coupang.com').replace(/\/$/, '');
const ACCESS_KEY = process.env.COUPANG_ACCESS_KEY || '';
const SECRET_KEY = process.env.COUPANG_SECRET_KEY || '';
const VENDOR_ID = process.env.COUPANG_VENDOR_ID || '';
const RELAY_SECRET = process.env.COUPANG_RELAY_SECRET || '';

function json(res, status, body) {
  const text = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
  });
  res.end(text);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = '';
    req.on('data', (chunk) => {
      data += chunk;
      if (data.length > 2_000_000) {
        req.destroy();
        reject(new Error('body too large'));
      }
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function signedDate() {
  return new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '').replace('Z', 'Z').slice(2);
}

function sign(method, apiPath, query) {
  const datetime = signedDate();
  const message = datetime + method.toUpperCase() + apiPath + (query || '');
  const signature = crypto.createHmac('sha256', SECRET_KEY).update(message).digest('hex');
  return `CEA algorithm=HmacSHA256, access-key=${ACCESS_KEY}, signed-date=${datetime}, signature=${signature}`;
}

function extractAkamaiRef(html) {
  const m = String(html).match(/Reference[^0-9a-fA-F]*([0-9a-fA-F.\-]+)/);
  return m ? m[1] : null;
}

function extractNotAllowedIp(message) {
  const m = String(message).match(/ip address\s+([0-9]{1,3}(?:\.[0-9]{1,3}){3})\s+is not allowed/i);
  return m ? m[1] : null;
}

function summarizeJson(obj, fallback = '정상 응답') {
  if (!obj || typeof obj !== 'object') return fallback;
  const code = obj.code ?? obj.resultCode ?? obj.status;
  const message = obj.message ?? obj.resultMessage ?? obj.errorMessage ?? obj.error;
  if (code || message) return `code=${code ?? '?'} message=${String(message ?? '').slice(0, 200)}`;
  if (Array.isArray(obj.data)) return `${fallback} · data ${obj.data.length}건`;
  if (Array.isArray(obj.content)) return `${fallback} · content ${obj.content.length}건`;
  return fallback;
}

function normalizeCoupangResponse(status, contentType, text) {
  if (status === 403 && contentType.includes('text/html')) {
    return {
      ok: false,
      httpStatus: 403,
      contentType,
      errorClass: 'COUPANG_GATEWAY_ACCESS_DENIED',
      akamaiReference: extractAkamaiRef(text),
      rejectedIp: null,
      json: null,
      summary: '쿠팡 게이트웨이 403 Access Denied. WING에 등록된 고정 IP와 실제 호출 IP를 확인하세요.',
    };
  }

  let obj = null;
  try { obj = JSON.parse(text); } catch {}

  if (obj && typeof obj === 'object') {
    const code = obj.code;
    const upperCode = typeof code === 'string' ? code.toUpperCase() : '';
    const msg = String(obj.message ?? obj.resultMessage ?? obj.errorMessage ?? obj.error ?? '');
    const rejectedIp = extractNotAllowedIp(msg);
    const hasErrorItems = Array.isArray(obj.data?.errorItems) && obj.data.errorItems.length > 0;

    if (status === 403 && rejectedIp) {
      return {
        ok: false,
        httpStatus: status,
        contentType,
        errorClass: 'COUPANG_GATEWAY_ACCESS_DENIED',
        akamaiReference: null,
        rejectedIp,
        json: obj,
        summary: `쿠팡 IP 미허용: ${rejectedIp}를 WING OPEN API IP 주소에 등록해야 합니다.`,
      };
    }

    if (upperCode === 'SUCCESS' && hasErrorItems) {
      return {
        ok: false,
        httpStatus: status,
        contentType,
        errorClass: 'COUPANG_CREATED_WITH_ERRORS',
        akamaiReference: null,
        rejectedIp: null,
        json: obj,
        summary: '생성됨(SUCCESS) 그러나 errorItems 존재 → 검수 필요',
      };
    }

    if (status >= 200 && status < 300 && (upperCode === 'SUCCESS' || !upperCode)) {
      return {
        ok: true,
        httpStatus: status,
        contentType,
        errorClass: null,
        akamaiReference: null,
        rejectedIp: null,
        json: obj,
        summary: upperCode === 'SUCCESS' ? '정상 응답(SUCCESS)' : summarizeJson(obj, '정상 응답'),
      };
    }

    return {
      ok: false,
      httpStatus: status,
      contentType,
      errorClass: 'COUPANG_API_JSON_ERROR',
      akamaiReference: null,
      rejectedIp: null,
      json: obj,
      summary: `API 오류: ${summarizeJson(obj, `HTTP ${status}`)}`,
    };
  }

  return {
    ok: status >= 200 && status < 300,
    httpStatus: status,
    contentType,
    errorClass: status >= 200 && status < 300 ? null : 'COUPANG_API_JSON_ERROR',
    akamaiReference: null,
    rejectedIp: null,
    json: null,
    summary: `HTTP ${status} (${contentType})`,
  };
}

function assertAllowedCall(method, apiPath) {
  if (!['GET', 'POST'].includes(method)) throw new Error('method not allowed');
  if (typeof apiPath !== 'string' || !apiPath.startsWith('/v2/providers/')) throw new Error('path not allowed');
  if (apiPath.includes('..')) throw new Error('path not allowed');
}

async function callCoupang(payload) {
  const method = String(payload.method || '').toUpperCase();
  const apiPath = String(payload.apiPath || '');
  const query = payload.query ? String(payload.query).replace(/^\?/, '') : '';
  const body = payload.body;
  assertAllowedCall(method, apiPath);

  const url = BASE_URL + apiPath + (query ? `?${query}` : '');
  const response = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json;charset=UTF-8',
      Authorization: sign(method, apiPath, query),
      'X-EXTENDED-Timeout': '90000',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const contentType = response.headers.get('content-type') || '';
  const text = await response.text();
  return normalizeCoupangResponse(response.status, contentType, text);
}

async function externalIp() {
  try {
    const r = await fetch('https://api.ipify.org?format=json', { cache: 'no-store' });
    const j = await r.json();
    return j.ip || null;
  } catch {
    return null;
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);

    if (req.method === 'GET' && url.pathname === '/health') {
      return json(res, 200, {
        ok: true,
        relay: true,
        egressIp: await externalIp(),
        credentialStatus: {
          accessKeySet: !!ACCESS_KEY,
          secretKeySet: !!SECRET_KEY,
          vendorIdSet: !!VENDOR_ID,
        },
      });
    }

    if (req.method === 'POST' && url.pathname === '/coupang/call') {
      if (!RELAY_SECRET || req.headers['x-relay-secret'] !== RELAY_SECRET) {
        return json(res, 401, { ok: false, summary: 'relay unauthorized' });
      }
      if (!ACCESS_KEY || !SECRET_KEY || !VENDOR_ID) {
        return json(res, 500, { ok: false, summary: 'relay env missing' });
      }
      const raw = await readBody(req);
      const payload = raw ? JSON.parse(raw) : {};
      const result = await callCoupang(payload);
      return json(res, 200, result);
    }

    return json(res, 404, { ok: false, summary: 'not found' });
  } catch (err) {
    return json(res, 500, { ok: false, summary: String(err && err.message ? err.message : err) });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Coupang relay listening on ${PORT}`);
});
