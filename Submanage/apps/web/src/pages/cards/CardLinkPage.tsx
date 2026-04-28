import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import apiClient from '@/lib/apiClient';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import styles from './CardLinkPage.module.css';

// 국내 7대 카드사 (CLAUDE.md §8 — 해외 카드사 연동 금지)
const CARD_COMPANIES = [
  { id: 'SHINHAN', name: '신한카드',  color: '#0066CC', emoji: '🔵' },
  { id: 'KB',      name: 'KB국민카드', color: '#FFBC00', emoji: '🟡' },
  { id: 'HYUNDAI', name: '현대카드',  color: '#1A1A1A', emoji: '⚫' },
  { id: 'SAMSUNG', name: '삼성카드',  color: '#1428A0', emoji: '🔷' },
  { id: 'LOTTE',   name: '롯데카드',  color: '#E60012', emoji: '🔴' },
  { id: 'WOORI',   name: '우리카드',  color: '#007AFF', emoji: '💙' },
  { id: 'HANA',    name: '하나카드',  color: '#00A650', emoji: '🟢' },
] as const;

type CardCompanyId = (typeof CARD_COMPANIES)[number]['id'];

type Step = 'select' | 'auth' | 'done';

export default function CardLinkPage() {
  const [step, setStep]           = useState<Step>('select');
  const [selected, setSelected]   = useState<CardCompanyId | null>(null);
  const [authCode, setAuthCode]   = useState('');
  const [loading, setLoading]     = useState(false);
  const [error, setError]         = useState('');
  const navigate = useNavigate();

  const handleSelect = (id: CardCompanyId) => {
    setSelected(id);
    setStep('auth');
  };

  const handleLink = async () => {
    if (!selected || !authCode) return;
    setLoading(true);
    setError('');
    try {
      await apiClient.post('/cards/link', { cardCompany: selected, authCode });
      setStep('done');
    } catch {
      setError('카드 연동에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setLoading(false);
    }
  };

  const selectedInfo = CARD_COMPANIES.find((c) => c.id === selected);

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <h2 className={styles.title}>카드 연동</h2>
        <p className={styles.subtitle}>마이데이터를 통해 카드를 연동하면 구독이 자동으로 탐지됩니다.</p>
      </header>

      {/* Step 1 — 카드사 선택 */}
      {step === 'select' && (
        <div className={styles.grid}>
          {CARD_COMPANIES.map((company) => (
            <Card
              key={company.id}
              className={styles.companyCard}
              onClick={() => handleSelect(company.id)}
            >
              <span className={styles.companyEmoji}>{company.emoji}</span>
              <span className={styles.companyName}>{company.name}</span>
            </Card>
          ))}
        </div>
      )}

      {/* Step 2 — 마이데이터 인증 */}
      {step === 'auth' && selectedInfo && (
        <Card className={styles.authCard}>
          <div className={styles.authHeader}>
            <span className={styles.companyEmoji}>{selectedInfo.emoji}</span>
            <h3>{selectedInfo.name} 연동</h3>
          </div>

          <div className={styles.notice}>
            <p>🔒 마이데이터 표준 OAuth 2.0으로 안전하게 인증합니다.</p>
            <p>카드 정보는 암호화되어 저장되며, 실제 결제 기능은 제공하지 않습니다.</p>
          </div>

          {/* 실제 환경에서는 마이데이터 OAuth 웹뷰로 대체 */}
          <div className={styles.authForm}>
            <label className={styles.authLabel}>인가 코드 입력</label>
            <input
              className={styles.authInput}
              type="text"
              placeholder="마이데이터 인가 코드를 입력하세요"
              value={authCode}
              onChange={(e) => setAuthCode(e.target.value)}
            />
            <p className={styles.authHint}>
              실제 서비스에서는 카드사 공식 페이지로 이동해 인증 후 자동으로 코드가 입력됩니다.
            </p>
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <div className={styles.authActions}>
            <Button variant="secondary" onClick={() => setStep('select')}>이전</Button>
            <Button onClick={handleLink} loading={loading} disabled={!authCode}>
              연동하기
            </Button>
          </div>
        </Card>
      )}

      {/* Step 3 — 완료 */}
      {step === 'done' && (
        <Card className={styles.doneCard}>
          <div className={styles.doneIcon}>✅</div>
          <h3 className={styles.doneTitle}>카드 연동 완료!</h3>
          <p className={styles.doneDesc}>
            {selectedInfo?.name} 연동이 완료되었습니다.<br />
            12개월치 결제 내역을 분석해 구독을 탐지하고 있습니다.
          </p>
          <Button onClick={() => navigate('/dashboard')} fullWidth size="lg">
            대시보드로 이동
          </Button>
        </Card>
      )}
    </div>
  );
}
