import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

import apiClient from '@/lib/apiClient';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import styles from './CancelGuidePage.module.css';

interface CancellationStep { order: number; description: string; imageUrl?: string; }
interface Guide {
  id: string;
  steps: CancellationStep[];
  deep_link?: string;
  screenshot_urls: string[];
  catalog: { service_name: string };
}

export default function CancelGuidePage() {
  const { id } = useParams<{ id: string }>();
  const [guide, setGuide]   = useState<Guide | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    if (!id) return;
    void apiClient
      .get<{ success: boolean; data: Guide }>(`/subscriptions/${id}/cancel-guide`)
      .then(({ data }) => { if (data.success) setGuide(data.data); })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className={styles.loading}>불러오는 중…</div>;

  if (!guide)
    return (
      <div className={styles.noGuide}>
        <p className={styles.noGuideIcon}>🔍</p>
        <p>해지 가이드가 준비 중입니다.</p>
        <Button variant="ghost" onClick={() => navigate(-1)}>돌아가기</Button>
      </div>
    );

  return (
    <div className={styles.page}>
      <button className={styles.backBtn} onClick={() => navigate(-1)}>← 뒤로</button>

      <div className={styles.header}>
        <h2 className={styles.title}>{guide.catalog?.service_name} 해지 안내</h2>
        <p className={styles.notice}>
          ⚠️ SubTrack은 해지 <strong>안내</strong>만 제공합니다. 실제 해지는 해당 서비스에서 직접 진행해주세요.
        </p>
      </div>

      {/* 단계별 가이드 */}
      <div className={styles.steps}>
        {guide.steps.map((step) => (
          <Card key={step.order} className={styles.stepCard}>
            <div className={styles.stepNum}>{step.order}</div>
            <p className={styles.stepDesc}>{step.description}</p>
            {step.imageUrl && (
              <img src={step.imageUrl} alt={`단계 ${step.order}`} className={styles.stepImg} />
            )}
          </Card>
        ))}
      </div>

      {/* 딥링크 버튼 (자동 해지 아님, 해당 서비스 앱/웹으로 이동) */}
      {guide.deep_link && (
        <Card className={styles.deepLinkCard}>
          <p className={styles.deepLinkTitle}>🔗 직접 해지 페이지로 이동</p>
          <p className={styles.deepLinkDesc}>해당 서비스의 해지 페이지로 연결됩니다.</p>
          <Button
            onClick={() => window.open(guide.deep_link!, '_blank', 'noopener,noreferrer')}
            fullWidth
          >
            해지 페이지 열기
          </Button>
        </Card>
      )}
    </div>
  );
}
