'use strict';
// محرك الترشيح المتبادل — إصدار أول قابل للتفسير (08-matching). قواعد versioned، بلا AI.
const RULES = {
  version: 'rules-v1.0',
  weights: { place: 25, family: 25, work: 20, lifestyle: 15, values: 15 },
  importanceMul: { high: 1.5, normal: 1, low: 0.5 },
  minCoverage: 0.60, minMutual: 70, capacity: 3,
  cardTtlDays: 7,
};
const U = (v) => v === undefined || v === null || v === '' || ['unknown', 'prefer_not_to_answer', 'not_applicable'].includes(v);
const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);
const idx = (arr, v) => arr.indexOf(v);

/** قيم المطابقة الجزئية: جداول معرّفة فقط، لا أرقام مخترعة */
const T = {
  timeline: (a, b) => { const o = ['0-6', '6-12', '12+']; const d = Math.abs(idx(o, a) - idx(o, b)); return d === 0 ? 1 : d === 1 ? 0.5 : 0; },
  housing: (a, b) => (a === b ? 1 : a === 'flexible' || b === 'flexible' ? 0.5 : 0),
  wants: (a, b) => (a === 'undecided' || b === 'undecided' ? 0.5 : a === b ? 1 : 0),
  edu: (a, b) => { const o = ['secondary', 'diploma', 'bachelor', 'postgrad']; const d = Math.abs(idx(o, a) - idx(o, b)); return d === 0 ? 1 : d === 1 ? 0.5 : 0; },
  social: (a, b) => { const o = ['quiet', 'balanced', 'social']; const d = Math.abs(idx(o, a) - idx(o, b)); return d === 0 ? 1 : d === 1 ? 0.5 : 0; },
};

/** شروط صلبة A→B. يعيد {ok:true} | {ok:false} | {unknown:[حقول]} */
function hardCheck(A, B) {
  const unknown = [];
  if (A.gender === B.gender) return { ok: false, why: 'gender' };
  if (U(B.age)) unknown.push('age');
  else if (B.age < A.pref_age_min || B.age > A.pref_age_max) return { ok: false, why: 'age' };
  if (U(B.city)) unknown.push('city'); else if (!A.pref_cities.includes(B.city)) return { ok: false, why: 'city' };
  if (U(B.marital_status)) unknown.push('marital_status'); else if (!A.pref_marital.includes(B.marital_status)) return { ok: false, why: 'marital' };
  if (A.accepts_partner_children === 'no') { if (U(B.children)) unknown.push('children'); else if (B.children === 'has') return { ok: false, why: 'children' }; }
  for (const h of A.hard || []) {
    const v = B[h.field];
    if (U(v)) unknown.push(h.field); else if (!h.values.includes(v)) return { ok: false, why: h.field };
  }
  // تعدد: من يرفضه لا يُرشح له من يقبله إلا إن كان غير منطبق
  if (A.polygamy_view === 'rejects') { if (U(B.polygamy_view)) unknown.push('polygamy_view'); else if (B.polygamy_view === 'accepts') return { ok: false, why: 'polygamy_view' }; }
  return unknown.length ? { unknown: [...new Set(unknown)] } : { ok: true };
}

/** fit لكل بُعد: متوسط المكونات المعروفة؛ null إن لم يكن أي مكون قابلًا للمقارنة */
function dimFits(A, B) {
  const c = (cond, f) => (cond ? f() : null);
  const place = [
    c(!U(B.city) && !U(A.city), () => (A.city === B.city ? 1 : A.pref_cities.includes(B.city) ? 0.5 : 0)),
    c(!U(A.housing) && !U(B.housing), () => T.housing(A.housing, B.housing)),
  ];
  const family = [
    c(!U(A.wants_children) && !U(B.wants_children), () => T.wants(A.wants_children, B.wants_children)),
    c(!U(A.timeline) && !U(B.timeline), () => T.timeline(A.timeline, B.timeline)),
    c(!U(A.accepts_partner_children) && !U(B.children), () => (B.children === 'none' ? 1 : { yes: 1, flexible: 0.5, no: 0 }[A.accepts_partner_children])),
  ];
  const work = [
    c(!U(A.education) && !U(B.education), () => T.edu(A.education, B.education)),
    c(!U(A.partner_work) && !U(B.works), () => (A.partner_work === 'prefers_not' && B.works ? 0 : 1)),
    c(!U(A.travel) && !U(B.job_travel), () => (B.job_travel === 'no' ? 1 : { yes: 1, conditional: 0.5, no: 0 }[A.travel])),
  ];
  const lifestyle = [
    c(!U(A.smoking_ok) && !U(B.smoking), () => (B.smoking === 'no' ? 1 : { yes: 1, flexible: 0.5, no: 0 }[A.smoking_ok])),
    c(!U(A.social_style) && !U(B.social_style), () => T.social(A.social_style, B.social_style)),
  ];
  const values = [
    c(A.langs?.length && B.langs?.length, () => (A.langs.some((x) => B.langs.includes(x)) ? 1 : 0)),
    c(A.values?.length && B.values?.length, () => Math.min(1, A.values.filter((x) => B.values.includes(x)).length / Math.min(A.values.length, B.values.length, 3))),
  ];
  const out = {};
  for (const [k, comps] of Object.entries({ place, family, work, lifestyle, values })) out[k] = avg(comps.filter((x) => x !== null));
  return out;
}

