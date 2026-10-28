'use strict';
// صفحات التطبيق بعد الدخول. كل نص عبر textContent (لا innerHTML). الخادم يفرض الصلاحيات، والواجهة تُظهر صفحات الدور فقط.
(function () {
  const { h, t, get, post, patch, toast, fail, fmt, fmtD } = MK;
  const root = document.getElementById('root'), live = document.getElementById('live');
  let schemaCache = null;
  const schema = async () => (schemaCache ||= await get('/api/schema'));
  const loading = () => h('div', { role: 'status', 'aria-label': 'جارٍ التحميل' }, h('div', { class: 'skeleton' }), h('p', null), h('div', { class: 'skeleton' }));
  const badge = (s, cls) => h('span', { class: 'badge ' + (cls || '') }, t(s));
  const stateCls = (s) => (['ACTIVE', 'MUTUAL_INTEREST', 'approved', 'resolved', 'active'].includes(s) ? 'ok' : ['FROZEN', 'pending', 'open', 'in_progress', 'DRAFT'].includes(s) ? 'warn' : ['DELETED', 'DECLINED', 'REVOKED', 'rejected', 'suspended'].includes(s) ? 'bad' : '');
  const DIML = { place: 'السكن والمكان', family: 'تكوين الأسرة وتوقيت الزواج', work: 'العمل والتعليم', lifestyle: 'نمط الحياة', values: 'التواصل والقيم' };
  const PERM_HELP = { intake: 'ينشئ الطلبات ويودعها ويعدّلها', matches: 'يستقبل طلبات المقارنة ويقرر فيها', contact: 'يضغط «تم التواصل» ويفعّل الملفات المجمّدة', cancel: 'يلغي ملفات المستفيدين', exempt: 'يرفع طلب استثناء مدة التجميد', browse: 'يطّلع على بيانات التوافق لكل الملفات النشطة لدى كل المشرفين (بلا أسماء ولا هواتف) ويطلب مطابقة مباشرة مع ملفاته', support: 'يرفع طلبات الدعم الفني' };
  const SVGNS = 'http://www.w3.org/2000/svg';
  const sv = (tag, attrs, ...kids) => { const el = document.createElementNS(SVGNS, tag); for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v); kids.flat().forEach((c) => c != null && el.append(c.nodeType ? c : document.createTextNode(String(c)))); return el; };
  const loadScript = (src) => new Promise((res, rej) => { const s = h('script', { src }); s.onload = res; s.onerror = rej; document.head.append(s); });
  const copy = async (text, btn) => { try { await navigator.clipboard.writeText(text); toast('تم النسخ'); } catch { const i = btn.closest('.cred-row').querySelector('input'); i.select(); toast('حدّد النص وانسخه يدويًا'); } };

  // ---------- القوائم حسب الدور والصلاحية ----------
  const NAVDEF = {
    supervisor: [['/dash', 'home', 'الرئيسية'], ['/files', 'file', 'ملفاتي', 'intake'], ['/new', 'plus', 'إضافة طلب', 'intake'], ['/matches', 'link', 'طلبات المقارنة', 'matches'], ['/browse', 'users', 'ملفات المشرفين', 'browse'], ['/frozen', 'lock', 'الملفات المجمّدة', 'contact'], ['/engine', 'chart', 'محاكي المحرك', 'intake'], ['/help', 'help', 'الدعم الفني', 'support']],
    super_admin: [['/admin', 'users', 'لوحة المشرف الأول'], ['/audit', 'list', 'سجل التدقيق'], ['/engine', 'chart', 'محاكي المحرك']],
    tech: [['/help', 'help', 'الدعم الفني']],
  };
  const HOME = { supervisor: '/dash', super_admin: '/admin', tech: '/help' };
  const SHORT = { '/dash': 'الرئيسية', '/files': 'ملفاتي', '/new': 'إضافة', '/matches': 'المقارنة', '/browse': 'المشرفون', '/frozen': 'المجمّدة', '/engine': 'المحاكي', '/help': 'الدعم', '/admin': 'اللوحة', '/audit': 'التدقيق' };
  const EXTRA = { supervisor: [['/draft', 'intake'], ['/file', 'intake']] }; // صفحات فرعية بنفس صلاحية أصلها
  const navFor = () => (NAVDEF[MK.user.role] || []).filter(([, , , perm]) => !perm || (MK.user.perms || []).includes(perm));

  // ---------- الهيكل: شريط جانبي على الحاسوب، تبويب سفلي + ورقة منزلقة بالإيماءة على الجوال ----------
  const phoneMQ = window.matchMedia('(max-width: 900px)');
  const logout = async () => { await post('/api/auth/logout').catch(() => {}); MK.user = null; MK.toLogin(); };
  function makeSheet(side, scrim, moreBtn) {
    let open = false, H = () => side.offsetHeight + 16;
    const sp = MK.spring((y) => { side.style.transform = `translate3d(0,${y}px,0)`; scrim.style.opacity = String(Math.max(0, 1 - y / H())); });
    const setOpen = (o) => { open = o; scrim.classList.toggle('on', o); moreBtn.setAttribute('aria-expanded', String(o)); document.body.style.overflow = o ? 'hidden' : ''; };
    const show = (v0) => { if (!phoneMQ.matches) return; side.classList.add('animating'); if (!open) { sp.set(H()); setOpen(true); } sp.to(0, v0, () => side.classList.add('open')); };
    const hide = (v0) => { side.classList.remove('open'); side.classList.add('animating'); setOpen(false); sp.to(H(), v0, () => { side.classList.remove('animating'); side.style.transform = ''; scrim.style.opacity = ''; }); };
    // سحب 1:1 من حيث أمسك الإصبع، مقاومة مطاطية فوق الحد، ثم إسقاط الزخم لتقرير الإغلاق
    let drag = null;
    side.addEventListener('pointerdown', (e) => { if (!phoneMQ.matches || e.button) return; drag = { id: e.pointerId, y0: e.clientY, x0: sp.x, hist: [[performance.now(), e.clientY]], moved: false }; sp.stop(); });
    side.addEventListener('pointermove', (e) => { if (!drag || e.pointerId !== drag.id) return; const dy = e.clientY - drag.y0; if (!drag.moved && Math.abs(dy) < 8) return;
      if (!drag.moved) { drag.moved = true; side.setPointerCapture(e.pointerId); }
      let y = drag.x0 + dy; if (y < 0) y = MK.rubberband(y, H()); sp.set(y); drag.hist.push([performance.now(), e.clientY]); if (drag.hist.length > 6) drag.hist.shift(); });
    const release = (e) => { if (!drag || e.pointerId !== drag.id) return; const d = drag; drag = null; if (!d.moved) return;
      const [t0, y0] = d.hist[0], [t1, y1] = d.hist[d.hist.length - 1], v = t1 > t0 ? ((y1 - y0) / (t1 - t0)) * 1000 : 0;
      const projected = sp.x + MK.project(v); (v > 500 || projected > H() * 0.45) ? hide(v) : show(v);
      side.addEventListener('click', (ev) => { ev.stopPropagation(); ev.preventDefault(); }, { capture: true, once: true }); };
    side.addEventListener('pointerup', release); side.addEventListener('pointercancel', release);
    scrim.addEventListener('click', () => hide());
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && open) hide(); });
    side.addEventListener('click', (e) => { if (e.target.closest('a') && open) hide(); });
    phoneMQ.addEventListener('change', () => { if (!phoneMQ.matches) { sp.stop(); setOpen(false); side.classList.remove('open', 'animating'); side.style.transform = ''; scrim.style.opacity = ''; } });
    return { toggle: () => (open ? hide() : show()) };
  }
  // دليل مختصر لكل صفحة بلغة بسيطة: يظهر عند الضغط على «كيف أستخدم هذه الصفحة؟»
  const GUIDE = {
    '/dash': ['هذه صفحتك الأولى. أعلى الصفحة تجد ما يحتاج إجراءً الآن.', 'الأزرار الكبيرة تأخذك إلى كل عمل مباشرة.'],
    '/files': ['هنا كل الملفات التي أدخلتها.', '«استكمال وإيداع» للمسودة، و«اطلب المقارنة» للملف النشط ليبحث المحرك عن المناسبين.'],
    '/new': ['أدخل بيانات صاحب الطلب خطوة بخطوة. الحقول المعلّمة بنجمة مطلوبة.', 'يمكنك «حفظ المسودة» في أي وقت والعودة لاحقًا من «ملفاتي».', 'في النهاية راجع كل ما أدخلت ثم اضغط «مراجعة وإيداع الملف».'],
    '/draft': ['أكمل ما نقص ثم أودع الملف.', 'بعد حفظ المسودة تستطيع إضافة المرفقات.'],
    '/file': ['هذه بيانات الملف كاملة ولا يراها غيرك.', 'أي تعديل يُنشئ إصدارًا جديدًا ويعيد المحرك التقييم.'],
    '/matches': ['كل بطاقة هنا شخص اقترحه المحرك لأحد ملفاتك، بلا اسم ولا هاتف.', 'اضغط «مناسب» أو «غير مناسب». عند اهتمام الطرفين يظهر لك اسم المشرف الآخر لتتواصل معه.', 'بعد التواصل اضغط «تم التواصل» فيُجمَّد الملفان 7 أيام.'],
    '/browse': ['هنا ملفات كل المشرفين ببيانات التوافق فقط.', 'افتح أي ملف لترى بياناته، أو اضغط «مطابقة مع ملفي» ليقيّم المحرك الملفين فورًا.'],
    '/frozen': ['الملفات هنا مجمّدة بعد التواصل. بعد 7 أيام اضغط «تفعيل الملف».', 'إن أردت التفعيل قبل المدة اطلب استثناءً من المشرف الأول.'],
    '/engine': ['هذه تجربة تعليمية على بيانات اصطناعية لفهم كيف يختار المحرك.', 'ابدأ من مثال، ثم غيّر شرطًا وشاهد الأثر.'],
    '/help': ['اكتب المشكلة واختر تصنيفها واضغط إرسال.', 'يرد المشرف الأول هنا في «طلباتي».'],
    '/admin': ['نظرة عامة على المنصة بالأرقام فقط، بلا بيانات أي مستفيد.', 'من «الحسابات والصلاحيات» تنشئ الحسابات وتحدد الصفحات المسموحة لكل مشرف.', 'من «الاعتمادات» تقرر طلبات الاستثناء.'],
    '/audit': ['سجل بكل ما حدث في المنصة: من فعل ماذا ومتى، بلا محتوى شخصي.'],
  };
  function shell(title, ...content) {
    const cur = '/' + (location.hash.slice(1).split('/')[1] || '');
    const items = navFor(), link = ([p, ic, l]) => h('a', { href: '#' + p, 'aria-current': cur === p ? 'page' : false }, MK.icon(ic), h('span', null, l));
    const nav = h('nav', { 'aria-label': 'القائمة الرئيسية' }, items.map(link), h('button', { type: 'button', onclick: logout }, MK.icon('out'), h('span', null, 'خروج')));
    const side = h('aside', { class: 'side', id: 'side' }, h('div', { class: 'sheet-handle', 'aria-hidden': 'true' }), h('a', { class: 'brand', href: '#' + HOME[MK.user.role] }, h('img', { src: MK.BASE + 'assets/logo-symbol.svg', alt: '', width: 40, height: 40 }), 'معرفة خير'), nav,
      MK.textControl(), h('div', { class: 'who' }, h('div', null, MK.user.display_name || t(MK.user.role)), h('div', { class: 'small' }, t(MK.user.role))));
    const scrim = h('div', { class: 'scrim', 'aria-hidden': 'true' });
    const moreBtn = h('button', { type: 'button', 'aria-controls': 'side', 'aria-expanded': 'false', 'aria-label': 'المزيد والخروج' }, MK.icon('list'), h('span', null, 'المزيد'));
    const sheet = makeSheet(side, scrim, moreBtn); moreBtn.onclick = sheet.toggle;
    const tabbar = h('nav', { class: 'tabbar', 'aria-label': 'التنقل السريع' }, items.slice(0, 4).map(([p, ic, l]) => h('a', { href: '#' + p, 'aria-current': cur === p ? 'page' : false, 'aria-label': l }, MK.icon(ic), h('span', null, SHORT[p] || l))), moreBtn);
    const home = HOME[MK.user.role], homeLabel = ((NAVDEF[MK.user.role] || []).find((x) => x[0] === home) || [])[2] || 'الرئيسية';
    const crumbs = h('nav', { class: 'crumbs-app', 'aria-label': 'مسار الصفحة' }, h('a', { href: '#' + home }, homeLabel), title !== homeLabel ? [h('span', { 'aria-hidden': 'true' }, '‹'), h('span', { 'aria-current': 'page' }, title)] : null);
    const guide = GUIDE[cur], isHome = cur === home;
    const helpBtn = guide ? h('button', { type: 'button', class: 'btn sm ghost helpbtn', onclick: () => MK.dialog('كيف أستخدم هذه الصفحة؟', h('ol', { class: 'guide' }, guide.map((g) => h('li', null, g))), [{ label: 'فهمت', value: true }]) }, MK.icon('help'), 'كيف أستخدم هذه الصفحة؟') : null;
    const backBtn = !isHome ? h('button', { type: 'button', class: 'btn sm ghost backbtn', onclick: () => (history.length > 1 ? history.back() : MK.nav(home)) }, '→ رجوع') : null;
    const main = h('main', { class: 'main', id: 'main', tabindex: '-1' }, h('div', { class: 'pagenav' }, backBtn, crumbs), h('div', { class: 'topbar' }, h('h1', null, title), h('div', { class: 'sp actions' }, helpBtn, MK.demo ? h('span', { class: 'badge warn' }, 'نسخة تجريبية') : null)), ...content);
    document.body.style.overflow = '';
    root.replaceChildren(h('div', { class: 'app' }, side, main, scrim, tabbar)); document.title = title + ' | معرفة خير'; live.textContent = title; main.focus({ preventScroll: true }); window.scrollTo(0, 0);
    return main;
  }
  const mount = async (title, fn) => {
    const holder = h('div', null, loading()); const main = shell(title, holder);
    try { const el = await fn(); holder.replaceChildren(el); } catch (e) { if (e.status === 401) return; holder.replaceChildren(h('div', { class: 'card empty', role: 'alert' }, h('h3', null, e.status === 403 || e.status === 404 ? 'لا يمكن الوصول' : 'حدث خطأ'), h('p', null, e.status === 403 ? 'هذه الصفحة غير مفعّلة لحسابك. تواصل مع المشرف الأول.' : e.status === 404 ? 'هذه الصفحة غير متاحة.' : 'تعذر التحميل. أعد المحاولة بعد قليل.'))); }
    return main;
  };
  const table = (heads, rows, empty = 'لا توجد بيانات.') => rows.length ? h('div', { class: 'table-wrap' }, h('table', null, h('thead', null, h('tr', null, heads.map((x) => h('th', { scope: 'col' }, x)))), h('tbody', null, rows.map((r) => h('tr', null, r.map((c, i) => h('td', { 'data-label': heads[i] || '' }, c))))))) : h('div', { class: 'card empty' }, empty);
  const kpi = (v, l, cls, sub) => h('div', { class: 'card kpi ' + (cls || '') }, h('b', null, String(v)), h('span', null, l), sub ? h('small', null, sub) : null);
  const refresh = () => MK.nav(location.hash.slice(1));
  const act = (fn) => async () => { try { await fn(); refresh(); } catch (e) { fail(e); } };
  const credDialog = (title, r) => {
    const row = (label, val) => { const i = h('input', { readonly: true, dir: 'ltr', value: val, 'aria-label': label, class: 'cred-val' }); const b = h('button', { type: 'button', class: 'btn sm secondary', onclick: () => copy(val, b) }, 'نسخ'); return h('div', { class: 'cred-row' }, h('label', null, label), h('div', { class: 'cred-line' }, i, b)); };
    return MK.dialog(title, h('div', null, h('p', { class: 'callout' }, r.note || 'احفظ الاسم والرقم الآن. لن يُعرض الرقم مرة أخرى.'), row('الاسم', r.name), row('الرقم', r.code)), [{ label: 'حفظتُهما', value: true }]);
  };

  // ===================== المشرف: الرئيسية =====================
  const P = {};
  P['/dash'] = () => mount('الرئيسية', async () => {
    const d = await get('/api/sup/home'), s = d.summary, can = (p) => d.perms.includes(p);
    const big = (href, ic, title, desc, n, cls) => h('a', { class: 'bigbtn ' + (cls || ''), href }, MK.icon(ic), h('div', null, h('b', null, title), h('span', null, desc)), n ? h('span', { class: 'cnt' }, String(n)) : null);
    const actions = [
      can('matches') && s.awaiting ? big('#/matches', 'link', 'راجع طلبات المقارنة', `${s.awaiting} اقتراح بانتظار قرارك`, s.awaiting, 'hot') : null,
      can('matches') && s.mutual ? big('#/matches', 'link', 'تواصل مع المشرف الآخر', `${s.mutual} اهتمام من الطرفين`, s.mutual, 'hot') : null,
      can('contact') && s.ready_to_activate ? big('#/frozen', 'lock', 'فعّل الملفات', `${s.ready_to_activate} ملف انتهت مدة تجميده`, s.ready_to_activate, 'hot') : null,
      can('intake') ? big('#/new', 'plus', 'أضف طلبًا جديدًا', 'أدخل بيانات صاحب طلب خطوة بخطوة') : null,
      can('intake') ? big('#/files', 'file', 'ملفاتي', `${s.active} نشط · ${s.drafts} مسودة · ${s.frozen} مجمّد`) : null,
      can('matches') && !s.awaiting ? big('#/matches', 'link', 'طلبات المقارنة', 'اقتراحات المحرك لملفاتك') : null,
      can('browse') ? big('#/browse', 'users', 'ملفات المشرفين', 'اطّلع على الملفات واطلب مطابقة مباشرة') : null,
      can('contact') && !s.ready_to_activate && s.frozen ? big('#/frozen', 'lock', 'الملفات المجمّدة', `${s.frozen} ملف بعد التواصل`) : null,
      can('support') ? big('#/help', 'help', 'الدعم الفني', 'أرسل مشكلة أو استفسارًا') : null,
    ].filter(Boolean);
    return h('div', { class: 'grid' },
      d.next ? h('div', { class: 'alert info big' }, h('span', null, h('b', null, 'المطلوب منك الآن: '), d.next.label), h('a', { class: 'btn', href: d.next.link }, 'ابدأ')) : h('div', { class: 'alert ok big' }, 'لا يوجد ما يحتاج إجراءً الآن.'),
      h('h2', { class: 'q' }, 'ماذا تريد أن تفعل؟'), h('div', { class: 'bigbtns' }, actions),
      h('details', { class: 'card' }, h('summary', null, 'كيف يسير العمل من البداية إلى النهاية؟'), h('ol', { class: 'flow' },
        h('li', null, h('b', null, 'أنشئ الطلب'), h('span', null, 'أدخل بيانات صاحب الطلب، ثم أودع الملف بعد إقرارك بحصولك على موافقته.')),
        h('li', null, h('b', null, 'استقبل طلبات المقارنة'), h('span', null, 'يعرض المحرك حتى 3 بطاقات مجهولة لكل ملف. اختر مناسب أو غير مناسب.')),
        h('li', null, h('b', null, 'تواصل مع المشرف الآخر'), h('span', null, 'عند اهتمام الطرفين يظهر اسم المشرف الآخر. بعد التواصل اضغط «تم التواصل».')),
        h('li', null, h('b', null, 'التجميد 7 أيام'), h('span', null, 'يُجمَّد الملفان. بعد 7 أيام تفعّل ملفك بنفسك، أو تطلب استثناءً من المشرف الأول.')))));
  });

  // ===================== المشرف: الملفات والنماذج =====================
  P['/files'] = () => mount('ملفاتي', async () => {
    const rows = await get('/api/sup/files'), can = (p) => MK.user.perms.includes(p);
    const compare = async (r, btn) => { btn.disabled = true; try { const x = await post(`/api/profiles/${r.id}/comparison`); toast(x.message); refresh(); } catch (e) { btn.disabled = false; if (e.code === 'COOLDOWN') toast(e.message, true); else fail(e); } };
    const cancel = async (r) => { if (!await MK.confirm('إلغاء الملف', `سيُلغى الملف ${r.code} نهائيًا وتُتلف مفاتيح تشفيره ولا يمكن استرجاعه. تُسحب كل اقتراحاته.`, 'إلغاء الملف', 'danger')) return; try { await post(`/api/profiles/${r.id}/cancel`, { reason: 'cancelled' }); toast('أُلغي الملف'); refresh(); } catch (e) { fail(e); } };
    return h('div', { class: 'grid' }, h('div', { class: 'actions' }, h('a', { class: 'btn', href: '#/new' }, 'إضافة طلب جديد')),
      table(['الرمز', 'الحالة', 'الاكتمال', 'الإصدار', 'آخر تحديث', 'مراجعة الموافقة', 'إجراءات'], rows.map((r) => [h('span', { class: 'code' }, r.code, r.name ? h('small', { class: 'muted' }, ' ' + r.name) : null), badge(r.state, stateCls(r.state)), r.completeness + '%', r.version || '—', fmt(r.updated_at), r.review_due_at ? h('span', null, fmtD(r.review_due_at), r.review_soon ? h('span', { class: 'badge warn' }, 'قريبًا') : null) : '—',
        h('div', { class: 'actions' },
          r.state === 'DRAFT' ? h('a', { class: 'btn sm', href: '#/draft/' + r.id }, 'استكمال وإيداع') : null,
          r.state === 'ACTIVE' && can('matches') ? (() => { const b = h('button', { class: 'btn sm', type: 'button' }, 'اطلب المقارنة'); b.onclick = () => compare(r, b); return b; })() : null,
          r.state !== 'DRAFT' ? h('a', { class: 'btn sm secondary', href: '#/file/' + r.id }, 'عرض وتعديل') : null,
          r.state === 'FROZEN' ? h('a', { class: 'btn sm secondary', href: '#/frozen' }, 'التجميد') : null,
          can('cancel') ? h('button', { class: 'btn sm ghost', type: 'button', onclick: () => cancel(r) }, 'إلغاء') : null)]), 'لا توجد ملفات بعد. أضف أول طلب.'));
  });
  async function attestDialog(sc, title = 'إقرار الموافقة') {
    const chk = h('input', { type: 'checkbox', id: 'at' }), ref = h('input', { id: 'rf', maxlength: 60, placeholder: 'مثال: نموذج ورقي رقم 114', 'aria-describedby': 'rf-e' }), err = h('div', { class: 'err', id: 'rf-e', role: 'alert' }), out = { v: null };
    const ok = await MK.dialog(title, h('div', null, h('p', null, sc.consent_text), h('label', { class: 'check', for: 'at' }, chk, 'أقرّ بذلك وأتحمل مسؤوليته'), h('label', { for: 'rf' }, 'مرجع إثبات الموافقة (للتدقيق)'), ref, err), [
      { label: 'تأكيد وإيداع', value: true, validate: async () => { if (!chk.checked) { err.textContent = 'يلزم الإقرار أولًا'; return false; } if (ref.value.trim().length < 4) { err.textContent = 'اكتب مرجع الإثبات'; return false; } out.v = { consent_attested: true, consent_ref: ref.value.trim() }; return true; } },
      { label: 'رجوع', value: false, cls: 'secondary' }]);
    return ok ? out.v : null;
  }
  function newOrEdit(id) {
    return mount(id ? 'استكمال المسودة' : 'إضافة طلب', async () => {
      const sc = await schema(); let pid = id, data = { I: {}, M: {}, S: {}, C: {} };
      if (id) data = (await get(`/api/profiles/${id}/draft`)).data;
      const f = MK.form(sc.fields, data);
      const save = async (quiet) => {
        if (!f.check()) return null;
        const body = f.collect();
        try { if (!pid) { const r = await post('/api/profiles/drafts', body); pid = r.id; if (!quiet) toast('حُفظت المسودة'); history.replaceState(null, '', '#/draft/' + pid); refreshAtt(); return r; } const r = await patch(`/api/profiles/${pid}/draft`, body); if (!quiet) toast(`حُفظت المسودة. الاكتمال ${r.completeness}%`); return r; }
        catch (e) { if (e.data?.fields) f.showErrors(e.data.fields); fail(e); return null; }
      };
      const submit = async () => {
        const miss = f.missingAll(); if (miss.length) { f.toReview(); toast(`بقي ${miss.length} حقلًا مطلوبًا قبل الإيداع`, true); return; }
        const r = await save(true); if (!r || !pid) return;
        const body = await attestDialog(sc); if (!body) return;
        try { const res = await post(`/api/profiles/${pid}/submit`, body);
          const go = await MK.dialog('أُودع الملف ' + res.code, h('div', null, h('p', null, 'الملف نشط الآن ويدخل المقارنة. بياناته مشفّرة وتظهر لغيرك كبطاقة مجهولة فقط.'), h('p', { class: 'small muted' }, 'رقم الإيصال: ' + res.receipt_id)), [{ label: 'اطلب المقارنة الآن', value: 'compare' }, { label: 'لاحقًا', value: 'later', cls: 'secondary' }]);
          if (go === 'compare') { try { const x = await post(`/api/profiles/${res.id}/comparison`); toast(x.message); } catch (e) { fail(e); } MK.nav('/matches'); } else MK.nav('/files');
        } catch (e) { if (e.data?.missing) { f.showErrors(e.data.missing); toast('أكمل الحقول الأساسية أولًا', true); } else { if (e.data?.fields) f.showErrors(e.data.fields); fail(e); } }
      };
      const attBox = h('div', null, pid ? MK.attachments(pid) : h('div', { class: 'card empty' }, h('h3', null, 'المرفقات'), h('p', null, 'احفظ المسودة أولًا ثم أضف المستندات والصور.')));
      const refreshAtt = () => { if (pid && !attBox.querySelector('.files')) attBox.replaceChildren(MK.attachments(pid)); };
      return h('div', { class: 'grid' }, h('div', { class: 'callout' }, 'أدخل بيانات صاحب الطلب على خطوات، ثم راجعها وأودع الملف. تتحمل مسؤولية الحصول على موافقته قبل الإيداع.'), f.el, attBox, MK.preview(f),
        h('div', { class: 'actions sticky-bar' }, h('button', { class: 'btn secondary', type: 'button', onclick: () => save() }, 'حفظ المسودة'), h('button', { class: 'btn', type: 'button', onclick: submit }, 'مراجعة وإيداع الملف')));
    });
  }
  P['/new'] = () => newOrEdit(null);
  P['/draft'] = (id) => newOrEdit(id);
  P['/file'] = (id) => mount('بيانات الملف', async () => {
    const sc = await schema(), d = await get(`/api/profiles/${id}/data`); const f = MK.form(sc.fields, d.data), can = (p) => MK.user.perms.includes(p);
    const save = async () => { if (!f.check()) return; try { const r = await post(`/api/profiles/${id}/correction`, f.collect()); toast('حُفظ الإصدار ' + r.version + '. أُبطلت الاقتراحات المتأثرة وسيُعاد التقييم'); MK.nav('/files'); } catch (e) { if (e.data?.fields) f.showErrors(e.data.fields); fail(e); } };
    const renew = async () => { const body = await attestDialog(sc, 'تجديد الموافقة'); if (!body) return; try { await post(`/api/profiles/${id}/renew`, body); toast('جُدّدت الموافقة'); } catch (e) { fail(e); } };
    return h('div', { class: 'grid' }, h('div', { class: 'callout' }, `الملف ${d.code}، الإصدار ${d.version}، الحالة: ${t(d.state)}. ما تعرضه هنا لا يُرى لغيرك. أي تعديل ينشئ إصدارًا جديدًا ويُبطل الاقتراحات المتأثرة.`), f.el, MK.attachments(id), MK.preview(f),
      h('div', { class: 'actions sticky-bar' }, d.state === 'ACTIVE' ? h('button', { class: 'btn', type: 'button', onclick: save }, 'حفظ التعديل') : h('span', { class: 'badge warn' }, 'الملف مجمّد: لا تعديل قبل التفعيل'), h('button', { class: 'btn secondary', type: 'button', onclick: renew }, 'تجديد الموافقة'),
        can('cancel') ? h('button', { class: 'btn danger', type: 'button', onclick: async () => { if (await MK.confirm('إلغاء الملف', 'سيُلغى الملف نهائيًا وتُتلف مفاتيح تشفيره.', 'إلغاء الملف', 'danger')) { try { await post(`/api/profiles/${id}/cancel`, { reason: 'cancelled' }); toast('أُلغي الملف'); MK.nav('/files'); } catch (e) { fail(e); } } } }, 'إلغاء الملف') : null));
  });

  // ===================== المشرف: طلبات المقارنة =====================
  // حلقة التوافق: رقم إجمالي واضح مع اتجاهي الدرجة والتغطية
  function compatRing(cp) {
    const R = 26, C = 2 * Math.PI * R, pct = Math.max(0, Math.min(100, cp.mutual)), lvl = pct >= 85 ? 'high' : pct >= 75 ? 'mid' : 'low';
    const svg = sv('svg', { viewBox: '0 0 64 64', class: 'ring ' + lvl, role: 'img', 'aria-label': `التوافق ${pct}%` },
      sv('circle', { cx: 32, cy: 32, r: R, fill: 'none', stroke: 'currentColor', 'stroke-opacity': .15, 'stroke-width': 6 }),
      sv('circle', { cx: 32, cy: 32, r: R, fill: 'none', stroke: 'currentColor', 'stroke-width': 6, 'stroke-linecap': 'round', 'stroke-dasharray': `${(pct / 100) * C} ${C}`, transform: 'rotate(-90 32 32)', class: 'ring-arc' }),
      sv('text', { x: 32, y: 36, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700 }, String(pct)));
    return h('div', { class: 'compat' }, svg, h('div', { class: 'compat-txt' }, h('b', null, { high: 'توافق عالٍ', mid: 'توافق جيد', low: 'توافق مقبول' }[lvl]), h('span', { class: 'small muted' }, `من جهة ملفك ${cp.mine} · من جهته ${cp.theirs} · تغطية البيانات ${cp.coverage}%`)));
  }
  function matchCard(c) {
    const k = c.card, kv = [['العمر', k.age_range], ['المنطقة', k.region], ['المدينة', k.city], ['الحالة', k.marital_status && t(k.marital_status)], ['الأبناء', k.children && t(k.children)], ['التعليم', k.education && t(k.education)], ['مجال العمل', k.work_field], ['توقيت البدء', k.timeline && t(k.timeline)], ['السكن', k.housing && t(k.housing)], ['نمط الحياة', k.social_style && t(k.social_style)], ['اللغات', k.langs && k.langs.join('، ')], ['القيم', k.values && k.values.join('، ')], ['الإنجاب', k.wants_children && t(k.wants_children)]].filter(([, v]) => v);
    const send = async (decision, channel) => { try { const r = await post(`/api/pairs/${c.pair_id}/decision`, { profile_id: c.profile_id, decision, channel }); toast(r.mutual ? 'اهتمام الطرفين. يمكنك التواصل مع المشرف الآخر.' : decision === 'interested' ? 'سُجّل اهتمامك' : decision === 'later' ? 'سيبقى الاقتراح حتى انتهاء صلاحيته' : 'سُجّل القرار'); refresh(); } catch (e) { fail(e); } };
    const interest = async () => { const ch = h('input', { id: 'ch', maxlength: 80, placeholder: 'مثال: عبر مكتبي من الأحد إلى الخميس' }); const ok = await MK.dialog('مناسب لملف ' + c.profile_code, h('div', null, h('p', null, 'سيُبلَّغ المشرف الآخر باهتمامك فقط. لا تُشارك بيانات المستفيد من هنا.'), h('label', { for: 'ch' }, 'كيف يتواصل معك المشرف الآخر؟ (اختياري)'), ch), [{ label: 'تسجيل الاهتمام', value: true }, { label: 'إلغاء', value: false, cls: 'secondary' }]); if (ok) send('interested', ch.value); };
    const decline = async () => { if (await MK.confirm('غير مناسب', 'لن يُعاد اقتراح هذا الملف لهذا الملف مرة أخرى، ولن يُبلَّغ الطرف الآخر بالسبب.', 'غير مناسب', 'danger')) send('not_interested'); };
    const contact = async () => { if (!await MK.confirm('تم التواصل', `بعد تأكيدك يُجمَّد الملفان (${c.profile_code} والآخر) 7 أيام فلا يظهران لأحد، وتُسحب بقية اقتراحاتهما. بعدها يفعّل كل مشرف ملفه، أو يرفع طلب استثناء للمشرف الأول.`, 'تم التواصل: جمّد الملفين')) return; try { await post(`/api/pairs/${c.pair_id}/contact`, { profile_id: c.profile_id }); toast('جُمّد الملفان 7 أيام'); MK.nav('/frozen'); } catch (e) { fail(e); } };
    const acts = c.state === 'MUTUAL_INTEREST' ? [h('button', { class: 'btn', type: 'button', onclick: contact }, 'تم التواصل')] : c.my_decision === 'interested' ? [h('span', { class: 'badge' }, 'أبديت اهتمامك: بانتظار المشرف الآخر')] : [h('button', { class: 'btn', type: 'button', onclick: interest }, 'مناسب'), h('button', { class: 'btn secondary', type: 'button', onclick: decline }, 'غير مناسب'), h('button', { class: 'btn ghost', type: 'button', onclick: () => send('later') }, 'لاحقًا')];
    const dims = Object.keys(DIML).map((d) => [d, (k.dims || {})[d]]);
    return h('article', { class: 'card cand', 'aria-label': 'طلب مقارنة ' + k.code },
      h('div', { class: 'cand-top' }, h('span', { class: 'code' }, k.code), badge(c.state, stateCls(c.state)), h('span', { class: 'small muted sp' }, 'لملفك ', h('b', null, c.profile_code))),
      c.compat ? compatRing(c.compat) : null,
      h('ul', { class: 'dimlist' }, dims.map(([d, lv]) => h('li', null, h('span', null, DIML[d]), lv ? h('span', { class: 'lvl ' + lv }, { high: 'تقارب عالٍ', mid: 'تقارب جيد', low: 'تقارب محدود' }[lv]) : h('span', { class: 'lvl none' }, 'بيانات ناقصة')))),
      k.bio ? h('p', { class: 'bio' }, k.bio) : null,
      h('dl', { class: 'kv' }, kv.map(([a, b]) => [h('dt', null, a), h('dd', null, b)])),
      k.reasons?.length ? h('div', null, h('b', null, 'لماذا اقتُرح'), h('ul', { class: 'reasons' }, k.reasons.map((r) => h('li', null, r)))) : null, k.discuss ? h('p', { class: 'small' }, h('b', null, 'يستحق النقاش: '), k.discuss) : null,
      c.other_supervisor ? h('div', { class: 'callout' }, h('b', null, 'المشرف الآخر: '), `${c.other_supervisor.name || '—'} (${t(c.other_supervisor.category) || '—'})`, c.other_supervisor.channel ? h('div', { class: 'small' }, 'قناته: ' + c.other_supervisor.channel) : null, h('div', { class: 'small muted' }, 'تواصل معه خارج المنصة ثم اضغط «تم التواصل».')) : null,
      h('p', { class: 'small muted' }, 'تنتهي صلاحية الاقتراح ' + fmtD(c.expires_at)), h('div', { class: 'actions' }, ...acts));
  }
  P['/matches'] = () => mount('طلبات المقارنة', async () => {
    const [rows, files] = await Promise.all([get('/api/matches'), MK.user.perms.includes('intake') ? get('/api/sup/files') : Promise.resolve([])]);
    const act = files.filter((f) => f.state === 'ACTIVE'), sel = h('select', { id: 'cf', 'aria-label': 'الملف' }, act.map((f) => h('option', { value: f.id }, f.code)));
    const run = h('button', { class: 'btn secondary', type: 'button' }, 'اطلب مقارنة جديدة');
    run.onclick = async () => { if (!sel.value) return; run.disabled = true; try { const x = await post(`/api/profiles/${sel.value}/comparison`); toast(x.message); refresh(); } catch (e) { run.disabled = false; if (e.code === 'COOLDOWN') toast(e.message, true); else fail(e); } };
    return h('div', { class: 'grid' },
      act.length ? h('div', { class: 'card engine-cta' }, h('div', null, h('h3', null, 'المحرك'), h('p', { class: 'muted' }, 'يقارن المحرك شروط كل ملف وشروط الطرف الآخر معًا، ويعرض حتى 3 بطاقات لكل ملف تتفق عليها الجهتان. اختر ملفًا واطلب مقارنة جديدة.'), h('label', { for: 'cf' }, 'الملف'), sel), h('div', { class: 'actions' }, run)) : null,
      rows.length ? h('div', { class: 'grid g3' }, rows.map(matchCard)) : h('div', { class: 'card empty' }, h('p', null, 'لا توجد طلبات مقارنة الآن.'), h('p', { class: 'muted' }, 'اطلب مقارنة لأحد ملفاتك النشطة، أو انتظر الدورة المجدولة.')));
  });

  // ===================== المشرف: ملفات المشرفين (اطلاع + مطابقة مباشرة) =====================
  const FL2 = { gender: 'الجنس', age: 'نطاق العمر', city: 'المدينة', marital_status: 'الحالة الاجتماعية', children: 'الأبناء', timeline: 'توقيت البدء', housing: 'السكن', wants_children: 'الرغبة بالإنجاب', accepts_partner_children: 'يقبل من لديه أبناء', polygamy_view: 'التعدد', partner_work: 'موقفه من عمل الشريك', education: 'التعليم', works: 'يعمل', work_field: 'مجال العمل', travel: 'يقبل تنقل الشريك', job_travel: 'تنقل عمله', smoking: 'التدخين', smoking_ok: 'يقبل التدخين', social_style: 'نمط الحياة', langs: 'اللغات', values: 'القيم', pref_age_min: 'أدنى عمر مقبول', pref_age_max: 'أعلى عمر مقبول', pref_cities: 'المدن المقبولة', pref_marital: 'الحالات المقبولة', hard: 'شروط صلبة', soft: 'تفضيلات مرنة', importance: 'أهمية الأبعاد' };
  const CRIT_AR = { smoking: 'التدخين', children: 'الأبناء', wants_children: 'الإنجاب', housing: 'السكن', partner_work: 'العمل', job_travel: 'تنقل العمل', timeline: 'التوقيت', polygamy_view: 'التعدد', marital_status: 'الحالة' };
  const fmtB = (k, v) => { if (v === undefined || v === null) return null; if (k === 'hard' || k === 'soft') return v.length ? v.map((x) => `${CRIT_AR[x.field] || x.field}: ${x.values.map(t).join(' أو ')}`).join('؛ ') : 'لا يوجد'; if (k === 'importance') { const e = Object.entries(v); return e.length ? e.map(([d, l]) => `${DIML[d] || d}: ${t(l)}`).join('، ') : 'عادية'; } if (typeof v === 'boolean') return v ? 'نعم' : 'لا'; if (Array.isArray(v)) return v.map(t).join('، ') || '—'; return t(v); };
  async function matchDialog(target, myFiles) {
    const tg = target.gender || target.data?.gender, mine = myFiles.filter((f) => !tg || f.gender !== tg);
    if (!mine.length) { await MK.dialog('مطابقة مباشرة', h('p', null, `ليس لديك ملف نشط من الجنس الآخر لمطابقته مع ${target.code}.`), [{ label: 'إغلاق', value: true, cls: 'secondary' }]); return; }
    const sel = h('select', { id: 'dm' }, mine.map((f) => h('option', { value: f.id }, `${f.code} · ${t(f.gender)} · ${f.age_range} · ${f.city}`))), out = h('div', { 'aria-live': 'polite' }), run = h('button', { type: 'button', class: 'btn' }, 'شغّل المطابقة');
    run.onclick = async () => { run.disabled = true; out.replaceChildren(h('p', { class: 'muted' }, 'جارٍ تقييم الملفين في الاتجاهين…'));
      try { const r = await post(`/api/browse/${target.id}/match`, { my_profile_id: sel.value });
        const ok = r.status === 'ELIGIBLE', cls = ok ? 'ok' : ['EXISTS', 'CAPACITY'].includes(r.status) ? 'warn' : 'bad';
        out.replaceChildren(h('div', { class: 'grid' }, h('div', { class: 'alert ' + cls }, h('div', null, h('b', null, ok ? 'مؤهل: أُنشئ الاقتراح' : r.status === 'EXISTS' ? 'يوجد اقتراح قائم' : r.status === 'CAPACITY' ? 'السعة ممتلئة' : 'غير مؤهل'), h('div', { class: 'small' }, r.message))),
          r.mutual !== undefined ? h('p', { class: 'small muted' }, `التوافق المتبادل ${r.mutual}` + (r.mine !== undefined ? ` · من جهة ملفك ${r.mine} · من جهته ${r.theirs} · تغطية ${r.coverage}%` : '')) : null,
          (ok || r.status === 'EXISTS') ? h('div', null, h('a', { class: 'btn sm secondary', href: '#/matches' }, 'افتح طلبات المقارنة')) : null));
      } catch (e) { out.replaceChildren(h('div', { class: 'alert bad' }, e.message || 'تعذر التقييم')); } run.disabled = false; };
    await MK.dialog('مطابقة مباشرة مع ' + target.code, h('div', null, h('p', { class: 'small muted' }, `يقيّم المحرك ملفك والملف ${target.code} (لدى ${target.supervisor?.name || 'مشرف آخر'}) بالشروط من الجهتين. إن كان مؤهلًا يظهر الاقتراح في طلبات المقارنة لديكما، ويبقى القرار للطرفين.`), h('label', { for: 'dm' }, 'ملفك'), sel, h('div', { class: 'actions' }, run), out), [{ label: 'إغلاق', value: true, cls: 'secondary' }]);
  }
  async function browseDetail(row, myFiles) {
    let d; try { d = await get('/api/browse/' + row.id); } catch (e) { fail(e); return; }
    const groups = [['الأساسيات', ['gender', 'age', 'city', 'marital_status', 'children', 'timeline', 'housing', 'wants_children', 'accepts_partner_children', 'polygamy_view', 'partner_work']], ['العمل ونمط الحياة', ['education', 'works', 'work_field', 'travel', 'job_travel', 'smoking', 'smoking_ok', 'social_style', 'langs', 'values']], ['ما يطلبه في الطرف الآخر', ['pref_age_min', 'pref_age_max', 'pref_cities', 'pref_marital', 'hard', 'soft', 'importance']]];
    const canMatch = !d.mine && d.state === 'ACTIVE' && MK.user.perms.includes('matches') && myFiles.some((f) => f.gender !== d.data.gender);
    await MK.dialog(`الملف ${d.code}`, h('div', { class: 'browse-detail' },
      h('div', { class: 'pill-row' }, badge(d.state, stateCls(d.state)), h('span', { class: 'badge' }, 'المشرف: ' + (d.supervisor?.name || '—')), d.mine ? h('span', { class: 'badge ok' }, 'ملفك') : null),
      d.bio ? h('p', { class: 'bio' }, d.bio) : null,
      groups.map(([title, keys]) => { const items = keys.map((k) => [k, fmtB(k, d.data[k])]).filter(([, v]) => v !== null); return items.length ? h('div', { class: 'rv-group' }, h('h4', null, title), h('dl', { class: 'kv rv' }, items.map(([k, v]) => [h('dt', null, FL2[k]), h('dd', null, v)]))) : null; }),
      h('p', { class: 'small muted' }, 'الاسم والهاتف وتاريخ الميلاد لا تُعرض لغير المشرف صاحب الملف. يظهر اسم المشرف للتواصل بعد اهتمام الطرفين.')),
      [canMatch ? { label: 'مطابقة مباشرة مع ملفي', value: 'match' } : null, { label: 'إغلاق', value: false, cls: 'secondary' }].filter(Boolean)).then((v) => { if (v === 'match') matchDialog(d, myFiles); });
  }
  P['/browse'] = () => mount('ملفات المشرفين', async () => {
    const q = new URLSearchParams(location.hash.split('?')[1] || ''), f = { gender: q.get('gender') || '', city: q.get('city') || '', state: q.get('state') || '' };
    const [rows, allRows] = await Promise.all([get('/api/browse?' + new URLSearchParams(Object.fromEntries(Object.entries(f).filter(([, v]) => v)))), get('/api/browse?state=ACTIVE')]);
    const myFiles = allRows.filter((x) => x.mine && x.state === 'ACTIVE'); let text = '';
    const gs = h('select', { id: 'bg' }, h('option', { value: '' }, 'الكل'), h('option', { value: 'man', selected: f.gender === 'man' }, 'رجال'), h('option', { value: 'woman', selected: f.gender === 'woman' }, 'نساء'));
    const cs = h('select', { id: 'bc' }, h('option', { value: '' }, 'كل المدن'), MK.CITIES.map((c) => h('option', { value: c, selected: f.city === c }, c)));
    const ss = h('select', { id: 'bs' }, h('option', { value: '' }, 'نشط ومجمّد'), h('option', { value: 'ACTIVE', selected: f.state === 'ACTIVE' }, 'نشط فقط'), h('option', { value: 'FROZEN', selected: f.state === 'FROZEN' }, 'مجمّد فقط'));
    const search = h('input', { id: 'bq', placeholder: 'رمز الملف أو اسم المشرف', oninput: (e) => { text = e.target.value.trim(); drawList(); } });
    const apply = () => { location.hash = '#/browse?' + new URLSearchParams(Object.fromEntries([['gender', gs.value], ['city', cs.value], ['state', ss.value]].filter(([, v]) => v))); };
    [gs, cs, ss].forEach((el) => (el.onchange = apply));
    const list = h('div', { class: 'grid g3' }), count = h('p', { class: 'small muted' });
    const card = (r) => h('article', { class: 'card bcard' + (r.mine ? ' mine' : ''), tabindex: '0', role: 'button', 'aria-label': 'الملف ' + r.code, onclick: () => browseDetail(r, myFiles), onkeydown: (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); browseDetail(r, myFiles); } } },
      h('div', { class: 'cand-top' }, h('span', { class: 'code' }, r.code), badge(r.state, stateCls(r.state)), r.mine ? h('span', { class: 'badge ok' }, 'ملفك') : null),
      h('dl', { class: 'kv compact' }, [['الجنس', t(r.gender)], ['العمر', r.age_range], ['المدينة', r.city], ['الحالة', t(r.marital_status)], ['الأبناء', t(r.children)], ['التوقيت', t(r.timeline)], ['السكن', t(r.housing)], ['الإنجاب', t(r.wants_children)], ['التعليم', r.education ? t(r.education) : '—']].map(([a, b]) => [h('dt', null, a), h('dd', null, b)])),
      h('div', { class: 'bfoot' }, h('span', { class: 'small muted' }, 'المشرف: ' + (r.supervisor?.name || '—')), r.hard_count ? h('span', { class: 'badge warn' }, `${r.hard_count} شرط صلب`) : null),
      h('div', { class: 'actions' }, h('button', { type: 'button', class: 'btn sm secondary', onclick: (e) => { e.stopPropagation(); browseDetail(r, myFiles); } }, 'كل البيانات'), !r.mine && r.state === 'ACTIVE' && myFiles.some((f) => f.gender !== r.gender) && MK.user.perms.includes('matches') ? h('button', { type: 'button', class: 'btn sm', onclick: (e) => { e.stopPropagation(); matchDialog(r, myFiles); } }, 'مطابقة مع ملفي') : null));
    const drawList = () => { const rs = rows.filter((r) => !text || r.code.includes(text.toUpperCase()) || (r.supervisor?.name || '').includes(text)); count.textContent = `${rs.length} ملف · ${rs.filter((r) => !r.mine).length} لدى مشرفين آخرين`; list.replaceChildren(...(rs.length ? rs.map(card) : [h('div', { class: 'card empty' }, 'لا ملفات تطابق التصفية.')])); };
    drawList();
    return h('div', { class: 'grid' },
      h('div', { class: 'callout' }, 'كل الملفات النشطة لدى كل المشرفين، ببيانات التوافق فقط (بلا أسماء ولا هواتف). افتح أي ملف لترى بياناته كاملة، أو اطلب مطابقة مباشرة مع أحد ملفاتك فيقيّمها المحرك بالشروط من الجهتين. هذه الصفحة بصلاحية من المشرف الأول.'),
      h('div', { class: 'card filters' }, h('div', { class: 'field' }, h('label', { for: 'bq' }, 'بحث'), search), h('div', { class: 'field' }, h('label', { for: 'bg' }, 'الجنس'), gs), h('div', { class: 'field' }, h('label', { for: 'bc' }, 'المدينة'), cs), h('div', { class: 'field' }, h('label', { for: 'bs' }, 'الحالة'), ss)),
      !myFiles.length && MK.user.perms.includes('matches') ? h('div', { class: 'alert warn' }, h('span', null, 'لا يوجد لديك ملف نشط؛ أودع ملفًا أولًا لتطلب مطابقة مباشرة.'), MK.user.perms.includes('intake') ? h('a', { class: 'btn sm secondary', href: '#/new' }, 'إضافة طلب') : null) : null,
      count, list);
  });

  // ===================== المشرف: الملفات المجمّدة =====================
  P['/frozen'] = () => mount('الملفات المجمّدة', async () => {
    const rows = await get('/api/frozen'), can = (p) => MK.user.perms.includes(p);
    const activate = async (r) => { if (!await MK.confirm('تفعيل الملف', `سيعود الملف ${r.code} إلى المقارنة. هل تواصلك مع الطرف الآخر منتهٍ؟`, 'تفعيل الملف')) return; try { await post(`/api/profiles/${r.id}/activate`); toast('فُعّل الملف'); refresh(); } catch (e) { fail(e); } };
    const exempt = async (r) => { const n = h('textarea', { id: 'exn', maxlength: 300, rows: 3 }); const err = h('div', { class: 'err', role: 'alert' }); const ok = await MK.dialog('طلب استثناء المدة', h('div', null, h('p', null, `الملف ${r.code} مجمّد ويتبقى ${r.days_left} يوم. يقرر المشرف الأول الاستثناء، وبعد موافقته تفعّل الملف بنفسك.`), h('label', { for: 'exn' }, 'سبب الاستثناء'), n, err), [{ label: 'إرسال الطلب', value: true, validate: async () => { try { await post(`/api/profiles/${r.id}/exemption`, { note: n.value }); return true; } catch (e) { err.textContent = e.message; return false; } } }, { label: 'إلغاء', value: false, cls: 'secondary' }]); if (ok) { toast('أُرسل الطلب إلى المشرف الأول'); refresh(); } };
    return h('div', { class: 'grid' }, h('div', { class: 'callout' }, 'بعد «تم التواصل» يُجمَّد الملفان 7 أيام. التفعيل بعد المدة من المشرف صاحب الملف، وللاستثناء ترفع طلبًا للمشرف الأول.'),
      table(['الملف', 'مجمّد منذ', 'ينتهي', 'المتبقي', 'طلب الاستثناء', 'إجراءات'], rows.map((r) => [h('span', { class: 'code' }, r.code), fmt(r.frozen_at), fmt(r.frozen_until), r.can_activate ? h('span', { class: 'badge ok' }, 'جاهز') : r.days_left + ' يوم', r.exemption ? badge(r.exemption.state, stateCls(r.exemption.state)) : '—',
        h('div', { class: 'actions' }, h('button', { class: 'btn sm', type: 'button', disabled: !r.can_activate, onclick: () => activate(r) }, 'تفعيل الملف'), can('exempt') && r.can_request_exemption ? h('button', { class: 'btn sm secondary', type: 'button', onclick: () => exempt(r) }, 'طلب استثناء المدة') : null)]), 'لا توجد ملفات مجمّدة.'));
  });

  // ===================== محاكي المحرك =====================
  P['/engine'] = () => mount('محاكي المحرك', async () => {
    await loadScript(MK.BASE + 'shared/engine.js'); await loadScript(MK.BASE + 'app/engine-demo.js'); const box = h('div', { id: 'sim', class: 'sim' }); window.MKSim(box);
    return h('div', { class: 'grid' }, h('div', { class: 'callout' }, 'محاكاة تعمل في متصفحك على 90 ملفًا اصطناعيًا بنفس ملف المحرك الحقيقي. لا تتصل بأي بيانات فعلية.'), box);
  });

  // ===================== الدعم الفني =====================
  const CLASSES = ['login', 'page_error', 'matching', 'data', 'permissions', 'security', 'other'];
  P['/help'] = () => mount('الدعم الفني', async () => {
    const rows = await get('/api/support/tickets');
    const cls = h('select', { id: 'tc' }, h('option', { value: '' }, 'اختر التصنيف'), CLASSES.map((c) => h('option', { value: c }, t(c)))), pg = h('input', { id: 'tp', maxlength: 40, placeholder: 'اسم الصفحة (اختياري)' }), desc = h('textarea', { id: 'td', rows: 5, maxlength: 1000, 'aria-describedby': 'td-h' }), err = h('div', { class: 'err', role: 'alert' });
    const send = async () => { err.textContent = ''; try { await post('/api/support/tickets', { classification: cls.value, description: desc.value, page: pg.value }); toast('وصل طلبك إلى المشرف الأول'); refresh(); } catch (e) { err.textContent = e.message; fail(e); } };
    return h('div', { class: 'grid' }, h('div', { class: 'card' }, h('h3', null, 'رفع طلب دعم فني'), h('p', { class: 'muted' }, 'اكتب وصف المشكلة وحدد تصنيفها. لا تكتب بيانات شخصية؛ تُحجب الهواتف والروابط تلقائيًا.'),
      h('div', { class: 'grid g2' }, h('div', { class: 'field' }, h('label', { for: 'tc' }, 'تصنيف المشكلة'), cls), h('div', { class: 'field' }, h('label', { for: 'tp' }, 'الصفحة'), pg)),
      h('div', { class: 'field' }, h('label', { for: 'td' }, 'وصف المشكلة'), desc, h('div', { class: 'hint', id: 'td-h' }, 'ماذا حدث؟ ماذا كنت تتوقع؟ متى؟')), err, h('button', { class: 'btn', type: 'button', onclick: send }, 'إرسال الطلب')),
      h('h2', null, 'طلباتي'), table(['التاريخ', 'التصنيف', 'الوصف', 'الحالة', 'رد المشرف الأول'], rows.map((r) => [fmt(r.at), t(r.classification), r.description, badge(r.state, stateCls(r.state)), r.response || '—']), 'لم ترفع طلبات بعد.'));
  });

  // ===================== المشرف الأول =====================
  const PAL = ['#153F35', '#2F7A66', '#B89B64', '#79500E', '#8FA399', '#A22D35', '#52665D'];
  const num = (v) => (typeof v === 'number' ? v : parseInt(String(v).replace(/\D/g, ''), 10) || 0);
  function donut(map, title) {
    const ent = Object.entries(map).filter(([, v]) => num(v) > 0), tot = ent.reduce((a, [, v]) => a + num(v), 0) || 1, R = 54, C = 2 * Math.PI * R; let off = 0;
    const svg = sv('svg', { viewBox: '0 0 140 140', class: 'chart donut', role: 'img', 'aria-label': title }, sv('circle', { cx: 70, cy: 70, r: R, fill: 'none', stroke: '#E7EFEA', 'stroke-width': 22 }),
      ent.map(([k, v], i) => { const len = (num(v) / tot) * C; const c = sv('circle', { cx: 70, cy: 70, r: R, fill: 'none', stroke: PAL[i % PAL.length], 'stroke-width': 22, 'stroke-dasharray': `${len} ${C - len}`, 'stroke-dashoffset': -off, transform: 'rotate(-90 70 70)' }); off += len; return c; }),
      sv('text', { x: 70, y: 68, 'text-anchor': 'middle', 'font-size': 22, 'font-weight': 700 }, String(tot)), sv('text', { x: 70, y: 86, 'text-anchor': 'middle', 'font-size': 11 }, 'المجموع'));
    return h('div', { class: 'donut-wrap' }, svg, h('ul', { class: 'legend' }, ent.map(([k, v], i) => h('li', null, h('i', { class: 'sw', 'data-c': PAL[i % PAL.length] }), `${t(k)}: ${v}`))));
  }
  const hbars = (rows, max) => { const mx = max || Math.max(1, ...rows.map((r) => num(r[1]))); return h('div', { class: 'funnel' }, rows.map(([l, v]) => h('div', { class: 'row' }, h('span', null, l), h('div', { class: 'track' }, h('i', { class: 'bar', 'data-w': String(Math.round((100 * num(v)) / mx)) })), h('b', null, String(v))))); };
  const WHYL = { age: 'العمر', city: 'المدينة', marital: 'الحالة الاجتماعية', children: 'الأبناء', smoking: 'التدخين', wants_children: 'الإنجاب', housing: 'السكن', partner_work: 'العمل', job_travel: 'تنقل العمل', timeline: 'التوقيت', polygamy_view: 'التعدد', marital_status: 'الحالة', gender: 'الجنس' };
  const ATABS = [['overview', 'نظرة عامة'], ['accounts', 'الحسابات والصلاحيات'], ['approvals', 'الاعتمادات'], ['tickets', 'الدعم الفني'], ['engine', 'المحرك'], ['security', 'الأمان']];

  P['/admin'] = (tab) => {
    tab = ATABS.some(([k]) => k === tab) ? tab : 'overview';
    return mount('لوحة المشرف الأول', async () => {
      const [ov, dash, tix] = await Promise.all([get('/api/admin/overview'), ['accounts', 'approvals'].includes(tab) ? get('/api/admin/dashboard') : Promise.resolve(null), tab === 'tickets' ? get('/api/admin/tickets') : Promise.resolve(null)]);
      const counts = { approvals: ov.kpis.exemptions_pending + ov.alerts.filter((a) => /اعتماد مستقل/.test(a.text)).length, tickets: ov.kpis.tickets_open };
      const tabs = h('nav', { class: 'tabs', 'aria-label': 'أقسام اللوحة' }, ATABS.map(([k, l]) => h('a', { href: '#/admin/' + k, 'aria-current': k === tab ? 'page' : false }, l, counts[k] ? h('span', { class: 'count' }, String(counts[k])) : null)));
      const banner = ov.demo ? h('div', { class: 'hint-box' }, 'وضع العرض: حجب الخلايا الصغيرة معطّل لتظهر الأعداد. هذه اللوحة مجمّعة ولا تعرض بيانات أي مستفيد.') : null;
      const body = { overview: () => tabOverview(ov), accounts: () => tabAccounts(dash), approvals: () => tabApprovals(dash), tickets: () => tabTickets(tix), engine: () => tabEngine(ov), security: () => tabSecurity(ov) }[tab]();
      return h('div', { class: 'grid' }, tabs, banner, body);
    });
  };
  function tabOverview(ov) {
    const k = ov.kpis;
    return h('div', { class: 'grid' },
      ov.alerts.length ? h('div', null, h('h2', null, 'تنبيهات تحتاج انتباهك'), h('div', { class: 'alerts', role: 'list' }, ov.alerts.map((a) => h('div', { class: 'alert ' + a.level, role: 'listitem' }, h('span', null, a.text), h('a', { class: 'btn sm secondary', href: a.link }, 'فتح'))))) : h('div', { class: 'alert ok' }, 'لا توجد تنبيهات. كل المؤشرات ضمن الحدود.'),
      h('div', { class: 'kpis' }, kpi(k.profiles_total, 'إجمالي الملفات'), kpi(k.active, 'ملفات نشطة', '', `${k.drafts} مسودة`), kpi(k.frozen, 'ملفات مجمّدة'), kpi(k.pairs_live, 'طلبات مقارنة قائمة'), kpi(k.pairs_mutual, 'اهتمام الطرفين'), kpi(k.contacted, 'تم التواصل'), kpi(k.capacity_use + '%', 'استخدام السعة', '', 'ملفات لديها اقتراح قائم'),
        kpi(k.exemptions_pending, 'طلبات استثناء', k.exemptions_pending ? 'warn' : ''), kpi(k.tickets_open, 'دعم فني مفتوح', k.tickets_open ? 'warn' : ''), kpi(`${k.supervisors_active}/${k.supervisors_active + k.supervisors_suspended}`, 'مشرفون نشطون'), kpi(k.cancelled, 'ملفات ملغاة')),
      h('div', { class: 'grid g2' }, h('div', { class: 'card' }, h('h3', null, 'قمع الرحلة'), hbars(ov.funnel)), h('div', { class: 'card' }, h('h3', null, 'حالة الملفات'), donut(ov.profiles_by_state, 'الملفات حسب الحالة'))),
      h('div', { class: 'grid g2' }, h('div', { class: 'card' }, h('h3', null, 'حالة طلبات المقارنة'), donut(ov.pairs_by_state, 'الاقتراحات حسب الحالة')), h('div', { class: 'card' }, h('h3', null, 'حمل المشرفين'), ov.workload.length ? hbars(ov.workload.map((w) => [w.name + (w.status !== 'active' ? ' (معلّق)' : ''), w.load])) : 'لا مشرفين.', h('p', { class: 'small muted' }, 'عدد الملفات المسندة لكل مشرف (يشمل المسودات والمجمّدة).'))),
      h('div', { class: 'card' }, h('h3', null, 'آخر الأحداث'), table(['الوقت', 'الدور', 'الحدث', 'النتيجة'], ov.recent_audit.map((e) => [fmt(e.at), t(e.role), e.action, e.outcome]), 'لا أحداث.'), h('a', { href: '#/audit' }, 'عرض السجل الكامل')));
  }
  function permDialog(a, all) {
    const allowed = a.role === 'tech' ? ['support'] : all, boxes = allowed.map((p) => { const c = h('input', { type: 'checkbox', id: 'pm-' + p, checked: a.perms.includes(p), value: p }); return [p, c]; });
    return MK.dialog('صلاحيات ' + a.display_name, h('div', { class: 'perm-list' }, h('p', { class: 'muted small' }, 'الصفحات التي تظهر للحساب. تُفرض في الخادم وتسري فورًا.'), boxes.map(([p, c]) => h('label', { class: 'check', for: 'pm-' + p }, c, h('span', null, h('b', null, t(p)), h('small', { class: 'muted' }, ' ' + (PERM_HELP[p] || '')))))), [{ label: 'حفظ الصلاحيات', value: true }, { label: 'إلغاء', value: false, cls: 'secondary' }]).then((ok) => (ok ? boxes.filter(([, c]) => c.checked).map(([p]) => p) : null));
  }
  function tabAccounts(d) {
    const role = h('select', { id: 'ar' }, h('option', { value: 'supervisor' }, 'مشرف'), h('option', { value: 'tech' }, 'مشرف تقني')), nm = h('input', { id: 'an', maxlength: 60 }), cat = h('select', { id: 'ac' }, ['lawyer', 'judge', 'mayor', 'other_verified'].map((c) => h('option', { value: c }, t(c)))), sp = h('input', { id: 'as', placeholder: 'الرياض، الدمام' }), vn = h('textarea', { id: 'av', rows: 2 }), err = h('div', { class: 'err', role: 'alert' });
    const supOnly = [cat, sp, vn].map((e) => e.closest?.('.field')); const supBox = h('div', { class: 'grid' }, h('div', { class: 'field' }, h('label', { for: 'ac' }, 'نوع الصفة'), cat), h('div', { class: 'field' }, h('label', { for: 'as' }, 'النطاق (مدن)'), sp), h('div', { class: 'field' }, h('label', { for: 'av' }, 'توثيق التحقق من الصفة (مرجع الفحص)'), vn));
    role.onchange = () => { supBox.hidden = role.value !== 'supervisor'; };
    const create = async () => { err.textContent = ''; try { const r = await post('/api/admin/accounts', { role: role.value, display_name: nm.value, category: cat.value, scope: sp.value.split(/[،,]/).map((x) => x.trim()).filter(Boolean), verified_note: vn.value }); await credDialog('بيانات دخول الحساب الجديد', r); refresh(); } catch (e) { err.textContent = e.message; if (e.status !== 422) fail(e); } };
    const rowActs = (a) => h('div', { class: 'actions' },
      h('button', { class: 'btn sm secondary', type: 'button', onclick: async () => { const p = await permDialog(a, d.all_perms); if (p) { try { await post(`/api/admin/accounts/${a.id}/perms`, { perms: p }); toast('حُدّثت الصلاحيات'); refresh(); } catch (e) { fail(e); } } } }, 'الصلاحيات'),
      h('button', { class: 'btn sm secondary', type: 'button', onclick: async () => { if (await MK.confirm('إعادة تعيين بيانات الدخول', `سيُبطل الاسم والرقم الحاليان لـ ${a.display_name} وتُغلق جلساته، ويُولَّد اسم ورقم جديدان.`, 'إعادة تعيين')) { try { const r = await post(`/api/admin/accounts/${a.id}/reset`); await credDialog('بيانات الدخول الجديدة', r); } catch (e) { fail(e); } } } }, 'إعادة تعيين الدخول'),
      h('button', { class: 'btn sm ghost', type: 'button', onclick: act(async () => { await post('/api/admin/role-change-requests', { target: a.id, action: a.status === 'active' ? 'suspend' : 'activate' }); toast('أُرسل طلب بانتظار اعتماد مشرف أول آخر'); }) }, a.status === 'active' ? 'طلب تعليق' : 'طلب تفعيل'));
    return h('div', { class: 'grid' }, h('h2', null, 'الحسابات'),
      table(['الاسم', 'الدور', 'الصفة', 'التحقق', 'الصلاحيات', 'الحمل', 'آخر دخول', 'الحالة', 'إجراءات'], d.accounts.map((a) => [a.display_name, t(a.role), a.category ? t(a.category) : '—', a.review_date ? h('span', null, fmtD(a.review_date), a.expiring_soon ? h('span', { class: 'badge warn' }, 'قريبًا') : null) : '—', h('div', { class: 'perm-sum' }, h('span', { class: 'badge ' + (a.perms.length ? '' : 'warn') }, a.perms.length ? `${a.perms.length} من ${a.role === 'tech' ? 1 : d.all_perms.length} صفحات` : 'بلا صلاحيات'), a.perms.length ? h('small', null, a.perms.map((p) => t(p)).join('، ')) : null), a.role === 'supervisor' ? a.load : '—', a.last_login ? fmt(a.last_login) : 'لم يدخل بعد', badge(a.status, stateCls(a.status)), rowActs(a)]), 'لا حسابات بعد.'),
      d.unassigned.length ? h('div', null, h('h2', null, 'ملفات تحتاج إعادة إسناد'), table(['الرمز', 'الحالة', 'إسناد'], d.unassigned.map((p) => { const sel = h('select', { 'aria-label': 'مشرف' }, d.supervisors.filter((x) => x.status === 'active').map((x) => h('option', { value: x.id }, x.display_name))); return [p.code, t(p.state), h('div', { class: 'actions' }, sel, h('button', { class: 'btn sm', type: 'button', onclick: act(() => post(`/api/admin/profiles/${p.id}/reassign`, { supervisor_id: sel.value })) }, 'إسناد'))]; }))) : null,
      h('div', { class: 'card' }, h('h3', null, 'إنشاء حساب جديد'), h('p', { class: 'muted small' }, 'يولّد النظام اسمًا من كلمات عشوائية ورقمًا من رموز عشوائية. يُعرضان مرة واحدة، فسلّمهما لصاحب الحساب عبر قناة آمنة. تحقق من الهوية والصفة وتعارض المصالح قبل الإنشاء.'),
        h('div', { class: 'grid g2' }, h('div', { class: 'field' }, h('label', { for: 'ar' }, 'نوع الحساب'), role), h('div', { class: 'field' }, h('label', { for: 'an' }, 'الاسم المهني'), nm)), supBox, err, h('button', { class: 'btn', type: 'button', onclick: create }, 'إنشاء الحساب وتوليد بيانات الدخول')));
  }
  function tabApprovals(d) {
    const dec = (url, ok, msg) => act(async () => { await post(url, { approve: ok }); toast(msg); });
    return h('div', { class: 'grid' }, h('h2', null, 'طلبات استثناء مدة التجميد'), h('p', { class: 'muted' }, 'يرفعها المشرف لملف مجمّد بعد التواصل. القرار لك، وبعد الموافقة يفعّل المشرف ملفه بنفسه.'),
      table(['الملف', 'المشرف', 'السبب', 'المتبقي', 'الوقت', 'قرار'], d.exemptions.map((r) => [h('span', { class: 'code' }, r.profile_code), r.supervisor, r.note, r.days_left + ' يوم', fmt(r.at), h('div', { class: 'actions' }, h('button', { class: 'btn sm', type: 'button', onclick: dec(`/api/admin/exemptions/${r.id}/decision`, true, 'قُبل الاستثناء') }, 'موافقة'), h('button', { class: 'btn sm secondary', type: 'button', onclick: dec(`/api/admin/exemptions/${r.id}/decision`, false, 'رُفض الطلب') }, 'رفض'))]), 'لا طلبات استثناء معلقة.'),
      h('h2', null, 'اعتمادات التعليق والتفعيل'), h('p', { class: 'muted' }, 'تعليق حساب أو تفعيله أو تجديد تحققه يحتاج اعتماد مشرف أول آخر غير الطالب.'),
      table(['الطلب', 'الوقت', 'قرار'], d.pending_approvals.map((r) => [r.summary, fmt(r.at), h('div', { class: 'actions' }, h('button', { class: 'btn sm', type: 'button', onclick: dec(`/api/admin/role-change-requests/${r.id}/decision`, true, 'تم الاعتماد') }, 'اعتماد'), h('button', { class: 'btn sm secondary', type: 'button', onclick: dec(`/api/admin/role-change-requests/${r.id}/decision`, false, 'رُفض الطلب') }, 'رفض'))]), 'لا اعتمادات معلقة.'));
  }
  function tabTickets(rows) {
    return h('div', { class: 'grid' }, h('h2', null, 'طلبات الدعم الفني'), rows.length ? rows.map((r) => {
      const st = h('select', { id: 'ts-' + r.id, 'aria-label': 'الحالة' }, ['open', 'in_progress', 'resolved'].map((s) => h('option', { value: s, selected: r.state === s }, t(s)))), rs = h('textarea', { id: 'tr-' + r.id, rows: 2, maxlength: 500, 'aria-label': 'الرد' }, r.response || '');
      rs.value = r.response || '';
      return h('article', { class: 'card' }, h('div', { class: 'topbar' }, h('div', null, badge(r.classification), ' ', badge(r.state, stateCls(r.state)), h('span', { class: 'small muted' }, ` ${r.by_name} (${t(r.role)}) · ${fmt(r.at)}${r.page ? ' · صفحة: ' + r.page : ''}`))), h('p', null, r.description),
        h('div', { class: 'grid g2' }, h('div', { class: 'field' }, h('label', { for: 'ts-' + r.id }, 'الحالة'), st), h('div', { class: 'field' }, h('label', { for: 'tr-' + r.id }, 'رد على الطلب'), rs)), h('button', { class: 'btn sm', type: 'button', onclick: act(async () => { await post(`/api/admin/tickets/${r.id}`, { state: st.value, response: rs.value }); toast('حُدّث الطلب'); }) }, 'حفظ'));
    }) : h('div', { class: 'card empty' }, 'لا طلبات دعم فني.'));
  }
  function tabEngine(ov) {
    const R = ov.rules, hist = ov.score_histogram, runNow = h('button', { class: 'btn', type: 'button', onclick: act(async () => { const r = await post('/api/admin/match-runs'); toast(`اكتملت الدورة: ${r.created} اقتراح جديد من ${r.profiles} ملف`); }) }, 'تشغيل دورة مطابقة الآن');
    return h('div', { class: 'grid' },
      h('div', { class: 'card' }, h('h3', null, 'كيف يقرر المحرك؟'), h('ol', { class: 'flow' }, h('li', null, h('b', null, 'الأهلية والشروط الصلبة'), h('span', null, 'نشاط الملفين، موافقات صالحة، الرفض السابق، ثم شروط كل طرف في الاتجاهين. المجهول = يحتاج إيضاحًا.')), h('li', null, h('b', null, 'درجة كل اتجاه'), h('span', null, 'خمسة أبعاد × أوزان (تُعاد معايرتها بأهمية صاحب الملف)، وتُحسب على الأبعاد المعروفة فقط.')), h('li', null, h('b', null, 'العتبات'), h('span', null, `التغطية ≥ ${R.minCoverage * 100}% والدرجة المتبادلة (الأقل من الاتجاهين) ≥ ${R.minMutual}.`)), h('li', null, h('b', null, 'الاختيار'), h('span', null, `حتى ${R.capacity} لكل ملف: بالدرجة ثم أقل تعرضًا ثم أطول انتظارًا ثم عشوائية محفوظة للدفعة.`)), h('li', null, h('b', null, 'القرار والتجميد'), h('span', null, `المشرف يقرر. بعد «تم التواصل» يُجمَّد الملفان ${R.freeze_days} أيام.`)))),
      h('div', { class: 'grid g2' }, h('div', { class: 'card' }, h('h3', null, 'الأوزان الابتدائية'), table(['البُعد', 'الوزن'], Object.entries(R.weights).map(([d, w]) => [DIML[d], w + ' / 100'])), h('p', { class: 'small muted' }, `إصدار القواعد: ${R.version}. الأوزان والعتبات افتراضات تجريبية قابلة للمراجعة.`)),
        h('div', { class: 'card' }, h('h3', null, 'عتبات وحدود'), table(['المعامل', 'القيمة'], [['أدنى تغطية بيانات', R.minCoverage * 100 + '%'], ['أدنى درجة متبادلة', R.minMutual], ['السعة لكل ملف', R.capacity], ['صلاحية الاقتراح', R.cardTtlDays + ' أيام'], ['مدة التجميد', R.freeze_days + ' أيام'], ['حقول يمكن جعلها شرطًا صلبًا', R.hard_allowed.length]]), h('p', { class: 'small muted' }, 'لا تُستخدم الثروة ولا الشكل ولا القبيلة ولا الدين أو الصحة في الدرجة.'))),
      h('div', { class: 'card' }, h('h3', null, 'توزيع الدرجات المتبادلة للاقتراحات'), hbars(Object.entries(hist)), h('p', { class: 'small muted' }, 'يُظهر ما إذا كانت العتبة تُنتج اقتراحات قوية أم حدّية.')),
      h('div', { class: 'card' }, h('div', { class: 'topbar' }, h('h3', null, 'سجل دورات المطابقة'), h('div', { class: 'sp' }, runNow)),
        table(['الوقت', 'المشغّل', 'الملفات', 'مؤهلة', 'أُنشئ', 'متوسط الدرجة', 'مستبعدة بشرط', 'تحتاج إيضاحًا', 'المدة'], ov.runs.map((r) => [fmt(r.at), r.trigger, r.stats.profiles, r.stats.ELIGIBLE, r.stats.created, r.stats.avg_mutual ?? '—', h('div', { class: 'pill-row' }, Object.entries(r.stats.excluded_by || {}).sort((x, y) => y[1] - x[1]).slice(0, 4).map(([w, n]) => h('span', { class: 'badge' }, `${WHYL[w] || w} ${n}`))), r.stats.NEEDS_CLARIFICATION, (r.ms ?? 0) + ' م.ث']), 'لم تُشغَّل دورات بعد.')));
  }
  function tabSecurity(ov) {
    const sc = ov.security;
    const controls = [['دخول باسم ورقم عشوائيين يولّدهما المشرف الأول، ولا تسجيل ذاتي', true], ['لا حسابات للمستفيدين: بياناتهم بيد المشرف الموثوق وبإقراره', true], ['صلاحيات لكل صفحة تُفرض في الخادم', true], ['قفل الاسم بعد 5 محاولات خاطئة وتحديد المعدل', true], ['إعادة إدخال الرقم قبل العمليات الحساسة', true], ['إخفاء كل الصفحات قبل الدخول (404 موحد)', true], ['تشفير مغلف بمفتاح لكل ملف وطبقة، وإتلاف المفاتيح عند الإلغاء', true], ['سلسلة تدقيق بالتجزئة بلا محتوى', sc.chain_valid], ['CSP صارم ورؤوس أمان وCSRF وno-store', true], ['فصل المهام: اعتماد مستقل لتعليق الحسابات', true], ['حجب الخلايا الصغيرة في الأعداد' + (ov.demo ? ' (معطّل في وضع العرض)' : ''), !ov.demo]];
    return h('div', { class: 'grid' },
      h('div', { class: 'kpis' }, kpi(sc.chain_valid ? 'سليمة' : 'مكسورة', 'سلسلة التدقيق', sc.chain_valid ? '' : 'bad', `${sc.audit_events} حدثًا`), kpi(sc.denied_24h, 'عمليات مرفوضة (24 ساعة)', sc.denied_24h > 20 ? 'warn' : ''), kpi(sc.failed_logins_1h, 'دخول فاشل (ساعة)', sc.failed_logins_1h >= 10 ? 'bad' : ''), kpi(sc.sessions_active, 'جلسات نشطة'), kpi(sc.accounts_total, 'حسابات', '', `${sc.accounts_suspended} معلّق`), kpi(sc.kms.keys, 'مفاتيح KEK', '', `${sc.kms.destroyed} أُتلفت`), kpi(sc.tombstones, 'ملفات ملغاة (tombstones)')),
      h('div', { class: 'grid g2' }, h('div', { class: 'card' }, h('h3', null, 'الضوابط المفعّلة'), h('ul', { class: 'checklist' }, controls.map(([l, ok]) => h('li', null, h('span', { class: 'badge ' + (ok ? 'ok' : 'warn') }, ok ? 'مفعّل' : 'تنبيه'), ' ', l)))),
        h('div', { class: 'card' }, h('h3', null, 'استخدام المفاتيح حسب الخدمة'), table(['الخدمة', 'عدد فك التغليف'], Object.entries(sc.kms.unwraps_by_service).map(([s, n]) => [s, n]), 'لا بيانات.'), h('p', { class: 'small muted' }, 'كل فك تغليف مسجّل. عامل المطابقة لا يفك طبقتي الهوية والخاص.'))),
      h('div', { class: 'card' }, h('h3', null, 'آخر الأحداث'), table(['الوقت', 'الدور', 'الحدث', 'الغرض', 'النتيجة'], ov.recent_audit.map((e) => [fmt(e.at), t(e.role), e.action, e.purpose, e.outcome])), h('p', null, h('a', { href: '#/audit' }, 'السجل الكامل مع الفلترة'))),
      h('div', { class: 'callout' }, 'المشرف الأول لا يقرأ ملفات المستفيدين ولا يملك فك المفاتيح: هذه اللوحة أعداد وحالات فقط. تغيير الحالات الحساسة يمر باعتماد مستقل.'));
  }
  P['/audit'] = () => mount('سجل التدقيق', async () => {
    const q = new URLSearchParams(location.hash.split('?')[1] || ''), role = q.get('role') || '', action = q.get('action') || '';
    const r = await get('/api/audit?' + new URLSearchParams({ ...(role && { role }), ...(action && { action }) }));
    const rs = h('select', { id: 'fr' }, h('option', { value: '' }, 'كل الأدوار'), ['super_admin', 'supervisor', 'tech', 'service', 'anonymous'].map((x) => h('option', { value: x, selected: role === x }, t(x)))), ac = h('input', { id: 'fa', placeholder: 'مثال: auth.login', value: action, dir: 'ltr' });
    return h('div', { class: 'grid' }, h('div', { class: 'alert ' + (r.chain_valid ? 'ok' : 'bad') }, r.chain_valid ? 'سلسلة التدقيق سليمة: لم يُكتشف عبث.' : 'فشل التحقق من السلسلة: اكتُشف عبث محتمل.'),
      h('form', { class: 'filters', onsubmit: (e) => { e.preventDefault(); location.hash = '#/audit?' + new URLSearchParams({ ...(rs.value && { role: rs.value }), ...(ac.value && { action: ac.value }) }); } }, h('div', { class: 'field' }, h('label', { for: 'fr' }, 'الدور'), rs), h('div', { class: 'field' }, h('label', { for: 'fa' }, 'الحدث'), ac), h('button', { class: 'btn secondary', type: 'submit' }, 'تصفية')),
      table(['#', 'الوقت', 'الدور', 'الحدث', 'الغرض', 'النتيجة'], r.events.map((e) => [e.seq, fmt(e.at), t(e.role), e.action, e.purpose, h('span', { class: 'badge ' + (e.outcome === 'ok' ? 'ok' : 'bad') }, e.outcome)]), 'لا أحداث مطابقة.'), h('p', { class: 'small muted' }, 'السجل لا يحتوي أسماء ولا هواتف ولا محتوى ملفات. يُعرض آخر 200 حدث.'));
  });

  // ---------- الموجّه ----------
  async function route() {
    const [, name, arg] = location.hash.slice(1).split('?')[0].split('/'); const key = '/' + (name || '');
    if (!MK.user) { try { MK.user = await get('/api/auth/me'); } catch { return; } try { MK.demo = !!(await fetch(MK.BASE + 'api/demo/accounts').then((r) => r.ok)); } catch { MK.demo = false; } }
    const allowed = navFor().map((x) => x[0]), extra = (EXTRA[MK.user.role] || []).filter(([, p]) => MK.user.perms.includes(p)).map((x) => x[0]);
    if (!name) return MK.nav(HOME[MK.user.role]);
    if (![...allowed, ...extra].includes(key) || !P[key]) return mount('الصفحة غير متاحة', async () => h('div', { class: 'card empty' }, h('h3', null, 'لا يمكن الوصول'), h('p', null, 'هذه الصفحة غير موجودة أو غير مفعّلة لحسابك.'), h('a', { class: 'btn', href: '#' + HOME[MK.user.role] }, 'العودة إلى الرئيسية')));
    return P[key](arg);
  }
  window.addEventListener('hashchange', route);
  new MutationObserver(() => { document.querySelectorAll('i[data-w]').forEach((i) => { i.style.width = i.dataset.w + '%'; i.removeAttribute('data-w'); }); document.querySelectorAll('i[data-c]').forEach((i) => { i.style.background = i.dataset.c; i.removeAttribute('data-c'); }); }).observe(document.body, { childList: true, subtree: true });
  route();
})();
