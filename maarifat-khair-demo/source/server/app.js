'use strict';
// معرفة خير v3: ثلاثة أدوار فقط (المشرف الأول، المشرف، المشرف التقني). لا حسابات للمستفيدين.
// الدخول باسم (كلمات) ورقم (رموز) عشوائيين يولّدهما المشرف الأول. الصلاحية لكل صفحة.
const K = require('./crypto');
const Q = require('./questionnaire');
const M = require('./matching/engine');

class HttpError extends Error { constructor(status, code, msg, extra) { super(msg || code); this.status = status; this.code = code; this.extra = extra; } }
const E = (s, c, m, x) => new HttpError(s, c, m, x);
const DAY = 86400000;
const DUMMY_CODE = K.hashPassword('dummy-code-for-timing');
const POLICY_VERSION = 'policy-2026-10-v2';
const CONSENT_TEXT = 'أقرّ بأن صاحب الطلب اطّلع على الغرض من إدراج بياناته، ووافق صراحةً على استخدام البيانات المحددة لاقتراح ترشيحات متبادلة عبر مشرفين موثوقين، وأنني أحتفظ بمرجع إثبات الموافقة، وأن له حق السحب والإلغاء في أي وقت عن طريقي.';
const LIVE_PAIR = ['PROPOSED', 'INTEREST_ONE_SIDE', 'MUTUAL_INTEREST'];
const TERMINAL_PAIR = ['DECLINED', 'EXPIRED', 'REVOKED', 'CONTACTED'];
const FREEZE_DAYS = 7;
// صلاحيات الصفحات. يمنحها المشرف الأول أو يسحبها. المشرف التقني له الدعم الفني فقط.
const SUP_PERMS = ['intake', 'matches', 'contact', 'cancel', 'exempt', 'support'];
const DEFAULT_PERMS = { supervisor: SUP_PERMS, tech: ['support'], super_admin: [] };
const TICKET_CLASSES = ['login', 'page_error', 'matching', 'data', 'permissions', 'security', 'other'];
const TICKET_STATES = ['open', 'in_progress', 'resolved'];

