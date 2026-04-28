import { PrismaClient } from '@prisma/client';

import { encrypt, decrypt } from '@subtrack/shared';

const prismaBase = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['warn', 'error'],
});

// transactions 테이블 금융 데이터 자동 암/복호화 미들웨어 (CLAUDE.md §7)
prismaBase.$use(async (params, next) => {
  // 저장 시 암호화
  if (params.model === 'Transaction' && ['create', 'update', 'upsert'].includes(params.action)) {
    const data = params.args.data as Record<string, unknown>;
    if (typeof data['merchant_name'] === 'string') {
      data['merchant_name_encrypted'] = encrypt(data['merchant_name'] as string);
      delete data['merchant_name'];
    }
    if (typeof data['amount'] === 'number' || typeof data['amount'] === 'string') {
      data['amount_encrypted'] = encrypt(String(data['amount']));
      delete data['amount'];
    }
  }

  const result: unknown = await next(params);

  // 조회 시 복호화
  if (params.model === 'Transaction' && ['findUnique', 'findFirst', 'findMany'].includes(params.action)) {
    const decryptRecord = (record: Record<string, unknown>): void => {
      if (typeof record['merchant_name_encrypted'] === 'string') {
        record['merchant_name'] = decrypt(record['merchant_name_encrypted'] as string);
      }
      if (typeof record['amount_encrypted'] === 'string') {
        record['amount'] = Number(decrypt(record['amount_encrypted'] as string));
      }
    };

    if (Array.isArray(result)) {
      (result as Record<string, unknown>[]).forEach(decryptRecord);
    } else if (result && typeof result === 'object') {
      decryptRecord(result as Record<string, unknown>);
    }
  }

  return result;
});

export const prisma = prismaBase;
