'use strict';
const fs = require('node:fs'), path = require('node:path');
const { createCore } = require('./core');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.json': 'application/json', '.png': 'image/png', '.ico': 'image/x-icon', '.txt': 'text/plain; charset=utf-8' };
const CSP = "default-src 'self'; img-src 'self' data:; style-src 'self'; script-src 'self'; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'; object-src 'none'";
const SEC = { 'Content-Security-Policy': CSP, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', 'X-Frame-Options': 'DENY', 'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()', 'Cross-Origin-Opener-Policy': 'same-origin', 'Cross-Origin-Resource-Policy': 'same-origin' };
if (process.env.MK_SECURE) SEC['Strict-Transport-Security'] = 'max-age=31536000; includeSubDomains';

// الأصول العامة الوحيدة قبل تسجيل الدخول: شاشة الدخول وما تحتاجه لعرضها
const PUBLIC_STATIC = /^\/(index\.html|login\.js|styles\.css|fonts\/noto-(400|500|700)\.woff2|assets\/(favicon|logo-symbol)\.svg)?$/;
const NOT_FOUND_PAGE = '<!doctype html><meta charset="utf-8"><meta name="robots" content="noindex"><title>غير موجود</title><p style="font-family:sans-serif;padding:2rem">غير موجود</p>';

// محدد معدل بسيط لكل عنوان IP (نافذة ثابتة). في الإنتاج: على مستوى البوابة/WAF أيضًا.
function limiter() {
  const m = new Map();
  return (key, max, ms = 60e3) => { const now = Date.now(); let e = m.get(key); if (!e || now - e.t > ms) e = { n: 0, t: now }; e.n++; m.set(key, e); if (m.size > 5000) for (const [k, v] of m) if (now - v.t > ms) m.delete(k); return e.n <= max; };
}

function createHandler(app, webRoot, opts = {}) {
  const core = createCore(app), allow = limiter(); const root = path.resolve(webRoot) + path.sep;
  const sharedEngine = path.join(__dirname, 'matching', 'engine.js');
  const cookies = (req) => Object.fromEntries((req.headers.cookie || '').split(/;\s*/).filter(Boolean).map((s) => { const i = s.indexOf('='); try { return [s.slice(0, i), decodeURIComponent(s.slice(i + 1))]; } catch { return [s.slice(0, i), '']; } }));
  const ipOf = (req) => (opts.trustProxy ? String(req.headers['x-forwarded-for'] || '').split(',')[0].trim() : '') || req.socket.remoteAddress || '?';
  return async function handler(req, res) {
    const url = new URL(req.url, 'http://x');
    const send = (status, body, headers = {}) => { res.writeHead(status, { ...SEC, ...headers }); res.end(body); };
    const J = { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' };
    try {
      if (url.pathname.startsWith('/api/')) {
        const ip = ipOf(req), sensitive = /^\/api\/(auth|invitations)\//.test(url.pathname);
        if (!allow('g:' + ip, 600) || (sensitive && !allow('s:' + ip, 20))) return send(429, JSON.stringify({ error: 'RATE_LIMIT', message: 'طلبات كثيرة. حاول بعد قليل' }), { ...J, 'Retry-After': '60' });
        if (req.method !== 'GET' && !(req.headers['content-type'] || '').startsWith('application/json')) return send(415, JSON.stringify({ error: 'UNSUPPORTED_MEDIA_TYPE' }), J);
        let body = {};
        if (req.method !== 'GET') { const chunks = []; let n = 0; for await (const ch of req) { n += ch.length; if (n > 100e3) return send(413, JSON.stringify({ error: 'TOO_LARGE' }), J); chunks.push(ch); } try { body = chunks.length ? JSON.parse(Buffer.concat(chunks)) : {}; } catch { return send(400, JSON.stringify({ error: 'BAD_JSON' }), J); } }
        const r = await core({ method: req.method, pathname: url.pathname, query: url.searchParams, body, sid: cookies(req).mk_sid, headers: { 'x-mk': req.headers['x-mk'] } });
        const extra = {};
        if (r.setSid !== undefined) extra['Set-Cookie'] = `mk_sid=${r.setSid || ''}; HttpOnly; SameSite=Strict; Path=/; ${r.setSid ? 'Max-Age=28800' : 'Max-Age=0'}${process.env.MK_SECURE ? '; Secure' : ''}`;
        return send(r.status, JSON.stringify(r.json), { ...J, ...extra });
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return send(405, 'method not allowed', { Allow: 'GET, HEAD' });
      // ملفات ثابتة: قبل الدخول لا يظهر إلا شاشة الدخول وأصولها. كل ما عداها لا يُقدَّم إلا لجلسة صالحة،
      // ويُرد 404 موحد لغير المصرح لئلا يُعرف ما هو موجود.
      const needSession = !PUBLIC_STATIC.test(url.pathname);
      if (needSession && !app.session(cookies(req).mk_sid)) return send(404, NOT_FOUND_PAGE, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' });
      if (url.pathname === '/shared/engine.js') return send(200, fs.readFileSync(sharedEngine), { 'Content-Type': MIME['.js'], 'Cache-Control': 'no-store' }); // نفس ملف المحرك للمتصفح
      let p; try { p = decodeURIComponent(url.pathname); } catch { return send(400, 'bad request'); }
      if (p.includes('\0')) return send(400, 'bad request');
      if (p.endsWith('/')) p += 'index.html';
      let target = path.resolve(root, '.' + path.posix.normalize('/' + p));
      if (!target.startsWith(root)) return send(403, 'forbidden'); // منع اجتياز المسارات (مع فاصل المسار)
      if (!fs.existsSync(target) && !path.extname(target) && fs.existsSync(target + '.html')) target += '.html';
      if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) return send(404, NOT_FOUND_PAGE, { 'Content-Type': MIME['.html'], 'Cache-Control': 'no-store' });
      return send(200, fs.readFileSync(target), { 'Content-Type': MIME[path.extname(target)] || 'application/octet-stream', 'Cache-Control': needSession ? 'no-store' : path.extname(target) === '.woff2' ? 'public, max-age=31536000, immutable' : 'no-cache' });
    } catch (e) {
      console.error('internal error:', e.code || e.name);
      return send(500, JSON.stringify({ error: 'INTERNAL', message: 'حدث خطأ عام' }), J);
    }
  };
}
module.exports = { createHandler, SEC, CSP };
