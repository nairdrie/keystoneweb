/**
 * Encrypt third-party credentials before they are stored (AES-256-GCM).
 *
 * Key: CREDENTIALS_ENCRYPTION_KEY, 32 bytes as 64 hex chars or base64.
 * Ciphertext format: "v1:<iv b64>:<tag b64>:<data b64>". Keep the key out of
 * the database; rotating it means re-connecting (or re-encrypting) the stored
 * credentials.
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

function key(): Buffer {
  const raw = (process.env.CREDENTIALS_ENCRYPTION_KEY || '').trim();
  if (!raw) throw new Error('CREDENTIALS_ENCRYPTION_KEY is not set');
  const buf = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  if (buf.length !== 32) throw new Error('CREDENTIALS_ENCRYPTION_KEY must be 32 bytes (64 hex chars or base64)');
  return buf;
}

export function encryptionConfigured(): boolean {
  try {
    key();
    return true;
  } catch {
    return false;
  }
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64'), cipher.getAuthTag().toString('base64'), data.toString('base64')].join(':');
}

export function decryptSecret(box: string): string {
  const [v, iv, tag, data] = String(box).split(':');
  if (v !== 'v1' || !iv || !tag || data === undefined) throw new Error('Unrecognised encrypted value');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8');
}
