'use strict';
// محاكاة المحرك: نفس ملف server/matching/engine.js يعمل هنا في المتصفح على أشخاص اصطناعيين.
window.MKSim = function (root) {
  const E = window.MKEngine; if (!E || !root) return;
  const h = (tag, attrs, ...kids) => { const el = document.createElement(tag); for (const [k, v] of Object.entries(attrs || {})) { if (v === false || v == null) continue; if (k === 'class') el.className = v; else if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else if (k === 'value') el.value = v; else if (k === 'checked' || k === 'selected' || k === 'disabled') el[k] = !!v; else el.setAttribute(k, v === true ? '' : v); } for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c))); return el; };
  const L = { man: 'رجل', woman: 'امرأة', never_married: 'لم يسبق الزواج', divorced: 'مطلق/ة', widowed: 'أرمل/ة', none: 'بلا أبناء', has: 'لديه/ا أبناء', '0-6': '0–6 أشهر', '6-12': '6–12 شهرًا', '12+': 'أكثر من 12', independent: 'سكن مستقل', family: 'ضمن الأسرة', flexible: 'مرن', yes: 'نعم', no: 'لا', undecided: 'غير محسوم', quiet: 'هادئة', balanced: 'متوازنة', social: 'اجتماعية', bachelor: 'بكالوريوس', postgrad: 'دراسات عليا', diploma: 'دبلوم', secondary: 'ثانوي', high: 'عالٍ', mid: 'متوسط', low: 'يحتاج نقاشًا' };
  const WHY = { gender: 'الجنس', age: 'العمر', city: 'المدينة', marital: 'الحالة الاجتماعية', children: 'الأبناء', smoking: 'التدخين', wants_children: 'الرغبة بالإنجاب', housing: 'السكن', partner_work: 'العمل', job_travel: 'تنقل العمل', timeline: 'التوقيت', polygamy_view: 'التعدد', marital_status: 'الحالة الاجتماعية', age_unknown: 'العمر' };
  const UNKL = { age: 'العمر', city: 'المدينة', marital_status: 'الحالة', children: 'الأبناء', smoking: 'التدخين', job_travel: 'تنقل العمل', wants_children: 'الإنجاب', housing: 'السكن', timeline: 'التوقيت', partner_work: 'العمل', polygamy_view: 'التعدد' };
  const DIMS = [['place', 'المدينة والسكن'], ['family', 'الأسرة والتوقيت'], ['work', 'العمل والتعليم'], ['lifestyle', 'نمط الحياة'], ['values', 'القيم واللغة']];
  const CITIES = ['الرياض', 'جدة', 'مكة المكرمة', 'المدينة المنورة', 'الدمام', 'الخبر', 'الطائف', 'أبها'];
  const REGION = { 'الرياض': 'المنطقة الوسطى', 'جدة': 'المنطقة الغربية', 'مكة المكرمة': 'المنطقة الغربية', 'المدينة المنورة': 'المنطقة الغربية', 'الطائف': 'المنطقة الغربية', 'الدمام': 'المنطقة الشرقية', 'الخبر': 'المنطقة الشرقية', 'أبها': 'المنطقة الجنوبية' };
  const ageRange = (a) => { const lo = Math.floor(a / 5) * 5; return `${lo}–${lo + 4}`; };

  // مجموعة اصطناعية حتمية
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const r = rng(7), pick = (xs) => xs[Math.floor(r() * xs.length)], some = (xs, k) => [...xs].sort(() => r() - 0.5).slice(0, k);
  const near = { 'الرياض': ['الرياض'], 'جدة': ['جدة', 'مكة المكرمة', 'الطائف'], 'مكة المكرمة': ['مكة المكرمة', 'جدة'], 'المدينة المنورة': ['المدينة المنورة'], 'الدمام': ['الدمام', 'الخبر'], 'الخبر': ['الخبر', 'الدمام'], 'الطائف': ['الطائف', 'جدة'], 'أبها': ['أبها'] };
  const POOL = Array.from({ length: 90 }, (_, i) => {
    const gender = i % 2 ? 'woman' : 'man', city = pick(['الرياض', 'الرياض', 'الرياض', 'جدة', 'جدة', 'الدمام', 'الخبر', 'مكة المكرمة', 'المدينة المنورة', 'الطائف', 'أبها']), age = 22 + Math.floor(r() * 18), mar = r() < 0.72 ? 'never_married' : pick(['divorced', 'widowed']);
    return { id: (gender === 'man' ? 'م' : 'ن') + '-' + String(i + 1).padStart(2, '0'), busy: r() < 0.18, M: { gender, age, city, marital_status: mar, children: mar !== 'never_married' && r() < 0.5 ? 'has' : 'none', timeline: pick(['0-6', '6-12', '6-12', '12+']), housing: pick(['independent', 'independent', 'family', 'flexible']), partner_work: pick(['supports', 'flexible', 'prefers_not']), wants_children: pick(['yes', 'yes', 'undecided', 'no']), accepts_partner_children: pick(['yes', 'flexible', 'no']), polygamy_view: 'rejects', education: pick(['secondary', 'diploma', 'bachelor', 'bachelor', 'postgrad']), works: r() < 0.85, job_travel: pick(['no', 'no', 'frequent']), travel: pick(['yes', 'conditional', 'no']), smoking: r() < 0.2 ? 'yes' : 'no', smoking_ok: pick(['no', 'flexible', 'yes']), social_style: pick(['quiet', 'balanced', 'social']), langs: some(['العربية', 'الإنجليزية', 'الفرنسية'], 1 + Math.floor(r() * 2)), values: some(['الاحترام', 'الصدق', 'الأسرة', 'الاستقلال', 'الطموح', 'الهدوء', 'الكرم', 'التعلم'], 2), pref_age_min: Math.max(18, age - 7), pref_age_max: age + 7, pref_cities: [...new Set([...(near[city] || [city]), ...(r() < 0.35 ? [pick(CITIES)] : [])])], pref_marital: r() < 0.6 ? ['never_married'] : ['never_married', 'divorced', 'widowed'], hard: r() < 0.25 ? [{ field: 'smoking', values: ['no'] }] : [] },
      cards: some(['age_range', 'region', 'education', 'timeline', 'housing', 'social_style', 'langs', 'values', 'wants_children', 'city'], 6).concat(['age_range', 'region']) };
  });

  const PRESET = {
    flexible: { gender: 'man', age: 29, city: 'الرياض', marital_status: 'never_married', children: 'none', timeline: '6-12', housing: 'flexible', wants_children: 'yes', accepts_partner_children: 'flexible', partner_work: 'flexible', polygamy_view: 'rejects', smoking: 'no', smoking_ok: 'flexible', social_style: 'balanced', education: 'bachelor', works: true, job_travel: 'no', travel: 'yes', langs: ['العربية', 'الإنجليزية'], values: ['الصدق', 'الأسرة'], pref_age_min: 23, pref_age_max: 34, pref_cities: ['الرياض', 'جدة', 'الدمام', 'الخبر', 'مكة المكرمة', 'الطائف'], pref_marital: ['never_married', 'divorced', 'widowed'], hard: [], importance: {} },
    strict: { gender: 'woman', age: 27, city: 'جدة', marital_status: 'never_married', children: 'none', timeline: '0-6', housing: 'independent', wants_children: 'yes', accepts_partner_children: 'no', partner_work: 'supports', polygamy_view: 'rejects', smoking: 'no', smoking_ok: 'no', social_style: 'social', education: 'bachelor', works: true, job_travel: 'no', travel: 'conditional', langs: ['العربية'], values: ['الصدق', 'الكرم'], pref_age_min: 27, pref_age_max: 33, pref_cities: ['جدة'], pref_marital: ['never_married'], hard: [{ field: 'smoking', values: ['no'] }, { field: 'timeline', values: ['0-6'] }], importance: { family: 'high' } },
  };
  let me = JSON.parse(JSON.stringify(PRESET.flexible)); const decisions = {}; let sent = null;

  const sel = (label, key, opts, onSet) => { const id = 's-' + key; return h('div', { class: 'field' }, h('label', { for: id }, label), h('select', { id, onchange: (e) => { me[key] = e.target.value; refresh(); } }, opts.map(([v, l]) => h('option', { value: v, selected: me[key] === v }, l)))); };
  const num = (label, key, min, max) => h('div', { class: 'field' }, h('label', { for: 's-' + key }, label), h('input', { id: 's-' + key, type: 'number', min, max, value: me[key], onchange: (e) => { me[key] = Math.max(min, Math.min(max, +e.target.value || min)); refresh(); } }));
  const chips = (label, key, opts) => h('div', { class: 'field' }, h('span', { class: 'lab' }, label), h('div', { class: 'chips', role: 'group', 'aria-label': label }, opts.map(([v, l]) => h('label', { class: 'chip' }, h('input', { type: 'checkbox', checked: me[key].includes(v), onchange: (e) => { me[key] = e.target.checked ? [...me[key], v] : me[key].filter((x) => x !== v); refresh(); } }), l))));
  const hardToggle = (label, field, vals) => h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: me.hard.some((x) => x.field === field), onchange: (e) => { me.hard = me.hard.filter((x) => x.field !== field); if (e.target.checked) me.hard.push({ field, values: vals }); refresh(); } }), label);
  const imp = (d, l) => h('div', { class: 'field' }, h('label', { for: 'i-' + d }, l), h('select', { id: 'i-' + d, onchange: (e) => { if (e.target.value === 'normal') delete me.importance[d]; else me.importance[d] = e.target.value; refresh(); } }, [['normal', 'عادية'], ['high', 'مرتفعة'], ['low', 'منخفضة']].map(([v, t]) => h('option', { value: v, selected: (me.importance[d] || 'normal') === v }, t))));

  const left = h('div', { class: 'sim-form' }), out = h('div', { class: 'sim-out', 'aria-live': 'polite' });
  function drawForm() {
    left.replaceChildren(
      h('div', { class: 'card' }, h('h2', null, '1. أنت'), h('div', { class: 'row' }, h('button', { type: 'button', class: 'btn sm secondary', onclick: () => { me = JSON.parse(JSON.stringify(PRESET.flexible)); reset(); } }, 'مثال مرن'), h('button', { type: 'button', class: 'btn sm secondary', onclick: () => { me = JSON.parse(JSON.stringify(PRESET.strict)); reset(); } }, 'مثال صارم')),
        sel('أنا', 'gender', [['man', 'رجل'], ['woman', 'امرأة']]), num('عمري', 'age', 18, 70), sel('مدينتي', 'city', CITIES.map((c) => [c, c])), sel('حالتي الاجتماعية', 'marital_status', [['never_married', L.never_married], ['divorced', L.divorced], ['widowed', L.widowed]]), sel('الأبناء', 'children', [['none', 'بلا أبناء'], ['has', 'لدي أبناء']]), sel('الرغبة بالإنجاب', 'wants_children', [['yes', 'نعم'], ['no', 'لا'], ['undecided', 'غير محسوم']]), sel('توقيت البدء', 'timeline', [['0-6', L['0-6']], ['6-12', L['6-12']], ['12+', L['12+']]]), sel('السكن المرغوب', 'housing', [['independent', L.independent], ['family', L.family], ['flexible', L.flexible]])),
      h('div', { class: 'card' }, h('h2', null, '2. تفضيلات الشريك'), num('أدنى عمر مقبول', 'pref_age_min', 18, 80), num('أعلى عمر مقبول', 'pref_age_max', 18, 90), chips('المدن المقبولة', 'pref_cities', CITIES.map((c) => [c, c])), chips('الحالات المقبولة', 'pref_marital', [['never_married', L.never_married], ['divorced', L.divorced], ['widowed', L.widowed]]),
        h('div', { class: 'field' }, h('span', { class: 'lab' }, 'شروط لا أتجاوزها (صلبة)'), hardToggle('لا يدخّن', 'smoking', ['no']), hardToggle('بلا أبناء', 'children', ['none']), hardToggle('يرغب بالإنجاب', 'wants_children', ['yes']), hardToggle('توقيت قريب (0–6 أشهر)', 'timeline', ['0-6'])),
        h('details', null, h('summary', null, 'أهمية الأبعاد (اختياري)'), DIMS.map(([d, l]) => imp(d, l)))));
  }
  const reset = () => { for (const k of Object.keys(decisions)) delete decisions[k]; sent = null; drawForm(); refresh(); };

  function evaluate() {
    const stats = { opposite: 0, excluded: 0, excluded_by: {}, clarify: 0, clarify_fields: {}, insufficient: 0, below: 0, eligible: [] }; const excluded = [], clarify = [];
    for (const p of POOL) { if (p.M.gender === me.gender) continue; stats.opposite++;
      const ev = E.evaluatePair(me, p.M);
      if (ev.status === 'EXCLUDED') { stats.excluded++; stats.excluded_by[ev.why] = (stats.excluded_by[ev.why] || 0) + 1; excluded.push([p, ev.why]); }
      else if (ev.status === 'NEEDS_CLARIFICATION') { stats.clarify++; ev.unknown.forEach((f) => (stats.clarify_fields[f] = (stats.clarify_fields[f] || 0) + 1)); clarify.push([p, ev.unknown]); }
      else if (ev.status === 'INSUFFICIENT') stats.insufficient++; else if (ev.status === 'BELOW_THRESHOLD') stats.below++;
      else stats.eligible.push({ p, ev, a: 'me', b: p.id, mutual: ev.mutual, coverage: ev.coverage, exposure: { a: 0, b: p.busy ? 3 : 0 }, waitDays: { a: 0, b: 0 }, tie: p.id }); }
    // سعة الطرف الآخر: من امتلأت سعته لا يُحجز (كما في المنصة)
    const load = new Map(); POOL.filter((p) => p.busy).forEach((p) => load.set(p.id, 3));
    const chosen = E.select(stats.eligible, load); const chosenIds = new Set(chosen.map((c) => c.b));
    return { stats, excluded, clarify, chosen, rest: stats.eligible.filter((c) => !chosenIds.has(c.b)) };
  }
  const stage = (n, label, cls, sub) => h('div', { class: 'stage ' + (cls || '') }, h('b', null, String(n)), h('span', null, label), sub ? h('small', null, sub) : null);
  const bars = (map, labels) => { const mx = Math.max(1, ...Object.values(map)); return h('div', { class: 'mini-bars' }, Object.entries(map).sort((x, y) => y[1] - x[1]).map(([k, v]) => h('div', { class: 'bar-row' }, h('span', null, labels[k] || k), h('div', { class: 'track' }, h('i', { class: 'bar', 'data-w': String(Math.round(100 * v / mx)) })), h('b', null, String(v))))); };
  const card = (c, mine) => { const B = c.p.M, ab = c.ev.ab, d = decisions[c.p.id]; const reasons = E.reasons(ab.fits, c.p.cards), dims = E.dimLevels(ab.fits, c.p.cards);
    return h('article', { class: 'card cand' + (d === 'interested' ? ' picked' : '') }, h('div', { class: 'cand-top' }, h('span', { class: 'code' }, 'ك-' + c.p.id), h('span', { class: 'badge' }, `التوافق المتبادل ${Math.round(c.mutual)}`), h('span', { class: 'badge' }, `التغطية ${Math.round(c.coverage * 100)}%`)),
      h('dl', { class: 'kv' }, h('dt', null, 'العمر'), h('dd', null, ageRange(B.age)), h('dt', null, 'المنطقة'), h('dd', null, REGION[B.city]), c.p.cards.includes('education') ? [h('dt', null, 'التعليم'), h('dd', null, L[B.education])] : null, c.p.cards.includes('timeline') ? [h('dt', null, 'التوقيت'), h('dd', null, L[B.timeline])] : null, c.p.cards.includes('housing') ? [h('dt', null, 'السكن'), h('dd', null, L[B.housing])] : null),
      reasons.length ? h('div', null, h('b', null, 'لماذا اقتُرح'), h('ul', { class: 'reasons' }, reasons.map((x) => h('li', null, x)))) : null,
      h('div', { class: 'dims' }, DIMS.filter(([k]) => dims[k]).map(([k, l]) => h('div', { class: 'dim ' + dims[k] }, h('span', null, l), h('em', null, L[dims[k]])))),
      mine ? h('div', { class: 'actions' }, [['interested', 'مهتم'], ['not_interested', 'غير مهتم'], ['later', 'لاحقًا']].map(([v, t]) => h('button', { type: 'button', class: 'btn sm ' + (d === v ? '' : 'secondary'), 'aria-pressed': String(d === v), onclick: () => { decisions[c.p.id] = d === v ? undefined : v; sent = null; refresh(); } }, t))) : null);
  };
  function draw(res) {
    const s = res.stats, total = POOL.length;
    const sendBox = (() => { const picks = res.chosen.filter((c) => decisions[c.p.id] === 'interested'); if (!picks.length) return h('p', { class: 'muted' }, 'اختر «مهتم» لاقتراح واحد على الأقل ثم أرسل.');
      const go = h('button', { type: 'button', class: 'btn', onclick: () => { sent = picks.map((c) => { const back = E.directional(c.p.M, me), mutual = back.score >= 80 && ((c.p.id.charCodeAt(2) || 0) % 2 === 0); return { c, mutual }; }); refresh(); } }, `أرسل اهتمامي (${picks.length}) للمطابقة`); return h('div', null, go); })();
    const result = sent ? h('div', { class: 'card sent' }, h('h3', null, 'ماذا حدث بعد الإرسال؟'), sent.map(({ c, mutual }) => h('div', { class: 'flow-row' }, h('b', null, 'ك-' + c.p.id), h('span', { class: 'chip-state' }, 'PROPOSED'), h('span', null, '←'), h('span', { class: 'chip-state on' }, 'INTEREST_ONE_SIDE'), mutual ? [h('span', null, '←'), h('span', { class: 'chip-state ok' }, 'MUTUAL_INTEREST'), h('small', null, 'أبدى الطرف الآخر اهتمامه (محاكاة): يختار كل طرف حقول الكشف ويُعاد التحقق قبل أي كشف.')] : h('small', null, 'دعوة اهتمام فقط. لا يرى الطرف الآخر اسمك ولا هاتفك، وبانتظار قراره.')))) : null;
    out.replaceChildren(
      h('div', { class: 'card' }, h('h2', null, '3. ماذا فعل المحرك؟'), h('p', { class: 'muted' }, `مجموعة اصطناعية من ${total} شخصًا. يُختبر كل زوج في الاتجاهين.`),
        h('div', { class: 'stages' }, stage(total, 'في المجموعة'), stage(s.opposite, 'مقابل لك'), stage(s.excluded, 'استُبعد بشرط صلب', 'bad'), stage(s.clarify, 'يحتاج إيضاحًا', 'warn'), stage(s.insufficient + s.below, 'تحت العتبة', 'warn'), stage(s.eligible.length, 'مؤهل', 'ok'), stage(res.chosen.length, 'يُعرض (حتى 3)', 'ok strong')),
        s.excluded ? h('div', null, h('h4', null, 'أكثر الشروط استبعادًا'), bars(s.excluded_by, WHY)) : null,
        res.stats.clarify ? h('div', null, h('h4', null, 'معلومات ناقصة تمنع الحكم'), bars(s.clarify_fields, UNKL)) : null,
        s.excluded && !s.eligible.length ? h('div', { class: 'callout' }, 'لا يوجد مؤهلون. جرّب توسيع المدن أو العمر أو إزالة شرط صلب. المحرك لن يخفّف شروطك بدلًا عنك.') : null),
      h('div', null, h('h2', null, `اقتراحات المحرك (${res.chosen.length} من 3)`), res.chosen.length ? h('div', { class: 'grid g3' }, res.chosen.map((c) => card(c, true))) : h('div', { class: 'card empty' }, h('p', null, 'لا توجد اقتراحات مناسبة حاليًا.'), h('p', null, 'لن نغيّر شروطك دون موافقتك.')), h('div', { class: 'send-bar card' }, sendBox), result),
      res.rest.length ? h('details', { class: 'card' }, h('summary', null, `مؤهلون لم يُعرضوا (${res.rest.length}) — لأن الحد 3 أو لامتلاء سعة الطرف الآخر`), h('p', { class: 'small muted' }, 'في المنصة الفعلية لا يراهم أحد؛ نعرضهم هنا للتعلّم فقط.'), h('div', { class: 'grid g3' }, res.rest.slice(0, 6).map((c) => card(c, false)))) : null,
      res.excluded.length ? h('details', { class: 'card' }, h('summary', null, `لماذا استُبعد هؤلاء؟ (${res.excluded.length})`), h('div', { class: 'table-wrap' }, h('table', null, h('thead', null, h('tr', null, h('th', null, 'الرمز'), h('th', null, 'الشرط الذي فشل'))), h('tbody', null, res.excluded.slice(0, 15).map(([p, why]) => h('tr', null, h('td', null, 'ك-' + p.id), h('td', null, WHY[why] || why))))))) : null,
      h('p', { class: 'small muted' }, 'تنبيه: الأرقام معروضة هنا للشرح فقط. في المنصة الفعلية لا تُعرض نسبة توافق، لأنها ترتيب تفضيلات وليست احتمال نجاح.'));
    out.querySelectorAll('i[data-w]').forEach((i) => { i.style.width = i.dataset.w + '%'; });
  }
  let t; function refresh() { clearTimeout(t); t = setTimeout(() => draw(evaluate()), 60); }
  root.replaceChildren(h('div', { class: 'sim-grid' }, left, out)); drawForm(); draw(evaluate());
};
