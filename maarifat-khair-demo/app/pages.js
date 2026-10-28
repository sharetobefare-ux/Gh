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
  const PERM_HELP = { intake: 'ينشئ الطلبات ويودعها ويعدّلها', matches: 'يستقبل طلبات المقارنة ويقرر فيها', contact: 'يضغط «تم التواصل» ويفعّل الملفات المجمّدة', cancel: 'يلغي ملفات المستفيدين', exempt: 'يرفع طلب استثناء مدة التجميد', support: 'يرفع طلبات الدعم الفني' };
  const loadScript = (src) => new Promise((res, rej) => { const s = h('script', { src }); s.onload = res; s.onerror = rej; document.head.append(s); });
  const copy = async (text, btn) => { try { await navigator.clipboard.writeText(text); toast('تم النسخ'); } catch { const i = btn.closest('.cred-row').querySelector('input'); i.select(); toast('حدّد النص وانسخه يدويًا'); } };

  // ---------- القوائم حسب الدور والصلاحية ----------
  const NAVDEF = {
    supervisor: [['/dash', 'home', 'الرئيسية'], ['/files', 'file', 'ملفاتي', 'intake'], ['/new', 'plus', 'إضافة طلب', 'intake'], ['/matches', 'link', 'طلبات المقارنة', 'matches'], ['/frozen', 'lock', 'الملفات المجمّدة', 'contact'], ['/engine', 'chart', 'محاكي المحرك', 'intake'], ['/help', 'help', 'الدعم الفني', 'support']],
    super_admin: [['/admin', 'users', 'لوحة المشرف الأول'], ['/audit', 'list', 'سجل التدقيق'], ['/engine', 'chart', 'محاكي المحرك']],
    tech: [['/help', 'help', 'الدعم الفني']],
  };
  const HOME = { supervisor: '/dash', super_admin: '/admin', tech: '/help' };
  const EXTRA = { supervisor: [['/draft', 'intake'], ['/file', 'intake']] }; // صفحات فرعية بنفس صلاحية أصلها
  const navFor = () => (NAVDEF[MK.user.role] || []).filter(([, , , perm]) => !perm || (MK.user.perms || []).includes(perm));

  function shell(title, ...content) {
    const cur = '/' + (location.hash.slice(1).split('/')[1] || '');
    const nav = h('nav', { 'aria-label': 'القائمة الرئيسية' }, navFor().map(([p, ic, l]) => h('a', { href: '#' + p, 'aria-current': cur === p ? 'page' : false }, MK.icon(ic), l)),
      h('button', { type: 'button', onclick: async () => { await post('/api/auth/logout').catch(() => {}); MK.user = null; MK.toLogin(); } }, MK.icon('out'), 'خروج'));
    const side = h('aside', { class: 'side', id: 'side' }, h('a', { class: 'brand', href: '#' + HOME[MK.user.role] }, h('img', { src: MK.BASE + 'assets/logo-symbol.svg', alt: '', width: 40, height: 40 }), 'معرفة خير'), nav,
      h('div', { class: 'who' }, h('div', null, MK.user.display_name || t(MK.user.role)), h('div', { class: 'small' }, t(MK.user.role))));
    const tog = h('button', { class: 'side-toggle', type: 'button', 'aria-controls': 'side', 'aria-expanded': 'false', onclick: () => { const o = side.classList.toggle('open'); tog.setAttribute('aria-expanded', String(o)); } }, MK.icon('list'), 'القائمة');
    const home = HOME[MK.user.role], homeLabel = ((NAVDEF[MK.user.role] || []).find((x) => x[0] === home) || [])[2] || 'الرئيسية';
    const crumbs = h('nav', { class: 'crumbs-app', 'aria-label': 'مسار الصفحة' }, h('a', { href: '#' + home }, homeLabel), title !== homeLabel ? [h('span', { 'aria-hidden': 'true' }, '‹'), h('span', { 'aria-current': 'page' }, title)] : null);
    const main = h('main', { class: 'main', id: 'main', tabindex: '-1' }, tog, crumbs, h('div', { class: 'topbar' }, h('h1', null, title), MK.demo ? h('div', { class: 'sp' }, h('span', { class: 'badge warn' }, 'نسخة تجريبية: بيانات اصطناعية')) : null), ...content);
    root.replaceChildren(h('div', { class: 'app' }, side, main)); document.title = title + ' | معرفة خير'; live.textContent = title; main.focus({ preventScroll: true }); window.scrollTo(0, 0);
    return main;
  }
  const mount = async (title, fn) => {
    const holder = h('div', null, loading()); const main = shell(title, holder);
    try { const el = await fn(); holder.replaceChildren(el); } catch (e) { if (e.status === 401) return; holder.replaceChildren(h('div', { class: 'card empty', role: 'alert' }, h('h3', null, e.status === 403 || e.status === 404 ? 'لا يمكن الوصول' : 'حدث خطأ'), h('p', null, e.status === 403 ? 'هذه الصفحة غير مفعّلة لحسابك. تواصل مع المشرف الأول.' : e.status === 404 ? 'هذه الصفحة غير متاحة.' : 'تعذر التحميل. أعد المحاولة بعد قليل.'))); }
    return main;
  };
  const table = (heads, rows, empty = 'لا توجد بيانات.') => rows.length ? h('div', { class: 'table-wrap' }, h('table', null, h('thead', null, h('tr', null, heads.map((x) => h('th', { scope: 'col' }, x)))), h('tbody', null, rows.map((r) => h('tr', null, r.map((c) => h('td', null, c))))))) : h('div', { class: 'card empty' }, empty);
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
    const d = await get('/api/sup/home'), s = d.summary;
    const link = (href, n, label, cls) => h('a', { class: 'card kpi linkcard ' + (cls || ''), href }, h('b', null, String(n)), h('span', null, label));
    const can = (p) => d.perms.includes(p);
    return h('div', { class: 'grid' },
      d.next ? h('div', { class: 'alert info' }, h('span', null, d.next.label), h('a', { class: 'btn sm', href: d.next.link }, 'فتح')) : h('div', { class: 'alert ok' }, 'لا يوجد ما يحتاج إجراءً الآن.'),
      h('div', { class: 'kpis' }, can('intake') ? link('#/files', s.drafts, 'مسودات') : null, can('intake') ? link('#/files', s.active, 'ملفات نشطة') : null, can('matches') ? link('#/matches', s.awaiting, 'طلبات مقارنة بانتظار قرارك', s.awaiting ? 'warn' : '') : null, can('matches') ? link('#/matches', s.mutual, 'اهتمام الطرفين: جاهز للتواصل', s.mutual ? 'ok' : '') : null, can('contact') ? link('#/frozen', s.frozen, 'ملفات مجمّدة') : null, can('contact') ? link('#/frozen', s.ready_to_activate, 'جاهزة للتفعيل', s.ready_to_activate ? 'ok' : '') : null),
      h('div', { class: 'card' }, h('h3', null, 'كيف يسير العمل'), h('ol', { class: 'flow' },
        h('li', null, h('b', null, 'أنشئ الطلب'), h('span', null, 'أدخل بيانات المستفيد، عاين الخيارات المتاحة، ثم أودع الملف بعد إقرارك بحصولك على موافقته.')),
        h('li', null, h('b', null, 'استقبل طلبات المقارنة'), h('span', null, 'يقارن المحرك الشروط من الجهتين ويعرض لكل ملف حتى 3 بطاقات مجهولة الهوية. اختر مناسب أو غير مناسب.')),
        h('li', null, h('b', null, 'تواصل مع المشرف الآخر'), h('span', null, 'عند اهتمام الطرفين يظهر لك اسم المشرف الآخر وقناته. بعد التواصل اضغط «تم التواصل».')),
        h('li', null, h('b', null, 'التجميد 7 أيام'), h('span', null, 'يُجمَّد الملفان فلا يظهران لأحد. بعد 7 أيام تفعّل ملفك بنفسك، أو ترفع طلب استثناء للمشرف الأول.')))),
      h('p', { class: 'small muted' }, 'صفحاتك المفعّلة: ' + d.perms.map((p) => t(p)).join('، ') + '. يمنحها المشرف الأول ويسحبها.'));
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
      const save = async () => {
        const body = f.collect(); f.showErrors([]);
        try { if (!pid) { const r = await post('/api/profiles/drafts', body); pid = r.id; toast('حُفظت المسودة'); history.replaceState(null, '', '#/draft/' + pid); return r; } const r = await patch(`/api/profiles/${pid}/draft`, body); toast(`حُفظت المسودة. الاكتمال ${r.completeness}%`); return r; }
        catch (e) { if (e.data?.fields) f.showErrors(e.data.fields); fail(e); return null; }
      };
      const submit = async () => {
        const r = await save(); if (!r && !pid) return; if (!pid) return;
        const body = await attestDialog(sc); if (!body) return;
        try { const res = await post(`/api/profiles/${pid}/submit`, body);
          const go = await MK.dialog('أُودع الملف ' + res.code, h('div', null, h('p', null, 'الملف نشط الآن ويدخل المقارنة. بياناته مشفّرة وتظهر لغيرك كبطاقة مجهولة فقط.'), h('p', { class: 'small muted' }, 'رقم الإيصال: ' + res.receipt_id)), [{ label: 'اطلب المقارنة الآن', value: 'compare' }, { label: 'لاحقًا', value: 'later', cls: 'secondary' }]);
          if (go === 'compare') { try { const x = await post(`/api/profiles/${res.id}/comparison`); toast(x.message); } catch (e) { fail(e); } MK.nav('/matches'); } else MK.nav('/files');
        } catch (e) { if (e.data?.fields) f.showErrors(e.data.fields); if (e.data?.missing) { f.showErrors(e.data.missing); toast('أكمل الحقول الأساسية أولًا', true); } else fail(e); }
      };
      return h('div', null, h('div', { class: 'callout' }, 'بعد الإيداع يصبح الملف نشطًا ويدخل المقارنة. تتحمل مسؤولية الحصول على موافقة صاحب الطلب قبل الإيداع.'), f.el, MK.preview(f), h('div', { class: 'actions' }, h('button', { class: 'btn secondary', type: 'button', onclick: save }, 'حفظ المسودة'), h('button', { class: 'btn', type: 'button', onclick: submit }, 'إيداع الملف')));
    });
  }
  P['/new'] = () => newOrEdit(null);
  P['/draft'] = (id) => newOrEdit(id);
  P['/file'] = (id) => mount('بيانات الملف', async () => {
    const sc = await schema(), d = await get(`/api/profiles/${id}/data`); const f = MK.form(sc.fields, d.data), can = (p) => MK.user.perms.includes(p);
    const save = async () => { try { const r = await post(`/api/profiles/${id}/correction`, f.collect()); toast('حُفظ الإصدار ' + r.version + '. أُبطلت الاقتراحات المتأثرة وسيُعاد التقييم'); MK.nav('/files'); } catch (e) { if (e.data?.fields) f.showErrors(e.data.fields); fail(e); } };
    const renew = async () => { const body = await attestDialog(sc, 'تجديد الموافقة'); if (!body) return; try { await post(`/api/profiles/${id}/renew`, body); toast('جُدّدت الموافقة'); } catch (e) { fail(e); } };
    return h('div', { class: 'grid' }, h('div', { class: 'callout' }, `الملف ${d.code}، الإصدار ${d.version}، الحالة: ${t(d.state)}. ما تعرضه هنا لا يُرى لغيرك. أي تعديل ينشئ إصدارًا جديدًا ويُبطل الاقتراحات المتأثرة.`), f.el, MK.preview(f),
      h('div', { class: 'actions' }, d.state === 'ACTIVE' ? h('button', { class: 'btn', type: 'button', onclick: save }, 'حفظ التعديل') : h('span', { class: 'badge warn' }, 'الملف مجمّد: لا تعديل قبل التفعيل'), h('button', { class: 'btn secondary', type: 'button', onclick: renew }, 'تجديد الموافقة'),
        can('cancel') ? h('button', { class: 'btn danger', type: 'button', onclick: async () => { if (await MK.confirm('إلغاء الملف', 'سيُلغى الملف نهائيًا وتُتلف مفاتيح تشفيره.', 'إلغاء الملف', 'danger')) { try { await post(`/api/profiles/${id}/cancel`, { reason: 'cancelled' }); toast('أُلغي الملف'); MK.nav('/files'); } catch (e) { fail(e); } } } }, 'إلغاء الملف') : null));
  });

  // ===================== المشرف: طلبات المقارنة =====================
  function matchCard(c) {
    const k = c.card, kv = [['العمر', k.age_range], ['المنطقة', k.region], ['المدينة', k.city], ['التعليم', k.education && t(k.education)], ['مجال العمل', k.work_field], ['توقيت البدء', k.timeline && t(k.timeline)], ['السكن', k.housing && t(k.housing)], ['نمط الحياة', k.social_style && t(k.social_style)], ['اللغات', k.langs && k.langs.join('، ')], ['القيم', k.values && k.values.join('، ')], ['الإنجاب', k.wants_children && t(k.wants_children)]].filter(([, v]) => v);
    const send = async (decision, channel) => { try { const r = await post(`/api/pairs/${c.pair_id}/decision`, { profile_id: c.profile_id, decision, channel }); toast(r.mutual ? 'اهتمام الطرفين. يمكنك التواصل مع المشرف الآخر.' : decision === 'interested' ? 'سُجّل اهتمامك' : decision === 'later' ? 'سيبقى الاقتراح حتى انتهاء صلاحيته' : 'سُجّل القرار'); refresh(); } catch (e) { fail(e); } };
    const interest = async () => { const ch = h('input', { id: 'ch', maxlength: 80, placeholder: 'مثال: عبر مكتبي من الأحد إلى الخميس' }); const ok = await MK.dialog('مناسب لملف ' + c.profile_code, h('div', null, h('p', null, 'سيُبلَّغ المشرف الآخر باهتمامك فقط. لا تُشارك بيانات المستفيد من هنا.'), h('label', { for: 'ch' }, 'كيف يتواصل معك المشرف الآخر؟ (اختياري)'), ch), [{ label: 'تسجيل الاهتمام', value: true }, { label: 'إلغاء', value: false, cls: 'secondary' }]); if (ok) send('interested', ch.value); };
    const decline = async () => { if (await MK.confirm('غير مناسب', 'لن يُعاد اقتراح هذا الملف لهذا الملف مرة أخرى، ولن يُبلَّغ الطرف الآخر بالسبب.', 'غير مناسب', 'danger')) send('not_interested'); };
    const contact = async () => { if (!await MK.confirm('تم التواصل', `بعد تأكيدك يُجمَّد الملفان (${c.profile_code} والآخر) 7 أيام فلا يظهران لأحد، وتُسحب بقية اقتراحاتهما. بعدها يفعّل كل مشرف ملفه، أو يرفع طلب استثناء للمشرف الأول.`, 'تم التواصل: جمّد الملفين')) return; try { const r = await post(`/api/pairs/${c.pair_id}/contact`, { profile_id: c.profile_id }); toast('جُمّد الملفان 7 أيام'); MK.nav('/frozen'); } catch (e) { fail(e); } };
    const acts = c.state === 'MUTUAL_INTEREST' ? [h('button', { class: 'btn', type: 'button', onclick: contact }, 'تم التواصل')] : c.my_decision === 'interested' ? [h('span', { class: 'badge' }, 'أبديت اهتمامك: بانتظار المشرف الآخر')] : [h('button', { class: 'btn', type: 'button', onclick: interest }, 'مناسب'), h('button', { class: 'btn secondary', type: 'button', onclick: decline }, 'غير مناسب'), h('button', { class: 'btn ghost', type: 'button', onclick: () => send('later') }, 'لاحقًا')];
    return h('article', { class: 'card cand', 'aria-label': 'طلب مقارنة ' + k.code }, h('div', null, h('span', { class: 'code' }, k.code), ' ', badge(c.state, stateCls(c.state)), h('div', { class: 'small muted' }, 'لملفك ', h('b', null, c.profile_code))), k.bio ? h('p', null, k.bio) : null, h('dl', { class: 'kv' }, kv.map(([a, b]) => [h('dt', null, a), h('dd', null, b)])),
      k.dims && Object.keys(k.dims).length ? h('div', null, h('b', null, 'مدى التقارب'), h('ul', { class: 'dimlist' }, Object.entries(k.dims).map(([d, lv]) => h('li', null, h('span', null, DIML[d]), h('span', { class: 'lvl ' + lv }, { high: 'تقارب عالٍ', mid: 'تقارب جيد', low: 'تقارب محدود' }[lv]))))) : null,
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
  const SVGNS = 'http://www.w3.org/2000/svg';
  const sv = (tag, attrs, ...kids) => { const el = document.createElementNS(SVGNS, tag); for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v); kids.flat().forEach((c) => c != null && el.append(c.nodeType ? c : document.createTextNode(String(c)))); return el; };
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
      table(['الاسم', 'الدور', 'الصفة', 'التحقق', 'الصلاحيات', 'الحمل', 'آخر دخول', 'الحالة', 'إجراءات'], d.accounts.map((a) => [a.display_name, t(a.role), a.category ? t(a.category) : '—', a.review_date ? h('span', null, fmtD(a.review_date), a.expiring_soon ? h('span', { class: 'badge warn' }, 'قريبًا') : null) : '—', h('div', { class: 'pill-row' }, a.perms.length ? a.perms.map((p) => h('span', { class: 'badge' }, t(p))) : h('span', { class: 'muted small' }, 'بلا صلاحيات')), a.role === 'supervisor' ? a.load : '—', a.last_login ? fmt(a.last_login) : 'لم يدخل بعد', badge(a.status, stateCls(a.status)), rowActs(a)]), 'لا حسابات بعد.'),
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
