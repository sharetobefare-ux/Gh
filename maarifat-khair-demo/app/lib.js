'use strict';
// أدوات الواجهة: بناء DOM آمن (textContent فقط)، API، رسائل، حوارات، TOTP للعرض التجريبي.
const MK = (window.MK = {});
MK.h = function h(tag, attrs, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === false || v === null || v === undefined) continue;
    if (k === 'class') el.className = v; else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v; else if (k === 'checked' || k === 'disabled' || k === 'selected' || k === 'open') el[k] = !!v; else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of kids.flat(Infinity)) { if (c === null || c === undefined || c === false) continue; el.append(c.nodeType ? c : document.createTextNode(String(c))); }
  return el;
};
const h = MK.h;
MK.L = { // تسميات القيم
  man: 'رجل', woman: 'امرأة', never_married: 'لم يسبق الزواج', divorced: 'مطلق/ة', widowed: 'أرمل/ة', none: 'لا', has: 'نعم', '0-6': 'خلال 0–6 أشهر', '6-12': 'خلال 6–12 شهرًا', '12+': 'بعد أكثر من 12 شهرًا',
  independent: 'سكن مستقل', family: 'ضمن منزل الأسرة', flexible: 'مرن', yes: 'نعم', no: 'لا', conditional: 'بشروط', frequent: 'نعم، متكرر', supports: 'أدعمه', prefers_not: 'أفضل ألا يعمل', undecided: 'غير محسوم', accepts: 'أقبل', rejects: 'لا أقبل', not_applicable: 'غير منطبق',
  secondary: 'ثانوي', diploma: 'دبلوم', bachelor: 'بكالوريوس', postgrad: 'دراسات عليا', quiet: 'هادئة', balanced: 'متوازنة', social: 'اجتماعية كثيرة', unknown: 'غير معروف', prefer_not_to_answer: 'أفضل عدم الإجابة',
  place: 'السكن والمكان', family_dim: 'تكوين الأسرة', work: 'العمل والتعليم', lifestyle: 'نمط الحياة', values: 'القيم والتواصل', high: 'مرتفعة', normal: 'عادية', low: 'منخفضة',
  age_range: 'نطاق العمر', region: 'المنطقة', bio: 'النبذة', education: 'التعليم', work_field: 'مجال العمل', timeline: 'توقيت البدء', housing: 'السكن', city: 'المدينة', social_style: 'نمط الحياة', langs: 'اللغات', wants_children: 'الإنجاب', children: 'الأبناء', name: 'الاسم', phone: 'الهاتف', contact_window: 'وقت التواصل',
  platform_coordination: 'تنسيق عبر المنصة', direct_contact: 'تواصل مباشر', timing: 'التوقيت', distance: 'المسافة', preferences: 'التفضيلات', prefer_not: 'أفضل عدم الإجابة',
  judge: 'قاضٍ', lawyer: 'محامٍ', mayor: 'عمدة', other_verified: 'صفة أخرى متحقق منها',
  super_admin: 'مشرف أعلى', supervisor: 'مشرف موثوق', participant: 'صاحب ملف', privacy_officer: 'مسؤول خصوصية', auditor: 'مدقق', support: 'دعم',
  DRAFT: 'قيد الإدخال', PENDING_OWNER: 'بانتظار صاحب الملف', SEALED: 'مودع', VALIDATING: 'تحقق', ACTIVE: 'نشط', PAUSED: 'موقوف', CORRECTION_PENDING: 'بانتظار تصحيح', WITHDRAWN: 'مسحوب', DELETION_PENDING: 'حذف قيد التنفيذ', DELETED: 'محذوف',
  PROPOSED: 'مقترح', INTEREST_ONE_SIDE: 'اهتمام من طرف', MUTUAL_INTEREST: 'اهتمام متبادل', DISCLOSURE_PENDING: 'بانتظار الكشف', INTRODUCTION_ACTIVE: 'تعارف نشط', CLOSED: 'مغلق', DECLINED: 'لم يستمر', EXPIRED: 'منتهٍ', REVOKED: 'مُبطل',
};
MK.t = (v) => MK.L[v] ?? v;
MK.fmt = (ms) => (ms ? new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(ms)) : '—');
MK.fmtD = (ms) => (ms ? new Intl.DateTimeFormat('ar-SA-u-ca-gregory-nu-latn', { dateStyle: 'medium' }).format(new Date(ms)) : '—');

