'use strict';
// مخطط الاستبيان المرحلي (04-questionnaire). المراحل: E أساسي، O اختياري، L لاحق (بعد كشف محدد).
// الطبقات: I هوية، M توافق، S خاص، C بطاقة.
const CITIES = ['الرياض', 'جدة', 'مكة المكرمة', 'المدينة المنورة', 'الدمام', 'الخبر', 'الظهران', 'الطائف', 'بريدة', 'تبوك', 'أبها', 'خميس مشيط', 'حائل', 'جازان', 'نجران', 'الأحساء', 'ينبع', 'الجبيل'];
const REGION = { 'الرياض': 'المنطقة الوسطى', 'بريدة': 'المنطقة الوسطى', 'حائل': 'منطقة حائل', 'جدة': 'المنطقة الغربية', 'مكة المكرمة': 'المنطقة الغربية', 'الطائف': 'المنطقة الغربية', 'المدينة المنورة': 'المنطقة الغربية', 'ينبع': 'المنطقة الغربية', 'الدمام': 'المنطقة الشرقية', 'الخبر': 'المنطقة الشرقية', 'الظهران': 'المنطقة الشرقية', 'الأحساء': 'المنطقة الشرقية', 'الجبيل': 'المنطقة الشرقية', 'أبها': 'المنطقة الجنوبية', 'خميس مشيط': 'المنطقة الجنوبية', 'جازان': 'المنطقة الجنوبية', 'نجران': 'المنطقة الجنوبية', 'تبوك': 'المنطقة الشمالية' };
const UNK = ['unknown', 'prefer_not_to_answer', 'not_applicable']; // قيم مختلفة؛ لا تُستبدل بصفر
const VALUES = ['الاحترام', 'الصدق', 'الأسرة', 'الاستقلال', 'الطموح', 'الهدوء', 'الكرم', 'التعلم'];
const LANGS = ['العربية', 'الإنجليزية', 'الأردية', 'الفرنسية', 'التركية'];
const enumOf = (...v) => ({ type: 'enum', values: v });

