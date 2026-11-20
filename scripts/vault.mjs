import { webcrypto } from 'node:crypto';
import { gzipSync, gunzipSync } from 'node:zlib';

export const iterations = 600000;
const encode = value => Buffer.from(value).toString('base64');
const decode = value => Buffer.from(value, 'base64');
export const metadata = vault => JSON.stringify({ version: vault.version, compression: vault.compression, kdf: vault.kdf, iterations: vault.iterations, salt: vault.salt });
export async function derive(password, vault) {
  if (!password) throw new Error('DASHBOARD_PASSWORD is required');
  const material = await webcrypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return webcrypto.subtle.deriveKey({ name: 'PBKDF2', salt: decode(vault.salt), iterations: vault.iterations, hash: 'SHA-256' }, material, { name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}
export async function seal(files, password, previous) {
  const vault = { version: 1, compression: 'gzip', kdf: 'PBKDF2-SHA256', iterations, salt: previous?.salt || encode(webcrypto.getRandomValues(new Uint8Array(32))), iv: encode(webcrypto.getRandomValues(new Uint8Array(12))) };
  const key = await derive(password, vault);
  vault.ciphertext = encode(await webcrypto.subtle.encrypt({ name: 'AES-GCM', iv: decode(vault.iv), additionalData: new TextEncoder().encode(metadata(vault)) }, key, gzipSync(Buffer.from(JSON.stringify(files)))));
  return vault;
}
export async function open(vault, password) {
  if (vault.version !== 1 || vault.iterations !== iterations || vault.compression !== 'gzip' || vault.kdf !== 'PBKDF2-SHA256') throw new Error('Unsupported vault format');
  const key = await derive(password, vault);
  const compressed = await webcrypto.subtle.decrypt({ name: 'AES-GCM', iv: decode(vault.iv), additionalData: new TextEncoder().encode(metadata(vault)) }, key, decode(vault.ciphertext));
  return JSON.parse(gunzipSync(Buffer.from(compressed), { maxOutputLength: 32 * 1024 * 1024 }).toString('utf8'));
}
