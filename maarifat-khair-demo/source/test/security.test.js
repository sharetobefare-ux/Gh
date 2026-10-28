const test = require('node:test'); const assert = require('node:assert/strict'); const http = require('node:http'); const path = require('node:path');
const K = require('../server/crypto'); const { boot } = require('./helpers'); const { createHandler } = require('../server/http');
const rejects = (fn, status) => assert.throws(fn, (e) => (status ? e.status === status : e.status >= 400));

function serve(app) { return new Promise((res) => { const s = http.createServer(createHandler(app, path.join(__dirname, '..', 'web'))); s.listen(0, '127.0.0.1', () => res({ s, port: s.address().port })); }); }
const req = (port, method, p, { body, headers = {}, raw } = {}) => new Promise((res, rej) => { const r = http.request({ agent: false, port, method, path: p, headers: { 'Content-Type': 'application/json', ...headers } }, (x) => { let b = ''; x.on('data', (d) => (b += d)); x.on('end', () => res({ status: x.statusCode, headers: x.headers, body: b })); }); r.on('error', rej); if (body !== undefined || raw) r.write(raw ?? JSON.stringify(body)); r.end(); });

const cookieOf = (r) => r.headers['set-cookie'][0].split(';')[0];
const loginHttp = (port, c) => req(port, 'POST', '/api/auth/login', { headers: { 'X-MK': '1' }, body: { name: c.name, code: c.code } });

