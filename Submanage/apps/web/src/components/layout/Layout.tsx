import { Outlet, NavLink, useNavigate } from 'react-router-dom';

import { useAuthStore } from '@/stores/auth.store';
import styles from './Layout.module.css';

const NAV_ITEMS = [
  { to: '/dashboard',               label: '대시보드',    icon: '📊' },
  { to: '/cards/link',              label: '카드 연동',   icon: '💳' },
  { to: '/reports',                 label: '지출 리포트', icon: '📈' },
  { to: '/notifications/settings',  label: '알림 설정',   icon: '🔔' },
];

export default function Layout() {
  const logout = useAuthStore((s) => s.logout);
  const email  = useAuthStore((s) => s.email);
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <span className={styles.logoMark}>S</span>
          <span className={styles.logoText}>SubTrack</span>
        </div>

        <nav className={styles.nav}>
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `${styles.navItem} ${isActive ? styles.active : ''}`
              }
            >
              <span className={styles.navIcon}>{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className={styles.userArea}>
          <p className={styles.userEmail}>{email}</p>
          <button className={styles.logoutBtn} onClick={handleLogout}>
            로그아웃
          </button>
        </div>
      </aside>

      <main className={styles.content}>
        <Outlet />
      </main>
    </div>
  );
}
