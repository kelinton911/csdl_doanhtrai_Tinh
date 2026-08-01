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
import { StoragePage } from './pages/StoragePage';
import { ApprovalQueuePage } from './pages/ApprovalQueuePage';
import { MaterialsPage } from './pages/MaterialsPage';
import { MaterialGroupsPage } from './pages/MaterialGroupsPage';
import { AssetCatalogPage } from './pages/AssetCatalogPage';
import { ImportPage } from './pages/ImportPage';
import { InspectionPage } from './pages/InspectionPage';
import { InspectionWizardPage } from './pages/InspectionWizardPage';
import { MaintenancePage } from './pages/MaintenancePage';
import { ScenarioPage } from './pages/ScenarioPage';
import { AlertsPage } from './pages/AlertsPage';
import { ReportsPage } from './pages/ReportsPage';
import { PotentialPage } from './pages/PotentialPage';
import { LandParcelsListPage } from './pages/LandParcelsListPage';
import { LandParcelFormPage } from './pages/LandParcelFormPage';
import { LandParcelDetailPage } from './pages/LandParcelDetailPage';
import { UtilitiesListPage } from './pages/UtilitiesListPage';
import { UtilityFormPage } from './pages/UtilityFormPage';
import { UtilityDetailPage } from './pages/UtilityDetailPage';
import { LocalResourcesListPage } from './pages/LocalResourcesListPage';
import { LocalResourceFormPage } from './pages/LocalResourceFormPage';
import { LocalResourceDetailPage } from './pages/LocalResourceDetailPage';
import { ProjectsListPage } from './pages/ProjectsListPage';
import { ProjectFormPage } from './pages/ProjectFormPage';
import { ProjectDetailPage } from './pages/ProjectDetailPage';
import { CommuneReadinessPage } from './pages/CommuneReadinessPage';
import { FieldSurveyPage } from './pages/FieldSurveyPage';
import { ScanPage } from './pages/ScanPage';
import { AdminPage } from './pages/AdminPage';

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
      <Route path="/barracks/:id/edit" element={<Protected><BarracksFormPage /></Protected>} />
      <Route path="/barracks/:id" element={<Protected><BarracksDetailPage /></Protected>} />
      <Route path="/land-parcels" element={<Protected><LandParcelsListPage /></Protected>} />
      <Route path="/land-parcels/new" element={<Protected><LandParcelFormPage /></Protected>} />
      <Route path="/land-parcels/:id/edit" element={<Protected><LandParcelFormPage /></Protected>} />
      <Route path="/land-parcels/:id" element={<Protected><LandParcelDetailPage /></Protected>} />
      <Route path="/utilities" element={<Protected><UtilitiesListPage /></Protected>} />
      <Route path="/utilities/new" element={<Protected><UtilityFormPage /></Protected>} />
      <Route path="/utilities/:id/edit" element={<Protected><UtilityFormPage /></Protected>} />
      <Route path="/utilities/:id" element={<Protected><UtilityDetailPage /></Protected>} />
      <Route path="/local-resources" element={<Protected><LocalResourcesListPage /></Protected>} />
      <Route path="/local-resources/new" element={<Protected><LocalResourceFormPage /></Protected>} />
      <Route path="/local-resources/:id/edit" element={<Protected><LocalResourceFormPage /></Protected>} />
      <Route path="/local-resources/:id" element={<Protected><LocalResourceDetailPage /></Protected>} />
      <Route path="/projects" element={<Protected><ProjectsListPage /></Protected>} />
      <Route path="/projects/new" element={<Protected><ProjectFormPage /></Protected>} />
      <Route path="/projects/:id/edit" element={<Protected><ProjectFormPage /></Protected>} />
      <Route path="/projects/:id" element={<Protected><ProjectDetailPage /></Protected>} />
      <Route path="/inventory" element={<Protected><InventoryPage /></Protected>} />
      <Route path="/storage" element={<Protected><StoragePage /></Protected>} />
      <Route path="/approvals" element={<Protected><ApprovalQueuePage /></Protected>} />
      <Route path="/materials" element={<Protected><MaterialsPage /></Protected>} />
      <Route path="/material-groups" element={<Protected><MaterialGroupsPage /></Protected>} />
      <Route path="/asset-catalog" element={<Protected><AssetCatalogPage /></Protected>} />
      <Route path="/import" element={<Protected><ImportPage /></Protected>} />
      <Route path="/inspection" element={<Protected><InspectionPage /></Protected>} />
      <Route path="/inspection/sheet/:id" element={<Protected><InspectionWizardPage /></Protected>} />
      <Route path="/field" element={<Protected><FieldSurveyPage /></Protected>} />
      <Route path="/scan" element={<Protected><ScanPage /></Protected>} />
      <Route path="/scan/:type/:code" element={<Protected><ScanPage /></Protected>} />
      <Route path="/commune-readiness" element={<Protected><CommuneReadinessPage /></Protected>} />
      <Route path="/maintenance" element={<Protected><MaintenancePage /></Protected>} />
      <Route path="/scenarios" element={<Protected><ScenarioPage /></Protected>} />
      <Route path="/potential" element={<Protected><PotentialPage /></Protected>} />
      <Route path="/reports" element={<Protected><ReportsPage /></Protected>} />
      <Route path="/alerts" element={<Protected><AlertsPage /></Protected>} />
      <Route path="/admin" element={<Protected><AdminPage /></Protected>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