const FIELDS = {
  // I — هوية (خزنة منفصلة)
  name:           { id: 'A02', layer: 'I', phase: 'E', type: 'text', max: 80, label: 'الاسم كما في الهوية' },
  dob:            { id: 'A03', layer: 'I', phase: 'E', type: 'date', label: 'تاريخ الميلاد' },
  phone:          { id: 'A04', layer: 'I', phase: 'E', type: 'phone', label: 'رقم التواصل الخاص' },
  contact_window: { id: 'A04', layer: 'I', phase: 'O', type: 'text', max: 40, label: 'وقت التواصل المناسب' },
  // M — توافق
  gender:         { id: 'B01', layer: 'M', phase: 'E', ...enumOf('man', 'woman'), label: 'رجل أم امرأة' },
  city:           { id: 'B02', layer: 'M', phase: 'E', type: 'city', label: 'مدينة الإقامة' },
  marital_status: { id: 'B03', layer: 'M', phase: 'E', ...enumOf('never_married', 'divorced', 'widowed'), label: 'الحالة الاجتماعية' },
  children:       { id: 'B04', layer: 'M', phase: 'E', ...enumOf('none', 'has'), label: 'هل لديك أبناء' },
  timeline:       { id: 'B08', layer: 'M', phase: 'E', ...enumOf('0-6', '6-12', '12+'), label: 'متى تتطلع للبدء (بالأشهر)' },
  housing:        { id: 'C02', layer: 'M', phase: 'E', ...enumOf('independent', 'family', 'flexible'), label: 'السكن المرغوب' },
  travel:         { id: 'C08', layer: 'M', phase: 'O', ...enumOf('yes', 'no', 'conditional'), label: 'تقبل علاقة مع تنقل مهني متكرر' },
  job_travel:     { id: 'C08b', layer: 'M', phase: 'O', ...enumOf('frequent', 'no'), label: 'عملك يتطلب تنقلًا متكررًا' },
  education:      { id: 'D01', layer: 'M', phase: 'O', ...enumOf('secondary', 'diploma', 'bachelor', 'postgrad'), label: 'المستوى التعليمي' },
  works:          { id: 'D02', layer: 'M', phase: 'O', type: 'bool', label: 'تعمل حاليًا' },
  work_field:     { id: 'D02', layer: 'M', phase: 'O', type: 'text', max: 40, label: 'مجال العمل (عام)' },
  partner_work:   { id: 'D03', layer: 'M', phase: 'E', ...enumOf('supports', 'prefers_not', 'flexible'), label: 'موقفك من عمل الطرف الآخر' },
  wants_children: { id: 'E01', layer: 'M', phase: 'E', ...enumOf('yes', 'no', 'undecided'), label: 'الرغبة في الإنجاب' },
  accepts_partner_children: { id: 'E04', layer: 'M', phase: 'E', ...enumOf('yes', 'no', 'flexible'), label: 'تقبل الزواج بمن لديه أبناء' },
  polygamy_view:  { id: 'E07', layer: 'M', phase: 'E', ...enumOf('accepts', 'rejects', 'not_applicable'), label: 'التعدد' },
  smoking:        { id: 'F02', layer: 'M', phase: 'O', ...enumOf('no', 'yes'), label: 'التدخين' },
  smoking_ok:     { id: 'F03', layer: 'M', phase: 'O', ...enumOf('yes', 'no', 'flexible'), label: 'تقبل التدخين لدى الطرف الآخر' },
  social_style:   { id: 'F05', layer: 'M', phase: 'O', ...enumOf('quiet', 'balanced', 'social'), label: 'حياة اجتماعية' },
  langs:          { id: 'F12', layer: 'M', phase: 'O', type: 'multi', values: LANGS, label: 'لغات التواصل' },
  values:         { id: 'F01', layer: 'M', phase: 'O', type: 'multi', values: VALUES, max: 3, label: 'أهم القيم' },
  // تفضيلات الشريك (H)
  pref_age_min:   { id: 'H01', layer: 'M', phase: 'E', type: 'int', min: 18, max: 90, label: 'أدنى عمر مقبول' },
  pref_age_max:   { id: 'H01', layer: 'M', phase: 'E', type: 'int', min: 18, max: 90, label: 'أعلى عمر مقبول' },
  pref_cities:    { id: 'H02', layer: 'M', phase: 'E', type: 'multi', values: CITIES, label: 'المدن المقبولة' },
  pref_marital:   { id: 'H03', layer: 'M', phase: 'E', type: 'multi', values: ['never_married', 'divorced', 'widowed'], label: 'الحالات الاجتماعية المقبولة' },
  hard:           { id: 'H05', layer: 'M', phase: 'O', type: 'hard', max: 5, label: 'شروط صلبة (حتى خمسة)' },
  soft:           { id: 'H06', layer: 'M', phase: 'O', type: 'hard', max: 9, label: 'تفضيلات مرنة' },
  importance:     { id: 'H04', layer: 'M', phase: 'O', type: 'importance', label: 'أهمية الأبعاد' },
  // C — بطاقة
  bio:            { id: 'B07', layer: 'C', phase: 'O', type: 'text', max: 500, label: 'نبذة بلا معرفات' },
  card_fields:    { id: 'H08', layer: 'C', phase: 'E', type: 'multi', values: ['age_range', 'region', 'bio', 'education', 'work_field', 'timeline', 'housing', 'city', 'social_style', 'langs', 'values', 'wants_children', 'children'], label: 'ما يُعرض في بطاقتك' },
  allow_supervisor_view: { id: 'H09', layer: 'C', phase: 'O', type: 'bool', label: 'السماح للمشرف برؤية البطاقات' },
  // S — خاص (L، لا يدخل المطابقة)
  private_note:   { id: 'G05', layer: 'S', phase: 'L', type: 'text', max: 300, label: 'أمر ترغب بإفصاح خاص بشأنه' },
};
// حقول يمكن جعلها شروطًا صلبة (H05) ومصدرها في ملف المرشح
const HARD_ALLOWED = ['children', 'wants_children', 'housing', 'partner_work', 'smoking', 'job_travel', 'timeline', 'polygamy_view', 'marital_status'];
const DIMENSIONS = ['place', 'family', 'work', 'lifestyle', 'values'];
const DISCLOSABLE = ['name', 'phone', 'contact_window'];

const maskPII = (s) => String(s).replace(/[\w.+-]+@[\w-]+\.[\w.]+/g, '[محجوب]').replace(/(\+?\d[\d\s-]{6,}\d)/g, '[محجوب]').replace(/https?:\/\/\S+/g, '[محجوب]').replace(/@\w+/g, '[محجوب]');

