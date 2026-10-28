'use strict';
// بيانات اصطناعية بالكامل — لا أشخاص حقيقيين.
const K = require('./crypto');
const base = (o) => ({ I: { name: o.name, dob: o.dob, phone: o.phone, contact_window: 'بعد العصر' }, M: o.M, S: {}, C: { bio: o.bio, card_fields: o.cards || ['age_range', 'region', 'bio', 'education', 'timeline', 'housing', 'social_style', 'langs', 'values', 'wants_children'], allow_supervisor_view: o.sup ?? true } });
const PEOPLE = [
  { name: 'تجريبي-أ1', dob: '1996-03-14', phone: '0500000001', bio: 'مهندس برمجيات يحب القراءة والمشي. يبحث عن حياة هادئة مستقرة.', M: { gender: 'man', city: 'الرياض', marital_status: 'never_married', children: 'none', timeline: '6-12', housing: 'independent', partner_work: 'supports', wants_children: 'yes', accepts_partner_children: 'flexible', polygamy_view: 'rejects', education: 'bachelor', works: true, work_field: 'تقنية', job_travel: 'no', travel: 'yes', smoking: 'no', smoking_ok: 'no', social_style: 'balanced', langs: ['العربية', 'الإنجليزية'], values: ['الصدق', 'الأسرة', 'التعلم'], pref_age_min: 22, pref_age_max: 30, pref_cities: ['الرياض', 'الخرج'.length ? 'الطائف' : 'الرياض'], pref_marital: ['never_married'], hard: [{ field: 'smoking', values: ['no'] }] } },
  { name: 'تجريبي-أ2', dob: '1993-07-02', phone: '0500000002', bio: 'محاسب، أحب السفر القصير وأقدّر الوضوح والصراحة.', M: { gender: 'man', city: 'جدة', marital_status: 'never_married', children: 'none', timeline: '0-6', housing: 'flexible', partner_work: 'flexible', wants_children: 'yes', accepts_partner_children: 'yes', polygamy_view: 'rejects', education: 'bachelor', works: true, work_field: 'محاسبة', job_travel: 'no', travel: 'conditional', smoking: 'no', smoking_ok: 'flexible', social_style: 'social', langs: ['العربية'], values: ['الصدق', 'الكرم'], pref_age_min: 24, pref_age_max: 33, pref_cities: ['جدة', 'مكة المكرمة'], pref_marital: ['never_married', 'divorced'] } },
  { name: 'تجريبي-أ3', dob: '1990-11-21', phone: '0500000003', bio: 'معلم مطلق، لديه ابن واحد. يفضل الحياة الهادئة.', M: { gender: 'man', city: 'الدمام', marital_status: 'divorced', children: 'has', timeline: '6-12', housing: 'independent', partner_work: 'supports', wants_children: 'undecided', accepts_partner_children: 'yes', polygamy_view: 'rejects', education: 'postgrad', works: true, work_field: 'تعليم', job_travel: 'no', travel: 'no', smoking: 'no', smoking_ok: 'no', social_style: 'quiet', langs: ['العربية', 'الإنجليزية'], values: ['الأسرة', 'الهدوء'], pref_age_min: 26, pref_age_max: 36, pref_cities: ['الدمام', 'الخبر', 'الظهران'], pref_marital: ['never_married', 'divorced', 'widowed'] } },
  { name: 'تجريبية-ب1', dob: '1998-01-09', phone: '0500000011', bio: 'صيدلانية، أحب الطبخ والرياضة الخفيفة.', M: { gender: 'woman', city: 'الرياض', marital_status: 'never_married', children: 'none', timeline: '6-12', housing: 'independent', partner_work: 'supports', wants_children: 'yes', accepts_partner_children: 'flexible', polygamy_view: 'rejects', education: 'bachelor', works: true, work_field: 'صيدلة', job_travel: 'no', travel: 'yes', smoking: 'no', smoking_ok: 'no', social_style: 'balanced', langs: ['العربية', 'الإنجليزية'], values: ['الصدق', 'الأسرة'], pref_age_min: 25, pref_age_max: 34, pref_cities: ['الرياض'], pref_marital: ['never_married'] } },
  { name: 'تجريبية-ب2', dob: '1995-05-30', phone: '0500000012', bio: 'مصممة جرافيك تحب الفنون والمقاهي الهادئة.', M: { gender: 'woman', city: 'جدة', marital_status: 'never_married', children: 'none', timeline: '0-6', housing: 'flexible', partner_work: 'flexible', wants_children: 'yes', accepts_partner_children: 'yes', polygamy_view: 'rejects', education: 'bachelor', works: true, work_field: 'تصميم', job_travel: 'no', travel: 'yes', smoking: 'no', smoking_ok: 'flexible', social_style: 'social', langs: ['العربية'], values: ['الصدق', 'الكرم', 'الأسرة'], pref_age_min: 26, pref_age_max: 36, pref_cities: ['جدة'], pref_marital: ['never_married', 'divorced'] } },
  { name: 'تجريبية-ب3', dob: '1992-09-17', phone: '0500000013', bio: 'مديرة مشاريع، أرملة بلا أبناء، تفضل التخطيط الواضح.', M: { gender: 'woman', city: 'الخبر', marital_status: 'widowed', children: 'none', timeline: '6-12', housing: 'independent', partner_work: 'supports', wants_children: 'undecided', accepts_partner_children: 'yes', polygamy_view: 'rejects', education: 'postgrad', works: true, work_field: 'إدارة', job_travel: 'no', travel: 'conditional', smoking: 'no', smoking_ok: 'no', social_style: 'quiet', langs: ['العربية', 'الإنجليزية'], values: ['الأسرة', 'الهدوء', 'التعلم'], pref_age_min: 28, pref_age_max: 40, pref_cities: ['الخبر', 'الدمام', 'الظهران'], pref_marital: ['never_married', 'divorced', 'widowed'] } },
  { name: 'تجريبية-ب4', dob: '1999-12-03', phone: '0500000014', bio: 'طالبة دراسات عليا، تحب القراءة.', M: { gender: 'woman', city: 'المدينة المنورة', marital_status: 'never_married', children: 'none', timeline: '12+', housing: 'family', partner_work: 'flexible', wants_children: 'yes', accepts_partner_children: 'no', polygamy_view: 'rejects', education: 'postgrad', works: false, travel: 'no', smoking: 'no', smoking_ok: 'no', social_style: 'quiet', langs: ['العربية'], values: ['الأسرة'], pref_age_min: 24, pref_age_max: 32, pref_cities: ['المدينة المنورة'], pref_marital: ['never_married'] } },
];
// تصحيح مدخل أ1 (قائمة مدن نظيفة)
PEOPLE[0].M.pref_cities = ['الرياض', 'الطائف'];


