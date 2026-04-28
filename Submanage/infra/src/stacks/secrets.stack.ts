import * as cdk      from 'aws-cdk-lib';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct }  from 'constructs';

export class SubTrackSecretsStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: cdk.StackProps) {
    super(scope, id, props);

    // ── 시크릿 목록 (CLAUDE.md §9 — 하드코딩 절대 금지) ────────────────────
    const secrets: { name: string; desc: string }[] = [
      { name: 'subtrack/jwt/access-secret',      desc: 'JWT Access Token 서명 키' },
      { name: 'subtrack/jwt/refresh-secret',     desc: 'JWT Refresh Token 서명 키' },
      { name: 'subtrack/crypto/encryption-key',  desc: 'AES-256 금융 데이터 암호화 키' },
      { name: 'subtrack/mydata/client-secret',   desc: '마이데이터 API Client Secret' },
      { name: 'subtrack/ai-engine/internal-key', desc: 'AI 엔진 내부 인증 시크릿' },
      { name: 'subtrack/fcm/server-key',         desc: 'Firebase Cloud Messaging 서버 키' },
      { name: 'subtrack/apns/private-key',       desc: 'APNs p8 인증서' },
      { name: 'subtrack/twilio/auth-token',      desc: 'Twilio SMS 인증 토큰' },
      { name: 'subtrack/aws/ses-api-key',        desc: 'AWS SES API Key' },
    ];

    secrets.forEach(({ name, desc }) => {
      new secretsmanager.Secret(this, name.replace(/\//g, '-'), {
        secretName: name,
        description: desc,
        // 90일마다 자동 로테이션 권장 (Lambda 로테이션 함수 별도 설정 필요)
        removalPolicy: cdk.RemovalPolicy.RETAIN, // 실수 삭제 방지
      });
    });
  }
}
