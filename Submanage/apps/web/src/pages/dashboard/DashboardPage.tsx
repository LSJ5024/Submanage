import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from 'recharts';

import apiClient from '@/lib/apiClient';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { useSubscriptionStore } from '@/stores/subscription.store';
import styles from './DashboardPage.module.css';

interface DashboardData {
  totalMonthlyAmount: number;
  upcomingBillings: { id: string; serviceName: string; amount: number; nextBillingDate: string; daysLeft: number }[];
  categoryBreakdown: { category: string; total: number; count: number }[];
}

const CATEGORY_LABELS: Record<string, string> = {
  VIDEO: '동영상', MUSIC: '음악', SOFTWARE: '소프트웨어',
  CLOUD: '클라우드', GAME: '게임', NEWS: '뉴스',
  SHOPPING: '쇼핑', FITNESS: '피트니스', EDUCATION: '교육', OTHER: '기타',
};

const CHART_COLORS = ['#5B67F8','#22C55E','#F59E0B','#EF4444','#8B5CF6','#06B6D4','#EC4899','#14B8A6','#F97316','#6B7280'];

export default function DashboardPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [sort, setSort]           = useState('billing_date');
  const [loading, setLoading]     = useState(true);

  const { items, fetchList, isLoading: subLoading } = useSubscriptionStore();
  const navigate = useNavigate();

  useEffect(() => {
    void (async () => {
      try {
        const { data } = await apiClient.get<{ success: boolean; data: DashboardData }>('/dashboard');
        if (data.success) setDashboard(data.data);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    useSubscriptionStore.getState().reset();
    void fetchList(undefined, sort);
  }, [sort, fetchList]);

  const pieData = (dashboard?.categoryBreakdown ?? [])
    .filter((c) => c.total > 0)
    .map((c) => ({ name: CATEGORY_LABELS[c.category] ?? c.category, value: c.total }));

  return (
    <div className={styles.page}>
      <h2 className={styles.pageTitle}>대시보드</h2>

      {/* 상단 요약 카드 */}
      <div className={styles.summaryRow}>
        <Card className={styles.totalCard}>
          <p className={styles.cardLabel}>이번 달 구독 총액</p>
          <p className={styles.totalAmount}>
            {loading ? '—' : `${(dashboard?.totalMonthlyAmount ?? 0).toLocaleString()}원`}
          </p>
          <p className={styles.cardSub}>활성 구독 기준</p>
        </Card>

        <Card className={styles.upcomingCard}>
          <p className={styles.cardLabel}>임박 결제 ({dashboard?.upcomingBillings.length ?? 0}건)</p>
          <div className={styles.upcomingList}>
            {dashboard?.upcomingBillings.length === 0 && (
              <p className={styles.emptyText}>7일 내 결제 예정이 없습니다</p>
            )}
            {dashboard?.upcomingBillings.slice(0, 3).map((bill) => (
              <div key={bill.id} className={styles.upcomingItem}>
                <span className={`${styles.dBadge} ${bill.daysLeft <= 3 ? styles.urgent : ''}`}>
                  D-{bill.daysLeft}
                </span>
                <span className={styles.upcomingName}>{bill.serviceName}</span>
                <span className={styles.upcomingAmount}>{bill.amount.toLocaleString()}원</span>
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* 중단: 카테고리 도넛 차트 + 구독 리스트 */}
      <div className={styles.mainRow}>
        <Card className={styles.chartCard}>
          <p className={styles.cardLabel}>카테고리별 지출</p>
          {pieData.length === 0 ? (
            <div className={styles.emptyChart}>
              <p>🔍</p>
              <p>구독 데이터가 없습니다</p>
              <Button variant="ghost" size="sm" onClick={() => navigate('/cards/link')}>
                카드 연동하기
              </Button>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={3} dataKey="value">
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => `${v.toLocaleString()}원`} />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>

        <div className={styles.subListWrap}>
          <div className={styles.subListHeader}>
            <p className={styles.cardLabel}>구독 목록</p>
            <div className={styles.sortGroup}>
              {[
                { value: 'billing_date', label: '결제 임박순' },
                { value: 'amount',       label: '금액순' },
                { value: 'category',     label: '카테고리' },
              ].map((s) => (
                <button
                  key={s.value}
                  className={`${styles.sortBtn} ${sort === s.value ? styles.sortActive : ''}`}
                  onClick={() => setSort(s.value)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {subLoading && <p className={styles.loadingText}>불러오는 중…</p>}

          {!subLoading && items.length === 0 && (
            <Card className={styles.emptyCard}>
              <p className={styles.emptyIcon}>📭</p>
              <p className={styles.emptyTitle}>탐지된 구독이 없습니다</p>
              <p className={styles.emptyDesc}>카드를 연동하면 구독이 자동으로 탐지됩니다.</p>
              <Button onClick={() => navigate('/cards/link')} size="sm">카드 연동하기</Button>
            </Card>
          )}

          <div className={styles.subList}>
            {items.map((sub) => (
              <Card
                key={sub.id}
                className={styles.subItem}
                onClick={() => navigate(`/subscriptions/${sub.id}`)}
              >
                <div className={styles.subInfo}>
                  <p className={styles.subName}>{sub.serviceName}</p>
                  <p className={styles.subMeta}>
                    {CATEGORY_LABELS[sub.category]} · {sub.billingCycle === 'MONTHLY' ? '월간' : sub.billingCycle}
                  </p>
                </div>
                <div className={styles.subRight}>
                  <p className={styles.subAmount}>{Number(sub.amount).toLocaleString()}원</p>
                  <span className={`${styles.statusBadge} ${styles[sub.status.toLowerCase()]}`}>
                    {sub.status === 'ACTIVE' ? '활성' : sub.status === 'PAUSED' ? '일시중지' : sub.status === 'CANCELLING' ? '해지중' : sub.status === 'CANCELLED' ? '해지' : '탐지'}
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
