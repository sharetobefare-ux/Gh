'use strict';
// نواة API غير مرتبطة بخادم HTTP: تعمل في Node وداخل المتصفح (للنسخة التجريبية المضمّنة).
const { HttpError } = require('./app');
function buildRouter(app) {
  const R = [];
  const add = (m, p, h, o = {}) => R.push({ m, re: new RegExp('^' + p.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), h, ...o });
  const pub = { auth: false };
  add('GET', '/api/health', () => ({ ok: true }), pub);
  // الدخول: اسم (كلمات) + رقم (رموز). لا يوجد تسجيل ذاتي ولا مستفيدون.
  add('POST', '/api/auth/login', (c) => { const r = app.login(c.body.name, c.body.code); c.setSession(r.sid); return { user: r.user }; }, pub);
  add('POST', '/api/auth/reauth', (c) => app.reauth(c.actor, c.body.code));
  add('POST', '/api/auth/logout', (c) => { app.logout(c.actor.sid); c.setSession(null); return { ok: true }; });
  add('GET', '/api/auth/me', (c) => app.publicUser(c.actor));
  add('GET', '/api/schema', (c) => { if (c.actor.role !== 'supervisor') throw new HttpError(403, 'FORBIDDEN', 'غير مصرح'); return { fields: app.publicSchema(), consent_text: app.CONSENT_TEXT, policy_version: app.POLICY_VERSION, freeze_days: app.FREEZE_DAYS }; });
  add('GET', '/api/demo/accounts', () => { if (!app.cfg.demo) throw new HttpError(404, 'NOT_FOUND'); return { accounts: app.db.demoCreds }; }, pub);
  // المشرف الأول
  add('GET', '/api/admin/overview', (c) => app.adminOverview(c.actor), { nostore: true });
  add('GET', '/api/admin/dashboard', (c) => app.adminDashboard(c.actor), { nostore: true });
  add('POST', '/api/admin/accounts', (c) => app.createAccount(c.actor, c.body));
  add('POST', '/api/admin/accounts/:id/reset', (c) => app.resetAccount(c.actor, c.params.id));
  add('POST', '/api/admin/accounts/:id/perms', (c) => app.setPerms(c.actor, c.params.id, c.body.perms));
  add('POST', '/api/admin/role-change-requests', (c) => app.requestRoleChange(c.actor, c.body));
  add('POST', '/api/admin/role-change-requests/:id/decision', (c) => app.approveRoleChange(c.actor, c.params.id, c.body.approve !== false));
  add('POST', '/api/admin/exemptions/:id/decision', (c) => app.decideExemption(c.actor, c.params.id, c.body.approve !== false));
  add('POST', '/api/admin/profiles/:id/reassign', (c) => app.reassign(c.actor, c.params.id, c.body.supervisor_id));
  add('POST', '/api/admin/match-runs', (c) => app.triggerMatch(c.actor));
  add('GET', '/api/admin/tickets', (c) => app.ticketsAdmin(c.actor));
  add('POST', '/api/admin/tickets/:id', (c) => app.updateTicket(c.actor, c.params.id, c.body));
  add('GET', '/api/audit', (c) => app.auditLog(c.actor, { action: c.query.get('action') || undefined, role: c.query.get('role') || undefined, from: +c.query.get('from') || undefined, to: +c.query.get('to') || undefined }));
  // المشرف
  add('GET', '/api/sup/home', (c) => app.supervisorHome(c.actor), { nostore: true });
  add('GET', '/api/sup/files', (c) => app.listFiles(c.actor), { nostore: true });
  add('POST', '/api/profiles/drafts', (c) => app.createDraft(c.actor, c.body));
  add('GET', '/api/profiles/:id/draft', (c) => app.readDraft(c.actor, c.params.id), { nostore: true });
  add('PATCH', '/api/profiles/:id/draft', (c) => app.updateDraft(c.actor, c.params.id, c.body));
  add('POST', '/api/profiles/:id/submit', (c) => app.submitProfile(c.actor, c.params.id, c.body));
  add('POST', '/api/profiles/:id/renew', (c) => app.renewProfile(c.actor, c.params.id, c.body));
  add('GET', '/api/profiles/:id/data', (c) => app.readProfile(c.actor, c.params.id), { nostore: true });
  add('POST', '/api/profiles/:id/correction', (c) => app.correctProfile(c.actor, c.params.id, c.body));
  add('POST', '/api/profiles/:id/comparison', (c) => app.requestComparison(c.actor, c.params.id));
  add('GET', '/api/browse', (c) => app.browseProfiles(c.actor, { gender: c.query.get('gender') || undefined, city: c.query.get('city') || undefined, state: c.query.get('state') || undefined }));
  add('GET', '/api/browse/:id', (c) => app.browseProfile(c.actor, c.params.id));
  add('POST', '/api/browse/:id/match', (c) => app.directMatch(c.actor, c.body.my_profile_id, c.params.id));
  add('GET', '/api/profiles/:id/files', (c) => app.listFilesOf(c.actor, c.params.id));
  add('POST', '/api/profiles/:id/files', (c) => app.addFile(c.actor, c.params.id, c.body));
  add('GET', '/api/profiles/:id/files/:fid', (c) => app.readFile(c.actor, c.params.id, c.params.fid));
  add('DELETE', '/api/profiles/:id/files/:fid', (c) => app.deleteFile(c.actor, c.params.id, c.params.fid));
  add('POST', '/api/profiles/:id/cancel', (c) => app.cancelProfile(c.actor, c.params.id, c.body));
  add('POST', '/api/profiles/:id/activate', (c) => app.activateProfile(c.actor, c.params.id));
  add('POST', '/api/profiles/:id/exemption', (c) => app.requestExemption(c.actor, c.params.id, c.body));
  add('POST', '/api/profiles/:id/correction-suggestions', (c) => app.suggestCorrection(c.actor, c.params.id, c.body));
  add('POST', '/api/options/preview', (c) => app.previewOptions(c.actor, c.body), { nostore: true });
  add('GET', '/api/matches', (c) => app.myMatches(c.actor), { nostore: true });
  add('POST', '/api/pairs/:id/decision', (c) => app.decide(c.actor, c.params.id, c.body));
  add('POST', '/api/pairs/:id/contact', (c) => app.markContact(c.actor, c.params.id, c.body));
  add('GET', '/api/frozen', (c) => app.myFrozen(c.actor), { nostore: true });
  // الدعم الفني (المشرف التقني، وكل من منحه المشرف الأول صلاحية الدعم)
  add('POST', '/api/support/tickets', (c) => app.openTicket(c.actor, c.body));
  add('GET', '/api/support/tickets', (c) => app.myTickets(c.actor), { nostore: true });
  return R;
}


