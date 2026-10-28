'use strict';
// مُولِّد نموذج إنشاء الملف من /api/schema: خطوات، تحقق لكل خطوة، شروط صلبة/مرنة، ومراجعة قبل الإيداع.
(function () {
  const { h, t } = MK;
  const STEPS = [
    ['الهوية والتواصل', ['name', 'dob', 'phone', 'contact_window']],
    ['المعلومات الأساسية', ['gender', 'city', 'marital_status', 'children', 'timeline', 'housing', 'wants_children', 'accepts_partner_children', 'polygamy_view', 'partner_work']],
    ['التعليم والعمل ونمط الحياة', ['education', 'works', 'work_field', 'travel', 'job_travel', 'smoking', 'smoking_ok', 'social_style', 'langs', 'values']],
    ['الطرف الآخر: الشروط والتفضيلات', ['pref_age_min', 'pref_age_max', 'pref_cities', 'pref_marital', 'hard', 'importance']],
    ['البطاقة المجهّلة', ['bio', 'card_fields', 'allow_supervisor_view']],
  ];
  const HELP = {
    dob: 'يظهر في البطاقة نطاق عمر فقط. الأهلية: 18 سنة فأكثر.', phone: 'لا يظهر لأحد. يُستخدم بعد اهتمام الطرفين فقط.', name: 'لا يظهر لأحد ولا يدخل المقارنة.',
    pref_cities: 'شرط صلب: لا يُقترح من يسكن خارج هذه المدن.', pref_marital: 'شرط صلب: لا يُقترح من حالته غير مختارة هنا.',
    importance: 'ارفع أهمية بُعد أو اخفضها؛ تُعاد الأوزان تلقائيًا.', card_fields: 'ما يراه المشرف الآخر في البطاقة. لا اسم ولا هاتف فيها أبدًا.',
    bio: 'وصف عام بلا أسماء أو هواتف أو روابط (تُحجب تلقائيًا).', polygamy_view: 'اختر «غير منطبق» إن لم يكن للحالة صلة.', allow_supervisor_view: 'تفويض مستقل قابل للسحب.',
    accepts_partner_children: 'اختيار «لا» يجعل وجود أبناء لدى الطرف الآخر مستبعِدًا.', values: 'حتى ثلاث قيم.',
  };
  // معايير الطرف الآخر: صياغة القيم بلسان الطرف الآخر لتكون واضحة
  const CRIT = [
    ['smoking', 'التدخين', { no: 'غير مدخن', yes: 'مدخن' }],
    ['children', 'وجود أبناء', { none: 'بلا أبناء', has: 'لديه أبناء' }],
    ['wants_children', 'الرغبة في الإنجاب', { yes: 'يرغب', no: 'لا يرغب', undecided: 'لم يحسم' }],
    ['housing', 'السكن الذي يريده', { independent: 'مستقل', family: 'مع الأسرة', flexible: 'مرن' }],
    ['partner_work', 'موقفه من عمل شريكه', { supports: 'يدعمه', prefers_not: 'يفضّل ألا يعمل', flexible: 'مرن' }],
    ['job_travel', 'تنقل عمله', { no: 'لا يتنقل', frequent: 'يتنقل كثيرًا' }],
    ['timeline', 'متى يريد البدء', { '0-6': 'خلال 6 أشهر', '6-12': '6–12 شهرًا', '12+': 'بعد سنة' }],
    ['polygamy_view', 'موقفه من التعدد', { accepts: 'يقبل', rejects: 'لا يقبل', not_applicable: 'غير منطبق' }],
  ];
  const MODES = [['none', 'لا يهم'], ['soft', 'مرن'], ['hard', 'صلب']];
  const DIMS = [['place', 'السكن والمكان'], ['family', 'تكوين الأسرة'], ['work', 'العمل والتعليم'], ['lifestyle', 'نمط الحياة'], ['values', 'القيم والتواصل']];
  const NEW_CARD = ['age_range', 'region', 'bio', 'education', 'timeline'];
  const ageOf = (d) => { const b = new Date(d), n = new Date(); if (isNaN(b)) return null; let a = n.getFullYear() - b.getFullYear(); if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--; return a; };

  MK.form = function form(schema, data, opts = {}) {
    const isNew = !Object.values(data || {}).some((L) => L && Object.keys(L).length);
    const get = (k) => (data[schema[k]?.layer] || {})[k];
    const ctl = {}; // key -> {read, err, check?, show?}
    const field = (k) => {
      const f = schema[k]; if (!f) return null;
      const id = 'f-' + k, req = f.phase === 'E', lab = h('label', { for: id }, f.label, req ? h('span', { class: 'req', 'aria-hidden': 'true' }, ' *') : null);
      let v = get(k), input, read, extra = null, check = null;
      if (isNew && k === 'card_fields' && v === undefined) v = NEW_CARD;
      const hint = HELP[k] ? h('div', { class: 'hint', id: id + '-h' }, HELP[k]) : null;
      if (f.type === 'enum' || f.type === 'city' || f.type === 'bool') {
        const opts2 = f.type === 'bool' ? [['true', 'نعم'], ['false', 'لا']] : (f.type === 'city' ? MK.CITIES : f.values).map((x) => [x, f.type === 'city' ? x : t(x)]);
        const cur = f.type === 'bool' ? (v === true ? 'true' : v === false ? 'false' : '') : v || '';
        input = h('select', { id, required: req }, h('option', { value: '' }, 'اختر…'), opts2.map(([val, l]) => h('option', { value: val, selected: cur === val }, l)));
        read = () => (input.value === '' ? undefined : f.type === 'bool' ? input.value === 'true' : input.value);
      } else if (f.type === 'int') { input = h('input', { id, type: 'number', inputmode: 'numeric', min: f.min, max: f.max, value: v ?? '', required: req }); read = () => (input.value === '' ? undefined : +input.value); check = () => { const x = read(); return x !== undefined && (!Number.isInteger(x) || x < f.min || x > f.max) ? `بين ${f.min} و${f.max}` : null; }; }
      else if (f.type === 'date') {
        input = h('input', { id, type: 'date', value: v || '', required: req, max: new Date().toISOString().slice(0, 10) }); extra = h('div', { class: 'hint ok-hint', 'aria-live': 'polite' });
        const upd = () => { const a = input.value ? ageOf(input.value) : null; extra.textContent = a === null ? '' : `العمر: ${a} سنة`; }; input.addEventListener('input', upd); upd();
        read = () => input.value || undefined; check = () => { const a = input.value ? ageOf(input.value) : null; return a !== null && a < 18 ? 'الأهلية 18 سنة فأكثر' : a !== null && a > 90 ? 'تاريخ غير منطقي' : null; };
      } else if (f.type === 'phone') { input = h('input', { id, type: 'tel', inputmode: 'tel', dir: 'ltr', value: v || '', placeholder: '05xxxxxxxx', required: req, autocomplete: 'off' }); read = () => input.value.trim() || undefined; check = () => { const x = read(); return x && !/^\+?\d{9,15}$/.test(x.replace(/[\s-]/g, '')) ? 'رقم غير صالح (9 إلى 15 رقمًا)' : null; }; }
      else if (f.type === 'text' && (f.max || 0) > 100) { input = h('textarea', { id, maxlength: f.max, rows: 4 }); input.value = v || ''; const cnt = h('div', { class: 'hint counter' }); const upd = () => (cnt.textContent = `${input.value.length} / ${f.max}`); input.addEventListener('input', upd); upd(); extra = cnt; read = () => input.value.trim() || undefined; }
      else if (f.type === 'text') { input = h('input', { id, type: 'text', maxlength: f.max, value: v || '', required: req }); read = () => input.value.trim() || undefined; }
      else if (f.type === 'multi') {
        const checks = f.values.map((x) => h('input', { type: 'checkbox', value: x, checked: (v || []).includes(x) }));
        input = h('div', { class: 'chips', role: 'group', 'aria-labelledby': id + '-l' }, f.values.map((x, i) => h('label', { class: 'chip' }, checks[i], k === 'pref_cities' || k === 'langs' || k === 'values' ? x : t(x))));
        lab.removeAttribute('for'); lab.id = id + '-l'; read = () => { const a = checks.filter((c) => c.checked).map((c) => c.value); return a.length ? a : undefined; };
        if (f.max) check = () => ((read() || []).length > f.max ? `اختر ${f.max} كحد أقصى` : null);
        if (k === 'pref_cities') extra = h('div', { class: 'actions tight' }, h('button', { type: 'button', class: 'btn sm ghost', onclick: () => checks.forEach((c) => (c.checked = true)) }, 'كل المدن'), h('button', { type: 'button', class: 'btn sm ghost', onclick: () => { const my = ctl.city?.read(); checks.forEach((c) => (c.checked = c.value === my)); if (!my) MK.toast('اختر مدينة الإقامة أولًا', true); } }, 'مدينته فقط'), h('button', { type: 'button', class: 'btn sm ghost', onclick: () => checks.forEach((c) => (c.checked = false)) }, 'مسح'));
      } else if (f.type === 'hard') return critBuilder(lab);
      else if (f.type === 'importance') {
        const sels = DIMS.map(([d, l]) => h('select', { 'aria-label': 'أهمية ' + l }, ['low', 'normal', 'high'].map((x) => h('option', { value: x, selected: ((v || {})[d] || 'normal') === x }, { low: 'أقل', normal: 'عادية', high: 'أعلى' }[x]))));
        input = h('div', { class: 'imp-grid' }, DIMS.map(([, l], i) => h('label', { class: 'imp' }, h('span', null, l), sels[i]))); lab.removeAttribute('for');
        read = () => { const o = {}; DIMS.forEach(([d], i) => { if (sels[i].value !== 'normal') o[d] = sels[i].value; }); return Object.keys(o).length ? o : undefined; };
      }
      if (['INPUT', 'SELECT', 'TEXTAREA'].includes(input.tagName) && hint) input.setAttribute('aria-describedby', id + '-h ' + id + '-e');
      const err = h('div', { class: 'err', role: 'alert', id: id + '-e' }); ctl[k] = { read, err, check, req, label: f.label, input };
      return h('div', { class: 'field' + (f.type === 'multi' || f.type === 'importance' ? ' wide' : ''), 'data-k': k }, lab, input, extra, hint, err);
    };

    // ---------- معايير الطرف الآخر: لا يهم / مرن / صلب ----------
    function critBuilder() {
      const hard = get('hard') || [], soft = get('soft') || [];
      const st = Object.fromEntries(CRIT.map(([k]) => { const hh = hard.find((x) => x.field === k), ss = soft.find((x) => x.field === k); return [k, { mode: hh ? 'hard' : ss ? 'soft' : 'none', values: [...((hh || ss || {}).values || [])] }]; }));
      const err = h('div', { class: 'err', role: 'alert', id: 'f-hard-e' }), counter = h('span', { class: 'badge' });
      const updCount = () => { const n = Object.values(st).filter((s) => s.mode === 'hard').length; counter.textContent = `شروط صلبة: ${n} / 5`; counter.className = 'badge ' + (n > 5 ? 'bad' : n ? 'warn' : ''); };
      const rows = CRIT.map(([k, label, vals]) => {
        const s = st[k], name = 'm-' + k;
        const chips = h('div', { class: 'chips', role: 'group', 'aria-label': 'القيم المقبولة: ' + label }, Object.entries(vals).map(([x, l]) => h('label', { class: 'chip' }, h('input', { type: 'checkbox', value: x, checked: s.values.includes(x), onchange: (e) => { s.values = e.target.checked ? [...s.values, x] : s.values.filter((y) => y !== x); row.classList.remove('invalid'); } }), l)));
        const vbox = h('div', { class: 'crit-vals' }, h('span', { class: 'small muted' }, 'المقبول لدى الطرف الآخر:'), chips);
        const seg = h('div', { class: 'seg', role: 'radiogroup', 'aria-label': label }, MODES.map(([m, l]) => h('label', { class: 'seg-o m-' + m }, h('input', { type: 'radio', name, value: m, checked: s.mode === m, onchange: () => { s.mode = m; draw(); } }), l)));
        const row = h('div', { class: 'crit' }, h('div', { class: 'crit-head' }, h('b', null, label), seg), vbox);
        const draw = () => { row.dataset.mode = s.mode; vbox.hidden = s.mode === 'none'; updCount(); }; draw();
        return row;
      });
      const box = h('div', { class: 'field wide', 'data-k': 'hard' },
        h('div', { class: 'crit-top' }, h('span', { class: 'lab' }, 'معايير الطرف الآخر'), counter),
        h('div', { class: 'legend-box' }, h('span', null, h('b', null, 'مرن: '), 'يرفع الدرجة عند التوافق ولا يستبعد أحدًا.'), h('span', null, h('b', null, 'صلب: '), 'يستبعد كل من لا يطابق. المجهول = «يحتاج إيضاحًا». حتى 5 شروط.')),
        h('div', { class: 'crit-list' }, rows), err);
      const pick = (m) => () => { const a = CRIT.filter(([k]) => st[k].mode === m && st[k].values.length).map(([k]) => ({ field: k, values: [...st[k].values] })); return a.length ? a : undefined; };
      const check = () => {
        const bad = CRIT.filter(([k]) => st[k].mode !== 'none' && !st[k].values.length);
        rows.forEach((r, i) => r.classList.toggle('invalid', bad.some(([k]) => k === CRIT[i][0])));
        if (bad.length) return 'اختر قيمة مقبولة واحدة على الأقل لكل معيار مرن أو صلب: ' + bad.map((x) => x[1]).join('، ');
        if (Object.values(st).filter((s) => s.mode === 'hard').length > 5) return 'الحد الأقصى 5 شروط صلبة. حوّل بعضها إلى «مرن».';
        return null;
      };
      ctl.hard = { read: pick('hard'), err, check, label: 'الشروط الصلبة' }; ctl.soft = { read: pick('soft'), err: h('div'), label: 'التفضيلات المرنة' };
      return box;
    }

    // ---------- الخطوات ----------
    let cur = 0;
    const N = STEPS.length + 1; // + المراجعة
    const sections = STEPS.map(([title, keys], i) => h('fieldset', { class: 'card step', hidden: true }, h('legend', { class: 'sr' }, title), h('div', { class: 'step-head' }, h('span', { class: 'step-n' }, String(i + 1)), h('div', null, h('span', { class: 'small muted' }, `الخطوة ${i + 1} من ${STEPS.length + 1}`), h('h3', null, title))), h('div', { class: 'fgrid' }, keys.map(field))));
    const review = h('section', { class: 'card step', hidden: true, 'aria-label': 'المراجعة' }); sections.push(review);
    const tabs = h('div', { class: 'stepper', role: 'tablist', 'aria-label': 'خطوات إنشاء الملف' });
    const nextB = h('button', { type: 'button', class: 'btn' }, 'التالي'), prevB = h('button', { type: 'button', class: 'btn ghost' }, 'السابق');
    const stepKeys = (i) => (STEPS[i] ? STEPS[i][1].concat(i === 3 ? ['soft'] : []) : []);
    const missingIn = (i) => stepKeys(i).filter((k) => ctl[k]?.req && ctl[k].read() === undefined);
    const errsIn = (i) => stepKeys(i).map((k) => [k, ctl[k]?.check?.()]).filter(([, e]) => e);
    const crossErr = () => { const a = ctl.pref_age_min?.read(), b = ctl.pref_age_max?.read(); return a !== undefined && b !== undefined && a > b ? [['pref_age_min', 'أدنى عمر أكبر من الأعلى']] : []; };
    const markStep = (i, { missing = true } = {}) => {
      stepKeys(i).forEach((k) => ctl[k] && (ctl[k].err.textContent = '')); let n = 0;
      for (const [k, e] of [...errsIn(i), ...(i === 3 ? crossErr() : [])]) { ctl[k].err.textContent = e; n++; }
      if (missing) for (const k of missingIn(i)) { if (!ctl[k].err.textContent) ctl[k].err.textContent = 'مطلوب قبل الإيداع'; }
      return n;
    };
    const drawTabs = () => tabs.replaceChildren(...[...STEPS.map(([tt]) => tt), 'المراجعة'].map((tt, j) => { const miss = j < STEPS.length ? missingIn(j).length : 0;
      return h('button', { type: 'button', role: 'tab', class: 'st ' + (j === cur ? 'on' : '') + (miss ? ' miss' : j < STEPS.length ? ' done' : ''), 'aria-selected': String(j === cur), onclick: () => go(j) }, h('span', { class: 'n' }, String(j + 1)), h('span', { class: 't' }, tt), miss ? h('span', { class: 'm', 'aria-label': miss + ' حقول مطلوبة' }, String(miss)) : null); }));
    const show = (i) => { cur = i; sections.forEach((s, j) => (s.hidden = j !== i)); if (i === STEPS.length) drawReview(); drawTabs(); prevB.disabled = i === 0; nextB.hidden = i === N - 1; };
    const go = (j) => { if (cur < STEPS.length && j > cur && markStep(cur, { missing: false })) { MK.toast('صحّح الحقول المعلَّمة أولًا', true); return; } if (cur < STEPS.length) markStep(cur, { missing: j > cur }); show(j); sections[j].scrollIntoView({ block: 'start', behavior: 'smooth' }); };
    nextB.onclick = () => go(cur + 1); prevB.onclick = () => go(cur - 1);
    Object.values(sections).forEach((s) => s.addEventListener('change', () => drawTabs()));

    function fmtVal(k, v) {
      const f = schema[k]; if (v === undefined) return null;
      if (k === 'hard' || k === 'soft') return v.map((x) => { const c = CRIT.find((y) => y[0] === x.field); return `${c ? c[1] : x.field}: ${x.values.map((z) => (c ? c[2][z] : z) || z).join(' أو ')}`; }).join('؛ ');
      if (k === 'importance') return DIMS.filter(([d]) => v[d]).map(([d, l]) => `${l}: ${{ low: 'أقل', high: 'أعلى' }[v[d]]}`).join('، ');
      if (k === 'dob') return `${v} (العمر ${ageOf(v)})`;
      if (f.type === 'bool') return v ? 'نعم' : 'لا';
      if (Array.isArray(v)) return v.map((x) => (k === 'pref_cities' || k === 'langs' || k === 'values' ? x : t(x))).join('، ');
      return f.type === 'enum' ? t(v) : String(v);
    }
    function drawReview() {
      const groups = STEPS.map(([title, keys], i) => {
        const ks = i === 3 ? keys.flatMap((k) => (k === 'hard' ? ['hard', 'soft'] : [k])) : keys;
        const items = ks.filter((k) => ctl[k]).map((k) => { const v = fmtVal(k, ctl[k].read()); return [k, v]; });
        const miss = items.filter(([k, v]) => v === null && ctl[k].req);
        return h('div', { class: 'rv-group' }, h('div', { class: 'rv-head' }, h('h4', null, `${i + 1}. ${title}`), miss.length ? h('span', { class: 'badge bad' }, `${miss.length} مطلوب`) : h('span', { class: 'badge ok' }, 'مكتمل'), h('button', { type: 'button', class: 'btn sm ghost', onclick: () => go(i) }, 'تعديل')),
          h('dl', { class: 'kv rv' }, items.filter(([k, v]) => v !== null || ctl[k].req).map(([k, v]) => [h('dt', null, ctl[k].label || schema[k]?.label || k), h('dd', { class: v === null ? 'missing' : '' }, v === null ? 'غير مُدخل (مطلوب)' : v)])));
      });
      const allMiss = STEPS.reduce((a, _, i) => a + missingIn(i).length, 0);
      review.replaceChildren(h('div', { class: 'step-head' }, h('span', { class: 'step-n' }, String(N)), h('div', null, h('span', { class: 'small muted' }, `الخطوة ${N} من ${N}`), h('h3', null, 'مراجعة الملف قبل الإيداع'))),
        allMiss ? h('div', { class: 'alert warn' }, `بقي ${allMiss} حقلًا مطلوبًا. يمكنك حفظ المسودة الآن والإيداع لاحقًا.`) : h('div', { class: 'alert ok' }, 'كل الحقول المطلوبة مكتملة. عاين الخيارات ثم أودع الملف.'), ...groups);
    }
    const collect = () => { const out = { I: {}, M: {}, S: {}, C: {} }; for (const [k, c] of Object.entries(ctl)) { const v = c.read(); if (v !== undefined && schema[k]) out[schema[k].layer][k] = v; } return out; };
    /** تحقق محلي شامل قبل الإرسال؛ يعيد true إن كان صالحًا */
    const check = () => { let first = -1; for (let i = 0; i < STEPS.length; i++) if (markStep(i, { missing: false }) && first < 0) first = i; if (first >= 0) { show(first); MK.toast('صحّح الحقول المعلَّمة أولًا', true); return false; } return true; };
    const showErrors = (fields = []) => { Object.values(ctl).forEach((c) => (c.err.textContent = '')); let first = -1; fields.forEach((k) => { const kk = k === 'soft' ? 'hard' : k; if (ctl[kk]) { ctl[kk].err.textContent = ctl[kk].err.textContent || 'تحقق من هذا الحقل'; const si = STEPS.findIndex(([, ks]) => ks.includes(kk)); if (si >= 0 && (first < 0 || si < first)) first = si; } }); if (first >= 0) show(first); };
    const missingAll = () => STEPS.flatMap((_, i) => missingIn(i));
    show(0);
    return { el: h('div', { class: 'pform' }, h('p', { class: 'small muted' }, 'الحقول المعلَّمة * مطلوبة للإيداع، ويمكن حفظ المسودة في أي وقت.'), tabs, ...sections, h('div', { class: 'actions step-nav' }, prevB, nextB)), collect, showErrors, check, missingAll, goto: (i) => show(i), toReview: () => show(N - 1) };
  };

  /** معاينة الخيارات: أعداد تقريبية من الملفات النشطة قبل الإيداع */
  MK.preview = (form) => {
    const out = h('div', { 'aria-live': 'polite' }, h('p', { class: 'muted small' }, 'بعد اختيار الجنس والشروط اضغط «عاين الخيارات» لترى كم ملفًا يناسب الشروط الآن، وما الذي يضيّق النتائج.'));
    const btn = h('button', { class: 'btn secondary', type: 'button' }, 'عاين الخيارات المتاحة');
    const FL = { age: 'العمر', city: 'المدينة', marital: 'الحالة الاجتماعية', gender: 'الجنس', children: 'الأبناء', smoking: 'التدخين', wants_children: 'الإنجاب', housing: 'السكن', partner_work: 'العمل', job_travel: 'تنقل العمل', timeline: 'التوقيت', polygamy_view: 'التعدد', marital_status: 'الحالة' };
    const num = (v) => parseInt(String(v).replace(/\D/g, ''), 10) || 0;
    const bar = (l, v, mx) => h('div', { class: 'row' }, h('span', null, l), h('div', { class: 'track' }, h('i', { class: 'bar', 'data-w': String(Math.round((100 * num(v)) / Math.max(1, mx))) })), h('b', null, String(v)));
    btn.onclick = async () => {
      if (form.check && !form.check()) return;
      btn.disabled = true;
      try {
        const r = await MK.post('/api/options/preview', form.collect()); const mx = Math.max(1, ...[r.pool, r.qualifying, r.needs_clarification, r.excluded].map(num));
        const rows = Object.entries(r.excluded_by).sort((a, b) => num(b[1]) - num(a[1])); const cl = Object.entries(r.clarify_fields);
        out.replaceChildren(h('div', { class: 'card preview' }, h('h3', null, 'الخيارات المتاحة الآن'),
          h('div', { class: 'funnel' }, bar('ملفات نشطة من الجنس الآخر', r.pool, mx), bar('تناسب الشروط من الجهتين', r.qualifying, mx), bar('تحتاج إيضاحًا', r.needs_clarification, mx), bar('استُبعدت بشرط صلب', r.excluded, mx)),
          rows.length ? h('div', null, h('b', null, 'أكثر ما يضيّق الخيارات'), h('div', { class: 'pill-row' }, rows.slice(0, 5).map(([k, v]) => h('span', { class: 'badge' }, `${FL[k] || k}: ${v}`))), r.most_restrictive ? h('p', { class: 'small muted' }, `الأكثر تقييدًا: ${FL[r.most_restrictive] || r.most_restrictive}. تحويله إلى «مرن» يوسّع الخيارات، والقرار لك.`) : null) : null,
          cl.length ? h('p', { class: 'small' }, 'حقول ناقصة لدى آخرين وتؤثر على النتيجة: ', cl.map(([k]) => FL[k] || k).join('، ')) : null,
          r.missing_for_accuracy.length ? h('p', { class: 'small' }, 'أكمل ' + r.missing_for_accuracy.map((k) => FL[k] || k).join('، ') + ' لدقة أعلى.') : null,
          h('p', { class: 'small muted' }, `${r.note} يُعرض لكل ملف حتى ${r.capacity} اقتراحات فقط.`)));
      } catch (e) { if (e.data?.error === 'NEED_FIELDS') { form.showErrors(e.data.fields || []); MK.toast('اختر الجنس أولًا لعرض الخيارات', true); } else MK.fail(e); }
      btn.disabled = false;
    };
    return h('div', { class: 'preview-wrap' }, out, btn);
  };
  MK.CITIES = ['الرياض', 'جدة', 'مكة المكرمة', 'المدينة المنورة', 'الدمام', 'الخبر', 'الظهران', 'الطائف', 'بريدة', 'تبوك', 'أبها', 'خميس مشيط', 'حائل', 'جازان', 'نجران', 'الأحساء', 'ينبع', 'الجبيل'];
})();

