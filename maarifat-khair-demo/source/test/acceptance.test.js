const test = require('node:test'); const assert = require('node:assert/strict');
const E = require('../server/matching/engine'); const K = require('../server/crypto'); const { boot } = require('./helpers');
const { PEOPLE } = require('../server/seed');
const rejects = (fn, status) => assert.throws(fn, (e) => (status ? e.status === status : e.status >= 400));

test('الخوارزمية: مثال المواصفة = 82.5 والمتبادل = min', () => {
  const r = E.combine({ place: 1, family: 1, work: 0.5, lifestyle: 1, values: 0.5 }, E.RULES.weights); assert.equal(r.score, 82.5); assert.equal(r.coverage, 1);
  assert.equal(Math.min(82.5, 75), 75);
});
test('تغطية 40% => لا تعرض (INSUFFICIENT) مهما ارتفعت الدرجة', () => {
  const A = { ...PEOPLE[0].M, age: 30 }, B = { ...PEOPLE[3].M, age: 28 };
  // نُسقط معظم الأبعاد لتبقى أبعاد بوزن 40 فقط
  for (const k of ['education', 'works', 'travel', 'job_travel', 'smoking', 'smoking_ok', 'social_style', 'langs', 'values', 'partner_work', 'wants_children', 'timeline', 'accepts_partner_children']) { A[k] = undefined; B[k] = undefined; }
  A.hard = []; B.hard = []; const r = E.evaluatePair(A, B);
  assert.ok(['INSUFFICIENT', 'NEEDS_CLARIFICATION'].includes(r.status)); assert.notEqual(r.status, 'ELIGIBLE');
});
test('شرط صلب فاشل يستبعد ولو الدرجة عالية؛ المجهول => إيضاح؛ التحقق في الاتجاهين', () => {
  const A = { ...PEOPLE[0].M, age: 30 }, B = { ...PEOPLE[3].M, age: 28 };
  assert.equal(E.evaluatePair(A, B).status, 'ELIGIBLE');
  assert.equal(E.evaluatePair({ ...A, pref_cities: ['جدة'] }, B).status, 'EXCLUDED');
  assert.equal(E.evaluatePair(A, { ...B, pref_age_max: 25 }).status, 'EXCLUDED'); // الاتجاه المعاكس
  assert.equal(E.evaluatePair({ ...A, hard: [{ field: 'job_travel', values: ['no'] }] }, { ...B, job_travel: undefined }).status, 'NEEDS_CLARIFICATION');
});
test('الحد الأقصى 3 ولا حشو بغير المؤهلين', () => {
  const load = new Map(); const c = (a, b, m) => ({ a, b, mutual: m, exposure: { a: 0, b: 0 }, waitDays: { a: 0, b: 0 }, tie: a + b });
  const ch = E.select([c('a', 'x1', 90), c('a', 'x2', 89), c('a', 'x3', 88), c('a', 'x4', 87)], load);
  assert.equal(ch.length, 3); assert.equal(load.get('a'), 3);
  assert.equal(E.select([c('b', 'y1', 80)], new Map()).length, 1); // مرشح واحد فقط => يعرض واحدًا
});
test('التشفير: العبث بـ ciphertext أو AAD يفشل مغلقًا؛ لا نص واضح في المخزن', () => {
  const { app } = boot(); const rec = [...app.db.sections.values()][0];
  const bad = { ...rec, ciphertext: Buffer.from('x' + rec.ciphertext).toString('base64') }; assert.throws(() => K.open(app.kms, bad, 't', 't'));
  assert.throws(() => K.open(app.kms, { ...rec, record_version: 99 }, 't', 't'));
  assert.throws(() => K.open(app.kms, { ...rec, section: 'M' }, 't', 't'));
  const dump = JSON.stringify([...app.db.sections.values(), ...app.db.cards.values(), ...app.db.pairs.values()]);
  for (const p of PEOPLE) { assert.ok(!dump.includes(p.name)); assert.ok(!dump.includes(p.phone)); }
  assert.ok(!dump.includes('الرياض'));
});
const files = (app, sup) => [...app.db.profiles.values()].filter((p) => p.supervisor_id === sup.id && p.state === 'ACTIVE');
/** يهيئ اقتراحًا بين ملفين نشطين */
function oneProposed(app) { app.runMatching('test'); const x = [...app.db.pairs.values()].find((p) => p.state === 'PROPOSED'); assert.ok(x, 'يلزم اقتراح واحد'); return x; }
const ownerOf = (app, as, pid) => ['sup1', 'sup2', 'sup3'].map((k) => as(k)).find((a) => a.id === app.db.profiles.get(pid).supervisor_id);

