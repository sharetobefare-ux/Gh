'use strict';
// محاكي المحرك: نفس ملف server/matching/engine.js يعمل في المتصفح على 90 ملفًا اصطناعيًا.
// الفكرة: غيّر شرطًا، شاهد الأثر فورًا على القمع، واضغط «خفّف» لترى السبب والنتيجة معًا.
window.MKSim = function (root) {
  const E = window.MKEngine; if (!E || !root) return;
  const h = (tag, attrs, ...kids) => { const el = document.createElement(tag); for (const [k, v] of Object.entries(attrs || {})) { if (v === false || v == null) continue; if (k === 'class') el.className = v; else if (k.startsWith('on')) el.addEventListener(k.slice(2), v); else if (k === 'value') el.value = v; else if (k === 'checked' || k === 'selected' || k === 'disabled' || k === 'open') el[k] = !!v; else el.setAttribute(k, v === true ? '' : v); } for (const c of kids.flat(Infinity)) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c))); return el; };
  const sv = (tag, attrs, ...kids) => { const el = document.createElementNS('http://www.w3.org/2000/svg', tag); for (const [k, v] of Object.entries(attrs || {})) el.setAttribute(k, v); kids.flat().forEach((c) => c != null && el.append(c.nodeType ? c : document.createTextNode(String(c)))); return el; };
  const L = { never_married: 'لم يسبق الزواج', divorced: 'مطلق/ة', widowed: 'أرمل/ة', none: 'بلا أبناء', has: 'لديه أبناء', '0-6': 'خلال 6 أشهر', '6-12': '6–12 شهرًا', '12+': 'بعد سنة', independent: 'سكن مستقل', family: 'مع الأسرة', flexible: 'مرن', yes: 'نعم', no: 'لا', undecided: 'غير محسوم', quiet: 'هادئة', balanced: 'متوازنة', social: 'اجتماعية', bachelor: 'بكالوريوس', postgrad: 'دراسات عليا', diploma: 'دبلوم', secondary: 'ثانوي', supports: 'يدعمه', prefers_not: 'يفضّل ألا يعمل' };
  const WHY = { gender: 'الجنس', age: 'العمر', city: 'المدينة', marital: 'الحالة الاجتماعية', children: 'الأبناء', smoking: 'التدخين', wants_children: 'الإنجاب', housing: 'السكن', partner_work: 'العمل', job_travel: 'تنقل العمل', timeline: 'التوقيت', polygamy_view: 'التعدد', marital_status: 'الحالة الاجتماعية' };
  const DIMS = [['place', 'السكن والمكان'], ['family', 'تكوين الأسرة وتوقيت الزواج'], ['work', 'العمل والتعليم'], ['lifestyle', 'نمط الحياة'], ['values', 'التواصل والقيم']];
  const CITIES = ['الرياض', 'جدة', 'مكة المكرمة', 'المدينة المنورة', 'الدمام', 'الخبر', 'الطائف', 'أبها'];
  const REGION = { 'الرياض': 'المنطقة الوسطى', 'جدة': 'المنطقة الغربية', 'مكة المكرمة': 'المنطقة الغربية', 'المدينة المنورة': 'المنطقة الغربية', 'الطائف': 'المنطقة الغربية', 'الدمام': 'المنطقة الشرقية', 'الخبر': 'المنطقة الشرقية', 'أبها': 'المنطقة الجنوبية' };
  const near = { 'الرياض': ['الرياض'], 'جدة': ['جدة', 'مكة المكرمة', 'الطائف'], 'مكة المكرمة': ['مكة المكرمة', 'جدة', 'الطائف'], 'المدينة المنورة': ['المدينة المنورة'], 'الدمام': ['الدمام', 'الخبر'], 'الخبر': ['الخبر', 'الدمام'], 'الطائف': ['الطائف', 'جدة', 'مكة المكرمة'], 'أبها': ['أبها'] };
  const ageRange = (a) => { const lo = Math.floor(a / 5) * 5; return `${lo}–${lo + 4}`; };
  const clone = (o) => JSON.parse(JSON.stringify(o));

  // مجموعة اصطناعية حتمية (نفس الأشخاص في كل مرة)
  function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const r = rng(7), pick = (xs) => xs[Math.floor(r() * xs.length)], some = (xs, k) => [...xs].sort(() => r() - 0.5).slice(0, k);
  const POOL = Array.from({ length: 90 }, (_, i) => {
    const gender = i % 2 ? 'woman' : 'man', city = pick(['الرياض', 'الرياض', 'الرياض', 'جدة', 'جدة', 'الدمام', 'الخبر', 'مكة المكرمة', 'المدينة المنورة', 'الطائف', 'أبها']), age = 22 + Math.floor(r() * 18), mar = r() < 0.72 ? 'never_married' : pick(['divorced', 'widowed']);
    return { id: (gender === 'man' ? 'م' : 'ن') + '-' + String(i + 1).padStart(2, '0'), busy: r() < 0.18, M: { gender, age, city, marital_status: mar, children: mar !== 'never_married' && r() < 0.5 ? 'has' : 'none', timeline: pick(['0-6', '6-12', '6-12', '12+']), housing: pick(['independent', 'independent', 'family', 'flexible']), partner_work: pick(['supports', 'flexible', 'prefers_not']), wants_children: pick(['yes', 'yes', 'undecided', 'no']), accepts_partner_children: pick(['yes', 'flexible', 'no']), polygamy_view: 'rejects', education: pick(['secondary', 'diploma', 'bachelor', 'bachelor', 'postgrad']), works: r() < 0.85, job_travel: pick(['no', 'no', 'frequent']), travel: pick(['yes', 'conditional', 'no']), smoking: r() < 0.2 ? 'yes' : 'no', smoking_ok: pick(['no', 'flexible', 'yes']), social_style: pick(['quiet', 'balanced', 'social']), langs: some(['العربية', 'الإنجليزية', 'الفرنسية'], 1 + Math.floor(r() * 2)), values: some(['الاحترام', 'الصدق', 'الأسرة', 'الاستقلال', 'الطموح', 'الهدوء', 'الكرم', 'التعلم'], 2), pref_age_min: Math.max(18, age - 7), pref_age_max: age + 7, pref_cities: [...new Set([...(near[city] || [city]), ...(r() < 0.35 ? [pick(CITIES)] : [])])], pref_marital: r() < 0.6 ? ['never_married'] : ['never_married', 'divorced', 'widowed'], hard: r() < 0.25 ? [{ field: 'smoking', values: ['no'] }] : [] },
      cards: some(['education', 'timeline', 'housing', 'social_style', 'langs', 'values', 'wants_children', 'city'], 5).concat(['age_range', 'region']) };
  });

  // معايير الطرف الآخر في المحاكي: قيمة واحدة مرغوبة لكل معيار، ووضع: لا يهم / مرن / صلب
  const CRIT = [['smoking', 'التدخين', 'no', 'غير مدخن'], ['children', 'الأبناء', 'none', 'بلا أبناء'], ['wants_children', 'الإنجاب', 'yes', 'يرغب بالإنجاب'], ['timeline', 'التوقيت', '0-6', 'يبدأ خلال 6 أشهر'], ['housing', 'السكن', 'independent', 'سكن مستقل']];
  const BASE = { gender: 'man', age: 29, city: 'الرياض', marital_status: 'never_married', children: 'none', timeline: '6-12', housing: 'flexible', wants_children: 'yes', accepts_partner_children: 'flexible', partner_work: 'flexible', polygamy_view: 'rejects', smoking: 'no', smoking_ok: 'flexible', social_style: 'balanced', education: 'bachelor', works: true, job_travel: 'no', travel: 'yes', langs: ['العربية', 'الإنجليزية'], values: ['الصدق', 'الأسرة'], pref_age_min: 23, pref_age_max: 34, pref_cities: ['الرياض', 'جدة', 'الدمام', 'الخبر', 'مكة المكرمة', 'الطائف'], pref_marital: ['never_married', 'divorced', 'widowed'], crit: {}, importance: {} };
  const PRESETS = [
    ['flexible', 'مرن', 'مدن كثيرة، نطاق عمر واسع، بلا شروط صلبة', BASE],
    ['balanced', 'متوازن', 'مدينته والمجاورة، شرط صلب واحد (غير مدخن)', { ...BASE, pref_cities: ['الرياض'], pref_age_min: 24, pref_age_max: 32, pref_marital: ['never_married', 'divorced'], crit: { smoking: 'hard', timeline: 'soft' } }],
    ['strict', 'صارم', 'مدينة واحدة، عمر ضيق، ثلاثة شروط صلبة', { ...BASE, gender: 'woman', age: 27, city: 'جدة', smoking_ok: 'no', timeline: '0-6', housing: 'independent', pref_age_min: 27, pref_age_max: 33, pref_cities: ['جدة'], pref_marital: ['never_married'], crit: { smoking: 'hard', timeline: 'hard', children: 'hard' }, importance: { family: 'high' } }],
  ];
  let me = clone(BASE), preset = 'flexible', history = [], prev = null, lastChange = '', tick = 0;
  const toEngine = () => { const A = clone(me); A.hard = []; A.soft = []; for (const [f, , v] of CRIT) { if (me.crit[f] === 'hard') A.hard.push({ field: f, values: [v] }); if (me.crit[f] === 'soft') A.soft.push({ field: f, values: [v] }); } delete A.crit; return A; };
  const change = (label, fn) => { history.push(clone(me)); if (history.length > 12) history.shift(); prev = evaluate(); lastChange = label; preset = ''; fn(); drawForm(); refresh(); };
  const undo = () => { if (!history.length) return; me = history.pop(); prev = null; lastChange = ''; drawForm(); refresh(); };

  // ---------- التقييم: نفس المحرك، مع تمييز «شرطك» عن «شرطه» ----------
  function evaluate() {
    const A = toEngine(), s = { opposite: 0, byMe: 0, byThem: 0, byMeWhy: {}, byThemWhy: {}, clarify: 0, insufficient: 0, below: 0, eligible: [] }, excluded = [];
    for (const p of POOL) { if (p.M.gender === me.gender) continue; s.opposite++;
      const h1 = E.hardCheck(A, p.M), h2 = E.hardCheck(p.M, A);
      if (h1.ok === false) { s.byMe++; s.byMeWhy[h1.why] = (s.byMeWhy[h1.why] || 0) + 1; excluded.push([p, 'me', h1.why]); continue; }
      if (h2.ok === false) { s.byThem++; s.byThemWhy[h2.why] = (s.byThemWhy[h2.why] || 0) + 1; excluded.push([p, 'them', h2.why]); continue; }
      const ev = E.evaluatePair(A, p.M);
      if (ev.status === 'NEEDS_CLARIFICATION') s.clarify++; else if (ev.status === 'INSUFFICIENT') s.insufficient++; else if (ev.status === 'BELOW_THRESHOLD') s.below++;
      else s.eligible.push({ p, ev, a: 'me', b: p.id, mutual: ev.mutual, coverage: ev.coverage, exposure: { a: 0, b: p.busy ? 3 : 0 }, waitDays: { a: 0, b: 0 }, tie: p.id }); }
    const load = new Map(); POOL.filter((p) => p.busy).forEach((p) => load.set(p.id, 3));
    const chosen = E.select(s.eligible, load), ids = new Set(chosen.map((c) => c.b));
    return { s, excluded, chosen, rest: s.eligible.filter((c) => !ids.has(c.b)), A };
  }
  // ---------- النموذج ----------
  const left = h('div', { class: 'sim-form' }), out = h('div', { class: 'sim-out', 'aria-live': 'polite' }), sumBox = h('div', { class: 'sim-sum' });
  const sel = (label, key, opts) => { const id = 's-' + key; return h('div', { class: 'field' }, h('label', { for: id }, label), h('select', { id, onchange: (e) => change(label, () => { me[key] = e.target.value; }) }, opts.map(([v, l]) => h('option', { value: v, selected: me[key] === v }, l)))); };
  const num = (label, key, min, max) => h('div', { class: 'field' }, h('label', { for: 's-' + key }, label), h('input', { id: 's-' + key, type: 'number', inputmode: 'numeric', min, max, value: me[key], onchange: (e) => change(label, () => { me[key] = Math.max(min, Math.min(max, +e.target.value || min)); }) }));
  const chips = (label, key, opts, quick) => h('div', { class: 'field' }, h('span', { class: 'lab' }, label), h('div', { class: 'chips', role: 'group', 'aria-label': label }, opts.map(([v, l]) => h('label', { class: 'chip' }, h('input', { type: 'checkbox', checked: me[key].includes(v), onchange: (e) => change(label, () => { me[key] = e.target.checked ? [...me[key], v] : me[key].filter((x) => x !== v); }) }), l))), quick ? h('div', { class: 'actions tight' }, quick.map(([l, fn]) => h('button', { type: 'button', class: 'btn sm ghost', onclick: () => change(label + ': ' + l, fn) }, l))) : null);
  const critRow = ([f, label, , want]) => { const mode = me.crit[f] || 'none', name = 'sm-' + f;
    return h('div', { class: 'crit', 'data-mode': mode }, h('div', { class: 'crit-head' }, h('b', null, label), h('div', { class: 'seg', role: 'radiogroup', 'aria-label': label }, [['none', 'لا يهم'], ['soft', 'مرن'], ['hard', 'صلب']].map(([m, l]) => h('label', { class: 'seg-o m-' + m }, h('input', { type: 'radio', name, value: m, checked: mode === m, onchange: () => change(`${label} → ${l}`, () => { if (m === 'none') delete me.crit[f]; else me.crit[f] = m; }) }), l)))), mode === 'none' ? null : h('span', { class: 'small muted' }, 'المطلوب: ', h('b', null, want))); };
  const imp = (d, l) => h('label', { class: 'imp' }, h('span', null, l), h('select', { 'aria-label': 'أهمية ' + l, onchange: (e) => change('أهمية ' + l, () => { if (e.target.value === 'normal') delete me.importance[d]; else me.importance[d] = e.target.value; }) }, [['low', 'أقل'], ['normal', 'عادية'], ['high', 'أعلى']].map(([v, t]) => h('option', { value: v, selected: (me.importance[d] || 'normal') === v }, t))));
  function drawForm() {
    left.replaceChildren(
      h('div', { class: 'card' }, h('div', { class: 'topbar' }, h('h2', null, '1. ابدأ من مثال'), history.length ? h('button', { type: 'button', class: 'btn sm ghost', onclick: undo }, 'تراجع') : null),
        h('div', { class: 'preset-cards' }, PRESETS.map(([k, l, d, v]) => h('button', { type: 'button', class: 'preset' + (preset === k ? ' on' : ''), 'aria-pressed': String(preset === k), onclick: () => { history.push(clone(me)); prev = evaluate(); lastChange = 'مثال ' + l; me = clone(v); preset = k; drawForm(); refresh(); } }, h('b', null, l), h('span', null, d)))),
        sumBox),
      h('div', { class: 'card' }, h('h2', null, '2. صاحب الطلب'), h('div', { class: 'fgrid' }, sel('الجنس', 'gender', [['man', 'رجل'], ['woman', 'امرأة']]), num('العمر', 'age', 18, 70), sel('المدينة', 'city', CITIES.map((c) => [c, c])), sel('الحالة الاجتماعية', 'marital_status', ['never_married', 'divorced', 'widowed'].map((v) => [v, L[v]]))),
        h('details', null, h('summary', null, 'تفاصيل تؤثر في الدرجة لا في الاستبعاد'), h('div', { class: 'fgrid' }, sel('الأبناء', 'children', [['none', 'بلا أبناء'], ['has', 'لديه أبناء']]), sel('الرغبة بالإنجاب', 'wants_children', [['yes', 'نعم'], ['no', 'لا'], ['undecided', 'غير محسوم']]), sel('توقيت البدء', 'timeline', ['0-6', '6-12', '12+'].map((v) => [v, L[v]])), sel('السكن المرغوب', 'housing', ['independent', 'family', 'flexible'].map((v) => [v, L[v]])), sel('التعليم', 'education', ['secondary', 'diploma', 'bachelor', 'postgrad'].map((v) => [v, L[v]])), sel('نمط الحياة', 'social_style', ['quiet', 'balanced', 'social'].map((v) => [v, L[v]])), sel('يقبل من لديه أبناء', 'accepts_partner_children', ['yes', 'flexible', 'no'].map((v) => [v, L[v]])), sel('يقبل التدخين لدى الطرف الآخر', 'smoking_ok', ['yes', 'flexible', 'no'].map((v) => [v, L[v]]))))),
      h('div', { class: 'card' }, h('h2', null, '3. الطرف الآخر'),
        h('div', { class: 'fgrid' }, num('أدنى عمر مقبول', 'pref_age_min', 18, 80), num('أعلى عمر مقبول', 'pref_age_max', 18, 90)),
        chips('المدن المقبولة (شرط صلب دائمًا)', 'pref_cities', CITIES.map((c) => [c, c]), [['مدينته فقط', () => { me.pref_cities = [me.city]; }], ['المجاورة', () => { me.pref_cities = [...new Set([...me.pref_cities, ...(near[me.city] || [me.city])])]; }], ['كل المدن', () => { me.pref_cities = [...CITIES]; }]]),
        chips('الحالات المقبولة (شرط صلب دائمًا)', 'pref_marital', ['never_married', 'divorced', 'widowed'].map((v) => [v, L[v]])),
        h('div', { class: 'field wide' }, h('span', { class: 'lab' }, 'معايير أخرى'), h('div', { class: 'legend-box' }, h('span', null, h('b', null, 'مرن: '), 'يرفع الدرجة عند التوافق ولا يستبعد أحدًا.'), h('span', null, h('b', null, 'صلب: '), 'يستبعد كل من لا يطابق.')), h('div', { class: 'crit-list' }, CRIT.map(critRow))),
        h('details', null, h('summary', null, 'أهمية الأبعاد (تغيّر الأوزان)'), h('div', { class: 'imp-grid' }, DIMS.map(([d, l]) => imp(d, l))))));
  }

  // ---------- النتيجة ----------
  const delta = (key, cur) => { if (!prev) return null; const p = key(prev), d = cur - p; if (!d) return null; return h('span', { class: 'delta ' + (d > 0 ? 'up' : 'down') }, (d > 0 ? '+' : '−') + Math.abs(d)); };
  const ring = (pct) => { const R = 26, C = 2 * Math.PI * R, lvl = pct >= 85 ? 'high' : pct >= 75 ? 'mid' : 'low'; return sv('svg', { viewBox: '0 0 64 64', class: 'ring ' + lvl, role: 'img', 'aria-label': `التوافق ${pct}` }, sv('circle', { cx: 32, cy: 32, r: R, fill: 'none', stroke: 'currentColor', 'stroke-opacity': .15, 'stroke-width': 6 }), sv('circle', { cx: 32, cy: 32, r: R, fill: 'none', stroke: 'currentColor', 'stroke-width': 6, 'stroke-linecap': 'round', 'stroke-dasharray': `${(pct / 100) * C} ${C}`, transform: 'rotate(-90 32 32)' }), sv('text', { x: 32, y: 36, 'text-anchor': 'middle', 'font-size': 15, 'font-weight': 700 }, String(pct))); };
  function explain(A, B, title) {
    const w = E.weightsFor(A), f = E.dimFits(A, B); let sumPts = 0, sumW = 0;
    const rows = DIMS.map(([d, l]) => { const fit = f[d], pts = fit == null ? null : w[d] * fit; if (pts != null) { sumPts += pts; sumW += w[d]; } return [l, Math.round(w[d]), fit == null ? 'غير معروف' : Math.round(fit * 100) + '%', pts == null ? '—' : pts.toFixed(1)]; });
    const score = sumW ? Math.round((100 * sumPts) / sumW) : 0;
    return h('div', { class: 'explain' }, h('b', null, title + ': ' + score), h('table', null, h('thead', null, h('tr', null, ['البُعد', 'الوزن', 'التقارب', 'النقاط'].map((x) => h('th', null, x)))), h('tbody', null, rows.map((rw) => h('tr', null, rw.map((c) => h('td', null, String(c))))))), h('p', { class: 'small muted' }, `الدرجة = مجموع النقاط (${sumPts.toFixed(1)}) ÷ مجموع أوزان الأبعاد المعروفة (${Math.round(sumW)}) × 100. الأبعاد غير المعروفة لا تُحسب صفرًا بل تُستبعد من القسمة.`));
  }
  const card = (c, shown) => { const B = c.p.M, ab = c.ev.ab, ba = c.ev.ba, dims = E.dimLevels(ab.fits, c.p.cards), reasons = E.reasons(ab.fits, c.p.cards), m = Math.round(c.mutual);
    const kv = [['العمر', ageRange(B.age)], ['المنطقة', REGION[B.city]], c.p.cards.includes('city') && ['المدينة', B.city], c.p.cards.includes('education') && ['التعليم', L[B.education]], c.p.cards.includes('timeline') && ['التوقيت', L[B.timeline]], c.p.cards.includes('housing') && ['السكن', L[B.housing]], c.p.cards.includes('social_style') && ['نمط الحياة', L[B.social_style]], c.p.cards.includes('langs') && ['اللغات', B.langs.join('، ')], c.p.cards.includes('values') && ['القيم', B.values.join('، ')]].filter(Boolean);
    return h('article', { class: 'card cand' + (shown ? '' : ' dim-card') }, h('div', { class: 'cand-top' }, h('span', { class: 'code' }, 'ك-' + c.p.id), shown ? h('span', { class: 'badge ok' }, 'يُعرض') : h('span', { class: 'badge' }, c.p.busy ? 'سعته ممتلئة' : 'خارج الثلاثة الأعلى')),
      h('div', { class: 'compat' }, ring(m), h('div', { class: 'compat-txt' }, h('b', null, m >= 85 ? 'توافق عالٍ' : m >= 75 ? 'توافق جيد' : 'توافق مقبول'), h('span', { class: 'small muted' }, `من جهته ${Math.round(ab.score)} · من جهة الآخر ${Math.round(ba.score)} · التوافق = الأقل منهما`))),
      h('ul', { class: 'dimlist' }, DIMS.map(([d, l]) => h('li', null, h('span', null, l), dims[d] ? h('span', { class: 'lvl ' + dims[d] }, { high: 'تقارب عالٍ', mid: 'تقارب جيد', low: 'تقارب محدود' }[dims[d]]) : h('span', { class: 'lvl none' }, 'لم يسمح بعرضه')))),
      h('dl', { class: 'kv' }, kv.map(([a, b]) => [h('dt', null, a), h('dd', null, b)])),
      reasons.length ? h('div', null, h('b', null, 'لماذا اقتُرح'), h('ul', { class: 'reasons' }, reasons.map((x) => h('li', null, x)))) : null,
      h('details', { class: 'why' }, h('summary', null, 'كيف حُسب هذا الرقم؟'), explain(c.A || toEngine(), B, 'من جهة صاحب الطلب'), explain(B, toEngine(), 'من جهة الآخر')));
  };
  // كل اقتراح تخفيف يُحاكى فعليًا قبل عرضه: نعرض أثره الحقيقي على عدد المؤهلين، الأنفع أولًا
  const countFail = (test) => POOL.filter((p) => p.M.gender !== me.gender && test(p.M)).length;
  function fixes(cur) {
    const cands = [];
    const nearMore = [...new Set([...me.pref_cities, ...(near[me.city] || [])])];
    cands.push([`المدن المقبولة تستبعد ${countFail((B) => !me.pref_cities.includes(B.city))}`, nearMore.length > me.pref_cities.length ? 'أضف المدن المجاورة' : 'اقبل كل المدن', (m) => { m.pref_cities = nearMore.length > me.pref_cities.length ? nearMore : [...CITIES]; }]);
    cands.push([`نطاق العمر يستبعد ${countFail((B) => B.age < me.pref_age_min || B.age > me.pref_age_max)}`, 'وسّع العمر 3 سنوات من كل جهة', (m) => { m.pref_age_min = Math.max(18, m.pref_age_min - 3); m.pref_age_max = Math.min(90, m.pref_age_max + 3); }]);
    if (me.pref_marital.length < 3) cands.push([`الحالات المقبولة تستبعد ${countFail((B) => !me.pref_marital.includes(B.marital_status))}`, 'اقبل كل الحالات', (m) => { m.pref_marital = ['never_married', 'divorced', 'widowed']; }]);
    if (me.accepts_partner_children === 'no') cands.push([`رفض من لديه أبناء يستبعد ${countFail((B) => B.children === 'has')}`, 'اجعله مرنًا', (m) => { m.accepts_partner_children = 'flexible'; }]);
    for (const [f, label, want] of CRIT) if (me.crit[f] === 'hard') cands.push([`شرط «${label}» الصلب يستبعد ${countFail((B) => B[f] !== want)}`, 'حوّله إلى مرن', (m) => { m.crit[f] = 'soft'; }]);
    const base = cur.s.eligible.length;
    return cands.map(([why, act, fn]) => { const saved = me; me = clone(saved); fn(me); const r = evaluate(); me = saved; return { why, act, fn: () => fn(me), gain: r.s.eligible.length - base, shown: r.chosen.length }; })
      .filter((x) => x.gain !== 0 || true).sort((a, b) => b.gain - a.gain).slice(0, 4);
  }
  function draw(res) {
    const { s, chosen, rest, excluded } = res, total = POOL.length, hardPass = s.opposite - s.byMe - s.byThem, scored = hardPass - s.clarify;
    sumBox.replaceChildren(h('span', null, 'يُعرض الآن ', h('b', null, `${chosen.length} من 3`)), h('span', { class: 'muted' }, ` · مؤهل ${s.eligible.length} من ${s.opposite}`), h('button', { type: 'button', class: 'btn sm ghost', onclick: () => document.getElementById('sim-result')?.scrollIntoView({ behavior: MK.reducedMotion?.() ? 'auto' : 'smooth', block: 'start' }) }, 'اعرض النتيجة'));
    const step = (n, label, sub, cls, key) => h('li', { class: 'fstep ' + (cls || '') }, h('b', null, String(n), key ? delta(key, n) : null), h('span', null, label), sub ? h('small', null, sub) : null);
    const fx = fixes(res);
    out.replaceChildren(
      h('div', { class: 'card', id: 'sim-result' }, h('div', { class: 'topbar' }, h('h2', null, '4. ماذا فعل المحرك؟'), lastChange ? h('span', { class: 'badge warn' }, 'بعد: ' + lastChange) : null),
        h('ol', { class: 'funnel-v' },
          step(total, 'في المجموعة', '90 ملفًا اصطناعيًا'),
          step(s.opposite, 'من الجنس الآخر', null, '', (p) => p.s.opposite),
          step(hardPass, 'اجتازوا الشروط الصلبة من الجهتين', `استبعد شرطُك ${s.byMe} · واستبعده شرطُهم ${s.byThem}`, s.byMe + s.byThem ? 'warn' : '', (p) => p.s.opposite - p.s.byMe - p.s.byThem),
          s.clarify ? step(scored, 'معلوماتهم كافية للحكم', `${s.clarify} يحتاج إيضاحًا`, 'warn', (p) => p.s.opposite - p.s.byMe - p.s.byThem - p.s.clarify) : null,
          step(s.eligible.length, 'تجاوزوا العتبة (توافق متبادل ≥ 70 وتغطية ≥ 60%)', `${s.below + s.insufficient} تحت العتبة`, s.eligible.length ? 'ok' : 'bad', (p) => p.s.eligible.length),
          step(chosen.length, 'يُعرض للمشرف', chosen.length < 3 && rest.length ? 'الباقون سعتهم ممتلئة' : 'الحد 3 لكل ملف، الأعلى توافقًا أولًا', 'ok strong', (p) => p.chosen.length)),
        fx.length ? h('div', { class: 'fix-box' }, h('b', null, 'ما الذي يضيّق الخيارات؟ جرّب بضغطة (الأثر محسوب مسبقًا):'), fx.map((x) => h('div', { class: 'fix-row' }, h('span', null, x.why, ' ', h('span', { class: 'badge ' + (x.gain > 0 ? 'ok' : '') }, x.gain > 0 ? `+${x.gain} مؤهلين → يُعرض ${x.shown}` : 'لا يغيّر وحده')), h('button', { type: 'button', class: 'btn sm ' + (x.gain > 0 ? '' : 'secondary'), onclick: () => change(x.act, x.fn) }, x.act))), fx.every((x) => x.gain <= 0) ? h('p', { class: 'small muted' }, 'لا يكفي تخفيف شرط واحد هنا؛ الشروط تتداخل. جرّب اثنين متتاليين.') : null) : null,
        s.byThem ? h('p', { class: 'small muted' }, `${s.byThem} استبعدوا صاحبَ الطلب بشروطهم هم (عمره أو مدينته أو حالته خارج ما يقبلونه). هذا لا يُغيَّر من جهته، وهو ما يعنيه «التحقق في الاتجاهين».`) : null),
      h('div', null, h('h2', null, `5. الاقتراحات (${chosen.length} من 3)`), chosen.length ? h('div', { class: 'grid g3' }, chosen.map((c) => card({ ...c, A: res.A }, true))) : h('div', { class: 'card empty' }, h('h3', null, 'لا اقتراحات بهذه الشروط'), h('p', null, 'المحرك لا يخفّف الشروط بدلًا عنك. استخدم أزرار «جرّب بضغطة» أعلاه أو عدّل الشروط.'))),
      rest.length ? h('details', { class: 'card' }, h('summary', null, `مؤهلون لم يُعرضوا (${rest.length})`), h('p', { class: 'small muted' }, 'إما لأن الحد 3، أو لأن سعة الطرف الآخر ممتلئة (لديه 3 اقتراحات قائمة). في المنصة لا يراهم أحد.'), h('div', { class: 'grid g3' }, rest.slice(0, 6).map((c) => card({ ...c, A: res.A }, false)))) : null,
      excluded.length ? h('details', { class: 'card' }, h('summary', null, `المستبعدون ولماذا (${excluded.length})`), h('div', { class: 'table-wrap' }, h('table', null, h('thead', null, h('tr', null, h('th', null, 'الرمز'), h('th', null, 'مَن استبعد؟'), h('th', null, 'الشرط'))), h('tbody', null, excluded.slice(0, 20).map(([p, who, why]) => h('tr', null, h('td', { 'data-label': 'الرمز' }, 'ك-' + p.id), h('td', { 'data-label': 'مَن استبعد؟' }, who === 'me' ? 'شرط صاحب الطلب' : 'شرط الطرف الآخر'), h('td', { 'data-label': 'الشرط' }, WHY[why] || why))))))) : null,
      h('div', { class: 'callout' }, h('b', null, 'وبعدها في المنصة: '), 'يرى المشرف هذه البطاقات ويقرر مناسب أو غير مناسب. عند اهتمام الطرفين يتواصل المشرفان خارج المنصة، ثم «تم التواصل» فيُجمَّد الملفان 7 أيام.'));
    if (prev) { const tk = ++tick; setTimeout(() => { if (tk !== tick) return; prev = null; out.querySelectorAll('.delta').forEach((d) => d.classList.add('fade')); }, 2500); }
  }
  let t; function refresh() { clearTimeout(t); t = setTimeout(() => draw(evaluate()), 40); }
  root.replaceChildren(h('div', { class: 'sim-grid' }, left, out)); drawForm(); draw(evaluate());
};
