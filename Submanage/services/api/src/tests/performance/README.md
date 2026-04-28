# SubTrack 성능 테스트 (TASK-052)

## 실행 방법

### 1. k6 설치
```bash
# macOS
brew install k6

# Windows (winget)
winget install k6

# Docker
docker run -i grafana/k6 run - <load-test.k6.js
```

### 2. 테스트 실행 (로컬)
```bash
# API 서버 실행 (docker-compose up -d)
docker-compose up -d postgres redis api

# k6 실행
k6 run load-test.k6.js \
  --env BASE_URL=http://localhost:3000/api/v1 \
  --env TEST_JWT_TOKEN=<유효한_JWT_토큰>
```

### 3. 목표 임계값 (PRD NFR-PERF)

| 지표 | 목표 | 시나리오 |
|------|------|---------|
| API P95 응답 시간 | **1.5초 이내** | ramp_up |
| 대시보드 P95 | **2초 이내** | ramp_up |
| 에러율 | **1% 미만** | 전체 |
| 동시 접속자 | **10,000명** | ramp_up 피크 |

### 4. 결과 확인
```
performance-report.json 파일 생성됨
```
