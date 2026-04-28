import pino from 'pino';
import pinoHttp from 'pino-http';

// 민감 데이터 마스킹 (CLAUDE.md §7, §11)
const SENSITIVE_KEYS = [
  'password',
  'token',
  'accessToken',
  'refreshToken',
  'access_token',
  'refresh_token',
  'cardNumber',
  'card_number',
  'accountNumber',
  'account_number',
  'ssn',
];

export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  formatters: {
    level(label) {
      return { level: label };
    },
  },
  serializers: {
    req(req: { method: string; url: string; headers: Record<string, string> }) {
      return {
        method: req.method,
        url: req.url,
        // Authorization 헤더 값은 로그에 출력하지 않음
        headers: { 'x-request-id': req.headers['x-request-id'] },
      };
    },
  },
  redact: {
    paths: SENSITIVE_KEYS.map((k) => `*.${k}`),
    censor: '***',
  },
});

export const httpLogger = pinoHttp({
  logger,
  customProps(req) {
    return { requestId: req.headers['x-request-id'] };
  },
  // 헬스 체크 요청은 로그 생략
  autoLogging: {
    ignore(req) {
      return req.url === '/health';
    },
  },
});