function createCore(app) {
  const routes = buildRouter(app);
  /** req: {method, pathname, query:URLSearchParams, body, sid, headers} -> {status, json, setSid} */
  return async function handle(req) {
    const r = routes.find((x) => x.m === req.method && x.re.test(req.pathname));
    if (!r) return { status: 404, json: { error: 'NOT_FOUND' } };
    if (req.method !== 'GET' && req.headers?.['x-mk'] !== '1') return { status: 403, json: { error: 'CSRF' } }; // رأس مخصص + SameSite=Strict
    const actor = req.sid ? app.session(req.sid) : null;
    if (r.auth !== false && !actor) return { status: 401, json: { error: 'UNAUTHENTICATED', message: 'انتهت الجلسة' } };
    let setSid;
    const ctx = { actor, body: req.body || {}, params: req.pathname.match(r.re).groups || {}, query: req.query || new URLSearchParams(), setSession: (v) => { setSid = v; } };
    try { const out = await r.h(ctx); return { status: 200, json: out ?? {}, setSid }; }
    catch (e) {
      if (e instanceof HttpError) return { status: e.status, json: { error: e.code, message: e.message, ...(e.extra || {}) } };
      console.error('internal error:', e.code || e.name); // لا نسجل محتوى
      return { status: 500, json: { error: 'INTERNAL', message: 'حدث خطأ عام' } };
    }
  };
}
module.exports = { buildRouter, createCore };
