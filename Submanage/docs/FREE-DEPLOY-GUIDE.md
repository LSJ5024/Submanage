# SubTrack 무료 배포 가이드 (신용카드 불필요)

> 모든 서비스를 **GitHub 계정**으로만 가입합니다.  
> 예상 소요 시간: **약 1시간**

---

## 전체 구조

```
사용자 브라우저
    ↓
Vercel (웹 앱)          → 무료, 무제한
    ↓ API 요청
Render (Node.js API)    → 무료, 월 750시간
    ↓ 내부 통신
Render (Python AI)      → 무료, 월 750시간
    ↓ DB/Cache
Neon (PostgreSQL)       → 무료, 0.5GB
Upstash (Redis)         → 무료, 10K 명령/일
Resend (이메일)          → 무료, 3,000건/월
```

> ⚠️ **Render 무료 티어 주의사항**
> - 15분 비활동 시 서비스가 슬립 상태로 전환됩니다.
> - 다음 요청 시 30~60초 콜드 스타트가 발생합니다.
> - 학교 발표 전 미리 한 번 접속해 워밍업하세요.

---

## STEP 1 — Neon PostgreSQL (무료 DB)

1. **https://neon.tech** 접속 → `Sign up with GitHub`
2. 프로젝트 생성 → 이름: `subtrack`
3. 리전: `AWS ap-southeast-1 (Singapore)` 선택 (한국에서 가장 가까운 무료 리전)
4. 생성 완료 후 **Connection string** 복사

```
postgresql://user:pass@ep-xxx.ap-southeast-1.aws.neon.tech/neondb?sslmode=require
```

5. `.env` 파일에 `DATABASE_URL=` 로 저장

---

## STEP 2 — Upstash Redis (무료 캐시)

1. **https://upstash.com** 접속 → `Sign up with GitHub`
2. `Create Database` → 이름: `subtrack-redis`
3. 리전: `AP-NORTHEAST-1 (Tokyo)` 선택
4. Type: `Regional` 선택 (무료)
5. 생성 후 `.env` 탭 → **REDIS_URL** 복사

```
rediss://default:PASSWORD@HOST.upstash.io:PORT
```

---

## STEP 3 — Resend 이메일 (무료 3,000건/월)

1. **https://resend.com** 접속 → `Sign up with GitHub`
2. 대시보드 → `API Keys` → `Create API Key`
3. 이름: `subtrack-prod`, 권한: `Full access`
4. 생성된 키 복사 (`re_XXXX...`)
5. `.env`에 `RESEND_API_KEY=re_XXXX...` 저장

> 무료 플랜에서는 발신 주소가 `onboarding@resend.dev` 고정  
> 도메인 추가 없이 바로 테스트 가능

---

## STEP 4 — 환경변수 파일 생성

프로젝트 루트에 `.env` 파일 생성:

```bash
cd D:/mypy/Submanage/services/api

# 아래 명령으로 랜덤 키 3개 생성
node -e "
  const crypto = require('crypto');
  console.log('JWT_ACCESS_SECRET=' + crypto.randomBytes(32).toString('hex'));
  console.log('JWT_REFRESH_SECRET=' + crypto.randomBytes(32).toString('hex'));
  console.log('ENCRYPTION_KEY='    + crypto.randomBytes(32).toString('hex'));
"
```

`.env` 파일 내용:
```env
NODE_ENV=production
PORT=3000
DATABASE_URL=<STEP 1에서 복사한 값>
REDIS_URL=<STEP 2에서 복사한 값>
JWT_ACCESS_SECRET=<위 명령 결과>
JWT_REFRESH_SECRET=<위 명령 결과>
JWT_ACCESS_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=30d
ENCRYPTION_KEY=<위 명령 결과>
AI_ENGINE_URL=https://subtrack-ai-engine.onrender.com
AI_ENGINE_INTERNAL_SECRET=<랜덤 문자열>
SCHEDULER_SECRET=<랜덤 문자열>
RESEND_API_KEY=<STEP 3에서 복사한 값>
RESEND_FROM_EMAIL=SubTrack <onboarding@resend.dev>
MYDATA_CLIENT_ID=mock_client_id
MYDATA_CLIENT_SECRET=mock_client_secret
MYDATA_API_BASE_URL=https://testbed.mydata.go.kr
```

---

## STEP 5 — DB 마이그레이션 + 시딩

