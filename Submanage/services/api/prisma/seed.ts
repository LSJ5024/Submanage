import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/** 구독 서비스 카탈로그 + 해지 가이드 30종 초기 데이터 (TASK-024) */
const CATALOG_SEED = [
  {
    service_name: 'Netflix',
    category: 'VIDEO' as const,
    website_url: 'https://www.netflix.com',
    merchant_name_patterns: ['NETFLIX', '넷플릭스', 'NETFLIX.COM'],
    deep_link: 'https://www.netflix.com/cancelplan',
    steps: [
      { order: 1, description: '넷플릭스 앱 또는 웹사이트에 로그인합니다.' },
      { order: 2, description: '우측 상단 프로필 아이콘 → 계정을 선택합니다.' },
      { order: 3, description: '멤버십 및 청구 섹션에서 "멤버십 해지"를 클릭합니다.' },
      { order: 4, description: '해지 확인 버튼을 클릭합니다.' },
    ],
  },
  {
    service_name: 'YouTube Premium',
    category: 'VIDEO' as const,
    website_url: 'https://www.youtube.com/premium',
    merchant_name_patterns: ['YOUTUBE PREMIUM', '유튜브 프리미엄', 'GOOGLE'],
    deep_link: 'https://www.youtube.com/paid_memberships',
    steps: [
      { order: 1, description: 'YouTube 앱 또는 웹에서 프로필 사진을 탭합니다.' },
      { order: 2, description: '유료 멤버십 → YouTube Premium을 선택합니다.' },
      { order: 3, description: '멤버십 관리 → 해지를 선택합니다.' },
    ],
  },
  {
    service_name: 'Spotify',
    category: 'MUSIC' as const,
    website_url: 'https://www.spotify.com',
    merchant_name_patterns: ['SPOTIFY', '스포티파이'],
    deep_link: 'https://www.spotify.com/account/subscription/',
    steps: [
      { order: 1, description: 'Spotify 웹사이트에서 계정에 로그인합니다.' },
      { order: 2, description: '계정 → 플랜을 선택합니다.' },
      { order: 3, description: '프리미엄 해지 버튼을 클릭합니다.' },
    ],
  },
  {
    service_name: 'Apple One',
    category: 'SOFTWARE' as const,
    website_url: 'https://www.apple.com',
    merchant_name_patterns: ['APPLE ONE', 'APPLE.COM/BILL', 'ITUNES'],
    deep_link: 'https://appleid.apple.com',
    steps: [
      { order: 1, description: 'iPhone 설정 → Apple ID → 구독을 탭합니다.' },
      { order: 2, description: 'Apple One을 선택합니다.' },
      { order: 3, description: '구독 해지를 탭하고 확인합니다.' },
    ],
  },
  {
    service_name: 'Wavve',
    category: 'VIDEO' as const,
    website_url: 'https://www.wavve.com',
    merchant_name_patterns: ['WAVVE', '웨이브'],
    deep_link: 'https://www.wavve.com/member/mypage',
    steps: [
      { order: 1, description: 'Wavve 앱 → 마이페이지를 탭합니다.' },
      { order: 2, description: '이용권 관리 → 자동결제 해지를 선택합니다.' },
      { order: 3, description: '해지 사유 선택 후 확인합니다.' },
    ],
  },
  {
    service_name: 'Tving',
    category: 'VIDEO' as const,
    website_url: 'https://www.tving.com',
    merchant_name_patterns: ['TVING', '티빙'],
    deep_link: 'https://www.tving.com/user/my/subscription',
    steps: [
      { order: 1, description: 'Tving 앱 → MY → 이용권 관리를 탭합니다.' },
      { order: 2, description: '현재 이용권 → 해지 신청을 선택합니다.' },
      { order: 3, description: '해지 확인 버튼을 탭합니다.' },
    ],
  },
  {
    service_name: 'Coupang Play',
    category: 'VIDEO' as const,
    website_url: 'https://www.coupangplay.com',
    merchant_name_patterns: ['COUPANG PLAY', '쿠팡플레이', 'COUPANG'],
    deep_link: 'https://www.coupang.com/np/rocket-pay',
    steps: [
      { order: 1, description: '쿠팡 앱 → MY쿠팡 → 멤버십 관리를 탭합니다.' },
      { order: 2, description: '쿠팡플레이 구독 해지를 선택합니다.' },
    ],
  },
  {
    service_name: 'Naver Plus',
    category: 'SHOPPING' as const,
    website_url: 'https://www.naver.com',
    merchant_name_patterns: ['NAVER PLUS', '네이버플러스', 'NAVER'],
    deep_link: 'https://new.pay.naver.com/membership',
    steps: [
      { order: 1, description: '네이버 앱 → 네이버페이 → 멤버십을 탭합니다.' },
      { order: 2, description: '멤버십 해지 신청을 선택합니다.' },
      { order: 3, description: '해지 사유 입력 후 확인합니다.' },
    ],
  },
  {
    service_name: 'Adobe CC',
    category: 'SOFTWARE' as const,
    website_url: 'https://www.adobe.com',
    merchant_name_patterns: ['ADOBE', 'ADOBE CREATIVE CLOUD', 'ADOBE.COM'],
    deep_link: 'https://account.adobe.com/plans',
    steps: [
      { order: 1, description: 'Adobe 계정 페이지에 로그인합니다.' },
      { order: 2, description: '플랜 및 결제 → 플랜 취소를 선택합니다.' },
      { order: 3, description: '취소 이유 선택 후 플랜 취소 확인을 클릭합니다.' },
    ],
  },
  {
    service_name: 'Microsoft 365',
    category: 'SOFTWARE' as const,
    website_url: 'https://www.microsoft.com',
    merchant_name_patterns: ['MICROSOFT 365', 'MS365', 'MICROSOFT'],
    deep_link: 'https://account.microsoft.com/services',
    steps: [
      { order: 1, description: 'Microsoft 계정 → 서비스 및 구독을 방문합니다.' },
      { order: 2, description: 'Microsoft 365 → 관리 → 구독 취소를 선택합니다.' },
    ],
  },
  // 나머지 20개 서비스 (Notion, GitHub, Slack, Disney+, 기타)
  { service_name: 'Notion', category: 'SOFTWARE' as const, website_url: 'https://www.notion.so', merchant_name_patterns: ['NOTION'], deep_link: 'https://www.notion.so/my-account', steps: [{ order: 1, description: 'Notion → Settings → Billing → Cancel Plan.' }] },
  { service_name: 'GitHub', category: 'SOFTWARE' as const, website_url: 'https://github.com', merchant_name_patterns: ['GITHUB'], deep_link: 'https://github.com/settings/billing', steps: [{ order: 1, description: 'GitHub → Settings → Billing → Downgrade to Free.' }] },
  { service_name: 'Slack', category: 'SOFTWARE' as const, website_url: 'https://slack.com', merchant_name_patterns: ['SLACK'], deep_link: 'https://slack.com/account/billing', steps: [{ order: 1, description: 'Slack 관리자 메뉴 → 결제 → 플랜 변경 → 무료로 전환.' }] },
  { service_name: 'Disney+', category: 'VIDEO' as const, website_url: 'https://www.disneyplus.com', merchant_name_patterns: ['DISNEY+', 'DISNEY PLUS'], deep_link: 'https://www.disneyplus.com/account', steps: [{ order: 1, description: '계정 → 구독 세부 정보 → 구독 취소.' }] },
  { service_name: 'Apple Music', category: 'MUSIC' as const, website_url: 'https://music.apple.com', merchant_name_patterns: ['APPLE MUSIC'], deep_link: 'https://appleid.apple.com', steps: [{ order: 1, description: 'iPhone 설정 → Apple ID → 구독 → Apple Music → 구독 취소.' }] },
  { service_name: 'Melon', category: 'MUSIC' as const, website_url: 'https://www.melon.com', merchant_name_patterns: ['MELON', '멜론'], deep_link: 'https://www.melon.com/mymusic/', steps: [{ order: 1, description: '멜론 → 마이뮤직 → 이용권 → 해지 신청.' }] },
  { service_name: 'Genie Music', category: 'MUSIC' as const, website_url: 'https://www.genie.co.kr', merchant_name_patterns: ['GENIE', '지니'], deep_link: 'https://www.genie.co.kr/my/', steps: [{ order: 1, description: '지니뮤직 → MY → 이용권 관리 → 해지.' }] },
  { service_name: 'Kakao 이용권', category: 'OTHER' as const, website_url: 'https://kakao.com', merchant_name_patterns: ['KAKAO', '카카오'], deep_link: 'https://payment.kakao.com', steps: [{ order: 1, description: '카카오톡 → 설정 → 카카오페이 → 정기결제 관리 → 해지.' }] },
  { service_name: 'Naver Webtoon', category: 'OTHER' as const, website_url: 'https://comic.naver.com', merchant_name_patterns: ['NAVER WEBTOON', '네이버웹툰'], deep_link: 'https://comic.naver.com/mypage', steps: [{ order: 1, description: '네이버 웹툰 → 마이페이지 → 정기결제 → 해지.' }] },
  { service_name: 'Kakao Webtoon', category: 'OTHER' as const, website_url: 'https://webtoon.kakao.com', merchant_name_patterns: ['KAKAO WEBTOON', '카카오웹툰'], deep_link: 'https://webtoon.kakao.com/my', steps: [{ order: 1, description: '카카오웹툰 → 마이페이지 → 구독 → 해지.' }] },
  { service_name: 'Ridi Books', category: 'OTHER' as const, website_url: 'https://ridibooks.com', merchant_name_patterns: ['RIDI', '리디'], deep_link: 'https://ridibooks.com/account/subscription', steps: [{ order: 1, description: '리디 → 계정 설정 → 구독 관리 → 해지.' }] },
  { service_name: 'Millie Library', category: 'OTHER' as const, website_url: 'https://www.millie.co.kr', merchant_name_patterns: ['MILLIE', '밀리의서재'], deep_link: 'https://www.millie.co.kr/my', steps: [{ order: 1, description: '밀리의서재 → MY → 구독 관리 → 해지.' }] },
  { service_name: 'Welaaa', category: 'FITNESS' as const, website_url: 'https://www.welaaa.com', merchant_name_patterns: ['WELAAA', '웰라'], deep_link: 'https://www.welaaa.com/my', steps: [{ order: 1, description: '웰라 앱 → MY → 구독 → 해지 신청.' }] },
  { service_name: 'Class101', category: 'EDUCATION' as const, website_url: 'https://class101.net', merchant_name_patterns: ['CLASS101', '클래스101'], deep_link: 'https://class101.net/my', steps: [{ order: 1, description: 'Class101 → 마이페이지 → 구독 → 구독 취소.' }] },
  { service_name: 'Colosseum', category: 'FITNESS' as const, website_url: 'https://www.colosseum.app', merchant_name_patterns: ['COLOSSEUM', '콜로세움'], deep_link: 'https://www.colosseum.app/account', steps: [{ order: 1, description: '앱 → 계정 설정 → 구독 취소.' }] },
  { service_name: 'Dropbox', category: 'CLOUD' as const, website_url: 'https://www.dropbox.com', merchant_name_patterns: ['DROPBOX'], deep_link: 'https://www.dropbox.com/account/plan', steps: [{ order: 1, description: 'Dropbox → 계정 설정 → 플랜 → 다운그레이드.' }] },
  { service_name: 'iCloud', category: 'CLOUD' as const, website_url: 'https://www.apple.com/icloud', merchant_name_patterns: ['ICLOUD', 'APPLE ICLOUD'], deep_link: 'https://appleid.apple.com', steps: [{ order: 1, description: 'iPhone 설정 → [이름] → iCloud → 저장 공간 관리 → 플랜 변경.' }] },
  { service_name: 'Google One', category: 'CLOUD' as const, website_url: 'https://one.google.com', merchant_name_patterns: ['GOOGLE ONE', 'GOOGLE STORAGE'], deep_link: 'https://one.google.com/storage', steps: [{ order: 1, description: 'Google One 앱 → 지원 → 멤버십 취소.' }] },
  { service_name: 'Nintendo Switch Online', category: 'GAME' as const, website_url: 'https://www.nintendo.com', merchant_name_patterns: ['NINTENDO', '닌텐도'], deep_link: 'https://accounts.nintendo.com', steps: [{ order: 1, description: 'Nintendo 계정 → Nintendo Switch Online → 자동 갱신 끄기.' }] },
  { service_name: 'Xbox Game Pass', category: 'GAME' as const, website_url: 'https://www.xbox.com', merchant_name_patterns: ['XBOX', 'GAME PASS', 'MICROSOFT XBOX'], deep_link: 'https://account.microsoft.com/services', steps: [{ order: 1, description: 'Microsoft 계정 → 서비스 및 구독 → Game Pass → 취소.' }] },
];

async function main(): Promise<void> {
  console.log('구독 서비스 카탈로그 및 해지 가이드 시딩 시작...');

  for (const item of CATALOG_SEED) {
    const catalog = await prisma.subscriptionCatalog.upsert({
      where: { service_name: item.service_name },
      update: {
        merchant_name_patterns: item.merchant_name_patterns,
        website_url: item.website_url,
      },
      create: {
        service_name: item.service_name,
        category: item.category,
        website_url: item.website_url,
        merchant_name_patterns: item.merchant_name_patterns,
      },
    });

    await prisma.cancellationGuide.upsert({
      where: { catalog_id: catalog.id },
      update: { steps: item.steps, deep_link: item.deep_link ?? null },
      create: {
        catalog_id: catalog.id,
        steps: item.steps,
        deep_link: item.deep_link ?? null,
        screenshot_urls: [],
      },
    });

    console.log(`✓ ${item.service_name}`);
  }

  console.log(`\n총 ${CATALOG_SEED.length}개 서비스 시딩 완료.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