// مولّد حتمي لأشخاص اصطناعيين إضافيين لتجربة المحرك (لا بيانات حقيقية)
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function generate(n = 16) {
  const r = rng(2026), pick = (xs) => xs[Math.floor(r() * xs.length)], some = (xs, k) => [...xs].sort(() => r() - 0.5).slice(0, k);
  const cities = ['الرياض', 'الرياض', 'جدة', 'جدة', 'الدمام', 'الخبر', 'مكة المكرمة', 'المدينة المنورة', 'الطائف', 'أبها'];
  const near = { 'الرياض': ['الرياض', 'بريدة'], 'جدة': ['جدة', 'مكة المكرمة', 'الطائف'], 'الدمام': ['الدمام', 'الخبر', 'الظهران'], 'الخبر': ['الخبر', 'الدمام', 'الظهران'], 'مكة المكرمة': ['مكة المكرمة', 'جدة', 'الطائف'], 'المدينة المنورة': ['المدينة المنورة', 'ينبع'], 'الطائف': ['الطائف', 'مكة المكرمة', 'جدة'], 'أبها': ['أبها', 'خميس مشيط'] };
  const jobs = ['تقنية', 'تعليم', 'صحة', 'هندسة', 'أعمال حرة', 'إدارة', 'محاسبة', 'تسويق'], bios = ['أحب القراءة والمشي وأقدّر الوضوح.', 'هادئ الطباع، أحب الأسرة والسفر القصير.', 'طموح في عملي وأبحث عن استقرار.', 'أحب الطبخ والرياضة والأوقات الهادئة.', 'أهتم بالتعلم المستمر وبناء أسرة متفاهمة.'];
  const out = [];
  for (let i = 0; i < n; i++) {
    const g = i % 2 ? 'woman' : 'man', city = pick(cities), year = 1988 + Math.floor(r() * 12), mar = r() < 0.75 ? 'never_married' : pick(['divorced', 'widowed']);
    const has = mar !== 'never_married' && r() < 0.5, age = 2026 - year;
    out.push({ name: `${g === 'man' ? 'تجريبي' : 'تجريبية'}-${g === 'man' ? 'م' : 'ن'}${i + 1}`, dob: `${year}-0${1 + Math.floor(r() * 9)}-1${Math.floor(r() * 9)}`, phone: `05000001${String(i).padStart(2, '0')}`, bio: pick(bios),
      M: { gender: g, city, marital_status: mar, children: has ? 'has' : 'none', timeline: pick(['0-6', '6-12', '6-12', '12+']), housing: pick(['independent', 'independent', 'family', 'flexible']), partner_work: pick(['supports', 'flexible', 'prefers_not']), wants_children: pick(['yes', 'yes', 'undecided', 'no']), accepts_partner_children: pick(['yes', 'flexible', 'no']), polygamy_view: 'rejects',
        education: pick(['secondary', 'diploma', 'bachelor', 'bachelor', 'postgrad']), works: r() < 0.85, work_field: pick(jobs), job_travel: pick(['no', 'no', 'frequent']), travel: pick(['yes', 'conditional', 'no']), smoking: r() < 0.2 ? 'yes' : 'no', smoking_ok: pick(['no', 'flexible', 'yes']), social_style: pick(['quiet', 'balanced', 'social']),
        langs: some(['العربية', 'الإنجليزية', 'الفرنسية'], 1 + Math.floor(r() * 2)), values: some(['الاحترام', 'الصدق', 'الأسرة', 'الاستقلال', 'الطموح', 'الهدوء', 'الكرم', 'التعلم'], 2),
        pref_age_min: Math.max(18, age - 8), pref_age_max: Math.min(60, age + 6), pref_cities: [...new Set([...(near[city] || [city]), ...(r() < 0.4 ? [pick(cities)] : [])])], pref_marital: r() < 0.6 ? ['never_married'] : ['never_married', 'divorced', 'widowed'],
        hard: r() < 0.3 ? [{ field: 'smoking', values: ['no'] }] : [] } });
  }
  return out;
}
const GENERATED = generate();

