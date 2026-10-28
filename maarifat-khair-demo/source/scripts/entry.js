import { Buffer } from 'buffer';
globalThis.Buffer = Buffer;
const ts = Buffer.prototype.toString;
Buffer.prototype.toString = function (enc, a, b) { return enc === 'base64url' ? ts.call(this, 'base64', a, b).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : ts.call(this, enc, a, b); };
const { createApp } = require('../server/app'), { seed } = require('../server/seed'), { createCore } = require('../server/core');
const demo = true;
const app = createApp({ demo, minCell: 1 }); seed(app, { scenario: true });
const core = createCore(app); let sid = null;
setInterval(() => { app.expirePairs(); app.purgeDue(); }, 60e3);
const realFetch = globalThis.fetch.bind(globalThis);
globalThis.fetch = async (url, opt = {}) => {
  const u = new URL(url, location.href);
  if (!u.pathname.includes('/api/')) return realFetch(url, opt);
  const pathname = u.pathname.slice(u.pathname.indexOf('/api/'));
  const headers = Object.fromEntries(Object.entries(opt.headers || {}).map(([k, v]) => [k.toLowerCase(), v]));
  let body; try { body = opt.body ? JSON.parse(opt.body) : {}; } catch { return new Response('{"error":"BAD_JSON"}', { status: 400 }); }
  const r = await core({ method: (opt.method || 'GET').toUpperCase(), pathname, query: u.searchParams, body, sid, headers });
  if (r.setSid !== undefined) sid = r.setSid || null;
  return new Response(JSON.stringify(r.json), { status: r.status, headers: { 'Content-Type': 'application/json' } });
};
globalThis.MK_BROWSER_DEMO = true;
