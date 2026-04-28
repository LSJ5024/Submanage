import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

import { useAuthStore } from '@/stores/auth.store';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import styles from './Auth.module.css';

export default function RegisterPage() {
  const [name, setName]         = useState('');
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm]   = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const register = useAuthStore((s) => s.register);
  const navigate  = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirm) {
      setError('비밀번호가 일치하지 않습니다.');
      return;
    }
    if (password.length < 8) {
      setError('비밀번호는 8자 이상이어야 합니다.');
      return;
    }

    setLoading(true);
    try {
      await register(email, password, name);
      navigate('/login', { state: { registered: true } });
    } catch {
      setError('회원가입에 실패했습니다. 이미 사용 중인 이메일일 수 있습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.box}>
        <div className={styles.header}>
          <span className={styles.logoMark}>S</span>
          <h1 className={styles.title}>회원가입</h1>
          <p className={styles.subtitle}>SubTrack과 함께 구독을 관리하세요</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <Input
            id="name"
            label="이름"
            type="text"
            placeholder="홍길동"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
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
            placeholder="8자 이상"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
          />
          <Input
            id="confirm"
            label="비밀번호 확인"
            type="password"
            placeholder="비밀번호를 다시 입력하세요"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            error={confirm && password !== confirm ? '비밀번호가 일치하지 않습니다.' : ''}
          />

          {error && <p className={styles.errorMsg}>{error}</p>}

          <Button type="submit" fullWidth loading={loading} size="lg">
            회원가입
          </Button>
        </form>

        <p className={styles.footer}>
          이미 계정이 있으신가요?{' '}
          <Link to="/login" className={styles.link}>로그인</Link>
        </p>
      </div>
    </div>
  );
}