/** أوزان A بعد تخصيص الأهمية وإعادة التطبيع إلى 100 */
function weightsFor(A) {
  const raw = {}; let s = 0;
  for (const d of Object.keys(RULES.weights)) { raw[d] = RULES.weights[d] * RULES.importanceMul[(A.importance || {})[d] || 'normal']; s += raw[d]; }
  for (const d in raw) raw[d] = (raw[d] / s) * 100;
  return raw;
}
function combine(fits, weights) {
  let K = 0, sum = 0, total = 0;
  for (const d of Object.keys(weights)) { total += weights[d]; if (fits[d] !== null && fits[d] !== undefined) { K += weights[d]; sum += weights[d] * fits[d]; } }
  return K > 0 ? { score: (100 * sum) / K, coverage: K / total } : { score: null, coverage: 0 };
}
const directional = (A, B) => { const f = dimFits(A, B); return { fits: f, ...combine(f, weightsFor(A)) }; };

/** تقييم زوج: يعيد الحالة والتفاصيل. */
function evaluatePair(A, B) {
  const h1 = hardCheck(A, B), h2 = hardCheck(B, A);
  if (h1.ok === false || h2.ok === false) return { status: 'EXCLUDED', why: h1.why || h2.why };
  if (h1.unknown || h2.unknown) return { status: 'NEEDS_CLARIFICATION', unknown: [...(h1.unknown || []), ...(h2.unknown || [])] };
  const ab = directional(A, B), ba = directional(B, A);
  if (ab.score === null || ba.score === null) return { status: 'INSUFFICIENT' };
  const coverage = Math.min(ab.coverage, ba.coverage);
  if (coverage < RULES.minCoverage) return { status: 'INSUFFICIENT', coverage };
  const mutual = Math.min(ab.score, ba.score);
  if (mutual < RULES.minMutual) return { status: 'BELOW_THRESHOLD', mutual, coverage };
  return { status: 'ELIGIBLE', mutual, coverage, ab, ba };
}

const DIM_TEXT = {
  place: { fields: ['city', 'housing', 'region'], text: 'المدينة وتصور السكن متقاربان' },
  family: { fields: ['timeline', 'wants_children', 'children'], text: 'تصور تكوين الأسرة وتوقيت البدء متقاربان' },
  work: { fields: ['education', 'work_field'], text: 'التعليم وتوقعات العمل متقاربة' },
  lifestyle: { fields: ['social_style'], text: 'نمط الحياة اليومي متقارب' },
  values: { fields: ['langs', 'values'], text: 'لغات التواصل والقيم المعلنة متقاربة' },
};
/** سببان كحد أقصى، من حقول سمح الطرف المعروض بعرضها فقط */
function reasons(fits, candidateCardFields) {
  return Object.entries(fits).filter(([d, f]) => f !== null && f >= 0.75 && DIM_TEXT[d].fields.some((x) => candidateCardFields.includes(x)))
    .sort((a, b) => b[1] - a[1] || RULES.weights[b[0]] - RULES.weights[a[0]]).slice(0, 2).map(([d]) => DIM_TEXT[d].text);
}

/** مستوى كل بُعد بكلمات (لا أرقام): فقط للأبعاد التي سمح الطرف المعروض بعرض حقولها */
function dimLevels(fits, candidateCardFields) {
  const out = {};
  for (const [d, f] of Object.entries(fits)) if (f !== null && DIM_TEXT[d].fields.some((x) => candidateCardFields.includes(x))) out[d] = f >= 0.75 ? 'high' : f >= 0.5 ? 'mid' : 'low';
  return out;
}
/**
 * اختيار greedy حتمي. candidates: [{a,b,mutual,coverage,exposure:{a,b},waitDays:{a,b},tie}]
 * load: Map(profileId->عدد البطاقات النشطة). لا يضيف دون العتبة لملء العدد.
 */
function select(candidates, load, capacity = RULES.capacity) {
  const sorted = [...candidates].sort((x, y) => y.mutual - x.mutual || (x.exposure.a + x.exposure.b) - (y.exposure.a + y.exposure.b) || (y.waitDays.a + y.waitDays.b) - (x.waitDays.a + x.waitDays.b) || (x.tie < y.tie ? -1 : 1));
  const chosen = [];
  for (const p of sorted) {
    if ((load.get(p.a) || 0) >= capacity || (load.get(p.b) || 0) >= capacity) continue;
    load.set(p.a, (load.get(p.a) || 0) + 1); load.set(p.b, (load.get(p.b) || 0) + 1);
    chosen.push(p);
  }
  return chosen;
}
const canonicalPairId = (x, y) => (x < y ? `${x}~${y}` : `${y}~${x}`);

const API = { DIM_TEXT, dimLevels, RULES, hardCheck, dimFits, weightsFor, combine, directional, evaluatePair, reasons, select, canonicalPairId, U };
if (typeof module !== 'undefined' && module.exports) module.exports = API; else globalThis.MKEngine = API; // نفس الملف يعمل في المتصفح لصفحة «جرّب المحرك»
