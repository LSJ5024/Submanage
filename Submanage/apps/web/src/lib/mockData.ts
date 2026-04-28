// 데모용 목 데이터 — 백엔드 없이 화면 확인 시 사용
// VITE_DEMO_MODE=true 환경변수로 활성화

export const MOCK_DASHBOARD = {
  totalMonthlyAmount: 87800,
  upcomingBillings: [
    { id: '1', serviceName: 'Netflix',  amount: 17000, nextBillingDate: new Date(Date.now() + 2 * 86400000).toISOString(), daysLeft: 2 },
    { id: '2', serviceName: 'Spotify',  amount: 10900, nextBillingDate: new Date(Date.now() + 5 * 86400000).toISOString(), daysLeft: 5 },
    { id: '3', serviceName: 'Adobe CC', amount: 28600, nextBillingDate: new Date(Date.now() + 7 * 86400000).toISOString(), daysLeft: 7 },
  ],
  categoryBreakdown: [
    { category: 'VIDEO',    total: 34000, count: 2 },
    { category: 'MUSIC',    total: 10900, count: 1 },
    { category: 'SOFTWARE', total: 42900, count: 2 },
  ],
};

export const MOCK_SUBSCRIPTIONS = {
  items: [
    { id: '1', serviceName: 'Netflix',         amount: 17000, status: 'ACTIVE',     billingCycle: 'MONTHLY', nextBillingDate: new Date(Date.now() + 2 * 86400000).toISOString(), category: 'VIDEO',    autoDetected: true  },
    { id: '2', serviceName: 'Spotify',         amount: 10900, status: 'ACTIVE',     billingCycle: 'MONTHLY', nextBillingDate: new Date(Date.now() + 5 * 86400000).toISOString(), category: 'MUSIC',    autoDetected: true  },
    { id: '3', serviceName: 'Adobe CC',        amount: 28600, status: 'ACTIVE',     billingCycle: 'MONTHLY', nextBillingDate: new Date(Date.now() + 7 * 86400000).toISOString(), category: 'SOFTWARE', autoDetected: true  },
    { id: '4', serviceName: 'YouTube Premium', amount: 14900, status: 'ACTIVE',     billingCycle: 'MONTHLY', nextBillingDate: new Date(Date.now() + 12 * 86400000).toISOString(), category: 'VIDEO',   autoDetected: true  },
    { id: '5', serviceName: 'Notion',          amount: 16000, status: 'PAUSED',     billingCycle: 'MONTHLY', nextBillingDate: new Date(Date.now() + 20 * 86400000).toISOString(), category: 'SOFTWARE', autoDetected: false },
    { id: '6', serviceName: 'Wavve',           amount:  7900, status: 'CANCELLING', billingCycle: 'MONTHLY', nextBillingDate: new Date(Date.now() + 3 * 86400000).toISOString(), category: 'VIDEO',    autoDetected: true  },
  ],
  nextCursor: null,
  hasMore: false,
};

export const MOCK_MONTHLY_REPORT = {
  year: new Date().getFullYear(),
  month: new Date().getMonth() + 1,
  totalAmount: 87800,
  subscriptionCount: 6,
  categoryBreakdown: { VIDEO: 39800, MUSIC: 10900, SOFTWARE: 37100 },
  subscriptions: MOCK_SUBSCRIPTIONS.items,
};

export const MOCK_NOTIFICATION_SETTINGS = {
  pushEnabled:      true,
  emailEnabled:     true,
  smsEnabled:       false,
  notificationTime: '10:00',
};

export const MOCK_CANCEL_GUIDE = {
  id: 'guide-1',
  catalog: { service_name: 'Netflix' },
  steps: [
    { order: 1, description: '넷플릭스 앱 또는 웹사이트에 로그인합니다.' },
    { order: 2, description: '우측 상단 프로필 아이콘 → 계정을 선택합니다.' },
    { order: 3, description: '멤버십 및 청구 섹션에서 "멤버십 해지"를 클릭합니다.' },
    { order: 4, description: '해지 확인 버튼을 클릭합니다.' },
  ],
  deep_link: 'https://www.netflix.com/cancelplan',
  screenshot_urls: [],
};