```bash
cd D:/mypy/Submanage/services/api

# 마이그레이션 실행 (Neon DB에 테이블 생성)
DATABASE_URL="<STEP 1 URL>" npx prisma migrate deploy

# 초기 데이터 시딩 (구독 카탈로그 30종 + 해지 가이드)
DATABASE_URL="<STEP 1 URL>" npx ts-node prisma/seed.ts
```

---

## STEP 6 — Render API 서버 배포

1. **https://render.com** 접속 → `Sign up with GitHub`
2. `New +` → `Web Service`
3. GitHub 저장소 연결: `LSJ5024/Submanage`
4. 설정:
   ```
   Name:            subtrack-api
   Branch:          main
   Root Directory:  (비워두기 — render.yaml 자동 감지)
   Runtime:         Docker
   Dockerfile Path: ./services/api/Dockerfile.railway
   Docker Context:  .
   Plan:            Free
   ```
5. **Environment Variables** 탭 → `.env` 내용 모두 입력
6. `Create Web Service` 클릭
7. 배포 완료 후 URL 복사: `https://subtrack-api.onrender.com`

### AI 엔진도 동일하게 추가:
```
Name:            subtrack-ai-engine
Dockerfile Path: ./services/ai-engine/Dockerfile
Docker Context:  ./services/ai-engine
Plan:            Free
환경변수:         PYTHON_ENV=production, DATABASE_URL=<위 값>, PORT=8000
```

---

## STEP 7 — Vercel 웹 앱 배포

1. **https://vercel.com** 접속 → `Sign up with GitHub`
2. `Add New Project` → GitHub 저장소 선택: `LSJ5024/Submanage`
3. 설정:
   ```
   Framework Preset: Vite
   Root Directory:   apps/web
   Build Command:    cd ../.. && pnpm --filter @subtrack/shared build && pnpm --filter @subtrack/web build
   Output Directory: dist
   ```
4. **Environment Variables** 추가:
   ```
   VITE_API_BASE_URL = https://subtrack-api.onrender.com/api/v1
   VITE_DEMO_MODE    = false
   ```
5. `Deploy` 클릭
6. 완료 후 URL 확인: `https://subtrack-xxx.vercel.app`

---

## STEP 8 — GitHub Actions 시크릿 등록

`GitHub 저장소 → Settings → Secrets and variables → Actions`

| 시크릿 이름 | 값 | 확인 방법 |
|------------|-----|----------|
| `NEON_DATABASE_URL` | Neon Connection String | STEP 1 |
| `VERCEL_TOKEN` | Vercel API Token | Vercel → Settings → Tokens |
| `VERCEL_ORG_ID` | `.vercel/project.json`의 orgId | Vercel 로컬 연결 후 확인 |
| `VERCEL_PROJECT_ID` | `.vercel/project.json`의 projectId | Vercel 로컬 연결 후 확인 |
| `RENDER_API_URL` | `https://subtrack-api.onrender.com` | Render 대시보드 |
| `RENDER_API_DEPLOY_HOOK` | Render → Settings → Deploy Hook | Render 대시보드 |

```bash
# Vercel ORG_ID, PROJECT_ID 확인 방법
cd D:/mypy/Submanage/apps/web
npx vercel link   # 로그인 후 프로젝트 연결
cat .vercel/project.json
```

---

## STEP 9 — 최종 확인

```bash
# API 헬스 체크
curl https://subtrack-api.onrender.com/health
# 예상 응답: {"status":"ok","timestamp":"..."}

# 웹 앱 접속
# https://subtrack-xxx.vercel.app → 로그인 화면 확인
```

---

## 비용 정리 (모두 무료)

| 서비스 | 무료 한도 | 초과 시 |
|--------|-----------|---------|
| Vercel | 무제한 | $20/월 |
| Render | 750시간/월 | $7/월 |
| Neon | 0.5GB | $19/월 |
| Upstash | 10K 명령/일 | $0.2/10K |
| Resend | 3,000건/월 | $20/월 |
| **합계** | **$0** | — |

> 학교 과제 기간(한 학기)은 무료 한도로 충분합니다.

---

## 문제 해결

**Q: Render 서비스가 응답이 없어요.**  
A: 무료 티어는 15분 비활동 후 슬립됩니다. 30~60초 기다리거나 URL을 직접 접속해 워밍업하세요.

**Q: DB 연결이 안 돼요.**  
A: Neon URL에 `?sslmode=require` 가 포함되어 있는지 확인하세요.

**Q: 이메일이 안 와요.**  
A: Resend 대시보드에서 `Logs` 탭에서 발송 기록을 확인하세요.  
무료 플랜은 발신자 주소가 `onboarding@resend.dev` 고정입니다.