function createApp(opts = {}) {
  const clock = { now: opts.now || (() => Date.now()) };
  const now = () => clock.now();
  const kms = opts.kms || new K.SimKMS();
  const cfg = { demo: opts.demo ?? false, sessionIdleMs: 30 * 60e3, sessionMaxMs: 8 * 3600e3, reauthMs: 5 * 60e3, draftMs: 14 * DAY, cardMs: M.RULES.cardTtlDays * DAY, freezeMs: FREEZE_DAYS * DAY, reviewMs: 90 * DAY, minCell: opts.minCell ?? 5, previewPerHour: 30, matchCooldownMs: 60e3 };
  const db = { users: new Map(), sessions: new Map(), profiles: new Map(), sections: new Map(), drafts: new Map(), consents: [], receipts: new Map(), pairs: new Map(), cards: new Map(), suppress: new Set(), roleReqs: new Map(), exemptions: new Map(), tickets: new Map(), audit: [], runs: [], attempts: new Map(), previews: new Map(), lastMatch: new Map(), tombstones: new Set(), deletionJobs: [], suggestions: [], demoCreds: [] };

  // ---------- تدقيق (سلسلة تجزئة؛ لا محتوى ولا أسماء ولا هواتف) ----------
  function audit(actor, action, resource, purpose, outcome = 'ok') {
    const prev = db.audit.length ? db.audit[db.audit.length - 1].hash : 'genesis';
    const ev = { seq: db.audit.length + 1, at: now(), role: actor?.role || 'anonymous', actor: actor?.id ? K.sha(actor.id).slice(0, 8) : '-', action, resource: resource ? String(resource).slice(0, 12) : '-', purpose: purpose || '-', outcome, prev };
    ev.hash = K.sha(JSON.stringify(ev)); db.audit.push(ev); return ev;
  }
  const verifyAuditChain = () => db.audit.every((e, i) => { const { hash, ...rest } = e; return e.prev === (i ? db.audit[i - 1].hash : 'genesis') && K.sha(JSON.stringify(rest)) === hash; });

  // ---------- هوية وجلسات ----------
  const need = (a, ...roles) => { if (!a || !roles.includes(a.role)) throw E(403, 'FORBIDDEN', 'غير مصرح'); };
  /** صلاحية صفحة: لا تُمنح ضمنيًا حتى للمشرف الأول؛ يلزم أن تكون في قائمة صلاحيات الحساب. */
  const needPerm = (a, perm) => { if (!a || a.role === 'super_admin' || !(a.perms || []).includes(perm)) throw E(403, 'FORBIDDEN', 'ليست لديك صلاحية هذه الصفحة'); };
  const notFound = () => E(404, 'NOT_FOUND', 'غير موجود');
  /** ينشئ حسابًا ببيانات دخول عشوائية. تُعاد مرة واحدة فقط ولا تُحفظ إلا مجزّأة. */
  function newAccount({ role, display_name, category, scope, verification, perms }) {
    if (!['super_admin', 'supervisor', 'tech'].includes(role)) throw E(422, 'BAD_ROLE', 'دور غير صالح');
    let name, nk; do { name = K.genName(); nk = K.nameKey(name); } while ([...db.users.values()].some((u) => u.name_key === nk));
    const code = K.genCode();
    const u = { id: 'u_' + K.rid(8), name_key: nk, code_hash: K.hashPassword(K.normCode(code)), role, display_name: String(display_name || '').slice(0, 60) || null, category: category || null, scope: scope || null, perms: [...(perms || DEFAULT_PERMS[role])], status: 'active', created_at: now(), verification: verification || null };
    db.users.set(u.id, u); return { user: u, name, code };
  }
  const publicUser = (u) => ({ id: u.id, role: u.role, display_name: u.display_name, category: u.category, perms: u.perms });
  function login(name, code) {
    const nk = K.nameKey(name), key = 'l:' + nk, a = db.attempts.get(key) || { n: 0, t: now() };
    if (now() - a.t > 15 * 60e3) { a.n = 0; a.t = now(); }
    if (a.n >= 5) throw E(429, 'RATE_LIMIT', 'محاولات كثيرة. حاول لاحقًا');
    const u = [...db.users.values()].find((x) => x.name_key === nk);
    const ok = K.verifyPassword(K.normCode(code), u ? u.code_hash : DUMMY_CODE); // نفس الزمن سواء وُجد الاسم أم لا
    if (!u || u.status !== 'active' || !ok) { a.n++; db.attempts.set(key, a); audit(null, 'auth.login', null, 'login', 'denied'); throw E(401, 'BAD_CREDENTIALS', 'الاسم أو الرقم غير صحيح'); }
    db.attempts.delete(key);
    const sid = K.rid(32); db.sessions.set(sid, { uid: u.id, at: now(), last: now(), reauth: now() });
    audit(u, 'auth.login', null, 'login'); return { sid, user: publicUser(u) };
  }
  function session(sid) {
    const s = db.sessions.get(sid); if (!s) return null;
    if (now() - s.last > cfg.sessionIdleMs || now() - s.at > cfg.sessionMaxMs) { db.sessions.delete(sid); return null; }
    const u = db.users.get(s.uid); if (!u || u.status !== 'active') { db.sessions.delete(sid); return null; }
    s.last = now(); return { ...u, sid, reauthed: now() - s.reauth < cfg.reauthMs };
  }
  /** إعادة التحقق بإدخال الرقم السري مرة أخرى قبل العمليات الحساسة. */
  function reauth(actor, code) {
    const u = db.users.get(actor.id), key = 'r:' + actor.id, a = db.attempts.get(key) || { n: 0, t: now() };
    if (now() - a.t > 15 * 60e3) { a.n = 0; a.t = now(); } if (a.n >= 5) throw E(429, 'RATE_LIMIT', 'محاولات كثيرة');
    if (!K.verifyPassword(K.normCode(code), u.code_hash)) { a.n++; db.attempts.set(key, a); audit(actor, 'auth.reauth', null, 'stepup', 'denied'); throw E(401, 'BAD_CODE', 'الرقم غير صحيح'); }
    db.attempts.delete(key); db.sessions.get(actor.sid).reauth = now(); return { ok: true, valid_for_sec: cfg.reauthMs / 1000 };
  }
  const needReauth = (a) => { if (!a.reauthed) throw E(401, 'REAUTH_REQUIRED', 'يلزم إدخال الرقم السري مجددًا', { reauth: true }); };
  const logout = (sid) => db.sessions.delete(sid);
  const killSessions = (uid) => { for (const [k, s] of db.sessions) if (s.uid === uid) db.sessions.delete(k); };
  /** أول تشغيل في الإنتاج: يُنشأ مشرف أول واحد وتُطبع بياناته مرة واحدة. */
  function bootstrapAdmin() { if (db.users.size) return null; const r = newAccount({ role: 'super_admin', display_name: 'المشرف الأول' }); audit(null, 'bootstrap.admin', r.user.id, 'setup'); return { name: r.name, code: r.code }; }

  // ---------- المسودات (بيد المشرف الذي أنشأها) ----------
  const draftOpen = (pid) => { const r = db.drafts.get(pid); return r ? K.open(kms, r, 'svc:draft', 'draft-edit') : { I: {}, M: {}, S: {}, C: {} }; };
  const draftSave = (pid, d) => db.drafts.set(pid, K.seal(kms, 'kek:draft', { profile_id: pid, section: 'DRAFT', schema_version: '1.0', record_version: 0, purpose: 'draft' }, d));
  const mkProfile = (sup) => { const id = 'p_' + K.rid(10); const p = { id, code: K.rid(4).toUpperCase().replace(/[-_]/g, 'X'), supervisor_id: sup, state: 'DRAFT', version: 0, completeness: 0, created_at: now(), updated_at: now(), draft_expires_at: now() + cfg.draftMs, exposure: 0, active_since: null, review_due_at: null, frozen_until: null, frozen_pair: null, exempt_ok: false, exemption_id: null }; db.profiles.set(id, p); return p; };
  function mergeDraft(base, patch) {
    // قائمة بيضاء صارمة: لا __proto__ ولا حقول مجهولة ولا طبقة خاطئة (منع تلويث النماذج الأولية)
    const out = JSON.parse(JSON.stringify(base)); const bad = [];
    if (patch !== undefined && (patch === null || typeof patch !== 'object' || Array.isArray(patch))) throw E(422, 'INVALID', 'بيانات غير صالحة', { fields: [] });
    for (const L of Object.keys(patch || {})) { if (!['I', 'M', 'S', 'C'].includes(L)) { bad.push(L); continue; }
      const src = patch[L]; if (src === null || typeof src !== 'object' || Array.isArray(src)) { bad.push(L); continue; }
      for (const k of Object.keys(src)) { if (!Object.prototype.hasOwnProperty.call(Q.FIELDS, k) || Q.FIELDS[k].layer !== L) { bad.push(k); continue; } out[L][k] = src[k]; } }
    if (bad.length) throw E(422, 'INVALID', 'بيانات غير صالحة', { fields: bad });
    return out;
  }
  const checkVerified = (actor) => { if (actor.verification?.expires_at < now()) throw E(403, 'VERIFICATION_EXPIRED', 'انتهت صلاحية التحقق من الصفة'); };
  const ownFile = (actor, id, ...states) => { const p = db.profiles.get(id); if (!p || p.supervisor_id !== actor.id || (states.length && !states.includes(p.state))) throw notFound(); return p; };
  function createDraft(actor, patch) {
    needPerm(actor, 'intake'); checkVerified(actor);
    const d = Q.sanitize(mergeDraft({ I: {}, M: {}, S: {}, C: {} }, patch));
    const v = Q.validate(d, now()); if (Object.keys(v.errors).length) throw E(422, 'INVALID', 'بيانات غير صالحة', { fields: Object.keys(v.errors) });
    const p = mkProfile(actor.id); p.completeness = v.completeness; draftSave(p.id, d); audit(actor, 'draft.create', p.id, 'intake'); return { id: p.id, code: p.code, completeness: p.completeness, missing: v.missing };
  }
  function readDraft(actor, id) { needPerm(actor, 'intake'); const p = ownFile(actor, id, 'DRAFT'); audit(actor, 'draft.read', p.id, 'intake'); return { id: p.id, state: p.state, data: draftOpen(p.id) }; }
  function updateDraft(actor, id, patch) {
    needPerm(actor, 'intake'); const p = ownFile(actor, id, 'DRAFT');
    const d = Q.sanitize(mergeDraft(draftOpen(id), patch)); const v = Q.validate(d, now());
    if (Object.keys(v.errors).length) throw E(422, 'INVALID', 'بيانات غير صالحة', { fields: Object.keys(v.errors) });
    p.completeness = v.completeness; p.updated_at = now(); draftSave(id, d); audit(actor, 'draft.update', id, 'intake'); return { completeness: p.completeness, missing: v.missing };
  }
  const publicSchema = () => Object.fromEntries(Object.entries(Q.FIELDS).map(([k, f]) => [k, { id: f.id, layer: f.layer, phase: f.phase, type: f.type, values: f.values, max: f.max, min: f.min, label: f.label }]));

  // ---------- إيداع الملف: يقرّ المشرف بحصوله على موافقة صاحب الطلب ----------
  function storeSections(p, d, ver) {
    for (const L of ['I', 'M', 'S', 'C']) {
      const kek = `kek:${p.id}:${L}`; // مفتاح لكل ملف/طبقة: يتيح إتلافًا تشفيريًا فعليًا
      db.sections.set(`${p.id}:${L}`, K.seal(kms, kek, { profile_id: p.id, section: L, schema_version: '1.0', record_version: ver, purpose: L === 'I' ? 'identity-vault' : L === 'M' ? 'matching' : L === 'C' ? 'card' : 'private' }, d[L]));
    }
  }
  const openSection = (p, L, caller, purpose) => { const r = db.sections.get(`${p.id}:${L}`); if (!r) throw E(404, 'NO_DATA'); return K.open(kms, r, caller, purpose); };
  function attest(actor, p, { consent_attested, consent_ref }) {
    if (consent_attested !== true) throw E(422, 'CONSENT_REQUIRED', 'يلزم الإقرار بالحصول على موافقة صاحب الطلب');
    const ref = Q.maskPII(String(consent_ref || '').trim()).slice(0, 60); if (ref.length < 4) throw E(422, 'CONSENT_REF_REQUIRED', 'اكتب مرجع إثبات الموافقة (4 أحرف على الأقل)', { fields: ['consent_ref'] });
    const c = { consent_id: 'c_' + K.rid(8), subject: p.id, policy_version: POLICY_VERSION, purpose: 'matching', notice_text_hash: K.sha(CONSENT_TEXT), method: 'supervisor-attested', recorded_by: actor.id, evidence_ref: ref, granted_at: now(), expires_at: now() + cfg.reviewMs, withdrawn_at: null };
    db.consents.push(c); return c;
  }
  function submitProfile(actor, id, body = {}) {
    needPerm(actor, 'intake'); checkVerified(actor); const p = ownFile(actor, id, 'DRAFT');
    const d = Q.sanitize(draftOpen(id)); const v = Q.validate(d, now());
    if (v.missing.length || Object.keys(v.errors).length) throw E(422, 'INCOMPLETE', 'استكمل الحقول الأساسية أولًا', { missing: v.missing, fields: Object.keys(v.errors) });
    attest(actor, p, body);
    d.M.age = v.age; // مشتق؛ تاريخ الميلاد يبقى في الخزنة I فقط
    storeSections(p, d, 1); db.drafts.delete(p.id);
    p.state = 'ACTIVE'; p.version = 1; p.completeness = v.completeness; p.updated_at = now(); p.active_since = now(); p.review_due_at = now() + cfg.reviewMs;
    const receipt = { receipt_id: 'r_' + K.rid(8), profile_id: p.id, record_version: 1, at: now(), state: 'ACTIVE' }; db.receipts.set(receipt.receipt_id, receipt); p.receipt_id = receipt.receipt_id;
    audit(actor, 'profile.submit', p.id, 'seal'); return { id: p.id, code: p.code, state: p.state, receipt_id: receipt.receipt_id };
  }
  /** تجديد الموافقة قبل انتهاء المراجعة (90 يومًا) */
  function renewProfile(actor, id, body = {}) {
    needPerm(actor, 'intake'); const p = ownFile(actor, id, 'ACTIVE', 'FROZEN'); attest(actor, p, body); p.review_due_at = now() + cfg.reviewMs; audit(actor, 'profile.renew', p.id, 'consent'); return { review_due_at: p.review_due_at };
  }
  function readProfile(actor, id) {
    needPerm(actor, 'intake'); needReauth(actor); const p = ownFile(actor, id, 'ACTIVE', 'FROZEN'); audit(actor, 'profile.read', p.id, 'custodian-access');
    return { id: p.id, code: p.code, state: p.state, version: p.version, data: Object.fromEntries(['I', 'M', 'S', 'C'].map((L) => [L, openSection(p, L, 'svc:custodian-gateway', 'custodian-access')])) };
  }
  function correctProfile(actor, id, changes) {
    needPerm(actor, 'intake'); needReauth(actor); const p = ownFile(actor, id, 'ACTIVE');
    const cur = Object.fromEntries(['I', 'M', 'S', 'C'].map((L) => [L, openSection(p, L, 'svc:custodian-gateway', 'correction')]));
    delete cur.M.age; const d = Q.sanitize(mergeDraft(cur, changes)); const v = Q.validate(d, now());
    if (Object.keys(v.errors).length || v.missing.length) throw E(422, 'INVALID', 'بيانات غير صالحة', { fields: Object.keys(v.errors), missing: v.missing });
    d.M.age = v.age; revokePairsOf(p.id, 'correction'); storeSections(p, d, p.version + 1); p.version++; p.updated_at = now(); p.completeness = v.completeness;
    audit(actor, 'profile.correct', p.id, 'correction'); return { version: p.version, state: p.state };
  }

  // ---------- المطابقة ----------
  function activeLoad() { const m = new Map(); for (const x of db.pairs.values()) if (LIVE_PAIR.includes(x.state)) { m.set(x.a, (m.get(x.a) || 0) + 1); m.set(x.b, (m.get(x.b) || 0) + 1); } return m; }
  function runMatching(trigger = 'manual') {
    const run = { id: 'run_' + K.rid(6), at: now(), rules: M.RULES.version, trigger, seed: K.rid(8), stats: {} }; db.runs.push(run);
    const caller = 'svc:matcher:' + run.id, ps = [...db.profiles.values()].filter((p) => p.state === 'ACTIVE' && !(p.review_due_at && p.review_due_at < now()));
    const data = new Map(ps.map((p) => [p.id, { p, M: openSection(p, 'M', caller, 'match-run'), C: openSection(p, 'C', caller, 'match-run') }]));
    const stats = { profiles: ps.length, EXCLUDED: 0, NEEDS_CLARIFICATION: 0, INSUFFICIENT: 0, BELOW_THRESHOLD: 0, ELIGIBLE: 0, created: 0, excluded_by: {}, clarify_fields: {}, avg_mutual: null }; const cands = []; const t0 = now();
    const list = [...data.values()];
    for (let i = 0; i < list.length; i++) for (let j = i + 1; j < list.length; j++) {
      const A = list[i], B = list[j], pid = M.canonicalPairId(A.p.id, B.p.id);
      const old = db.pairs.get(pid); if (db.suppress.has(pid) || (old && !(old.state === 'EXPIRED' || (old.state === 'REVOKED' && ['correction', 'contact'].includes(old.revoked_reason))))) continue;
      if (A.M.gender === B.M.gender) continue;
      const ev = M.evaluatePair(A.M, B.M); stats[ev.status]++; if (ev.status === 'EXCLUDED') stats.excluded_by[ev.why] = (stats.excluded_by[ev.why] || 0) + 1; if (ev.status === 'NEEDS_CLARIFICATION') for (const f of ev.unknown) stats.clarify_fields[f] = (stats.clarify_fields[f] || 0) + 1;
      if (ev.status === 'ELIGIBLE') cands.push({ a: A.p.id, b: B.p.id, mutual: ev.mutual, coverage: ev.coverage, ev, exposure: { a: A.p.exposure, b: B.p.exposure }, waitDays: { a: (now() - (A.p.active_since || now())) / DAY, b: (now() - (B.p.active_since || now())) / DAY }, tie: K.hmac(run.seed, pid) });
    }
    const load = activeLoad(); for (const p of ps) if (!load.has(p.id)) load.set(p.id, 0);
    for (const c of M.select(cands, load)) {
      const A = data.get(c.a), B = data.get(c.b);
      if (A.p.state !== 'ACTIVE' || B.p.state !== 'ACTIVE') continue; // إعادة فحص قبل الحجز
      const id = M.canonicalPairId(c.a, c.b);
      const pair = { id, a: c.a, b: c.b, state: 'PROPOSED', profile_versions: { [c.a]: A.p.version, [c.b]: B.p.version }, created_at: now(), expires_at: now() + cfg.cardMs, decisions: {}, later: {}, channels: {}, rules: M.RULES.version, run: run.id,
        score_enc: K.seal(kms, 'kek:pairs', { profile_id: id, section: 'SCORE', schema_version: '1.0', record_version: 1, purpose: 'explain' }, { mutual: c.mutual, coverage: c.coverage, ab: c.ev.ab.score, ba: c.ev.ba.score }) };
      db.pairs.set(id, pair);
      for (const [viewer, other, fits] of [[A, B, c.ev.ab.fits], [B, A, c.ev.ba.fits]]) db.cards.set(`${id}:${viewer.p.id}`, K.seal(kms, 'kek:pairs', { profile_id: id, section: 'CARD:' + viewer.p.id, schema_version: '1.0', record_version: 1, purpose: 'card' }, buildCard(other, fits)));
      A.p.exposure++; B.p.exposure++; stats.created++; stats._sum = (stats._sum || 0) + c.mutual;
    }
    if (stats.created) stats.avg_mutual = Math.round(10 * stats._sum / stats.created) / 10; delete stats._sum; stats.rules_version = M.RULES.version; stats.thresholds = { coverage: M.RULES.minCoverage, mutual: M.RULES.minMutual }; run.ms = now() - t0; if (db.runs.length > 50) db.runs.shift();
    for (const p of ps) db.lastMatch.set(p.id, now());
    run.stats = stats; audit({ role: 'service', id: 'matcher' }, 'match.run', run.id, trigger); return { run_id: run.id, ...stats };
  }
  function buildCard(o, fits) {
    const f = o.C.card_fields || [], m = o.M, c = {}; c.code = 'ك-' + K.rid(3).toUpperCase().replace(/[-_]/g, 'Z');
    if (f.includes('age_range')) c.age_range = Q.ageRange(m.age);
    if (f.includes('region')) c.region = Q.REGION[m.city]; if (f.includes('city')) c.city = m.city;
    if (f.includes('bio') && o.C.bio) c.bio = o.C.bio;
    for (const k of ['education', 'work_field', 'timeline', 'housing', 'social_style', 'langs', 'values', 'wants_children', 'children']) if (f.includes(k) && m[k] !== undefined) c[k] = m[k];
    c.reasons = M.reasons(fits, f); c.dims = M.dimLevels(fits, f);
    const weak = Object.entries(fits).filter(([, v]) => v !== null && v < 0.5).map(([d]) => d).find((d) => ({ place: ['city', 'housing', 'region'], family: ['timeline', 'wants_children', 'children'], work: ['education', 'work_field'], lifestyle: ['social_style'], values: ['langs', 'values'] }[d]).some((x) => f.includes(x)));
    if (weak) c.discuss = { place: 'تصور السكن والمكان', family: 'تصور الأسرة وتوقيتها', work: 'العمل والتعليم', lifestyle: 'نمط الحياة', values: 'القيم واللغة' }[weak];
    return c;
  }
  function expirePairs() { for (const x of db.pairs.values()) if (LIVE_PAIR.includes(x.state) && x.expires_at < now()) x.state = 'EXPIRED'; }
  function valid(x) { const A = db.profiles.get(x.a), B = db.profiles.get(x.b); return A && B && A.state === 'ACTIVE' && B.state === 'ACTIVE' && A.version === x.profile_versions[x.a] && B.version === x.profile_versions[x.b]; }
  function revokePairsOf(pid, why, except) { for (const x of db.pairs.values()) if ((x.a === pid || x.b === pid) && x.id !== except && !TERMINAL_PAIR.includes(x.state)) { x.state = 'REVOKED'; x.revoked_reason = why; for (const k of [`${x.id}:${x.a}`, `${x.id}:${x.b}`]) db.cards.delete(k); } }

  /** طلبات المقارنة الواردة للمشرف: لكل ملف من ملفاته اقتراحات المحرك، ببطاقات مجهولة الهوية. */
  function myMatches(actor) {
    needPerm(actor, 'matches'); expirePairs(); const out = [];
    for (const mine of db.profiles.values()) {
      if (mine.supervisor_id !== actor.id || mine.state !== 'ACTIVE') continue;
      for (const x of db.pairs.values()) {
        if (!LIVE_PAIR.includes(x.state) || (x.a !== mine.id && x.b !== mine.id)) continue;
        const other = x.a === mine.id ? x.b : x.a, op = db.profiles.get(other);
        if (!valid(x)) { x.state = 'REVOKED'; x.revoked_reason = 'invalid'; continue; }
        const card = K.open(kms, db.cards.get(`${x.id}:${mine.id}`), 'svc:card-gateway', 'card-view');
        const row = { pair_id: x.id, profile_id: mine.id, profile_code: mine.code, state: x.state, my_decision: x.decisions[mine.id] || (x.later[mine.id] ? 'later' : null), other_decided: !!x.decisions[other], expires_at: x.expires_at, card };
        if (x.state === 'MUTUAL_INTEREST') { const os = db.users.get(op.supervisor_id); row.other_supervisor = os ? { name: os.display_name, category: os.category, channel: x.channels[other] || null } : null; }
        out.push(row);
      }
    }
    return out.sort((a, b) => (a.state === 'MUTUAL_INTEREST' ? -1 : 0) - (b.state === 'MUTUAL_INTEREST' ? -1 : 0) || a.expires_at - b.expires_at);
  }
  function pairOf(actor, id, profile_id) {
    const x = db.pairs.get(id), mine = db.profiles.get(profile_id);
    if (!x || !mine || mine.supervisor_id !== actor.id || (x.a !== mine.id && x.b !== mine.id)) throw notFound(); expirePairs();
    return { x, mine, other: x.a === mine.id ? x.b : x.a };
  }
  function decide(actor, id, { profile_id, decision, channel }) {
    needPerm(actor, 'matches'); const { x, mine, other } = pairOf(actor, id, profile_id);
    if (!['interested', 'not_interested', 'later'].includes(decision)) throw E(422, 'BAD_DECISION');
    if (!LIVE_PAIR.includes(x.state) || !valid(x)) { if (!TERMINAL_PAIR.includes(x.state) && !valid(x)) x.state = 'REVOKED'; throw E(409, 'PAIR_CLOSED', 'لم يعد هذا الاقتراح متاحًا'); }
    if (decision === 'later') { x.later[mine.id] = true; return { state: x.state }; }
    if (x.decisions[mine.id] === 'interested' && decision === 'interested') throw E(409, 'ALREADY_DECIDED', 'سبق أن أبديت الاهتمام');
    x.decisions[mine.id] = decision; delete x.later[mine.id];
    if (decision === 'not_interested') { x.state = 'DECLINED'; db.suppress.add(x.id); for (const k of [`${x.id}:${x.a}`, `${x.id}:${x.b}`]) db.cards.delete(k); }
    else { x.channels[mine.id] = Q.maskPII(String(channel || '').slice(0, 80)); x.state = x.decisions[other] === 'interested' ? 'MUTUAL_INTEREST' : 'INTEREST_ONE_SIDE'; }
    audit(actor, 'pair.decision', x.id, decision); return { state: x.state, mutual: x.state === 'MUTUAL_INTEREST' };
  }
  /** تم التواصل: يجمّد الملفين 7 أيام ويُغلق الاقتراح ويمنع تكراره. */
  function markContact(actor, id, { profile_id }) {
    needPerm(actor, 'contact'); const { x } = pairOf(actor, id, profile_id);
    if (x.state !== 'MUTUAL_INTEREST' || !valid(x)) throw E(409, 'STATE', 'لا يمكن تسجيل التواصل إلا بعد اهتمام الطرفين');
    x.state = 'CONTACTED'; x.contacted_at = now(); x.contacted_by = actor.id; db.suppress.add(x.id);
    for (const k of [`${x.id}:${x.a}`, `${x.id}:${x.b}`]) db.cards.delete(k);
    for (const pid of [x.a, x.b]) { const p = db.profiles.get(pid); revokePairsOf(pid, 'contact', x.id); p.state = 'FROZEN'; p.frozen_at = now(); p.frozen_until = now() + cfg.freezeMs; p.frozen_pair = x.id; p.exempt_ok = false; p.exemption_id = null; p.updated_at = now(); }
    audit(actor, 'pair.contacted', x.id, 'freeze'); return { state: x.state, frozen_until: now() + cfg.freezeMs, files: [x.a, x.b].map((i) => db.profiles.get(i).code) };
  }
  function myFrozen(actor) {
    needPerm(actor, 'contact'); const out = [];
    for (const p of db.profiles.values()) if (p.supervisor_id === actor.id && p.state === 'FROZEN') {
      const ex = p.exemption_id && db.exemptions.get(p.exemption_id), left = Math.max(0, p.frozen_until - now());
      out.push({ id: p.id, code: p.code, frozen_at: p.frozen_at, frozen_until: p.frozen_until, days_left: Math.ceil(left / DAY), can_activate: left === 0 || p.exempt_ok, exemption: ex ? { state: ex.state, at: ex.at } : null, can_request_exemption: left > 0 && !p.exempt_ok && !(ex && ex.state === 'pending') });
    }
    return out.sort((a, b) => a.frozen_until - b.frozen_until);
  }
  /** تفعيل الملف بعد انتهاء المدة (أو بعد استثناء المشرف الأول). التفعيل من المشرف وليس تلقائيًا. */
  function activateProfile(actor, id) {
    needPerm(actor, 'contact'); const p = ownFile(actor, id, 'FROZEN');
    if (now() < p.frozen_until && !p.exempt_ok) throw E(409, 'FROZEN', `الملف مجمّد. تبقى ${Math.ceil((p.frozen_until - now()) / DAY)} يوم`, { days_left: Math.ceil((p.frozen_until - now()) / DAY) });
    p.state = 'ACTIVE'; p.frozen_until = null; p.frozen_pair = null; p.exempt_ok = false; p.exemption_id = null; p.active_since = now(); p.review_due_at = Math.max(p.review_due_at || 0, now() + 30 * DAY); p.updated_at = now();
    audit(actor, 'profile.activate', p.id, 'unfreeze'); return { state: p.state };
  }
  function requestExemption(actor, id, { note } = {}) {
    needPerm(actor, 'exempt'); const p = ownFile(actor, id, 'FROZEN');
    if (now() >= p.frozen_until || p.exempt_ok) throw E(409, 'STATE', 'لا حاجة لطلب استثناء');
    if (p.exemption_id && db.exemptions.get(p.exemption_id)?.state === 'pending') throw E(409, 'ALREADY_REQUESTED', 'لديك طلب قائم لهذا الملف');
    const n = Q.maskPII(String(note || '').trim().slice(0, 300)); if (n.length < 10) throw E(422, 'NOTE_REQUIRED', 'اكتب سبب الاستثناء (10 أحرف على الأقل)', { fields: ['note'] });
    const r = { id: 'ex_' + K.rid(6), profile_id: p.id, supervisor_id: actor.id, note: n, state: 'pending', at: now() }; db.exemptions.set(r.id, r); p.exemption_id = r.id;
    audit(actor, 'exemption.request', r.id, 'freeze'); return { id: r.id };
  }
  function cancelProfile(actor, id, { reason } = {}) {
    needReauth(actor); const p = db.profiles.get(id);
    if (!p || p.state === 'DELETED') throw notFound();
    if (actor.role === 'super_admin') { /* يلغي أي ملف */ } else { needPerm(actor, 'cancel'); if (p.supervisor_id !== actor.id) throw notFound(); }
    purgeProfile(p); audit(actor, 'profile.cancel', p.id, Q.maskPII(String(reason || 'other')).slice(0, 12)); return { state: p.state };
  }
  function purgeProfile(p) {
    revokePairsOf(p.id, 'cancel'); db.drafts.delete(p.id);
    for (const L of ['I', 'M', 'S', 'C']) { db.sections.delete(`${p.id}:${L}`); kms.destroy(`kek:${p.id}:${L}`); } // إتلاف تشفيري فعلي
    for (const x of db.pairs.values()) if (x.a === p.id || x.b === p.id) for (const k of [`${x.id}:${x.a}`, `${x.id}:${x.b}`]) db.cards.delete(k);
    for (const c of db.consents) if (c.subject === p.id && !c.withdrawn_at) c.withdrawn_at = now();
    db.tombstones.add(p.id); // يُعاد تطبيقه قبل فتح نظام مستعاد من نسخة احتياطية
    db.deletionJobs.push({ profile_id: p.id, at: now(), state: 'done' });
    p.state = 'DELETED'; p.updated_at = now(); p.frozen_until = null;
  }
  function purgeDue() { let n = 0; for (const p of db.profiles.values()) if (p.state === 'DRAFT' && p.draft_expires_at < now()) { db.drafts.delete(p.id); p.state = 'DELETED'; n++; } return n; }
  const restoreFromBackup = (ids) => ids.filter((id) => !db.tombstones.has(id));

  // ---------- المشرف: الرئيسية وملفاته ----------
  const STAGE = { DRAFT: 'مسودة', ACTIVE: 'نشط', FROZEN: 'مجمّد', DELETED: 'ملغى' };
  function listFiles(actor) {
    needPerm(actor, 'intake'); purgeDue();
    return [...db.profiles.values()].filter((p) => p.supervisor_id === actor.id && p.state !== 'DELETED').sort((a, b) => b.updated_at - a.updated_at).map((p) => ({ id: p.id, code: p.code, state: p.state, stage: STAGE[p.state], completeness: p.completeness, version: p.version, updated_at: p.updated_at, review_due_at: p.review_due_at, review_soon: !!(p.review_due_at && p.review_due_at < now() + 14 * DAY), frozen_until: p.frozen_until, name: p.state === 'DRAFT' ? (draftOpen(p.id).I.name || null) : undefined, last_match_at: db.lastMatch.get(p.id) || null }));
  }
  function supervisorHome(actor) {
    need(actor, 'supervisor'); purgeDue(); expirePairs();
    const mine = [...db.profiles.values()].filter((p) => p.supervisor_id === actor.id && p.state !== 'DELETED'), ids = new Set(mine.map((p) => p.id));
    const c = (s) => mine.filter((p) => p.state === s).length;
    const live = [...db.pairs.values()].filter((x) => LIVE_PAIR.includes(x.state) && (ids.has(x.a) || ids.has(x.b)));
    const awaiting = live.filter((x) => [x.a, x.b].some((i) => ids.has(i) && !x.decisions[i])).length, mutual = live.filter((x) => x.state === 'MUTUAL_INTEREST').length;
    const readyToActivate = mine.filter((p) => p.state === 'FROZEN' && (p.frozen_until <= now() || p.exempt_ok)).length;
    const next = mutual ? { label: `${mutual} اقتراح باهتمام الطرفين: تواصل ثم اضغط «تم التواصل»`, link: '#/matches' } : readyToActivate ? { label: `${readyToActivate} ملف جاهز للتفعيل بعد انتهاء التجميد`, link: '#/frozen' } : awaiting ? { label: `${awaiting} طلب مقارنة بانتظار قرارك`, link: '#/matches' } : c('DRAFT') ? { label: 'لديك مسودات لم تُودَع بعد', link: '#/files' } : null;
    return { summary: { drafts: c('DRAFT'), active: c('ACTIVE'), frozen: c('FROZEN'), awaiting, mutual, ready_to_activate: readyToActivate }, next, perms: actor.perms };
  }
  function requestComparison(actor, id) {
    needPerm(actor, 'matches'); const p = ownFile(actor, id, 'ACTIVE');
    const last = db.lastMatch.get(p.id) || 0, wait = cfg.matchCooldownMs - (now() - last);
    if (wait > 0 && db.runs.some((r) => r.trigger === 'supervisor-request' && r.by === p.id)) throw E(429, 'COOLDOWN', `يمكنك طلب المقارنة مجددًا بعد ${Math.ceil(wait / 1000)} ثانية`, { retry_after: Math.ceil(wait / 1000) });
    const before = new Set(db.pairs.keys()); runMatching('supervisor-request'); db.runs[db.runs.length - 1].by = p.id; db.lastMatch.set(p.id, now());
    const fresh = [...db.pairs.values()].filter((x) => (x.a === p.id || x.b === p.id) && !before.has(x.id)).length, live = [...db.pairs.values()].filter((x) => LIVE_PAIR.includes(x.state) && (x.a === p.id || x.b === p.id)).length;
    audit(actor, 'match.request', p.id, 'supervisor-request');
    return { new_pairs: fresh, live_pairs: live, message: fresh ? `وصلت ${fresh} اقتراحات جديدة لهذا الملف` : live ? 'لا اقتراحات جديدة، واقتراحاته الحالية قائمة' : 'لا توجد اقتراحات مناسبة حاليًا' };
  }
  function suggestCorrection(actor, id, { fields, note }) { needPerm(actor, 'intake'); const p = ownFile(actor, id, 'ACTIVE', 'FROZEN'); db.suggestions.push({ profile_id: p.id, fields: (fields || []).filter((f) => Q.FIELDS[f]), note: Q.maskPII(String(note || '').slice(0, 200)), at: now() }); audit(actor, 'profile.suggest', p.id, 'quality'); return { ok: true }; }

  // ---------- معاينة الخيارات المناسبة قبل الإيداع ----------
  const bucket = (n) => (n > 0 && n < cfg.minCell ? `<${cfg.minCell}` : n); // حجب الخلايا الصغيرة
  function previewOptions(actor, draft) {
    needPerm(actor, 'intake');
    const pv = db.previews.get(actor.id) || { n: 0, t: now() }; if (now() - pv.t > 3600e3) { pv.n = 0; pv.t = now(); }
    if (++pv.n > cfg.previewPerHour) throw E(429, 'RATE_LIMIT', 'تجاوزت حد المعاينات. حاول لاحقًا'); db.previews.set(actor.id, pv); // يمنع استنتاج أشخاص بتكرار المعاينة
    const d = mergeDraft({ I: {}, M: {}, S: {}, C: {} }, draft); const m = { ...d.M };
    if (!m.gender) throw E(422, 'NEED_FIELDS', 'اختر الجنس أولًا لعرض الخيارات', { fields: ['gender'] });
    if (d.I.dob && !Q.validate({ I: { dob: d.I.dob } }).errors.dob) m.age = Q.ageOn(d.I.dob, now());
    m.pref_cities = m.pref_cities || []; m.pref_marital = m.pref_marital || []; m.pref_age_min = m.pref_age_min || 18; m.pref_age_max = m.pref_age_max || 90;
    const caller = 'svc:preview', pool = [...db.profiles.values()].filter((p) => p.state === 'ACTIVE');
    const out = { pool: 0, qualifying: 0, needs_clarification: 0, insufficient: 0, below_threshold: 0, excluded: 0, excluded_by: {}, clarify_fields: {} };
    for (const p of pool) { const B = openSection(p, 'M', caller, 'preview'); if (B.gender === m.gender) continue; out.pool++;
      const ev = M.evaluatePair(m, B);
      if (ev.status === 'ELIGIBLE') out.qualifying++; else if (ev.status === 'NEEDS_CLARIFICATION') { out.needs_clarification++; for (const f of ev.unknown) out.clarify_fields[f] = (out.clarify_fields[f] || 0) + 1; }
      else if (ev.status === 'EXCLUDED') { out.excluded++; out.excluded_by[ev.why] = (out.excluded_by[ev.why] || 0) + 1; }
      else if (ev.status === 'INSUFFICIENT') out.insufficient++; else out.below_threshold++; }
    const top = Object.entries(out.excluded_by).sort((x, y) => y[1] - x[1])[0];
    const res = { pool: bucket(out.pool), qualifying: bucket(out.qualifying), needs_clarification: bucket(out.needs_clarification), insufficient: bucket(out.insufficient), below_threshold: bucket(out.below_threshold), excluded: bucket(out.excluded),
      excluded_by: Object.fromEntries(Object.entries(out.excluded_by).map(([k, v]) => [k, bucket(v)])), clarify_fields: Object.fromEntries(Object.entries(out.clarify_fields).map(([k, v]) => [k, bucket(v)])), most_restrictive: top ? top[0] : null,
      missing_for_accuracy: ['age', 'city', 'marital_status'].filter((k) => m[k] === undefined && !(k === 'age' && m.age !== undefined)), capacity: M.RULES.capacity, note: `أعداد تقريبية من الملفات النشطة؛ الخلايا الأقل من ${cfg.minCell} محجوبة. لا تُعرض هوية أحد.` };
    audit(actor, 'options.preview', null, 'preview'); return res;
  }

  // ---------- الدعم الفني ----------
  function openTicket(actor, { classification, description, page } = {}) {
    needPerm(actor, 'support');
    if (!TICKET_CLASSES.includes(classification)) throw E(422, 'BAD_CLASS', 'اختر تصنيف المشكلة', { fields: ['classification'] });
    const d = Q.maskPII(String(description || '').trim()).slice(0, 1000); if (d.length < 10) throw E(422, 'DESC_REQUIRED', 'صف المشكلة بما لا يقل عن 10 أحرف', { fields: ['description'] });
    const t = { id: 't_' + K.rid(5), by: actor.id, by_name: actor.display_name, role: actor.role, classification, description: d, page: page ? String(page).slice(0, 40) : null, state: 'open', at: now(), updated_at: now(), response: null };
    db.tickets.set(t.id, t); audit(actor, 'ticket.open', t.id, classification); return { id: t.id };
  }
  const ticketRow = (t) => ({ id: t.id, by_name: t.by_name, role: t.role, classification: t.classification, description: t.description, page: t.page, state: t.state, at: t.at, updated_at: t.updated_at, response: t.response });
  function myTickets(actor) { needPerm(actor, 'support'); return [...db.tickets.values()].filter((t) => t.by === actor.id).sort((a, b) => b.at - a.at).map(ticketRow); }
  function ticketsAdmin(actor) { need(actor, 'super_admin'); return [...db.tickets.values()].sort((a, b) => (a.state === 'resolved') - (b.state === 'resolved') || b.at - a.at).map(ticketRow); }
  function updateTicket(actor, id, { state, response }) {
    need(actor, 'super_admin'); const t = db.tickets.get(id); if (!t) throw notFound();
    if (!TICKET_STATES.includes(state)) throw E(422, 'BAD_STATE'); t.state = state; if (response !== undefined) t.response = Q.maskPII(String(response).slice(0, 500)); t.updated_at = now();
    audit(actor, 'ticket.update', t.id, state); return ticketRow(t);
  }

  // ---------- المشرف الأول ----------
  function adminDashboard(actor) {
    need(actor, 'super_admin'); const profiles = [...db.profiles.values()];
    const accounts = [...db.users.values()].filter((u) => u.role !== 'super_admin').map((u) => ({ id: u.id, role: u.role, display_name: u.display_name, category: u.category, scope: u.scope, status: u.status, perms: u.perms, review_date: u.verification?.expires_at, expiring_soon: !!(u.verification && u.verification.expires_at < now() + 60 * DAY), load: profiles.filter((p) => p.supervisor_id === u.id && p.state !== 'DELETED').length, last_login: db.audit.filter((e) => e.action === 'auth.login' && e.outcome === 'ok' && e.actor === K.sha(u.id).slice(0, 8)).slice(-1)[0]?.at || null }));
    const exemptions = [...db.exemptions.values()].filter((r) => r.state === 'pending').map((r) => { const p = db.profiles.get(r.profile_id), s = db.users.get(r.supervisor_id); return { id: r.id, profile_code: p?.code, supervisor: s?.display_name, note: r.note, at: r.at, days_left: p?.frozen_until ? Math.max(0, Math.ceil((p.frozen_until - now()) / DAY)) : 0 }; });
    return { accounts, supervisors: accounts.filter((a) => a.role === 'supervisor'), all_perms: SUP_PERMS, pending_approvals: [...db.roleReqs.values()].filter((r) => r.state === 'pending').map(({ id, kind, target, requested_by, at, summary }) => ({ id, kind, target, requested_by, at, summary })), exemptions, unassigned: profiles.filter((p) => !p.supervisor_id && p.state !== 'DELETED').map((p) => ({ id: p.id, code: p.code, state: p.state })) };
  }
  function createAccount(actor, { role, display_name, category, scope, verified_note }) {
    need(actor, 'super_admin'); needReauth(actor);
    if (!['supervisor', 'tech'].includes(role)) throw E(422, 'BAD_ROLE', 'اختر مشرفًا أو مشرفًا تقنيًا');
    if (!display_name || String(display_name).trim().length < 2) throw E(422, 'NAME_REQUIRED', 'اكتب اسم الحساب', { fields: ['display_name'] });
    let verification = null;
    if (role === 'supervisor') {
      if (!['judge', 'lawyer', 'mayor', 'other_verified'].includes(category)) throw E(422, 'BAD_CATEGORY', 'صفة غير صالحة', { fields: ['category'] });
      if (!verified_note || String(verified_note).trim().length < 4) throw E(422, 'VERIFY_REQUIRED', 'وثّق التحقق من الصفة', { fields: ['verified_note'] });
      verification = { category, checked_at: now(), expires_at: now() + 365 * DAY, evidence_ref: K.sha(verified_note).slice(0, 12) };
    }
    const r = newAccount({ role, display_name: String(display_name).trim(), category: role === 'supervisor' ? category : null, scope: Array.isArray(scope) ? scope.slice(0, 20).map(String) : [], verification });
    audit(actor, 'account.create', r.user.id, role); return { id: r.user.id, name: r.name, code: r.code, note: 'سلّم الاسم والرقم لصاحب الحساب عبر قناة آمنة. لن يُعرض الرقم مرة أخرى.' };
  }
  function resetAccount(actor, id) {
    need(actor, 'super_admin'); needReauth(actor); const u = db.users.get(id); if (!u || u.role === 'super_admin') throw notFound();
    let name, nk; do { name = K.genName(); nk = K.nameKey(name); } while ([...db.users.values()].some((x) => x.name_key === nk));
    const code = K.genCode(); u.name_key = nk; u.code_hash = K.hashPassword(K.normCode(code)); killSessions(u.id); db.attempts.delete('l:' + nk);
    audit(actor, 'account.reset', u.id, u.role); return { id: u.id, name, code, note: 'أُبطلت بيانات الدخول القديمة وجلساتها.' };
  }
  function setPerms(actor, id, perms) {
    need(actor, 'super_admin'); const u = db.users.get(id); if (!u || u.role === 'super_admin') throw notFound();
    const allowed = u.role === 'tech' ? ['support'] : SUP_PERMS;
    if (!Array.isArray(perms) || !perms.every((p) => allowed.includes(p))) throw E(422, 'BAD_PERMS', 'صلاحيات غير صالحة');
    u.perms = [...new Set(perms)]; audit(actor, 'perms.set', u.id, u.perms.join(',') || 'none'); return { perms: u.perms };
  }
  function requestRoleChange(actor, { target, action, note }) {
    need(actor, 'super_admin'); const u = db.users.get(target); if (!u || u.id === actor.id || u.role === 'super_admin') throw E(422, 'BAD_TARGET');
    if (!['suspend', 'activate', 'renew_verification'].includes(action)) throw E(422, 'BAD_ACTION');
    const r = { id: 'rc_' + K.rid(6), kind: action, target, requested_by: actor.id, at: now(), state: 'pending', summary: `${{ suspend: 'تعليق', activate: 'تفعيل', renew_verification: 'تجديد التحقق' }[action]} ← ${u.display_name || u.role}`, note: Q.maskPII(String(note || '').slice(0, 200)) };
    db.roleReqs.set(r.id, r); audit(actor, 'role.request', r.id, action); return { id: r.id };
  }
  function approveRoleChange(actor, id, approve = true) {
    need(actor, 'super_admin'); const r = db.roleReqs.get(id); if (!r || r.state !== 'pending') throw notFound();
    if (r.requested_by === actor.id) throw E(403, 'SELF_APPROVAL', 'لا يعتمد الشخص طلبه'); // فصل المهام
    r.state = approve ? 'approved' : 'rejected'; r.decided_by = actor.id; const u = db.users.get(r.target);
    if (approve) {
      if (r.kind === 'suspend') { u.status = 'suspended'; killSessions(u.id); for (const p of db.profiles.values()) if (p.supervisor_id === u.id && p.state !== 'DELETED') { p.supervisor_id = null; } }
      if (r.kind === 'activate') u.status = 'active';
      if (r.kind === 'renew_verification' && u.verification) u.verification.expires_at = now() + 365 * DAY;
    }
    audit(actor, 'role.decide', id, r.kind, approve ? 'ok' : 'rejected'); return { state: r.state };
  }
  /** استثناء مدة التجميد: القرار للمشرف الأول، والتفعيل بعده يبقى من المشرف. */
  function decideExemption(actor, id, approve) {
    need(actor, 'super_admin'); const r = db.exemptions.get(id); if (!r || r.state !== 'pending') throw notFound(); const p = db.profiles.get(r.profile_id);
    r.state = approve ? 'approved' : 'rejected'; r.decided_by = actor.id; r.decided_at = now(); if (approve && p && p.state === 'FROZEN') p.exempt_ok = true;
    audit(actor, 'exemption.decide', r.id, approve ? 'approved' : 'rejected'); return { state: r.state };
  }
  function reassign(actor, pid, supervisor_id) {
    need(actor, 'super_admin'); const p = db.profiles.get(pid), s = db.users.get(supervisor_id); if (!p || p.state === 'DELETED' || !s || s.role !== 'supervisor' || s.status !== 'active') throw notFound();
    p.supervisor_id = s.id; audit(actor, 'profile.reassign', pid, 'ops'); return { ok: true };
  }
  const triggerMatch = (actor) => { need(actor, 'super_admin'); const r = runMatching('ops-trigger'); return { run_id: r.run_id, created: r.created, profiles: r.profiles }; };
  function auditLog(actor, { action, role, from, to } = {}) {
    need(actor, 'super_admin');
    const ev = db.audit.filter((e) => (!action || e.action === action) && (!role || e.role === role) && (!from || e.at >= from) && (!to || e.at <= to)).map(({ actor: a, resource, ...r }) => r);
    return { chain_valid: verifyAuditChain(), events: ev.slice(-200).reverse() };
  }

  function adminOverview(actor) {
    need(actor, 'super_admin'); const byState = (m, f) => { const o = {}; for (const x of m.values()) o[f(x)] = (o[f(x)] || 0) + 1; return o; };
    const pst = byState(db.profiles, (p) => p.state), qst = byState(db.pairs, (x) => x.state);
    const profiles = [...db.profiles.values()], pairs = [...db.pairs.values()], active = pst.ACTIVE || 0;
    const load = activeLoad(); const live = pairs.filter((x) => LIVE_PAIR.includes(x.state)).length;
    const interested = (x) => Object.values(x.decisions).filter((d) => d === 'interested').length;
    const funnel = [['ملفات مُنشأة', profiles.length], ['مودعة (أُودعت مرة على الأقل)', profiles.filter((p) => p.version > 0).length], ['اقتراحات أُنشئت', pairs.length], ['اهتمام من جانب أو أكثر', pairs.filter((x) => interested(x) >= 1).length], ['اهتمام الطرفين', pairs.filter((x) => interested(x) === 2).length], ['تم التواصل', qst.CONTACTED || 0]];
    let hist = { '70–79': 0, '80–89': 0, '90–100': 0 }; for (const x of pairs) { try { const s = K.open(kms, x.score_enc, 'svc:analytics', 'score-histogram').mutual; hist[s >= 90 ? '90–100' : s >= 80 ? '80–89' : '70–79']++; } catch {} }
    const staff = [...db.users.values()].filter((u) => u.role !== 'super_admin'), sups = staff.filter((u) => u.role === 'supervisor');
    const alerts = [];
    for (const u of sups) if (u.status === 'active' && u.verification?.expires_at < now() + 60 * DAY) alerts.push({ level: 'warn', text: `تنتهي صلاحية تحقق ${u.display_name} خلال أقل من 60 يومًا`, link: '#/admin/supervisors' });
    const unassigned = profiles.filter((p) => !p.supervisor_id && p.state !== 'DELETED').length; if (unassigned) alerts.push({ level: 'bad', text: `${unassigned} ملف بلا مشرف ويحتاج إعادة إسناد`, link: '#/admin/supervisors' });
    const exPend = [...db.exemptions.values()].filter((r) => r.state === 'pending').length; if (exPend) alerts.push({ level: 'warn', text: `${exPend} طلب استثناء مدة تجميد بانتظار قرارك`, link: '#/admin/approvals' });
    const pend = [...db.roleReqs.values()].filter((r) => r.state === 'pending').length; if (pend) alerts.push({ level: 'warn', text: `${pend} طلب بانتظار اعتماد مستقل`, link: '#/admin/approvals' });
    const tOpen = [...db.tickets.values()].filter((t) => t.state !== 'resolved').length; if (tOpen) alerts.push({ level: 'info', text: `${tOpen} طلب دعم فني مفتوح`, link: '#/admin/tickets' });
    const unfreezeToday = profiles.filter((p) => p.state === 'FROZEN' && p.frozen_until <= now() + DAY).length; if (unfreezeToday) alerts.push({ level: 'info', text: `${unfreezeToday} ملف تنتهي مدة تجميده خلال 24 ساعة`, link: '#/admin/overview' });
    const cardsSoon = pairs.filter((x) => LIVE_PAIR.includes(x.state) && x.expires_at < now() + DAY).length; if (cardsSoon) alerts.push({ level: 'info', text: `${cardsSoon} اقتراح تنتهي صلاحيته خلال 24 ساعة`, link: '#/admin/engine' });
    if (!verifyAuditChain()) alerts.push({ level: 'bad', text: 'سلسلة التدقيق فشل التحقق منها: اكتُشف عبث محتمل', link: '#/admin/security' });
    const deniedLogins = db.audit.filter((e) => e.action === 'auth.login' && e.outcome === 'denied' && e.at > now() - 3600e3).length;
    const denied = db.audit.filter((e) => e.outcome === 'denied' && e.at > now() - 24 * 3600e3).length;
    if (deniedLogins >= 10) alerts.push({ level: 'bad', text: `${deniedLogins} محاولة دخول فاشلة في الساعة الأخيرة`, link: '#/admin/security' });
    const rules = { ...M.RULES, dimensions: Q.DIMENSIONS, hard_allowed: Q.HARD_ALLOWED, freeze_days: FREEZE_DAYS };
    return {
      generated_at: now(), demo: cfg.demo,
      kpis: { profiles_total: profiles.length, active, frozen: pst.FROZEN || 0, drafts: pst.DRAFT || 0, cancelled: pst.DELETED || 0, pairs_live: live, pairs_mutual: qst.MUTUAL_INTEREST || 0, contacted: qst.CONTACTED || 0, declined: qst.DECLINED || 0, capacity_use: active ? Math.round(100 * [...load.values()].filter((v) => v > 0).length / active) : 0,
        supervisors_active: sups.filter((u) => u.status === 'active').length, supervisors_suspended: sups.filter((u) => u.status !== 'active').length, tech_active: staff.filter((u) => u.role === 'tech' && u.status === 'active').length, tickets_open: tOpen, exemptions_pending: exPend },
      profiles_by_state: Object.fromEntries(Object.entries(pst).map(([k, v]) => [k, bucket(v)])), pairs_by_state: Object.fromEntries(Object.entries(qst).map(([k, v]) => [k, bucket(v)])), funnel: funnel.map(([l, v]) => [l, bucket(v)]), score_histogram: Object.fromEntries(Object.entries(hist).map(([k, v]) => [k, bucket(v)])),
      runs: db.runs.slice(-10).reverse().map((r) => ({ id: r.id, at: r.at, trigger: r.trigger, ms: r.ms, rules: r.rules, stats: r.stats })),
      rules, alerts,
      workload: sups.map((u) => ({ name: u.display_name, status: u.status, load: profiles.filter((p) => p.supervisor_id === u.id && p.state !== 'DELETED').length, drafts: profiles.filter((p) => p.supervisor_id === u.id && p.state === 'DRAFT').length, frozen: profiles.filter((p) => p.supervisor_id === u.id && p.state === 'FROZEN').length })),
      security: { audit_events: db.audit.length, chain_valid: verifyAuditChain(), denied_24h: denied, failed_logins_1h: deniedLogins, sessions_active: db.sessions.size, kms: { keys: kms.keks.size, destroyed: kms.destroyed.size, unwraps_by_service: kms.counters }, tombstones: db.tombstones.size, deletion_jobs: db.deletionJobs.length, accounts_total: db.users.size, accounts_suspended: [...db.users.values()].filter((u) => u.status !== 'active').length },
      recent_audit: db.audit.slice(-12).reverse().map(({ actor: _a, resource: _r, prev, hash, ...e }) => e),
    };
  }

  return { HttpError, db, kms, cfg, clock, POLICY_VERSION, CONSENT_TEXT, FREEZE_DAYS, SUP_PERMS, TICKET_CLASSES, audit, verifyAuditChain, newAccount, publicUser, login, session, reauth, logout, bootstrapAdmin,
    createDraft, readDraft, updateDraft, publicSchema, submitProfile, renewProfile, readProfile, correctProfile, runMatching, myMatches, decide, markContact, myFrozen, activateProfile, requestExemption, cancelProfile, purgeDue, restoreFromBackup, expirePairs,
    listFiles, supervisorHome, requestComparison, suggestCorrection, previewOptions, openTicket, myTickets, ticketsAdmin, updateTicket,
    adminDashboard, createAccount, resetAccount, setPerms, requestRoleChange, approveRoleChange, decideExemption, reassign, triggerMatch, auditLog, adminOverview };
}
module.exports = { createApp, HttpError };
