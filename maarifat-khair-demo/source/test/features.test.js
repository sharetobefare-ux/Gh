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
test('البطاقة تُظهر التوافق الإجمالي رقمًا ومستويات الأبعاد كلمات، ولا تُظهر اسمًا ولا هاتفًا', () => {
  const { app, as } = boot(); app.runMatching('t'); const rows = app.myMatches(as('sup1')); assert.ok(rows.length);
  for (const r of rows) { for (const v of Object.values(r.card.dims || {})) assert.ok(['high', 'mid', 'low'].includes(v)); assert.ok(!('name' in r.card) && !('phone' in r.card) && !('dob' in r.card));
    assert.ok(r.compat && r.compat.mutual >= 70 && r.compat.mutual <= 100 && r.compat.mutual === Math.min(r.compat.mine, r.compat.theirs) && r.compat.coverage >= 60); } // التوافق يظهر لكل بطاقة
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
test('المرفقات: لصاحب الملف فقط، أنواع وأحجام محددة، التوقيع يطابق النوع، وتُتلف مع إلغاء الملف', () => {
  const { app, as } = boot(); const sup = as('sup1'), p = [...app.db.profiles.values()].find((q) => q.supervisor_id === sup.id && q.state === 'ACTIVE');
  const png = Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.alloc(64, 1)]).toString('base64');
  const r = app.addFile(sup, p.id, { name: 'consent.png', type: 'image/png', data: png, label: 'نموذج الموافقة 0551234567' });
  assert.ok(r.id && r.size === 72); assert.ok(!r.label.includes('0551234567')); // حجب الهاتف من الوصف
  assert.equal(app.listFilesOf(sup, p.id).length, 1); assert.equal(app.readFile(sup, p.id, r.id).data, png);
  assert.ok(!JSON.stringify([...app.db.files.values()][0].rec).includes(png.slice(0, 40))); // مخزّن مشفّرًا
  assert.throws(() => app.listFilesOf(as('sup2'), p.id), (e) => e.status === 404); // لا يعرف غير صاحبه بوجود الملف
  assert.throws(() => app.readFile(as('admin1'), p.id, r.id), (e) => e.status === 403); // المشرف الأول لا يقرأ المرفقات
  assert.throws(() => app.addFile(sup, p.id, { name: 'x.exe', type: 'application/octet-stream', data: png }), (e) => e.code === 'BAD_TYPE');
  assert.throws(() => app.addFile(sup, p.id, { name: 'fake.pdf', type: 'application/pdf', data: png }), (e) => e.code === 'BAD_TYPE'); // توقيع لا يطابق
  assert.throws(() => app.addFile(sup, p.id, { name: 'big.png', type: 'image/png', data: Buffer.concat([Buffer.from('89504e470d0a1a0a', 'hex'), Buffer.alloc(2.1 * 1024 * 1024)]).toString('base64') }), (e) => e.code === 'TOO_LARGE');
  for (let i = 0; i < 5; i++) app.addFile(sup, p.id, { name: `a${i}.png`, type: 'image/png', data: png });
  assert.throws(() => app.addFile(sup, p.id, { name: 'a7.png', type: 'image/png', data: png }), (e) => e.code === 'LIMIT');
  app.deleteFile(sup, p.id, r.id); assert.equal(app.listFilesOf(sup, p.id).length, 5);
  app.cancelProfile(sup, p.id, { reason: 'cancelled' }); assert.equal([...app.db.files.values()].filter((f) => f.profile_id === p.id).length, 0);
  assert.ok(app.db.audit.some((e) => e.action === 'file.add') && !JSON.stringify(app.db.audit).includes('consent.png')); // لا أسماء ملفات في السجل
});
test('الاطلاع على ملفات المشرفين: مفتوح افتراضيًا، يسحبه المشرف الأول، يعرض التوافق لا الهوية، والمطابقة المباشرة تنشئ اقتراحًا للطرفين', () => {
  const { app, as } = boot(); const sup = as('sup1'), sup2 = as('sup2');
  assert.ok(sup.perms.includes('browse')); // مفعّلة لكل المشرفين افتراضيًا
  const rows = app.browseProfiles(sup); assert.ok(rows.length > 5 && rows.some((r) => !r.mine) && rows.every((r) => r.supervisor && r.age_range && !('name' in r) && !('phone' in r)));
  const other = rows.find((r) => !r.mine && r.state === 'ACTIVE'); const d = app.browseProfile(sup, other.id);
  assert.ok(d.data.gender && d.data.pref_cities && !('name' in d.data) && !('phone' in d.data) && !('dob' in d.data) && /–/.test(d.data.age)); // نطاق عمر لا تاريخ ميلاد
  assert.throws(() => app.browseProfile(as('tech1'), other.id), (e) => e.status === 403);
  // المطابقة المباشرة: ملفي × ملف مشرف آخر من الجنس الآخر
  const mine = [...app.db.profiles.values()].find((q) => q.supervisor_id === sup.id && q.state === 'ACTIVE');
  const myG = app.browseProfile(sup, mine.id).data.gender, cand = rows.find((r) => !r.mine && r.state === 'ACTIVE' && r.gender !== myG);
  const r1 = app.directMatch(sup, mine.id, cand.id); assert.ok(['ELIGIBLE', 'EXCLUDED', 'NEEDS_CLARIFICATION', 'BELOW_THRESHOLD', 'INSUFFICIENT', 'EXISTS', 'CAPACITY', 'SUPPRESSED'].includes(r1.status) && r1.message);
  if (r1.status === 'ELIGIBLE') { assert.ok(app.myMatches(sup).some((x) => x.pair_id === r1.pair_id)); const otherSup = [...app.db.users.values()].find((u) => u.id === cand.supervisor.id); assert.ok(app.myMatches({ ...otherSup }).some((x) => x.pair_id === r1.pair_id)); assert.equal(app.directMatch(sup, mine.id, cand.id).status, 'EXISTS'); }
  assert.throws(() => app.directMatch(sup, mine.id, mine.id), (e) => e.status === 422); // الملف مع نفسه
  // سحب الصلاحية من المشرف الأول يغلق الصفحة فورًا
  app.setPerms(as('admin1'), sup.id, sup.perms.filter((x) => x !== 'browse'));
  assert.throws(() => app.browseProfiles(app.session([...app.db.sessions.entries()].find(([, v]) => v.uid === sup.id)[0])), (e) => e.status === 403);
  assert.ok(app.db.audit.some((e) => e.action === 'profile.view' && e.purpose === 'browse'));
});
