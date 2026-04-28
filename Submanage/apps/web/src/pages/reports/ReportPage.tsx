import { useEffect, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

import apiClient from '@/lib/apiClient';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import styles from './ReportPage.module.css';

interface MonthlyReport {
  year: number;
  month: number;
  totalAmount: number;
  subscriptionCount: number;
  categoryBreakdown: Record<string, number>;
  subscriptions: { id: string; serviceName: string; amount: number; category: string; status: string }[];
}

const CATEGORY_LABELS: Record<string, string> = {
  VIDEO: '동영상', MUSIC: '음악', SOFTWARE: '소프트웨어',
  CLOUD: '클라우드', GAME: '게임', NEWS: '뉴스',
  SHOPPING: '쇼핑', FITNESS: '피트니스', EDUCATION: '교육', OTHER: '기타',
};
const CHART_COLORS = ['#5B67F8','#22C55E','#F59E0B','#EF4444','#8B5CF6','#06B6D4','#EC4899','#14B8A6','#F97316','#6B7280'];

export default function ReportPage() {
  const now = new Date();
  const [year, setYear]   = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    void apiClient
      .get<{ success: boolean; data: MonthlyReport }>(`/dashboard/reports/monthly?year=${year}&month=${month}`)
      .then(({ data }) => { if (data.success) setReport(data.data); })
      .finally(() => setLoading(false));
  }, [year, month]);

  const prevMonth = () => { if (month === 1) { setMonth(12); setYear(y => y - 1); } else setMonth(m => m - 1); };
  const nextMonth = () => {
    const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;
    if (isCurrentMonth) return;
    if (month === 12) { setMonth(1); setYear(y => y + 1); } else setMonth(m => m + 1);
  };

  const pieData = Object.entries(report?.categoryBreakdown ?? {})
    .filter(([, v]) => v > 0)
    .map(([k, v]) => ({ name: CATEGORY_LABELS[k] ?? k, value: v }));

  const barData = report?.subscriptions
    .slice(0, 8)
    .sort((a, b) => b.amount - a.amount)
    .map((s) => ({ name: s.serviceName.length > 8 ? s.serviceName.slice(0, 8) + '…' : s.serviceName, amount: s.amount }))
    ?? [];

  return (
    <div className={styles.page}>
      {/* 월 네비게이션 */}
      <div className={styles.monthNav}>
        <Button variant="ghost" size="sm" onClick={prevMonth}>‹ 이전달</Button>
        <h2 className={styles.monthLabel}>{year}년 {month}월</h2>
        <Button
          variant="ghost" size="sm"
          onClick={nextMonth}
          disabled={year === now.getFullYear() && month === now.getMonth() + 1}
        >
          다음달 ›
        </Button>
      </div>

      {loading ? (
        <p className={styles.loading}>불러오는 중…</p>
      ) : (
        <>
          {/* 요약 카드 */}
          <div className={styles.summaryRow}>
            <Card className={styles.summaryCard}>
              <p className={styles.summaryLabel}>총 지출</p>
              <p className={styles.summaryAmount}>{(report?.totalAmount ?? 0).toLocaleString()}원</p>
            </Card>
            <Card className={styles.summaryCard}>
              <p className={styles.summaryLabel}>구독 수</p>
              <p className={styles.summaryAmount}>{report?.subscriptionCount ?? 0}개</p>
            </Card>
          </div>

          {/* 차트 행 */}
          <div className={styles.chartRow}>
            <Card className={styles.chartCard}>
              <p className={styles.chartTitle}>서비스별 지출</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={barData} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} tickFormatter={(v: number) => `${(v/1000).toFixed(0)}K`} />
                  <Tooltip formatter={(v: number) => `${v.toLocaleString()}원`} />
                  <Bar dataKey="amount" fill="var(--color-primary)" radius={[4,4,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card className={styles.chartCard}>
              <p className={styles.chartTitle}>카테고리별 비중</p>
              {pieData.length === 0 ? (
                <div className={styles.emptyChart}>데이터 없음</div>
              ) : (
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={pieData} cx="50%" cy="50%" outerRadius={75} dataKey="value">
                      {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip formatter={(v: number) => `${v.toLocaleString()}원`} />
                    <Legend iconSize={10} />
                  </PieChart>
                </ResponsiveContainer>
              )}
            </Card>
          </div>

          {/* 구독 목록 */}
          <Card>
            <p className={styles.chartTitle}>구독 상세 목록</p>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>서비스명</th><th>카테고리</th><th>상태</th><th>금액</th>
                </tr>
              </thead>
              <tbody>
                {(report?.subscriptions ?? []).map((s) => (
                  <tr key={s.id}>
                    <td>{s.serviceName}</td>
                    <td>{CATEGORY_LABELS[s.category] ?? s.category}</td>
                    <td><span className={`${styles.badge} ${styles[s.status.toLowerCase()]}`}>{s.status}</span></td>
                    <td className={styles.amountCell}>{s.amount.toLocaleString()}원</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        </>
      )}
    </div>
  );
}