MK.api = async function api(method, url, body) {
  let r;
  try { r = await fetch(url, { method, headers: { 'Content-Type': 'application/json', 'X-MK': '1' }, body: body === undefined ? undefined : JSON.stringify(body), credentials: 'same-origin' }); }
  catch { MK.toast('الاتصال ضعيف. لم يُرسل شيء، أعد المحاولة.', true); throw new Error('network'); }
  let data = {}; try { data = await r.json(); } catch {}
  if (r.status === 401 && data.error === 'UNAUTHENTICATED') { MK.user = null; MK.toLogin(); throw Object.assign(new Error('session'), { status: 401 }); }
  if (r.status === 401 && data.reauth) { const ok = await MK.reauth(); if (ok) return MK.api(method, url, body); throw Object.assign(new Error('reauth'), { status: 401, silent: true }); }
  if (!r.ok) throw Object.assign(new Error(data.message || 'خطأ'), { status: r.status, code: data.error, data });
  return data;
};
MK.get = (u) => MK.api('GET', u); MK.post = (u, b) => MK.api('POST', u, b || {}); MK.patch = (u, b) => MK.api('PATCH', u, b);
MK.toast = (msg, bad) => { document.querySelectorAll('.toast').forEach((x) => x.remove()); const t = h('div', { class: 'toast' + (bad ? ' bad' : ''), role: bad ? 'alert' : 'status' }, h('span', null, msg), h('button', { type: 'button', class: 'toast-x', 'aria-label': 'إغلاق', onclick: () => t.remove() }, '✕')); document.body.append(t); setTimeout(() => t.remove(), bad ? 9000 : 6000); };
// حجم الخط: تفضيل لكل جهاز (عادي / كبير / أكبر) لتسهيل القراءة لكبار السن
MK.TEXT_SIZES = [['normal', 'عادي'], ['large', 'كبير'], ['xl', 'أكبر']];
MK.getText = () => { try { return localStorage.getItem('mk_text') || 'normal'; } catch { return 'normal'; } };
MK.setText = (v) => { try { localStorage.setItem('mk_text', v); } catch {} document.documentElement.dataset.text = v; };
MK.setText(MK.getText());
MK.textControl = () => h('div', { class: 'textsize', role: 'group', 'aria-label': 'حجم الخط' }, h('span', null, 'حجم الخط'), h('div', { class: 'seg' }, MK.TEXT_SIZES.map(([v, l]) => h('label', { class: 'seg-o' }, h('input', { type: 'radio', name: 'txt', value: v, checked: MK.getText() === v, onchange: () => MK.setText(v) }), l))));
MK.fail = (e) => { if (!e.silent && e.status !== 401) MK.toast(e.message || 'حدث خطأ', true); };
MK.nav = (p) => { if (location.hash === '#' + p) window.dispatchEvent(new HashChangeEvent('hashchange')); else location.hash = p; };

MK.dialog = function dialog(title, content, buttons) {
  return new Promise((resolve) => {
    const d = h('dialog', { 'aria-labelledby': 'dlg-t' }, h('h3', { id: 'dlg-t' }, title), content,
      h('div', { class: 'actions', style: undefined }, ...buttons.map((b) => h('button', { class: 'btn ' + (b.cls || ''), type: 'button', onclick: async () => { if (b.value === false || !b.validate || await b.validate()) { d.close(); d.remove(); resolve(b.value); } } }, b.label))));
    d.addEventListener('cancel', () => { d.remove(); resolve(false); });
    document.body.append(d); d.showModal();
  });
};
MK.confirm = (title, text, yes = 'تأكيد', cls = '') => MK.dialog(title, h('p', null, text), [{ label: yes, value: true, cls }, { label: 'إلغاء', value: false, cls: 'secondary' }]);

// إعادة التحقق (خطوة أعلى): يُدخل المستخدم الرقم السري مرة أخرى
MK.reauth = async function () {
  const input = h('input', { id: 'rc', type: 'password', dir: 'ltr', autocomplete: 'off', spellcheck: 'false', 'aria-describedby': 'rc-e' }); const err = h('div', { class: 'err', id: 'rc-e', role: 'alert' });
  const ok = await MK.dialog('إعادة التحقق', h('div', null, h('p', null, 'هذا إجراء حساس. أدخل الرقم الخاص بك مرة أخرى للمتابعة.'), h('label', { for: 'rc' }, 'الرقم'), input, err), [
    { label: 'تحقق', value: true, validate: async () => { try { await MK.post('/api/auth/reauth', { code: input.value }); return true; } catch (e) { err.textContent = e.message; return false; } } },
    { label: 'إلغاء', value: false, cls: 'secondary' }]);
  return ok;
};
MK.BASE = '../'; MK.LOGIN = '../index.html';
MK.toLogin = () => { if (window.MK_BROWSER_DEMO) location.reload(); else location.href = MK.LOGIN; };

