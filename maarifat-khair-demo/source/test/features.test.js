const test = require('node:test'), assert = require('node:assert/strict'); const { boot } = require('./helpers');
test('معاينة الخيارات: تتطلب الجنس، أعداد مجمعة فقط، بلا هوية، ومحددة المعدل', () => {
  const { app, as } = boot(); const u = as('sup1');
  assert.throws(() => app.previewOptions(u, {}), (e) => e.code === 'NEED_FIELDS');
  const r = app.previewOptions(u, { M: { gender: 'woman' } }); const txt = JSON.stringify(r);
  assert.ok('pool' in r && 'qualifying' in r && !/"id"|"code"|name|phone/.test(txt));
  for (let i = 0; i < app.cfg.previewPerHour; i++) { try { app.previewOptions(u, { M: { gender: 'woman' } }); } catch (e) { assert.equal(e.code, 'RATE_LIMIT'); return; } }
  assert.fail('لم يُطبَّق حد المعدل');
});
test('معاينة الخيارات: للمشرف صاحب صلاحية الإدخال فقط، وترفض الحقول غير المعروفة', () => {
  const { app, as } = boot();
  for (const k of ['admin1', 'tech1']) assert.throws(() => app.previewOptions(as(k), { M: { gender: 'man' } }), (e) => e.status === 403);
  assert.throws(() => app.previewOptions(as('sup1'), { M: { gender: 'man', evil: 1 } }), (e) => e.status === 422);
});
test('طلب المقارنة لملف نشط فقط، مع فترة تهدئة، ولا يخص غير صاحب الملف', () => {
  const { app, as, t } = boot(); const sup = as('sup1'), p = [...app.db.profiles.values()].find((q) => q.supervisor_id === sup.id && q.state === 'ACTIVE');
  assert.throws(() => app.requestComparison(as('sup2'), p.id), (e) => e.status === 404); assert.throws(() => app.requestComparison(as('tech1'), p.id), (e) => e.status === 403);
  const a = app.requestComparison(sup, p.id); assert.ok('new_pairs' in a && a.message);
  assert.throws(() => app.requestComparison(sup, p.id), (e) => e.code === 'COOLDOWN' && e.status === 429);
  t.v += app.cfg.matchCooldownMs + 1; assert.ok(app.requestComparison(as('sup1'), p.id));
});
test('لوحة المشرف الأول: مجمعة بلا بيانات شخصية ومقصورة على الدور', () => {
  const { app, as } = boot();
  for (const l of ['sup1', 'tech1']) assert.throws(() => app.adminOverview(as(l)), `يجب رفض ${l}`);
  const o = app.adminOverview(as('admin1')); const txt = JSON.stringify(o);
  assert.ok(o.kpis && o.funnel && o.rules && o.security && Array.isArray(o.runs) && o.rules.freeze_days === 7); assert.equal(o.security.chain_valid, true);
  assert.ok(!/"phone"|"dob"|"bio"|ciphertext|"nonce"|code_hash|name_key/.test(txt), 'لا محتوى ملفات ولا أسرار');
  const d = JSON.stringify(app.adminDashboard(as('admin1'))); assert.ok(!/code_hash|name_key|"pw"/.test(d));
});
test('البطاقة تُظهر مستويات التقارب كلمات لا أرقامًا، ولا تُظهر اسمًا ولا هاتفًا', () => {
  const { app, as } = boot(); app.runMatching('t'); const rows = app.myMatches(as('sup1')); assert.ok(rows.length);
  for (const r of rows) { for (const v of Object.values(r.card.dims || {})) assert.ok(['high', 'mid', 'low'].includes(v)); assert.ok(!('name' in r.card) && !('phone' in r.card) && !('dob' in r.card)); }
});
test('المشرف يقرأ ملفه بعد إعادة التحقق فقط، ويصحح فتُبطل الاقتراحات المتأثرة', () => {
  const { app, as } = boot(); app.runMatching('t'); const sup = as('sup1', false), p = [...app.db.profiles.values()].find((q) => q.supervisor_id === sup.id && q.state === 'ACTIVE');
  assert.throws(() => app.readProfile(sup, p.id), (e) => e.code === 'REAUTH_REQUIRED');
  const ok = as('sup1'); const d = app.readProfile(ok, p.id); assert.ok(d.data.I.name && d.data.M.gender);
  const live = (pid) => [...app.db.pairs.values()].filter((x) => (x.a === pid || x.b === pid) && ['PROPOSED'].includes(x.state)).length; const before = live(p.id);
  const r = app.correctProfile(ok, p.id, { M: { timeline: '12+' } }); assert.equal(r.version, 2); assert.equal(live(p.id), 0); assert.ok(before >= 0);
});
test('تجديد الموافقة يتطلب إقرارًا جديدًا ويمدد المراجعة', () => {
  const { app, as } = boot(); const sup = as('sup1'), p = [...app.db.profiles.values()].find((q) => q.supervisor_id === sup.id && q.state === 'ACTIVE');
  assert.throws(() => app.renewProfile(sup, p.id, {}), (e) => e.code === 'CONSENT_REQUIRED'); const r = app.renewProfile(sup, p.id, { consent_attested: true, consent_ref: 'تجديد-ورقي-9' }); assert.ok(r.review_due_at > Date.now() - 1e12);
});
test('الملفات المنتهية مراجعتها لا تدخل المطابقة', () => {
  const { app, t } = boot(); t.v += 100 * 86400000; const r = app.runMatching('late'); assert.equal(r.profiles, 0);
});
