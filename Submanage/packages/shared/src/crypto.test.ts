import { decrypt, encrypt } from './crypto.js';

describe('AES-256-GCM 암호화 유틸', () => {
  beforeAll(() => {
    // 테스트용 32바이트 hex 키 설정
    process.env.ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
  });

  it('평문을 암호화하고 복호화하면 원본과 동일해야 한다', () => {
    const plaintext = 'Netflix Korea 결제 15,000원';
    const encrypted = encrypt(plaintext);
    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(plaintext);
  });

  it('동일한 평문을 두 번 암호화하면 다른 결과가 나와야 한다 (IV 랜덤)', () => {
    const plaintext = '가맹점명 테스트';
    const enc1 = encrypt(plaintext);
    const enc2 = encrypt(plaintext);
    expect(enc1).not.toBe(enc2);
  });

  it('암호화된 문자열은 iv:authTag:ciphertext 형식이어야 한다', () => {
    const encrypted = encrypt('test');
    const parts = encrypted.split(':');
    expect(parts).toHaveLength(3);
  });

  it('ENCRYPTION_KEY 없이 호출하면 에러를 던져야 한다', () => {
    const originalKey = process.env.ENCRYPTION_KEY;
    delete process.env.ENCRYPTION_KEY;
    expect(() => encrypt('test')).toThrow('ENCRYPTION_KEY');
    process.env.ENCRYPTION_KEY = originalKey;
  });

  it('잘못된 형식의 암호문을 복호화하면 에러를 던져야 한다', () => {
    expect(() => decrypt('invalid_format')).toThrow();
  });
});
