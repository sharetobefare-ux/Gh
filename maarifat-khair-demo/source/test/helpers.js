const { createApp } = require('../server/app'); const { seed } = require('../server/seed'); const K = require('../server/crypto');
function boot(opts = {}) { const t = { v: Date.UTC(2026, 9, 17) }; const app = createApp({ demo: true, minCell: 1, now: () => t.v }); const s = seed(app, { extra: false, ...opts });
  const as = (key, reauth = true) => { const sid = 'T' + K.rid(6); app.db.sessions.set(sid, { uid: s.users[key].id, at: t.v, last: t.v, reauth: reauth ? t.v : 0 }); return app.session(sid); };
  return { app, s, t, as }; }
module.exports = { boot };
