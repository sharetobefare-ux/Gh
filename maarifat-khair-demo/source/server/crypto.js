'use strict';
// تشفير مغلف: DEK لكل قسم/إصدار (AES-256-GCM) ملفوف بمفتاح KEK داخل "KMS" محاكى.
// تنبيه: نسخة مرجعية. في الإنتاج: KMS/HSM حقيقي + HPKE (RFC 9180) بمكتبة مدققة.
const c = require('node:crypto');

class SimKMS {
  constructor() { this.keks = new Map(); this.unwrapLog = []; this.counters = {}; this.destroyed = new Set(); }
  ensure(kekId) { if (!this.keks.has(kekId)) this.keks.set(kekId, c.randomBytes(32)); return kekId; }
  wrap(kekId, dek, aad) {
    this.ensure(kekId);
    const iv = c.randomBytes(12);
    const ci = c.createCipheriv('aes-256-gcm', this.keks.get(kekId), iv);
    ci.setAAD(Buffer.from(aad));
    const ct = Buffer.concat([ci.update(dek), ci.final()]);
    return Buffer.concat([iv, ci.getAuthTag(), ct]).toString('base64');
  }
  unwrap(kekId, wrapped, aad, caller, purpose) {
    if (this.destroyed.has(kekId) || !this.keks.has(kekId)) throw new Error('KEK_UNAVAILABLE');
    const b = Buffer.from(wrapped, 'base64');
    const d = c.createDecipheriv('aes-256-gcm', this.keks.get(kekId), b.subarray(0, 12));
    d.setAAD(Buffer.from(aad)); d.setAuthTag(b.subarray(12, 28));
    const out = Buffer.concat([d.update(b.subarray(28)), d.final()]);
    this.unwrapLog.push({ kekId, caller, purpose, at: Date.now() }); if (this.unwrapLog.length > 3000) this.unwrapLog.splice(0, 1000);
    const cls = String(caller).split(':').slice(0, 2).join(':'); this.counters[cls] = (this.counters[cls] || 0) + 1;
    return out;
  }
  destroy(kekId) { this.keks.delete(kekId); this.destroyed.add(kekId); }
}

const aadOf = (m) => [m.profile_id, m.section, m.schema_version, m.record_version, m.purpose].join('|');

function seal(kms, kekId, meta, obj) {
  const dek = c.randomBytes(32), nonce = c.randomBytes(12);
  const aad = aadOf(meta);
  const ci = c.createCipheriv('aes-256-gcm', dek, nonce);
  ci.setAAD(Buffer.from(aad));
  const ct = Buffer.concat([ci.update(JSON.stringify(obj), 'utf8'), ci.final()]);
  const rec = { ...meta, kek_id: kekId, nonce: nonce.toString('base64'), tag: ci.getAuthTag().toString('base64'),
    ciphertext: ct.toString('base64'), wrapped_dek: kms.wrap(kekId, dek, aad) };
  dek.fill(0);
  return rec;
}
function open(kms, rec, caller, purpose) {
  const aad = aadOf(rec);
  const dek = kms.unwrap(rec.kek_id, rec.wrapped_dek, aad, caller, purpose);
  try {
    const d = c.createDecipheriv('aes-256-gcm', dek, Buffer.from(rec.nonce, 'base64'));
    d.setAAD(Buffer.from(aad)); d.setAuthTag(Buffer.from(rec.tag, 'base64'));
    return JSON.parse(Buffer.concat([d.update(Buffer.from(rec.ciphertext, 'base64')), d.final()]).toString('utf8'));
  } finally { dek.fill(0); }
}
const rid = (n = 16) => c.randomBytes(n).toString('base64url');
const sha = (s) => c.createHash('sha256').update(s).digest('hex');
const hmac = (k, s) => c.createHmac('sha256', k).update(s).digest('hex');
const eq = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && c.timingSafeEqual(x, y); };

function hashPassword(pw) { const salt = c.randomBytes(16); return salt.toString('hex') + ':' + c.scryptSync(pw, salt, 32).toString('hex'); }
function verifyPassword(pw, stored) { const [s, h] = stored.split(':'); return eq(c.scryptSync(pw, Buffer.from(s, 'hex'), 32).toString('hex'), h); }

// ---------- بيانات الدخول العشوائية: اسم (كلمات) + رقم (رموز) يولّدهما المشرف الأول ----------
const WORDS = ['نخلة','صقر','واحة','بحر','جبل','نجم','غيمة','ريحان','سهم','فجر','ندى','وادي','سحاب','قمر','شمس','رمل','مطر','زهرة','تمر','صحراء','نسيم','هلال','ربيع','شراع','جوهر','مرجان','لؤلؤ','بدر','سنا','أفق','غدير','روضة','ياسمين','عنبر','كرم','سدرة','خيمة','حمامة','نخيل','زيتون','تين','رمان','قهوة','هيل','زعفران','صنوبر','عرعر','سمر','ضحى','غروب','شفق','جزيرة','شاطئ','موج','قارب','منارة','سفينة','ميناء','قلعة','برج','سور','بوابة','ممر','حصن'];
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789#$%&*@!?'; // 64 رمزًا بلا حروف ملتبسة
if (WORDS.length !== 64 || CODE_ALPHABET.length !== 64) throw new Error('alphabet size');
const pick64 = (n) => Array.from(c.randomBytes(n), (b) => b & 63); // 256 يقبل القسمة على 64: بلا انحياز
const genName = () => pick64(3).map((i) => WORDS[i]).join('-');
const genCode = () => { const x = pick64(12).map((i) => CODE_ALPHABET[i]).join(''); return `${x.slice(0, 4)}-${x.slice(4, 8)}-${x.slice(8)}`; }; // 72 بت
const normName = (s) => String(s || '').normalize('NFKC').replace(/[\u064B-\u065F\u0670\u0640]/g, '').replace(/[أإآ]/g, 'ا').trim().split(/[\s\-_.]+/).filter(Boolean).join('-');
const normCode = (s) => String(s || '').normalize('NFKC').replace(/[\s\-]/g, '');
const nameKey = (s) => sha('name:' + normName(s));

module.exports = { SimKMS, seal, open, rid, sha, hmac, eq, hashPassword, verifyPassword, genName, genCode, normName, normCode, nameKey };