MK.icons = {
  home: 'M3 11l9-8 9 8M5 10v10h14V10', list: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01', plus: 'M12 5v14M5 12h14', shield: 'M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z', users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4', file: 'M14 3H6v18h12V7zM14 3v4h4M9 13h6M9 17h6', help: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M9.5 9a2.5 2.5 0 1 1 3.5 2.3c-.7.4-1 1-1 1.7M12 17h.01', out: 'M9 21H5V3h4M16 17l5-5-5-5M21 12H9', chart: 'M4 20V10M10 20V4M16 20v-8M22 20H2', link: 'M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1',
};
MK.icon = (n) => { const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg'); s.setAttribute('viewBox', '0 0 24 24'); s.setAttribute('class', 'icon'); s.setAttribute('aria-hidden', 'true'); const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('d', MK.icons[n] || MK.icons.file); s.append(p); return s; };

Object.assign(MK.L, {
  super_admin: 'المشرف الأول', supervisor: 'مشرف', tech: 'مشرف تقني',
  DRAFT: 'مسودة', ACTIVE: 'نشط', FROZEN: 'مجمّد', DELETED: 'ملغى',
  PROPOSED: 'طلب مقارنة جديد', INTEREST_ONE_SIDE: 'اهتمام من جانب', MUTUAL_INTEREST: 'اهتمام الطرفين', CONTACTED: 'تم التواصل', DECLINED: 'لم يستمر', EXPIRED: 'منتهٍ', REVOKED: 'مُبطل',
  interested: 'مناسب', not_interested: 'غير مناسب', later: 'لاحقًا',
  intake: 'إضافة الطلبات وإدارة الملفات', browse: 'الاطلاع على ملفات المشرفين', matches: 'طلبات المقارنة', contact: 'تم التواصل وتفعيل الملفات', cancel: 'إلغاء حسابات المستفيدين', exempt: 'طلب استثناء مدة التجميد', support: 'الدعم الفني',
  login: 'تسجيل الدخول', page_error: 'خطأ في صفحة', matching: 'المطابقة والمقارنة', data: 'البيانات', permissions: 'الصلاحيات', security: 'أمني', other: 'أخرى',
  open: 'مفتوح', in_progress: 'قيد المعالجة', resolved: 'تم الحل', pending: 'بانتظار القرار', approved: 'مقبول', rejected: 'مرفوض', active: 'نشط', suspended: 'معلّق',
});

// ---------- حركة: نابض فيزيائي قابل للمقاطعة (يبدأ من القيمة الحالية ويرث السرعة) ----------
MK.reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
MK.spring = function (apply, opt = {}) {
  const k = opt.stiffness ?? 420, ratio = opt.ratio ?? 1, c = 2 * Math.sqrt(k) * ratio; // ratio 1 = حرج بلا ارتداد
  let x = 0, v = 0, target = 0, raf = 0, last = 0, done = null;
  const step = (t) => { let dt = (t - last) / 1000; last = t; if (!(dt > 0)) dt = 0.016; dt = Math.min(dt, 0.05);
    for (let i = 0, n = Math.ceil(dt / 0.004); i < n; i++) { const h = dt / n; v += (-k * (x - target) - c * v) * h; x += v * h; }
    if (Math.abs(v) < 2 && Math.abs(x - target) < 0.5) { x = target; v = 0; apply(x); raf = 0; const d = done; done = null; d && d(); return; }
    apply(x); raf = requestAnimationFrame(step); };
  return {
    get x() { return x; }, get v() { return v; }, get active() { return !!raf; },
    set(val) { this.stop(); x = val; v = 0; apply(x); },
    to(t, v0, cb) { target = t; if (v0 !== undefined) v = v0; done = cb || null; if (MK.reducedMotion()) { this.stop(); x = t; v = 0; apply(x); cb && cb(); return; } if (!raf) { last = performance.now(); raf = requestAnimationFrame(step); } },
    stop() { if (raf) cancelAnimationFrame(raf); raf = 0; },
  };
};
// إسقاط الزخم: أين سيستقر العنصر لو تُرك بسرعته الحالية (نفس دالة iOS)
MK.project = (v, rate = 0.998) => ((v / 1000) * rate) / (1 - rate);
MK.rubberband = (over, dim, c = 0.55) => (over * dim * c) / (dim + c * Math.abs(over));
