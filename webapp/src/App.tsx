import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { AppShell } from './components/AppShell';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { Placeholder } from './pages/Placeholder';

function Protected({ children }: { children: React.ReactNode }) {
  const { profile, ready } = useAuth();
  if (!ready) {
    return (
      <div style={{ height: '100vh', display: 'grid', placeItems: 'center', color: 'var(--color-neutral-600)' }}>
        Đang khôi phục phiên…
      </div>
    );
  }
  if (!profile) return <Navigate to="/login" replace />;
  return <AppShell>{children}</AppShell>;
}

export default function App() {
  const { profile, ready } = useAuth();
  return (
    <Routes>
      <Route
        path="/login"
        element={ready && profile ? <Navigate to="/dashboard" replace /> : <LoginPage />}
      />
      <Route path="/dashboard" element={<Protected><DashboardPage /></Protected>} />
      <Route path="/map" element={<Protected><Placeholder title="Bản đồ doanh trại" phase="Pha B" /></Protected>} />
      <Route path="/barracks" element={<Protected><Placeholder title="Doanh trại và công trình" phase="Pha B" /></Protected>} />
      <Route path="/inventory" element={<Protected><Placeholder title="Vật chất và vật tư" phase="Pha C" /></Protected>} />
      <Route path="/inspection" element={<Protected><Placeholder title="Kiểm kê - biến động" phase="Pha D" /></Protected>} />
      <Route path="/maintenance" element={<Protected><Placeholder title="Sửa chữa - khôi phục" phase="Pha F" /></Protected>} />
      <Route path="/scenarios" element={<Protected><Placeholder title="Kế hoạch và tình huống" phase="Pha G" /></Protected>} />
      <Route path="/reports" element={<Protected><Placeholder title="Báo cáo - phân tích" phase="Pha H" /></Protected>} />
      <Route path="/admin" element={<Protected><Placeholder title="Quản trị hệ thống" phase="Pha H" /></Protected>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
