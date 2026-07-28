import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { AppShell } from './components/AppShell';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { MapPage } from './pages/MapPage';
import { BarracksListPage } from './pages/BarracksListPage';
import { BarracksFormPage } from './pages/BarracksFormPage';
import { BarracksDetailPage } from './pages/BarracksDetailPage';
import { InventoryPage } from './pages/InventoryPage';
import { InspectionPage } from './pages/InspectionPage';
import { InspectionWizardPage } from './pages/InspectionWizardPage';
import { MaintenancePage } from './pages/MaintenancePage';
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
      <Route path="/map" element={<Protected><MapPage /></Protected>} />
      <Route path="/barracks" element={<Protected><BarracksListPage /></Protected>} />
      <Route path="/barracks/new" element={<Protected><BarracksFormPage /></Protected>} />
      <Route path="/barracks/:id" element={<Protected><BarracksDetailPage /></Protected>} />
      <Route path="/inventory" element={<Protected><InventoryPage /></Protected>} />
      <Route path="/inspection" element={<Protected><InspectionPage /></Protected>} />
      <Route path="/inspection/sheet/:id" element={<Protected><InspectionWizardPage /></Protected>} />
      <Route path="/maintenance" element={<Protected><MaintenancePage /></Protected>} />
      <Route path="/scenarios" element={<Protected><Placeholder title="Kế hoạch và tình huống" phase="Pha G" /></Protected>} />
      <Route path="/reports" element={<Protected><Placeholder title="Báo cáo - phân tích" phase="Pha H" /></Protected>} />
      <Route path="/admin" element={<Protected><Placeholder title="Quản trị hệ thống" phase="Pha H" /></Protected>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
