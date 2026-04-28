import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import type { Subscription } from '@subtrack/shared';
import apiClient from '@/lib/apiClient';
import { useSubscriptionStore } from '@/stores/subscription.store';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import styles from './SubscriptionDetailPage.module.css';

const STATUS_LABELS: Record<string, string> = {
  DETECTED: '탐지됨', ACTIVE: '활성', PAUSED: '일시중지',
  CANCELLING: '해지 중', CANCELLED: '해지됨',
};

const VALID_NEXT: Record<string, string[]> = {
  DETECTED:   ['ACTIVE'],
  ACTIVE:     ['CANCELLING', 'PAUSED'],
  PAUSED:     ['ACTIVE'],
  CANCELLING: ['CANCELLED', 'ACTIVE'],
  CANCELLED:  [],
};

const NEXT_LABEL: Record<string, string> = {
  ACTIVE: '활성으로 변경', PAUSED: '일시중지', CANCELLING: '해지 진행', CANCELLED: '해지 완료 처리',
};

export default function SubscriptionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [sub, setSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusLoading, setStatusLoading] = useState(false);

  const { updateStatus, remove } = useSubscriptionStore();
  const navigate = useNavigate();

  useEffect(() => {
    if (!id) return;
    void apiClient
      .get<{ success: boolean; data: Subscription }>(`/subscriptions/${id}`)
      .then(({ data }) => { if (data.success) setSub(data.data); })
      .finally(() => setLoading(false));
  }, [id]);

  const handleStatusChange = async (nextStatus: string) => {
    if (!id || !sub) return;
    setStatusLoading(true);
    try {
      await updateStatus(id, nextStatus);
      setSub((prev) => prev ? { ...prev, status: nextStatus as Subscription['status'] } : prev);
    } finally {
      setStatusLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!id || !confirm('구독을 삭제하시겠습니까?')) return;
    await remove(id);
    navigate('/dashboard');
  };

  if (loading) return <div className={styles.loading}>불러오는 중…</div>;
  if (!sub)    return <div className={styles.loading}>구독을 찾을 수 없습니다.</div>;

  const nextStatuses = VALID_NEXT[sub.status] ?? [];

  return (
    <div className={styles.page}>
      <button className={styles.backBtn} onClick={() => navigate(-1)}>← 뒤로</button>

      <Card className={styles.mainCard}>
        <div className={styles.topRow}>
          <div>
            <h2 className={styles.serviceName}>{sub.serviceName}</h2>
            <p className={styles.category}>{sub.category}</p>
          </div>
          <span className={`${styles.statusBadge} ${styles[sub.status.toLowerCase()]}`}>
            {STATUS_LABELS[sub.status]}
          </span>
        </div>

        <div className={styles.infoGrid}>
          <div className={styles.infoItem}>
            <p className={styles.infoLabel}>월 금액</p>
            <p className={styles.infoValue}>{Number(sub.amount).toLocaleString()}원</p>
          </div>
          <div className={styles.infoItem}>
            <p className={styles.infoLabel}>결제 주기</p>
            <p className={styles.infoValue}>{sub.billingCycle}</p>
          </div>
          <div className={styles.infoItem}>
            <p className={styles.infoLabel}>다음 결제일</p>
            <p className={styles.infoValue}>
              {new Date(sub.nextBillingDate).toLocaleDateString('ko-KR')}
            </p>
          </div>
          <div className={styles.infoItem}>
            <p className={styles.infoLabel}>탐지 방식</p>
            <p className={styles.infoValue}>{sub.autoDetected ? '자동 탐지' : '수동 등록'}</p>
          </div>
        </div>

        {/* 상태 변경 버튼 */}
        {nextStatuses.length > 0 && (
          <div className={styles.actions}>
            {nextStatuses.map((ns) => (
              <Button
                key={ns}
                variant={ns === 'CANCELLING' ? 'danger' : 'secondary'}
                loading={statusLoading}
                onClick={() => handleStatusChange(ns)}
              >
                {NEXT_LABEL[ns] ?? ns}
              </Button>
            ))}
          </div>
        )}
      </Card>

      {/* 해지 안내 버튼 (CLAUDE.md §8 — 자동 해지 금지, 안내만 제공) */}
      {['ACTIVE', 'CANCELLING'].includes(sub.status) && (
        <Card className={styles.guideCard}>
          <div className={styles.guideInfo}>
            <p className={styles.guideTitle}>🔍 해지 안내</p>
            <p className={styles.guideDesc}>단계별 해지 방법을 안내해 드립니다.</p>
          </div>
          <Button onClick={() => navigate(`/subscriptions/${id}/cancel-guide`)}>
            해지 안내 보기
          </Button>
        </Card>
      )}

      <button className={styles.deleteBtn} onClick={handleDelete}>구독 삭제</button>
    </div>
  );
}