function seed(app, { extra = true, scenario = false } = {}) {
  const out = { users: {}, creds: {} };
  const t0 = app.clock.now(), DAY = 86400000;
  const mk = (key, role, opt = {}) => { const r = app.newAccount({ role, ...opt }); out.users[key] = { id: r.user.id, role }; out.creds[key] = { name: r.name, code: r.code }; app.db.demoCreds.push({ key, role, label: opt.display_name, name: r.name, code: r.code }); return r.user; };
  mk('admin1', 'super_admin', { display_name: 'المشرف الأول (أ)' }); mk('admin2', 'super_admin', { display_name: 'المشرف الأول (ب)' });
  const ver = (cat) => ({ category: cat, checked_at: t0, expires_at: t0 + 365 * DAY, evidence_ref: 'demo' });
  const s1 = mk('sup1', 'supervisor', { display_name: 'أ. تجريبي (محامٍ)', category: 'lawyer', scope: ['الرياض', 'الدمام'], verification: ver('lawyer') });
  const s2 = mk('sup2', 'supervisor', { display_name: 'د. تجريبي (قاضٍ)', category: 'judge', scope: ['جدة'], verification: ver('judge') });
  mk('sup3', 'supervisor', { display_name: 'م. تجريبي (عمدة)', category: 'mayor', scope: ['الخبر'], verification: ver('mayor') });
  const tech = mk('tech1', 'tech', { display_name: 'المشرف التقني' });
  const act = (u) => { const sid = 'seed' + K.rid(6); app.db.sessions.set(sid, { uid: u.id, at: t0, last: t0, reauth: t0 }); return app.session(sid); };
  const WEST = ['جدة', 'مكة المكرمة', 'الطائف', 'المدينة المنورة', 'ينبع'];
  let n = 0; const files = {};
  for (const person of extra ? [...PEOPLE, ...GENERATED] : PEOPLE) {
    const sup = WEST.includes(person.M.city) && person !== PEOPLE[0] ? s2 : s1;
    const d = app.createDraft(act(sup), base(person)); files[person.name] = d.id;
    app.submitProfile(act(sup), d.id, { consent_attested: true, consent_ref: 'نموذج-ورقي-' + (100 + ++n) });
  }
  app.createDraft(act(s1), { I: { name: 'تجريبي-مسودة', dob: '1994-04-04', phone: '0500000099' }, M: { gender: 'man', city: 'الرياض' } });
  out.files = files;
  if (scenario) {
    app.runMatching('startup');
    // حالة جاهزة: ملفان جُمّدا بعد تواصل، وطلب استثناء بانتظار المشرف الأول، وطلب دعم فني
    const pair = [...app.db.pairs.values()].find((x) => x.state === 'PROPOSED');
    if (pair) {
      const sa = app.db.users.get(app.db.profiles.get(pair.a).supervisor_id), sb = app.db.users.get(app.db.profiles.get(pair.b).supervisor_id);
      app.decide(act(sa), pair.id, { profile_id: pair.a, decision: 'interested', channel: 'عبر مكتبي: الأحد إلى الخميس' });
      app.decide(act(sb), pair.id, { profile_id: pair.b, decision: 'interested', channel: 'عبر الديوان' });
      app.markContact(act(sb), pair.id, { profile_id: pair.b });
      app.requestExemption(act(sa), pair.a, { note: 'تعذّر إتمام التعارف بسبب سفر الطرف الآخر ونرجو استثناء المدة' });
    }
    app.openTicket(act(tech), { classification: 'page_error', description: 'صفحة طلبات المقارنة تتأخر في التحميل عند فتحها أول مرة صباحًا.', page: 'matches' });
  }
  return out;
}
module.exports = { seed, PEOPLE, GENERATED };
