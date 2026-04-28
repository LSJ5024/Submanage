import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getEncryptionKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error('ENCRYPTION_KEY 환경변수가 설정되지 않았습니다.');
  const buf = Buffer.from(key, 'hex');
  if (buf.length !== 32) throw new Error('ENCRYPTION_KEY는 32바이트(64자리 hex)이어야 합니다.');
  return buf;
}

/**
 * Encrypts plaintext using AES-256-GCM.
 * Returns a base64-encoded string: iv:authTag:ciphertext
 */
export function encrypt(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return [iv.toString('base64'), authTag.toString('base64'), encrypted.toString('base64')].join(
    ':',
  );
}

/**
 * Decrypts a base64-encoded string produced by encrypt().
 */
export function decrypt(encryptedText: string): string {
  const key = getEncryptionKey();
  const parts = encryptedText.split(':');
  if (parts.length !== 3) throw new Error('암호화된 데이터 형식이 올바르지 않습니다.');

  const [ivB64, authTagB64, dataB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const authTag = Buffer.from(authTagB64, 'base64');
  const encrypted = Buffer.from(dataB64, 'base64');

  if (iv.length !== IV_LENGTH) throw new Error('IV 길이가 올바르지 않습니다.');
  if (authTag.length !== AUTH_TAG_LENGTH) throw new Error('AuthTag 길이가 올바르지 않습니다.');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
