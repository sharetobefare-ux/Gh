'use strict';
// مُولِّد نموذج الاستبيان المرحلي من /api/schema
(function () {
  const { h, t } = MK;
  const STEPS = [
    ['التحقق والهوية', ['name', 'dob', 'phone', 'contact_window']],
    ['المعلومات الأساسية', ['gender', 'city', 'marital_status', 'children', 'timeline', 'housing', 'wants_children', 'accepts_partner_children', 'polygamy_view', 'partner_work']],
    ['التعليم والعمل ونمط الحياة (اختياري)', ['education', 'works', 'work_field', 'travel', 'job_travel', 'smoking', 'smoking_ok', 'social_style', 'langs', 'values']],
    ['تفضيلات الشريك', ['pref_age_min', 'pref_age_max', 'pref_cities', 'pref_marital', 'hard', 'importance']],
    ['البطاقة والإفصاح', ['bio', 'card_fields', 'allow_supervisor_view']],
  ];
  const HELP = { hard: 'حتى خمسة شروط لا ترغب بتجاوزها. المجهول فيها يعني «يحتاج إيضاحًا» لا «غير مناسب».', importance: 'ارفع أهمية بُعد أو اخفضها؛ تُعاد الأوزان تلقائيًا.', card_fields: 'اختر ما يظهر في بطاقتك المجهّلة. لا اسم ولا هاتف فيها أبدًا.', bio: 'بلا أسماء أو هواتف أو روابط (تُحجب تلقائيًا).', dob: 'يظهر منه نطاق عمر فقط. الأهلية: 18 سنة فأكثر.', polygamy_view: 'اختر «غير منطبق» إن لم يكن للحالة صلة.', pref_age_min: 'الحد الأدنى للعمر المقبول', allow_supervisor_view: 'تفويض مستقل قابل للسحب.' };
  const HARD_LABELS = { children: 'الأبناء (لدى الطرف الآخر)', wants_children: 'رغبته بالإنجاب', housing: 'السكن', partner_work: 'موقفه من العمل', smoking: 'التدخين', job_travel: 'تنقل عمله', timeline: 'توقيت البدء', polygamy_view: 'التعدد', marital_status: 'حالته الاجتماعية' };
  const HARD_VALUES = { children: ['none', 'has'], wants_children: ['yes', 'no', 'undecided'], housing: ['independent', 'family', 'flexible'], partner_work: ['supports', 'prefers_not', 'flexible'], smoking: ['no', 'yes'], job_travel: ['frequent', 'no'], timeline: ['0-6', '6-12', '12+'], polygamy_view: ['accepts', 'rejects', 'not_applicable'], marital_status: ['never_married', 'divorced', 'widowed'] };
  const DIMS = [['place', 'السكن والمكان'], ['family', 'تكوين الأسرة'], ['work', 'العمل والتعليم'], ['lifestyle', 'نمط الحياة'], ['values', 'القيم والتواصل']];

  MK.form = function form(schema, data, opts = {}) {
    const get = (k) => (data[schema[k].layer] || {})[k];
    const ctl = {}; // key -> {read()}
    const field = (k) => {
      const f = schema[k], id = 'f-' + k, v = get(k), lab = h('label', { for: id }, f.label + (f.phase === 'E' ? ' *' : '')); let input, read;
      const hint = HELP[k] ? h('div', { class: 'hint', id: id + '-h' }, HELP[k]) : null;
      if (f.type === 'enum') {
        input = h('select', { id }, h('option', { value: '' }, 'اختر…'), f.values.map((x) => h('option', { value: x, selected: v === x }, t(x)))); read = () => input.value || undefined;
      } else if (f.type === 'city') {
        input = h('select', { id }, h('option', { value: '' }, 'اختر…'), CITIES.map((x) => h('option', { value: x, selected: v === x }, x))); read = () => input.value || undefined;
      } else if (f.type === 'bool') {
        input = h('select', { id }, h('option', { value: '' }, 'اختر…'), h('option', { value: 'true', selected: v === true }, 'نعم'), h('option', { value: 'false', selected: v === false }, 'لا')); read = () => (input.value === '' ? undefined : input.value === 'true');
      } else if (f.type === 'int') { input = h('input', { id, type: 'number', min: f.min, max: f.max, value: v ?? '' }); read = () => (input.value === '' ? undefined : +input.value); }
      else if (f.type === 'date') { input = h('input', { id, type: 'date', value: v || '' }); read = () => input.value || undefined; }
      else if (f.type === 'phone') { input = h('input', { id, type: 'tel', inputmode: 'tel', dir: 'ltr', value: v || '', placeholder: '05xxxxxxxx' }); read = () => input.value.trim() || undefined; }
      else if (f.type === 'text' && (f.max || 0) > 100) { input = h('textarea', { id, maxlength: f.max }, v || ''); read = () => input.value.trim() || undefined; }
      else if (f.type === 'text') { input = h('input', { id, type: 'text', maxlength: f.max, value: v || '' }); read = () => input.value.trim() || undefined; }
      else if (f.type === 'multi') {
        const checks = f.values.map((x) => h('input', { type: 'checkbox', value: x, checked: (v || []).includes(x) })); input = h('div', { class: 'chips', role: 'group', 'aria-labelledby': id + '-l' }, f.values.map((x, i) => h('label', { class: 'chip' }, checks[i], schema[k].values && k !== 'pref_cities' && k !== 'langs' && k !== 'values' ? t(x) : t(x))));
        lab.removeAttribute('for'); lab.id = id + '-l'; read = () => { const a = checks.filter((c) => c.checked).map((c) => c.value); return a.length ? a : undefined; };
      } else if (f.type === 'hard') {
        const rows = h('div'); const state = (v || []).map((x) => ({ ...x })); const draw = () => { rows.replaceChildren(...state.map((s, i) => hardRow(s, i)), state.length < 5 ? h('button', { type: 'button', class: 'btn sm secondary', onclick: () => { state.push({ field: 'smoking', values: [] }); draw(); } }, 'إضافة شرط') : h('span', { class: 'hint' }, 'بلغت الحد (5)')); };
        const hardRow = (s, i) => { const sel = h('select', { 'aria-label': 'الحقل', onchange: () => { s.field = sel.value; s.values = []; draw(); } }, Object.keys(HARD_LABELS).map((x) => h('option', { value: x, selected: s.field === x }, HARD_LABELS[x])));
          return h('div', { class: 'card field' }, sel, h('div', { class: 'chips' }, HARD_VALUES[s.field].map((x) => h('label', { class: 'chip' }, h('input', { type: 'checkbox', checked: s.values.includes(x), onchange: (e) => { s.values = e.target.checked ? [...s.values, x] : s.values.filter((y) => y !== x); } }), t(x)))), h('button', { type: 'button', class: 'btn sm ghost', onclick: () => { state.splice(i, 1); draw(); } }, 'حذف الشرط')); };
        draw(); input = rows; read = () => { const a = state.filter((s) => s.values.length); return a.length ? a : undefined; };
      } else if (f.type === 'importance') {
        const sels = DIMS.map(([d, l]) => h('select', { 'aria-label': l }, ['normal', 'high', 'low'].map((x) => h('option', { value: x, selected: ((v || {})[d] || 'normal') === x }, t(x))))); input = h('div', { class: 'grid g2' }, DIMS.map(([, l], i) => h('div', null, h('span', { class: 'small' }, l), sels[i]))); lab.removeAttribute('for');
        read = () => { const o = {}; DIMS.forEach(([d], i) => { if (sels[i].value !== 'normal') o[d] = sels[i].value; }); return Object.keys(o).length ? o : undefined; };
      }
      if (input.tagName && ['INPUT', 'SELECT', 'TEXTAREA'].includes(input.tagName) && hint) input.setAttribute('aria-describedby', id + '-h');
      const err = h('div', { class: 'err', role: 'alert', id: id + '-e' }); ctl[k] = { read, err };
      return h('div', { class: 'field' }, lab, input, hint, err);
    };
    let cur = 0; const readonly = !!opts.readonly;
    const sections = STEPS.map(([title, keys]) => h('fieldset', { class: 'card', hidden: true, style: undefined }, h('legend', { class: 'sr' }, title), h('h3', null, title), keys.filter((k) => schema[k]).map(field)));
    const tabs = h('div', { class: 'stepper', role: 'tablist' }); const nextB = h('button', { type: 'button', class: 'btn secondary' }, 'التالي'), prevB = h('button', { type: 'button', class: 'btn ghost' }, 'السابق');
    const show = (i) => { cur = i; sections.forEach((s, j) => (s.hidden = j !== i)); tabs.replaceChildren(...STEPS.map(([tt], j) => h('span', { class: j === i ? 'on' : j < i ? 'done' : '', role: 'tab', 'aria-selected': String(j === i) }, `${j + 1}. ${tt}`))); prevB.disabled = i === 0; nextB.disabled = i === STEPS.length - 1; };
    nextB.onclick = () => { show(cur + 1); window.scrollTo(0, 0); }; prevB.onclick = () => { show(cur - 1); window.scrollTo(0, 0); }; show(0);
    const collect = () => { const out = { I: {}, M: {}, S: {}, C: {} }; for (const [k, c] of Object.entries(ctl)) { const v = c.read(); if (v !== undefined) out[schema[k].layer][k] = v; } return out; };
    const showErrors = (fields = []) => { Object.values(ctl).forEach((c) => (c.err.textContent = '')); let first = -1; fields.forEach((k) => { if (ctl[k]) { ctl[k].err.textContent = 'تحقق من هذا الحقل'; const si = STEPS.findIndex(([, ks]) => ks.includes(k)); if (first < 0 || si < first) first = si; } }); if (first >= 0) show(first); };
    return { el: h('div', null, tabs, ...sections, h('div', { class: 'actions' }, prevB, nextB)), collect, showErrors, goto: show };
  };
  /** لوحة معاينة الخيارات: أعداد تقريبية من الملفات النشطة قبل الإرسال */
  MK.preview = (form) => {
    const out = h('div', { 'aria-live': 'polite' }, h('p', { class: 'muted small' }, 'اختر الجنس وأكمل شروطك ثم اضغط «عاين الخيارات» لترى كم خيارًا يناسب شروطك الآن، وما الذي يضيّق النتائج.'));
    const btn = h('button', { class: 'btn secondary', type: 'button' }, 'عاين الخيارات المتاحة');
    const FL = { age: 'العمر', city: 'المدينة', marital: 'الحالة الاجتماعية', children: 'الأبناء', smoking: 'التدخين', wants_children: 'الإنجاب', housing: 'السكن', partner_work: 'العمل', job_travel: 'تنقل العمل', timeline: 'التوقيت', polygamy_view: 'التعدد', marital_status: 'الحالة' };
    const bar = (l, v, mx) => h('div', { class: 'row' }, h('span', null, l), h('div', { class: 'track' }, h('i', { class: 'bar', 'data-w': String(Math.round(100 * (parseInt(String(v).replace(/\D/g, ''), 10) || 0) / Math.max(1, mx)))})), h('b', null, String(v)));
    btn.onclick = async () => {
      btn.disabled = true;
      try {
        const r = await MK.post('/api/options/preview', form.collect()); const mx = Math.max(1, ...[r.pool, r.qualifying, r.needs_clarification, r.excluded].map((v) => parseInt(String(v).replace(/\D/g, ''), 10) || 0));
        const rows = Object.entries(r.excluded_by); const cl = Object.entries(r.clarify_fields);
        out.replaceChildren(h('div', { class: 'card preview' }, h('h3', null, 'الخيارات المتاحة الآن'),
          h('div', { class: 'funnel' }, bar('ملفات نشطة مقابلة', r.pool, mx), bar('تناسب شروطك من الجهتين', r.qualifying, mx), bar('تحتاج إيضاحًا', r.needs_clarification, mx), bar('استُبعدت بشروط صلبة', r.excluded, mx)),
          rows.length ? h('div', null, h('b', null, 'أكثر ما يضيّق الخيارات'), h('div', { class: 'pill-row' }, rows.sort((a, b) => (parseInt(b[1], 10) || 0) - (parseInt(a[1], 10) || 0)).slice(0, 5).map(([k, v]) => h('span', { class: 'badge' }, `${FL[k] || k}: ${v}`))), r.most_restrictive ? h('p', { class: 'small muted' }, `الأكثر تقييدًا: ${FL[r.most_restrictive] || r.most_restrictive}. تخفيف هذا الشرط يوسّع الخيارات، والقرار لك.`) : null) : null,
          cl.length ? h('p', { class: 'small' }, 'حقول ناقصة لدى آخرين وتؤثر على النتيجة: ', cl.map(([k]) => FL[k] || k).join('، ')) : null,
          r.missing_for_accuracy.length ? h('p', { class: 'small' }, 'أكمل ' + r.missing_for_accuracy.map((k) => FL[k] || k).join('، ') + ' لدقة أعلى.') : null,
          h('p', { class: 'small muted' }, `${r.note} يُعرض لكل شخص حتى ${r.capacity} اقتراحات فقط.`)), btn);
      } catch (e) { if (e.data?.error === 'NEED_FIELDS') { form.showErrors(e.data.fields || []); MK.toast('اختر الجنس أولًا لعرض الخيارات', true); } else MK.fail(e); }
      btn.disabled = false;
    };
    return h('div', { class: 'preview-wrap' }, out, btn);
  };
  const CITIES = ['الرياض', 'جدة', 'مكة المكرمة', 'المدينة المنورة', 'الدمام', 'الخبر', 'الظهران', 'الطائف', 'بريدة', 'تبوك', 'أبها', 'خميس مشيط', 'حائل', 'جازان', 'نجران', 'الأحساء', 'ينبع', 'الجبيل'];
  MK.CITIES = CITIES;
})();
