// بديل node:crypto للمتصفح: يغطي ما تستخدمه المنصة فقط (AES-GCM وSHA وHMAC وscrypt وعشوائية آمنة)
import { gcm } from '@noble/ciphers/aes.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { sha1 } from '@noble/hashes/legacy.js';
import { hmac } from '@noble/hashes/hmac.js';
import { scrypt } from '@noble/hashes/scrypt.js';
import { Buffer } from 'buffer';
const B = (x, enc) => (typeof x === 'string' ? Buffer.from(x, enc || 'utf8') : Buffer.from(x));
const out = (u8, enc) => { const b = Buffer.from(u8); return enc ? b.toString(enc) : b; };
export function randomBytes(n) { const u = new Uint8Array(n); crypto.getRandomValues(u); return Buffer.from(u); }
export function createHash(alg) { if (alg !== 'sha256') throw new Error('unsupported'); const parts = []; return { update(d) { parts.push(B(d)); return this; }, digest(enc) { return out(sha256(Buffer.concat(parts)), enc); } }; }
export function createHmac(alg, key) { const H = alg === 'sha1' ? sha1 : sha256; const parts = []; return { update(d) { parts.push(B(d)); return this; }, digest(enc) { return out(hmac(H, B(key), Buffer.concat(parts)), enc); } }; }
export function timingSafeEqual(a, b) { if (a.length !== b.length) throw new RangeError('length'); let d = 0; for (let i = 0; i < a.length; i++) d |= a[i] ^ b[i]; return d === 0; }
// تكلفة scrypt أقل في المتصفح (نسخة تجريبية فقط). في الخادم الحقيقي تُستخدم قيم node الافتراضية.
export function scryptSync(pw, salt, len) { return out(scrypt(B(pw), B(salt), { N: 2048, r: 8, p: 1, dkLen: len })); }
class Cipher { constructor(key, iv) { this.k = B(key); this.iv = B(iv); this.aad = new Uint8Array(0); this.parts = []; }
  setAAD(a) { this.aad = B(a); return this; } update(d, enc) { this.parts.push(B(d, enc)); return Buffer.alloc(0); } }
class Enc extends Cipher { final() { const r = gcm(this.k, this.iv, this.aad).encrypt(Buffer.concat(this.parts)); this.tag = Buffer.from(r.slice(r.length - 16)); return Buffer.from(r.slice(0, r.length - 16)); } getAuthTag() { return this.tag; } }
class Dec extends Cipher { setAuthTag(t) { this.tag = B(t); return this; } final() { try { return Buffer.from(gcm(this.k, this.iv, this.aad).decrypt(Buffer.concat([...this.parts, this.tag]))); } catch { throw new Error('Unsupported state or unable to authenticate data'); } } }
export const createCipheriv = (a, k, iv) => new Enc(k, iv);
export const createDecipheriv = (a, k, iv) => new Dec(k, iv);
export default { randomBytes, createHash, createHmac, timingSafeEqual, scryptSync, createCipheriv, createDecipheriv };