function checkValue(k, f, v) {
  if (UNK.includes(v)) return null; // مسموح ويُعالج كمجهول
  switch (f.type) {
    case 'enum': return f.values.includes(v) ? null : 'قيمة غير صالحة';
    case 'text': return typeof v === 'string' && v.length <= f.max ? null : 'نص غير صالح أو طويل';
    case 'bool': return typeof v === 'boolean' ? null : 'قيمة منطقية مطلوبة';
    case 'int': return Number.isInteger(v) && v >= f.min && v <= f.max ? null : 'رقم خارج النطاق';
    case 'city': return CITIES.includes(v) ? null : 'مدينة غير مدعومة';
    case 'date': return /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v)) ? null : 'تاريخ غير صالح';
    case 'phone': return /^\+?\d{9,15}$/.test(String(v).replace(/[\s-]/g, '')) ? null : 'رقم غير صالح';
    case 'multi': return Array.isArray(v) && v.every((x) => f.values.includes(x)) && (!f.max || v.length <= f.max) ? null : 'قائمة غير صالحة';
    case 'hard': return Array.isArray(v) && v.length <= f.max && new Set(v.map((h) => h && h.field)).size === v.length && v.every((h) => HARD_ALLOWED.includes(h.field) && Array.isArray(h.values) && h.values.length && h.values.every((x) => typeof x === 'string' && (FIELDS[h.field].values || []).includes(x))) ? null : `شروط غير صالحة (حتى ${f.max} من الحقول المسموحة، وقيمة واحدة على الأقل لكل شرط)`;
    case 'importance': return v && typeof v === 'object' && Object.entries(v).every(([d, w]) => DIMENSIONS.includes(d) && ['high', 'normal', 'low'].includes(w)) ? null : 'أهمية غير صالحة';
  }
  return 'نوع غير معروف';
}
const ageOn = (dob, now) => { const d = new Date(dob), n = new Date(now); let a = n.getUTCFullYear() - d.getUTCFullYear(); if (n.getUTCMonth() < d.getUTCMonth() || (n.getUTCMonth() === d.getUTCMonth() && n.getUTCDate() < d.getUTCDate())) a--; return a; };

// draft: {I:{},M:{},S:{},C:{}} -> {errors:{key:msg}, missing:[keys E], age}
function validate(draft, now = Date.now()) {
  const errors = {}, missing = [];
  for (const [k, f] of Object.entries(FIELDS)) {
    const v = draft?.[f.layer]?.[k];
    if (v === undefined || v === null || v === '') { if (f.phase === 'E') missing.push(k); continue; }
    const e = checkValue(k, f, v); if (e) errors[k] = e;
  }
  for (const L of Object.keys(draft || {})) for (const k of Object.keys(draft[L] || {})) if (!FIELDS[k] || FIELDS[k].layer !== L) errors[k] = 'حقل غير معروف';
  const M = draft?.M || {};
  if (M.pref_age_min && M.pref_age_max && M.pref_age_min > M.pref_age_max) errors.pref_age_min = 'الحد الأدنى أكبر من الأعلى';
  if (M.city && Array.isArray(M.pref_cities) && !M.pref_cities.length) errors.pref_cities = 'اختر مدينة واحدة على الأقل';
  if (Array.isArray(M.hard) && Array.isArray(M.soft) && M.soft.some((x) => M.hard.some((y) => y && x && y.field === x.field))) errors.soft = 'لا يكون المعيار صلبًا ومرنًا معًا';
  let age = null;
  if (draft?.I?.dob && !errors.dob) { age = ageOn(draft.I.dob, now); if (age < 18) errors.dob = 'الأهلية: 18 سنة فأكثر'; }
  return { errors, missing, age, completeness: Math.round(100 * (1 - missing.length / Object.values(FIELDS).filter((f) => f.phase === 'E').length)) };
}
// تنقيح النصوص الحرة قبل البطاقة
function sanitize(draft) {
  const d = JSON.parse(JSON.stringify(draft || { I: {}, M: {}, S: {}, C: {} }));
  for (const L of ['I', 'M', 'S', 'C']) d[L] = d[L] || {};
  if (d.C.bio) d.C.bio = maskPII(d.C.bio);
  if (d.M.work_field) d.M.work_field = maskPII(d.M.work_field);
  return d;
}
const ageRange = (age) => { const lo = Math.floor(age / 5) * 5; return `${lo}–${lo + 4}`; };

module.exports = { FIELDS, CITIES, REGION, VALUES, LANGS, HARD_ALLOWED, DIMENSIONS, DISCLOSABLE, UNK, validate, sanitize, ageOn, ageRange, maskPII };
