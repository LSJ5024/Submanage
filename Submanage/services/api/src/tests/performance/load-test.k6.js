/**
 * k6 부하 테스트 — SubTrack API 성능 검증 (TASK-052)
 * PRD NFR-PERF 목표:
 *   - API P95 응답 시간: 1.5초 이내
 *   - 대시보드 초기 로딩: 2초 이내
 *   - 동시 접속자: 10,000명 (Auto Scaling)
 *
 * 실행: k6 run load-test.k6.js --env BASE_URL=http://localhost:3000
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';

// ── 커스텀 메트릭 ──────────────────────────────────────────────────────────
const errorRate        = new Rate('error_rate');
const dashboardLatency = new Trend('dashboard_latency', true);
const subListLatency   = new Trend('subscription_list_latency', true);
const apiErrors        = new Counter('api_errors');

// ── 테스트 설정 ────────────────────────────────────────────────────────────
export const options = {
  scenarios: {
    // 시나리오 1: 점진적 부하 증가 (Ramp-up)
    ramp_up: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m',  target: 100   },  // 2분 → 100 VU
        { duration: '5m',  target: 1000  },  // 5분 → 1,000 VU
        { duration: '10m', target: 10000 },  // 10분 → 10,000 VU (목표)
        { duration: '5m',  target: 10000 },  // 5분 유지
        { duration: '3m',  target: 0     },  // Ramp-down
      ],
      gracefulRampDown: '30s',
    },

    // 시나리오 2: 스파이크 테스트
    spike: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 5000  },
        { duration: '30s', target: 10000 },
        { duration: '1m', target: 5000  },
        { duration: '30s', target: 0    },
      ],
      startTime: '25m', // ramp_up 이후 실행
    },
  },

  // PRD NFR-PERF 임계값
  thresholds: {
    // 전체 API P95 응답 시간 1.5초 이내
    'http_req_duration{scenario:ramp_up}': ['p(95)<1500'],

    // 대시보드 응답 2초 이내
    'dashboard_latency': ['p(95)<2000', 'p(99)<3000'],

    // 구독 목록 응답 1.5초 이내
    'subscription_list_latency': ['p(95)<1500'],

    // 에러율 1% 미만
    'error_rate': ['rate<0.01'],

    // HTTP 에러 횟수 제한
    'http_req_failed': ['rate<0.01'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000/api/v1';

// ── 테스트 픽스처 ──────────────────────────────────────────────────────────
const TEST_TOKEN = __ENV.TEST_JWT_TOKEN || 'eyJhbGciOiJIUzI1NiJ9.test';

const AUTH_HEADERS = {
  Authorization: `Bearer ${TEST_TOKEN}`,
  'Content-Type': 'application/json',
};

// ── 메인 테스트 함수 ───────────────────────────────────────────────────────
export default function () {
  group('대시보드 로딩 (PRD: 2초 이내)', () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/dashboard`, { headers: AUTH_HEADERS });
    const latency = Date.now() - start;

    dashboardLatency.add(latency);
    errorRate.add(res.status !== 200);

    const ok = check(res, {
      '대시보드 200 OK':              (r) => r.status === 200,
      '대시보드 2초 이내':             () => latency < 2000,
      '응답에 totalMonthlyAmount 포함': (r) => {
        try { return JSON.parse(r.body).data?.totalMonthlyAmount !== undefined; }
        catch { return false; }
      },
    });
    if (!ok) apiErrors.add(1);
  });

  sleep(0.5);

  group('구독 목록 조회 (P95: 1.5초)', () => {
    const start = Date.now();
    const res = http.get(`${BASE_URL}/subscriptions?limit=20`, { headers: AUTH_HEADERS });
    const latency = Date.now() - start;

    subListLatency.add(latency);
    errorRate.add(res.status !== 200);

    check(res, {
      '구독 목록 200 OK':   (r) => r.status === 200,
      '응답 1.5초 이내':    () => latency < 1500,
      'items 배열 포함':    (r) => {
        try { return Array.isArray(JSON.parse(r.body).data?.items); }
        catch { return false; }
      },
    });
  });

  sleep(0.5);

  group('월별 리포트 조회', () => {
    const year  = new Date().getFullYear();
    const month = new Date().getMonth() + 1;
    const res = http.get(
      `${BASE_URL}/dashboard/reports/monthly?year=${year}&month=${month}`,
      { headers: AUTH_HEADERS },
    );

    errorRate.add(res.status !== 200);
    check(res, {
      '리포트 200 OK': (r) => r.status === 200,
    });
  });

  sleep(1);
}

// ── 테스트 종료 후 요약 출력 ────────────────────────────────────────────────
export function handleSummary(data) {
  const p95Dashboard = data.metrics.dashboard_latency?.values?.['p(95)'] ?? 0;
  const p95SubList   = data.metrics.subscription_list_latency?.values?.['p(95)'] ?? 0;
  const errRate      = data.metrics.error_rate?.values?.rate ?? 0;
  const maxVUs       = data.metrics.vus_max?.values?.max ?? 0;

  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      maxConcurrentUsers:        maxVUs,
      dashboardP95Ms:            Math.round(p95Dashboard),
      subscriptionListP95Ms:     Math.round(p95SubList),
      errorRatePercent:          (errRate * 100).toFixed(2),
    },
    thresholdResults: {
      dashboardUnder2s:          p95Dashboard < 2000  ? '✅ PASS' : '❌ FAIL',
      subscriptionListUnder1_5s: p95SubList   < 1500  ? '✅ PASS' : '❌ FAIL',
      errorRateUnder1pct:        errRate       < 0.01  ? '✅ PASS' : '❌ FAIL',
      concurrentUsers10k:        maxVUs        >= 10000 ? '✅ PASS' : '🔄 확인 필요',
    },
  };

  return {
    'stdout': JSON.stringify(report, null, 2),
    'performance-report.json': JSON.stringify(report, null, 2),
  };
}
