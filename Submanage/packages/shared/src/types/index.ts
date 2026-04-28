// ── 공용 API 응답 타입 ───────────────────────────────────────
export interface ApiResponse<T> {
  success: boolean;
  data: T | null;
  error: ApiError | null;
}

export interface ApiError {
  code: string;
  message: string;
}

// ── ENUM 타입 ────────────────────────────────────────────────
export enum SubscriptionStatus {
  DETECTED = 'DETECTED',
  ACTIVE = 'ACTIVE',
  PAUSED = 'PAUSED',
  CANCELLING = 'CANCELLING',
  CANCELLED = 'CANCELLED',
}

export enum BillingCycle {
  WEEKLY = 'WEEKLY',
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  SEMI_ANNUAL = 'SEMI_ANNUAL',
  ANNUAL = 'ANNUAL',
}

export enum SubscriptionCategory {
  VIDEO = 'VIDEO',
  MUSIC = 'MUSIC',
  SOFTWARE = 'SOFTWARE',
  CLOUD = 'CLOUD',
  GAME = 'GAME',
  NEWS = 'NEWS',
  SHOPPING = 'SHOPPING',
  FITNESS = 'FITNESS',
  EDUCATION = 'EDUCATION',
  OTHER = 'OTHER',
}

export enum NotificationChannel {
  PUSH = 'PUSH',
  EMAIL = 'EMAIL',
  SMS = 'SMS',
}

export enum CardCompany {
  SHINHAN = 'SHINHAN',
  KB = 'KB',
  HYUNDAI = 'HYUNDAI',
  SAMSUNG = 'SAMSUNG',
  LOTTE = 'LOTTE',
  WOORI = 'WOORI',
  HANA = 'HANA',
}

// ── 도메인 인터페이스 ─────────────────────────────────────────
export interface User {
  id: string;
  email: string;
  name: string;
  phoneNumber?: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface Card {
  id: string;
  userId: string;
  cardCompany: CardCompany;
  lastFourDigits: string;
  linkedAt: Date;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface Subscription {
  id: string;
  userId: string;
  serviceName: string;
  category: SubscriptionCategory;
  amount: number;
  currency: string;
  billingCycle: BillingCycle;
  nextBillingDate: Date;
  status: SubscriptionStatus;
  autoDetected: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date;
}

export interface Notification {
  id: string;
  userId: string;
  subscriptionId: string;
  channel: NotificationChannel;
  title: string;
  body: string;
  sentAt?: Date;
  failedAt?: Date;
  retryCount: number;
  createdAt: Date;
}

export interface CancellationGuide {
  id: string;
  serviceName: string;
  steps: CancellationStep[];
  deepLink?: string;
  screenshotUrls: string[];
  updatedAt: Date;
}

export interface CancellationStep {
  order: number;
  description: string;
  imageUrl?: string;
}

// ── 페이지네이션 ─────────────────────────────────────────────
export interface CursorPagination<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
}
