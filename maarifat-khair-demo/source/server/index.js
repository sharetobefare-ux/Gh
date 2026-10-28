'use strict';
const http = require('node:http'), path = require('node:path');
const { createApp } = require('./app'), { seed } = require('./seed'), { createHandler } = require('./http');
const demo = process.argv.includes('--demo') || process.env.MK_DEMO === '1';
if (demo && process.env.NODE_ENV === 'production') { console.error('وضع العرض (حسابات وكلمات مرور معروفة) ممنوع في الإنتاج.'); process.exit(1); }
const app = createApp({ demo, minCell: demo ? 1 : 5 });
if (demo) { seed(app, { scenario: true }); console.log('وضع العرض: بيانات اصطناعية. حجب الخلايا الصغيرة معطّل. بيانات الدخول (اسم + رقم) تظهر في شاشة الدخول.'); }
else { const b = app.bootstrapAdmin(); if (b) console.log(`أُنشئ المشرف الأول. الاسم: ${b.name}\nالرقم: ${b.code}\nاحفظهما الآن؛ لن يُعرضا مرة أخرى.`); }
const handler = createHandler(app, path.join(__dirname, '..', 'web'), { trustProxy: process.env.MK_TRUST_PROXY === '1' });
setInterval(() => { app.expirePairs(); app.purgeDue(); app.runMatching('schedule'); }, 15 * 60e3).unref();
const port = +process.env.PORT || 3000;
const srv = http.createServer(handler);
srv.headersTimeout = 15e3; srv.requestTimeout = 30e3; srv.keepAliveTimeout = 5e3; srv.maxHeadersCount = 50; // حماية من الاتصالات البطيئة
srv.listen(port, process.env.HOST || '127.0.0.1', () => console.log(`معرفة خير تعمل على http://localhost:${port}`));
