import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuthStore } from '@/stores/auth.store';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import styles from './Auth.module.css';

export default function LoginPage() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const login    = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch {
      setError('이메일 또는 비밀번호가 올바르지 않습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.box}>
        <div className={styles.header}>
          <span className={styles.logoMark}>S</span>
          <h1 className={styles.title}>SubTrack</h1>
          <p className={styles.subtitle}>내 구독, 한눈에. 쉽게 관리.</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <Input
            id="email"
            label="이메일"
            type="email"
            placeholder="example@email.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <Input
            id="password"
            label="비밀번호"
            type="password"
            placeholder="비밀번호를 입력하세요"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />

          {error && <p className={styles.errorMsg}>{error}</p>}

          <Button type="submit" fullWidth loading={loading} size="lg">
            로그인
          </Button>
        </form>

        <p className={styles.footer}>
          계정이 없으신가요?{' '}
          <Link to="/register" className={styles.link}>회원가입</Link>
        </p>
      </div>
    </div>
  );
}