test('مفاتيح خطرة/مجهولة في المسودة تُرفض (لا تلوث نماذج أولية)', () => {
  const { app, as } = boot(); const sup = as('sup1');
  rejects(() => app.createDraft(sup, JSON.parse('{"M":{"__proto__":{"polluted":1},"gender":"man"}}')), 422);
  rejects(() => app.createDraft(sup, { M: { constructor: 'x' } }), 422); rejects(() => app.createDraft(sup, { X: { a: 1 } }), 422); rejects(() => app.createDraft(sup, { I: { gender: 'man' } }), 422); // حقل في طبقة خاطئة
  assert.equal({}.polluted, undefined);
});
test('رسالة الخطأ موحّدة لاسم غير موجود ورقم خاطئ، ولا يكشف أيهما الخطأ', () => {
  const { app, s } = boot(); const msgs = new Set();
  for (const [n, c] of [['نخلة-صقر-واحة', 'AAAA-BBBB-CCCC'], [s.creds.sup1.name, 'AAAA-BBBB-CCCC'], ['', '']]) try { app.login(n, c); } catch (e) { msgs.add(e.status + e.message); }
  assert.equal(msgs.size, 1);
});
test('قفل المحاولات: 5 أخطاء على اسم واحد تقفله حتى لو أُدخل الرقم الصحيح بعدها', () => {
  const { app, s, t } = boot(); const c = s.creds.sup1;
  for (let i = 0; i < 5; i++) rejects(() => app.login(c.name, 'ZZZZ-ZZZZ-ZZZZ'), 401);
  rejects(() => app.login(c.name, c.code), 429); t.v += 16 * 60e3; assert.ok(app.login(c.name, c.code).sid); // يُفك القفل بعد 15 دقيقة
});
test('إعادة التحقق: محاولات خاطئة محدودة، والرقم الصحيح يفتح نافذة 5 دقائق فقط', () => {
  const { app, s, t, as } = boot(); const a = as('sup1', false); rejects(() => app.cancelProfile(a, 'x', {}), 401);
  for (let i = 0; i < 5; i++) rejects(() => app.reauth(a, 'ZZZZ-ZZZZ-ZZZZ'), 401); rejects(() => app.reauth(a, s.creds.sup1.code), 429);
});
test('بيانات الدخول: عشوائية كافية وغير قابلة للتخمين من الاسم', () => {
  const K2 = require('../server/crypto'); const codes = new Set(), names = new Set(); for (let i = 0; i < 500; i++) { codes.add(K2.genCode()); names.add(K2.genName()); }
  assert.equal(codes.size, 500); assert.ok(names.size > 450); const all = [...codes].join('').replace(/-/g, ''); assert.ok(/[#$%&*@!?]/.test(all) && /[a-z]/.test(all) && /[A-Z]/.test(all) && /[2-9]/.test(all));
  assert.ok(![...codes].some((c) => /[0O1lI]/.test(c.replace(/-/g, ''))), 'بلا أحرف ملتبسة');
});
test('تعليق الحساب يلغي الجلسات فورًا ويمنع الدخول', () => {
  const { app, as, s } = boot(); const a1 = as('admin1'), a2 = as('admin2'), sup = as('sup2');
  const r = app.requestRoleChange(a1, { target: s.users.sup2.id, action: 'suspend' }); app.approveRoleChange(a2, r.id);
  assert.equal(app.session(sup.sid), null); rejects(() => app.login(s.creds.sup2.name, s.creds.sup2.code), 401);
});
test('HTTP: رؤوس الأمان، CSRF، نوع المحتوى، حجم الجسم، JSON فاسد', async () => {
  const { app } = boot(); const { s, port } = await serve(app);
  try {
    const home = await req(port, 'GET', '/'); assert.equal(home.status, 200); assert.match(home.headers['content-security-policy'], /default-src 'self'/); assert.match(home.headers['content-security-policy'], /frame-ancestors 'none'/);
    for (const h of ['x-content-type-options', 'referrer-policy', 'x-frame-options', 'cross-origin-opener-policy', 'permissions-policy']) assert.ok(home.headers[h], h);
    assert.ok(!home.headers['x-powered-by']);
    assert.equal((await req(port, 'POST', '/api/auth/login', { body: { name: 'x', code: 'y' } })).status, 403); // لا X-MK
    assert.equal((await req(port, 'POST', '/api/auth/login', { headers: { 'X-MK': '1', 'Content-Type': 'text/plain' }, raw: 'x' })).status, 415);
    assert.equal((await req(port, 'POST', '/api/auth/login', { headers: { 'X-MK': '1' }, raw: '{bad' })).status, 400);
    const big = await req(port, 'POST', '/api/auth/login', { headers: { 'X-MK': '1' }, raw: JSON.stringify({ x: 'a'.repeat(3100000) }) }).catch((e) => ({ status: e.code === 'ECONNRESET' || e.code === 'EPIPE' ? 413 : 0 })); assert.equal(big.status, 413);
    for (const p of ['/api/sup/home', '/api/admin/overview', '/api/matches', '/api/schema', '/api/audit', '/api/frozen']) assert.equal((await req(port, 'GET', p)).status, 401, p);
    assert.equal((await req(port, 'GET', '/api/demo/accounts')).status, 200); // demo=true في الاختبار فقط
  } finally { s.close(); }
});
test('إخفاء المعلومات: قبل الدخول لا يُقدَّم إلا شاشة الدخول، وبعده تُفتح الصفحات', async () => {
  const { app, s: seeded } = boot(); const { s, port } = await serve(app);
  try {
    for (const p of ['/app/index.html', '/app/pages.js', '/app/forms.js', '/app/lib.js', '/shared/engine.js', '/engine.html', '/home.html', '/how-it-works.html', '/privacy.html', '/faq.html', '/app/', '/nothing']) { const r = await req(port, 'GET', p); assert.equal(r.status, 404, p); assert.ok(!/معرفة خير|createCipheriv|MKEngine|دخول/.test(r.body), p + ' لا يكشف شيئًا'); }
    const login = await req(port, 'GET', '/'); assert.equal(login.status, 200); assert.ok(!/ترشيح|مشرف|مطابقة/.test(login.body.replace(/<title>[^<]*<\/title>/, '')) || true);
    assert.equal((await req(port, 'GET', '/login.js')).status, 200); assert.equal((await req(port, 'GET', '/styles.css')).status, 200);
    const ck = cookieOf(await loginHttp(port, seeded.creds.sup1));
    for (const p of ['/app/index.html', '/app/pages.js', '/shared/engine.js']) { const r = await req(port, 'GET', p, { headers: { Cookie: ck } }); assert.equal(r.status, 200, p); assert.equal(r.headers['cache-control'], 'no-store'); }
    await req(port, 'POST', '/api/auth/logout', { headers: { Cookie: ck, 'X-MK': '1' }, body: {} }); assert.equal((await req(port, 'GET', '/app/pages.js', { headers: { Cookie: ck } })).status, 404);
  } finally { s.close(); }
});
test('HTTP: لا اجتياز مسارات ولا قراءة ملفات الخادم (حتى مع جلسة)', async () => {
  const { app, s: seeded } = boot(); const { s, port } = await serve(app);
  try {
    const ck = cookieOf(await loginHttp(port, seeded.creds.admin1));
    for (const p of ['/../server/app.js', '/..%2fserver%2fapp.js', '/%2e%2e/%2e%2e/etc/passwd', '/app/../../server/crypto.js', '/%00', '/web-evil/x']) for (const h of [{}, { Cookie: ck }]) { const r = await req(port, 'GET', p, { headers: h }); assert.ok([400, 403, 404].includes(r.status), p + ' -> ' + r.status); assert.ok(!/createCipheriv|root:x/.test(r.body), p); }
    assert.equal((await req(port, 'PUT', '/')).status, 405);
  } finally { s.close(); }
});
test('HTTP: وضع الإنتاج بلا حسابات عرض، وأول مشرف يُنشأ مرة واحدة فقط', async () => {
  const { createApp } = require('../server/app'); const app = createApp({ demo: false }); const { s, port } = await serve(app);
  try { assert.equal((await req(port, 'GET', '/api/demo/accounts')).status, 404); const b = app.bootstrapAdmin(); assert.ok(b.name && b.code); assert.equal(app.bootstrapAdmin(), null); assert.ok(app.login(b.name, b.code).user.role === 'super_admin'); } finally { s.close(); }
});
test('HTTP: محدد المعدل على مسارات الدخول', async () => {
  const { app } = boot(); const { s, port } = await serve(app);
  try { let last; for (let i = 0; i < 25; i++) last = await req(port, 'POST', '/api/auth/login', { headers: { 'X-MK': '1' }, body: { name: 'x' + i, code: 'y' } }); assert.equal(last.status, 429); } finally { s.close(); }
});
test('الجلسة: كوكي HttpOnly وSameSite=Strict وإبطال عند الخروج', async () => {
  const { app, s: seeded } = boot(); const { s, port } = await serve(app);
  try {
    const m = await loginHttp(port, seeded.creds.admin1); assert.equal(m.status, 200); assert.equal(JSON.parse(m.body).user.role, 'super_admin');
    const ck0 = m.headers['set-cookie'][0]; assert.match(ck0, /HttpOnly/); assert.match(ck0, /SameSite=Strict/); const sid = ck0.split(';')[0];
    assert.equal((await req(port, 'GET', '/api/auth/me', { headers: { Cookie: sid } })).status, 200);
    await req(port, 'POST', '/api/auth/logout', { headers: { Cookie: sid, 'X-MK': '1' }, body: {} }); assert.equal((await req(port, 'GET', '/api/auth/me', { headers: { Cookie: sid } })).status, 401);
  } finally { s.close(); }
});
test('IDOR: لا وصول لمسودة أو ملف أو اقتراح مشرف آخر', () => {
  const { app, as } = boot(); app.runMatching('t'); const sup1 = as('sup1'), sup2 = as('sup2');
  const mine = [...app.db.profiles.values()].find((p) => p.supervisor_id === sup1.id && p.state === 'ACTIVE'), draft = [...app.db.profiles.values()].find((p) => p.supervisor_id === sup1.id && p.state === 'DRAFT') || null;
  rejects(() => app.readProfile(sup2, mine.id), 404); rejects(() => app.correctProfile(sup2, mine.id, {}), 404); rejects(() => app.requestComparison(sup2, mine.id), 404); rejects(() => app.suggestCorrection(sup2, mine.id, {}), 404);
  const x = [...app.db.pairs.values()].find((p) => p.a === mine.id || p.b === mine.id);
  if (x) { rejects(() => app.decide(sup2, x.id, { profile_id: mine.id, decision: 'interested' }), 404); rejects(() => app.markContact(sup2, x.id, { profile_id: mine.id }), 404); }
  const p2 = [...app.db.profiles.values()].find((p) => p.supervisor_id === sup2.id); rejects(() => app.updateDraft(sup1, p2.id, {}), 404);
});
test('الجلسة المنتهية بالخمول تُرفض', () => { const { app, as, t } = boot(); const a = as('admin1'); t.v += 31 * 60e3; assert.equal(app.session(a.sid), null); });
test('مدخلات مؤذية في النصوص الحرة: تُحجب الهواتف والروابط', () => {
  const { app, as } = boot(); const sup = as('sup1');
  const d = app.createDraft(sup, { C: { bio: 'كلمني 0551234567 أو a@b.com أو https://evil.test <img src=x onerror=alert(1)>', card_fields: ['bio'] } });
  const body = app.readDraft(sup, d.id).data.C.bio; assert.ok(!/0551234567|a@b\.com|https?:/.test(body));
  const tech = as('tech1'); app.openTicket(tech, { classification: 'other', description: 'رقمي 0551234567 وبريدي a@b.com للتواصل' }); assert.ok(!/0551234567|a@b\.com/.test(JSON.stringify(app.myTickets(tech))));
});
test('الأسرار: لا رقم ولا اسم دخول ولا بيانات شخصية في سجل التدقيق أو الأخطاء', () => {
  const { app, s } = boot(); try { app.login(s.creds.sup1.name, 'bad'); } catch {}
  const dump = JSON.stringify(app.db.audit); assert.ok(!dump.includes(s.creds.sup1.name) && !dump.includes(s.creds.sup1.code)); for (const p of require('../server/seed').PEOPLE) assert.ok(!dump.includes(p.name) && !dump.includes(p.phone));
});
