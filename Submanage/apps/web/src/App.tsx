import { Routes, Route, Navigate } from 'react-router-dom';

import { useAuthStore } from '@/stores/auth.store';
import LoginPage from '@/pages/auth/LoginPage';
import RegisterPage from '@/pages/auth/RegisterPage';
import DashboardPage from '@/pages/dashboard/DashboardPage';
import SubscriptionDetailPage from '@/pages/subscriptions/SubscriptionDetailPage';
import CancelGuidePage from '@/pages/subscriptions/CancelGuidePage';
import CardLinkPage from '@/pages/cards/CardLinkPage';
import NotificationSettingsPage from '@/pages/notifications/NotificationSettingsPage';
import ReportPage from '@/pages/reports/ReportPage';
import Layout from '@/components/layout/Layout';

function PrivateRoute({ children }: { children: React.ReactNode }) {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  return isLoggedIn ? <>{children}</> : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      {/* 공개 라우트 */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* 인증 필요 라우트 */}
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard" element={<DashboardPage />} />
        <Route path="subscriptions/:id" element={<SubscriptionDetailPage />} />
        <Route path="subscriptions/:id/cancel-guide" element={<CancelGuidePage />} />
        <Route path="cards/link" element={<CardLinkPage />} />
        <Route path="notifications/settings" element={<NotificationSettingsPage />} />
        <Route path="reports" element={<ReportPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