// ---------- المرفقات: سحب وإفلات أو اختيار، معاينة، حذف. تُخزَّن مشفّرة ولا تدخل المقارنة ----------
(function () {
  const { h, get, post, toast, fail, fmtD } = MK;
  const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'], MAX = 2 * 1024 * 1024, PER = 6;
  const kb = (n) => (n > 1e6 ? (n / 1e6).toFixed(1) + ' م.ب' : Math.round(n / 1024) + ' ك.ب');
  const toB64 = (file) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(file); });
  const del = (u) => MK.api('DELETE', u);
  MK.attachments = function attachments(pid, { readonly = false } = {}) {
    const list = h('div', { class: 'files' }), status = h('div', { class: 'hint', 'aria-live': 'polite' }), input = h('input', { type: 'file', accept: TYPES.join(','), multiple: true, class: 'sr', id: 'att-in' });
    let items = [];
    const draw = () => { list.replaceChildren(...items.map(card)); status.textContent = `${items.length} من ${PER} مرفقات · PDF أو صور حتى 2 م.ب`; dz.hidden = readonly || items.length >= PER; };
    const openFile = async (f) => { try { const r = await get(`/api/profiles/${pid}/files/${f.id}`); const url = `data:${r.type};base64,${r.data}`;
      if (r.type === 'application/pdf') { const b = Uint8Array.from(atob(r.data), (c) => c.charCodeAt(0)); const o = URL.createObjectURL(new Blob([b], { type: r.type })); window.open(o, '_blank', 'noopener'); setTimeout(() => URL.revokeObjectURL(o), 60e3); return; }
      await MK.dialog(f.name, h('div', null, h('img', { src: url, alt: f.label || f.name, class: 'file-full' })), [{ label: 'إغلاق', value: true, cls: 'secondary' }]); } catch (e) { fail(e); } };
    const remove = async (f) => { if (!await MK.confirm('حذف المرفق', `سيُحذف «${f.name}» نهائيًا.`, 'حذف', 'danger')) return; try { await del(`/api/profiles/${pid}/files/${f.id}`); items = items.filter((x) => x.id !== f.id); draw(); toast('حُذف المرفق'); } catch (e) { fail(e); } };
    const card = (f) => {
      const thumb = h('div', { class: 'file-thumb' }, f.type === 'application/pdf' ? h('span', { class: 'file-ext' }, 'PDF') : h('span', { class: 'file-ext' }, f.type.split('/')[1].toUpperCase()));
      if (f.type !== 'application/pdf') get(`/api/profiles/${pid}/files/${f.id}`).then((r) => thumb.replaceChildren(h('img', { src: `data:${r.type};base64,${r.data}`, alt: '' }))).catch(() => {});
      return h('div', { class: 'file-card' }, h('button', { type: 'button', class: 'file-open', onclick: () => openFile(f), 'aria-label': 'فتح ' + f.name }, thumb),
        h('div', { class: 'file-meta' }, h('b', null, f.label || f.name), h('span', { class: 'small muted' }, `${f.name} · ${kb(f.size)} · ${fmtD(f.at)}`)),
        readonly ? null : h('button', { type: 'button', class: 'btn sm ghost', onclick: () => remove(f) }, 'حذف'));
    };
    const upload = async (files) => {
      for (const file of files) {
        if (!TYPES.includes(file.type)) { toast(`«${file.name}»: النوع غير مدعوم`, true); continue; }
        if (file.size > MAX) { toast(`«${file.name}» أكبر من 2 م.ب`, true); continue; }
        if (items.length >= PER) { toast(`الحد الأقصى ${PER} مرفقات`, true); break; }
        const lab = h('input', { id: 'att-l', maxlength: 40, placeholder: 'مثال: نموذج الموافقة الموقّع' });
        const ok = await MK.dialog('وصف المرفق', h('div', null, h('p', { class: 'small muted' }, file.name), h('label', { for: 'att-l' }, 'ما هذا المرفق؟ (اختياري)'), lab), [{ label: 'رفع', value: true }, { label: 'إلغاء', value: false, cls: 'secondary' }]);
        if (!ok) continue;
        const lv = lab.value.trim();
        dz.classList.add('busy'); status.textContent = `جارٍ رفع «${file.name}»…`;
        try { const r = await post(`/api/profiles/${pid}/files`, { name: file.name, type: file.type, data: await toB64(file), label: lv }); items.push(r); draw(); toast('رُفع المرفق'); } catch (e) { fail(e); draw(); } finally { dz.classList.remove('busy'); }
      }
    };
    const dz = h('label', { class: 'dropzone', for: 'att-in', ondragover: (e) => { e.preventDefault(); dz.classList.add('over'); }, ondragleave: () => dz.classList.remove('over'), ondrop: (e) => { e.preventDefault(); dz.classList.remove('over'); upload([...e.dataTransfer.files]); } },
      MK.icon('plus'), h('b', null, 'أضف مرفقًا'), h('span', { class: 'small muted' }, 'اسحب الملفات هنا أو اضغط للاختيار'), input);
    input.onchange = () => { upload([...input.files]); input.value = ''; };
    const el = h('div', { class: 'card' }, h('h3', null, 'المرفقات'), h('p', { class: 'small muted' }, 'مستندات الملف: نموذج الموافقة، إثبات الصفة، أو ما يراه المشرف لازمًا. تُخزَّن مشفّرة، تظهر لك وحدك، ولا تدخل المقارنة ولا تُرسل لأحد.'), list, dz, status);
    get(`/api/profiles/${pid}/files`).then((r) => { items = r; draw(); }).catch((e) => { status.textContent = 'تعذر تحميل المرفقات'; fail(e); });
    return el;
  };
})();