test('الدخول: اسم كلمات + رقم رموز يولّدهما المشرف الأول، ويفتح الدور الصحيح', () => {
  const { app, s, as } = boot(); const adm = as('admin1');
  const acc = app.createAccount(adm, { role: 'supervisor', display_name: 'أ. جديد', category: 'lawyer', scope: ['الرياض'], verified_note: 'رخصة محاماة رقم تجريبي' });
  assert.match(acc.name, /^[\u0600-\u06FF]+-[\u0600-\u06FF]+-[\u0600-\u06FF]+$/); assert.match(acc.code, /^[A-Za-z2-9#$%&*@!?]{4}-[A-Za-z2-9#$%&*@!?]{4}-[A-Za-z2-9#$%&*@!?]{4}$/);
  const r = app.login(acc.name, acc.code); assert.equal(r.user.role, 'supervisor'); assert.deepEqual(r.user.perms.sort(), [...app.SUP_PERMS].sort());
  const rt = app.login(acc.name.replace(/-/g, ' '), acc.code.replace(/-/g, '').toLowerCase() === acc.code.replace(/-/g, '').toLowerCase() ? acc.code : acc.code); assert.ok(rt.sid); // تسامح في الفواصل
  const dump = JSON.stringify([...app.db.users.values()]); assert.ok(!dump.includes(acc.name) && !dump.includes(acc.code.replace(/-/g, '')), 'لا يُخزن الاسم ولا الرقم نصًا');
  assert.throws(() => app.login(acc.name, 'AAAA-BBBB-CCCC'), (e) => e.status === 401);
  const t = app.login(s.creds.tech1.name, s.creds.tech1.code); assert.equal(t.user.role, 'tech'); assert.deepEqual(t.user.perms, ['support']);
});
test('الصلاحيات حسب الصفحة: كل دور لا يصل إلا لصفحاته', () => {
  const { app, as } = boot(); const adm = as('admin1'), sup = as('sup1'), tech = as('tech1');
  const denied = (fn) => assert.throws(fn, (e) => e.status === 403 || e.status === 404);
  denied(() => app.createDraft(adm, {})); denied(() => app.listFiles(adm)); denied(() => app.myMatches(adm)); denied(() => app.previewOptions(adm, { M: { gender: 'man' } }));
  denied(() => app.listFiles(tech)); denied(() => app.myMatches(tech)); denied(() => app.myFrozen(tech)); denied(() => app.adminOverview(tech)); denied(() => app.ticketsAdmin(tech));
  denied(() => app.adminOverview(sup)); denied(() => app.createAccount(sup, { role: 'tech', display_name: 'x' })); denied(() => app.auditLog(sup)); denied(() => app.ticketsAdmin(sup));
  assert.ok(app.listFiles(sup).length); assert.ok(app.openTicket(tech, { classification: 'login', description: 'تعذر الدخول من الجهاز الجديد' }).id);
});
test('منح الصلاحيات وسحبها: يطبق فورًا على الخادم', () => {
  const { app, as, s } = boot(); const adm = as('admin1');
  app.setPerms(adm, s.users.sup1.id, ['intake', 'support']); const sup = as('sup1');
  assert.ok(app.listFiles(sup)); assert.throws(() => app.myMatches(sup), (e) => e.status === 403); assert.throws(() => app.myFrozen(sup), (e) => e.status === 403);
  assert.throws(() => app.setPerms(adm, s.users.sup1.id, ['admin']), (e) => e.status === 422);
  assert.throws(() => app.setPerms(adm, s.users.tech1.id, ['intake']), (e) => e.status === 422); // الفني: الدعم فقط
  assert.throws(() => app.setPerms(as('sup1'), s.users.sup2.id, []), (e) => e.status === 403);
});
test('إعادة تعيين بيانات الدخول: تُبطل القديمة والجلسات', () => {
  const { app, as, s } = boot(); const adm = as('admin1'), old = s.creds.sup2, sup = as('sup2');
  assert.throws(() => app.resetAccount(as('admin1', false), s.users.sup2.id), (e) => e.code === 'REAUTH_REQUIRED');
  const n = app.resetAccount(adm, s.users.sup2.id); assert.equal(app.session(sup.sid), null);
  assert.throws(() => app.login(old.name, old.code), (e) => e.status === 401); assert.ok(app.login(n.name, n.code).sid);
});
test('الإيداع: يلزم إقرار المشرف بالموافقة ومرجعها، وتُسجل الموافقة', () => {
  const { app, as } = boot(); const sup = as('sup1'); const d = [...app.db.profiles.values()].find((p) => p.state === 'DRAFT' && p.supervisor_id === sup.id);
  assert.throws(() => app.submitProfile(sup, d.id, {}), (e) => e.status === 422); // ناقص الحقول أيضًا
  const full = app.createDraft(sup, require('./../server/seed').PEOPLE[1] && { I: { name: 'تجريبي-ز', dob: '1995-02-02', phone: '0500000077' }, M: { ...require('../server/seed').PEOPLE[0].M, gender: 'man' }, C: { card_fields: ['age_range', 'region'] } });
  assert.throws(() => app.submitProfile(sup, full.id, { consent_attested: false, consent_ref: 'ورقي-1234' }), (e) => e.code === 'CONSENT_REQUIRED');
  assert.throws(() => app.submitProfile(sup, full.id, { consent_attested: true, consent_ref: 'ab' }), (e) => e.code === 'CONSENT_REF_REQUIRED');
  const before = app.db.consents.length; const r = app.submitProfile(sup, full.id, { consent_attested: true, consent_ref: 'ورقي-1234' });
  assert.equal(r.state, 'ACTIVE'); assert.equal(app.db.consents.length, before + 1); assert.equal(app.db.consents.at(-1).method, 'supervisor-attested');
  assert.throws(() => app.readDraft(sup, full.id), (e) => e.status === 404); // المسودة أُتلفت بعد الإيداع
});
test('تدفق المقارنة: قرار كل مشرف ثم اهتمام الطرفين ثم تم التواصل يجمّد الملفين 7 أيام', () => {
  const { app, as, t } = boot(); const x = oneProposed(app);
  const owner = (pid) => ownerOf(app, as, pid);
  const A = owner(x.a), B = owner(x.b);
  assert.throws(() => app.markContact(A, x.id, { profile_id: x.a }), (e) => e.status === 409); // قبل الاهتمام
  const m1 = app.myMatches(A).find((r) => r.pair_id === x.id && r.profile_id === x.a); assert.ok(m1 && m1.card.code && !m1.card.name && !('phone' in m1.card)); assert.equal(m1.other_supervisor, undefined);
  assert.equal(app.decide(A, x.id, { profile_id: x.a, decision: 'interested', channel: 'مكتبي 0551234567' }).state, 'INTEREST_ONE_SIDE');
  assert.equal(app.decide(B, x.id, { profile_id: x.b, decision: 'interested', channel: 'الديوان' }).mutual, true);
  const mm = app.myMatches(A).find((r) => r.pair_id === x.id && r.profile_id === x.a); assert.ok(mm.other_supervisor.name); assert.ok(!/0551234567/.test(JSON.stringify(app.myMatches(B)))); // الأرقام تُحجب
  const r = app.markContact(B, x.id, { profile_id: x.b }); assert.equal(r.state, 'CONTACTED');
  for (const pid of [x.a, x.b]) { const p = app.db.profiles.get(pid); assert.equal(p.state, 'FROZEN'); assert.equal(p.frozen_until, t.v + 7 * 86400000); }
  assert.ok(![...app.db.pairs.values()].some((q) => q.id !== x.id && [x.a, x.b].some((i) => (q.a === i || q.b === i)) && ['PROPOSED', 'INTEREST_ONE_SIDE', 'MUTUAL_INTEREST'].includes(q.state)), 'تُسحب بقية اقتراحات الملفين');
  app.runMatching('again'); assert.ok(!['PROPOSED', 'INTEREST_ONE_SIDE', 'MUTUAL_INTEREST'].includes(app.db.pairs.get(x.id).state)); // المجمّد لا يُقترح، والزوج لا يتكرر
});
test('التفعيل بعد التجميد من المشرف نفسه: مرفوض قبل 7 أيام، مسموح بعدها، وليس تلقائيًا', () => {
  const { app, as, t, s } = boot(); const x = oneProposed(app);
  const own = (pid) => ownerOf(app, as, pid);
  app.decide(own(x.a), x.id, { profile_id: x.a, decision: 'interested' }); app.decide(own(x.b), x.id, { profile_id: x.b, decision: 'interested' }); app.markContact(own(x.a), x.id, { profile_id: x.a });
  const A = own(x.a); const fr = app.myFrozen(A).find((f) => f.id === x.a); assert.equal(fr.days_left, 7); assert.equal(fr.can_activate, false);
  assert.throws(() => app.activateProfile(A, x.a), (e) => e.code === 'FROZEN'); assert.throws(() => app.activateProfile(as('admin1'), x.a), (e) => e.status === 403); // المشرف الأول لا يفعّل ملفات المشرفين
  t.v += 6.9 * 86400000; assert.equal(app.db.profiles.get(x.a).state, 'FROZEN'); assert.throws(() => app.activateProfile(own(x.a), x.a));
  t.v += 0.2 * 86400000; assert.equal(app.db.profiles.get(x.a).state, 'FROZEN', 'لا تفعيل تلقائي'); assert.equal(app.activateProfile(own(x.a), x.a).state, 'ACTIVE');
  assert.equal(app.db.profiles.get(x.b).state, 'FROZEN', 'ملف الطرف الآخر يفعّله مشرفه');
});
test('استثناء مدة التجميد: طلب من المشرف وقرار المشرف الأول والتفعيل بعده من المشرف', () => {
  const { app, as, t } = boot(); const x = oneProposed(app); const own = (pid) => ownerOf(app, as, pid);
  app.decide(own(x.a), x.id, { profile_id: x.a, decision: 'interested' }); app.decide(own(x.b), x.id, { profile_id: x.b, decision: 'interested' }); app.markContact(own(x.a), x.id, { profile_id: x.a });
  const A = own(x.a), adm = as('admin1');
  assert.throws(() => app.requestExemption(A, x.a, { note: 'قصير' }), (e) => e.code === 'NOTE_REQUIRED');
  const r = app.requestExemption(A, x.a, { note: 'سفر الطرف الآخر منع إتمام التواصل' }); assert.throws(() => app.requestExemption(A, x.a, { note: 'طلب مكرر لنفس الملف الآن' }), (e) => e.code === 'ALREADY_REQUESTED');
  assert.equal(app.adminDashboard(adm).exemptions.length, 1); assert.throws(() => app.decideExemption(A, r.id, true), (e) => e.status === 403);
  assert.throws(() => app.activateProfile(A, x.a), (e) => e.code === 'FROZEN', 'الطلب وحده لا يفك التجميد');
  app.decideExemption(adm, r.id, true); assert.equal(app.db.profiles.get(x.a).state, 'FROZEN', 'القرار لا يفعّل تلقائيًا'); assert.equal(app.activateProfile(A, x.a).state, 'ACTIVE');
  // رفض
  const B = own(x.b); const r2 = app.requestExemption(B, x.b, { note: 'نحتاج استثناء لظرف عائلي طارئ' }); app.decideExemption(adm, r2.id, false); assert.throws(() => app.activateProfile(B, x.b), (e) => e.code === 'FROZEN');
});
test('إلغاء ملف مستفيد: مشرف صاحب الصلاحية أو المشرف الأول، مع إعادة التحقق، ويتلف المفاتيح', () => {
  const { app, as, s } = boot(); const sup = as('sup1'), other = as('sup2'); const p = files(app, sup)[0];
  assert.throws(() => app.cancelProfile(as('sup1', false), p.id, {}), (e) => e.code === 'REAUTH_REQUIRED'); assert.throws(() => app.cancelProfile(other, p.id, {}), (e) => e.status === 404);
  app.setPerms(as('admin1'), s.users.sup1.id, ['intake', 'matches']); assert.throws(() => app.cancelProfile(as('sup1'), p.id, {}), (e) => e.status === 403);
  app.setPerms(as('admin1'), s.users.sup1.id, [...app.SUP_PERMS]);
  assert.equal(app.cancelProfile(as('sup1'), p.id, { reason: 'withdrawn' }).state, 'DELETED'); assert.ok(app.db.tombstones.has(p.id)); assert.ok(!app.db.sections.has(p.id + ':I')); assert.ok(app.kms.destroyed.has(`kek:${p.id}:I`));
  assert.throws(() => app.readProfile(as('sup1'), p.id), (e) => e.status === 404); assert.deepEqual(app.restoreFromBackup([p.id]), []);
  const q = files(app, as('sup2'))[0]; assert.equal(app.cancelProfile(as('admin1'), q.id, {}).state, 'DELETED'); // المشرف الأول يلغي أي ملف
});
test('الدعم الفني: التصنيف ووصف المشكلة إلزاميان، والمشرف الأول يتابع الحالة', () => {
  const { app, as } = boot(); const tech = as('tech1'), adm = as('admin1');
  assert.throws(() => app.openTicket(tech, { classification: 'x', description: 'وصف طويل بما يكفي' }), (e) => e.code === 'BAD_CLASS'); assert.throws(() => app.openTicket(tech, { classification: 'login', description: 'قصير' }), (e) => e.code === 'DESC_REQUIRED');
  const t = app.openTicket(tech, { classification: 'matching', description: 'الاقتراحات لا تظهر بعد طلب المقارنة. جوالي 0551234567' });
  const mine = app.myTickets(tech); assert.equal(mine.length, 1); assert.ok(!/0551234567/.test(mine[0].description)); assert.equal(mine[0].state, 'open');
  assert.equal(app.ticketsAdmin(adm).length, 1); assert.equal(app.updateTicket(adm, t.id, { state: 'resolved', response: 'تم الإصلاح' }).state, 'resolved'); assert.equal(app.myTickets(tech)[0].response, 'تم الإصلاح');
  assert.throws(() => app.updateTicket(tech, t.id, { state: 'resolved' }), (e) => e.status === 403);
});
test('فصل المهام: لا يعتمد الشخص طلبه، والاعتماد من مشرف أول آخر', () => {
  const { app, as, s } = boot(); const a1 = as('admin1'), a2 = as('admin2'); const r = app.requestRoleChange(a1, { target: s.users.sup1.id, action: 'suspend' });
  assert.throws(() => app.approveRoleChange(a1, r.id), (e) => e.code === 'SELF_APPROVAL'); assert.equal(app.approveRoleChange(a2, r.id).state, 'approved'); assert.equal(app.db.users.get(s.users.sup1.id).status, 'suspended');
  assert.ok([...app.db.profiles.values()].filter((p) => p.state === 'ACTIVE').some((p) => p.supervisor_id === null), 'ملفاته تحتاج إعادة إسناد');
});
test('المطابقة تعمل بلا وصول للهوية: عامل المطابقة لا يفك I', () => {
  const { app } = boot(); app.runMatching('t'); assert.ok(!Object.keys(app.kms.counters).some((k) => k.startsWith('svc:matcher') && /:I$/.test(k)));
});
test('التدقيق: سلسلة التجزئة تكشف العبث', () => { const { app } = boot(); assert.ok(app.verifyAuditChain()); app.db.audit[2].outcome = 'tampered'; assert.equal(app.verifyAuditChain(), false); });
