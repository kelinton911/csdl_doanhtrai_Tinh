import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/auth';
import { AppShell } from './components/AppShell';
import { LoginPage } from './pages/LoginPage';

// Tách mã theo route (code-splitting): mỗi trang là một chunk tải khi cần → bundle chính nhỏ,
// tải nhanh. Trang dùng named export nên bọc về default cho React.lazy.
const LandingPage = lazy(() => import('./pages/LandingPage').then((m) => ({ default: m.LandingPage })));
const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })));
const MapPage = lazy(() => import('./pages/MapPage').then((m) => ({ default: m.MapPage })));
const BarracksListPage = lazy(() => import('./pages/BarracksListPage').then((m) => ({ default: m.BarracksListPage })));
const BarracksFormPage = lazy(() => import('./pages/BarracksFormPage').then((m) => ({ default: m.BarracksFormPage })));
const BarracksDetailPage = lazy(() => import('./pages/BarracksDetailPage').then((m) => ({ default: m.BarracksDetailPage })));
const InventoryPage = lazy(() => import('./pages/InventoryPage').then((m) => ({ default: m.InventoryPage })));
const CommuneMaterialsPage = lazy(() => import('./pages/CommuneMaterialsPage').then((m) => ({ default: m.CommuneMaterialsPage })));
const StoragePage = lazy(() => import('./pages/StoragePage').then((m) => ({ default: m.StoragePage })));
const ApprovalQueuePage = lazy(() => import('./pages/ApprovalQueuePage').then((m) => ({ default: m.ApprovalQueuePage })));
const MaterialsPage = lazy(() => import('./pages/MaterialsPage').then((m) => ({ default: m.MaterialsPage })));
const MaterialGroupsPage = lazy(() => import('./pages/MaterialGroupsPage').then((m) => ({ default: m.MaterialGroupsPage })));
const AssetCatalogPage = lazy(() => import('./pages/AssetCatalogPage').then((m) => ({ default: m.AssetCatalogPage })));
const ImportPage = lazy(() => import('./pages/ImportPage').then((m) => ({ default: m.ImportPage })));
const InspectionPage = lazy(() => import('./pages/InspectionPage').then((m) => ({ default: m.InspectionPage })));
const InspectionWizardPage = lazy(() => import('./pages/InspectionWizardPage').then((m) => ({ default: m.InspectionWizardPage })));
const MaintenancePage = lazy(() => import('./pages/MaintenancePage').then((m) => ({ default: m.MaintenancePage })));
const ScenarioPage = lazy(() => import('./pages/ScenarioPage').then((m) => ({ default: m.ScenarioPage })));
const AlertsPage = lazy(() => import('./pages/AlertsPage').then((m) => ({ default: m.AlertsPage })));
const ReportsPage = lazy(() => import('./pages/ReportsPage').then((m) => ({ default: m.ReportsPage })));
const PotentialPage = lazy(() => import('./pages/PotentialPage').then((m) => ({ default: m.PotentialPage })));
const LandParcelsListPage = lazy(() => import('./pages/LandParcelsListPage').then((m) => ({ default: m.LandParcelsListPage })));
const LandParcelFormPage = lazy(() => import('./pages/LandParcelFormPage').then((m) => ({ default: m.LandParcelFormPage })));
const LandParcelDetailPage = lazy(() => import('./pages/LandParcelDetailPage').then((m) => ({ default: m.LandParcelDetailPage })));
const UtilitiesListPage = lazy(() => import('./pages/UtilitiesListPage').then((m) => ({ default: m.UtilitiesListPage })));
const UtilityFormPage = lazy(() => import('./pages/UtilityFormPage').then((m) => ({ default: m.UtilityFormPage })));
const UtilityDetailPage = lazy(() => import('./pages/UtilityDetailPage').then((m) => ({ default: m.UtilityDetailPage })));
const LocalResourcesListPage = lazy(() => import('./pages/LocalResourcesListPage').then((m) => ({ default: m.LocalResourcesListPage })));
const LocalResourceFormPage = lazy(() => import('./pages/LocalResourceFormPage').then((m) => ({ default: m.LocalResourceFormPage })));
const LocalResourceDetailPage = lazy(() => import('./pages/LocalResourceDetailPage').then((m) => ({ default: m.LocalResourceDetailPage })));
const ProjectsListPage = lazy(() => import('./pages/ProjectsListPage').then((m) => ({ default: m.ProjectsListPage })));
const ProjectFormPage = lazy(() => import('./pages/ProjectFormPage').then((m) => ({ default: m.ProjectFormPage })));
const ProjectDetailPage = lazy(() => import('./pages/ProjectDetailPage').then((m) => ({ default: m.ProjectDetailPage })));
const BudgetsListPage = lazy(() => import('./pages/BudgetsListPage').then((m) => ({ default: m.BudgetsListPage })));
const BudgetFormPage = lazy(() => import('./pages/BudgetFormPage').then((m) => ({ default: m.BudgetFormPage })));
const BudgetDetailPage = lazy(() => import('./pages/BudgetDetailPage').then((m) => ({ default: m.BudgetDetailPage })));
const TasksListPage = lazy(() => import('./pages/TasksListPage').then((m) => ({ default: m.TasksListPage })));
const TaskFormPage = lazy(() => import('./pages/TaskFormPage').then((m) => ({ default: m.TaskFormPage })));
const TaskDetailPage = lazy(() => import('./pages/TaskDetailPage').then((m) => ({ default: m.TaskDetailPage })));
const InspectionsListPage = lazy(() => import('./pages/InspectionsListPage').then((m) => ({ default: m.InspectionsListPage })));
const InspectionFormPage = lazy(() => import('./pages/InspectionFormPage').then((m) => ({ default: m.InspectionFormPage })));
const InspectionDetailPage = lazy(() => import('./pages/InspectionDetailPage').then((m) => ({ default: m.InspectionDetailPage })));
const LegalDocsListPage = lazy(() => import('./pages/LegalDocsListPage').then((m) => ({ default: m.LegalDocsListPage })));
const LegalDocFormPage = lazy(() => import('./pages/LegalDocFormPage').then((m) => ({ default: m.LegalDocFormPage })));
const LegalDocDetailPage = lazy(() => import('./pages/LegalDocDetailPage').then((m) => ({ default: m.LegalDocDetailPage })));
const DeploymentSitesPage = lazy(() => import('./pages/DeploymentSitesPage').then((m) => ({ default: m.DeploymentSitesPage })));
const DeploymentSiteFormPage = lazy(() => import('./pages/DeploymentSiteFormPage').then((m) => ({ default: m.DeploymentSiteFormPage })));
const DeploymentSiteDetailPage = lazy(() => import('./pages/DeploymentSiteDetailPage').then((m) => ({ default: m.DeploymentSiteDetailPage })));
const RecoveryPage = lazy(() => import('./pages/RecoveryPage').then((m) => ({ default: m.RecoveryPage })));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })));
const CommuneReadinessPage = lazy(() => import('./pages/CommuneReadinessPage').then((m) => ({ default: m.CommuneReadinessPage })));
const FieldSurveyPage = lazy(() => import('./pages/FieldSurveyPage').then((m) => ({ default: m.FieldSurveyPage })));
const ScanPage = lazy(() => import('./pages/ScanPage').then((m) => ({ default: m.ScanPage })));
const AdminPage = lazy(() => import('./pages/AdminPage').then((m) => ({ default: m.AdminPage })));

function Centered({ text }: { text: string }) {
  return <div style={{ height: '60vh', display: 'grid', placeItems: 'center', color: 'var(--color-neutral-600)' }}>{text}</div>;
}

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
  return (
    <AppShell>
      <Suspense fallback={<Centered text="Đang tải…" />}>{children}</Suspense>
    </AppShell>
  );
}

export default function App() {
  const { profile, ready } = useAuth();
  return (
    <Routes>
      <Route path="/" element={<Suspense fallback={<Centered text="Đang tải…" />}><LandingPage /></Suspense>} />
      <Route path="/landing" element={<Suspense fallback={<Centered text="Đang tải…" />}><LandingPage /></Suspense>} />
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
      <Route path="/budgets" element={<Protected><BudgetsListPage /></Protected>} />
      <Route path="/budgets/new" element={<Protected><BudgetFormPage /></Protected>} />
      <Route path="/budgets/:id/edit" element={<Protected><BudgetFormPage /></Protected>} />
      <Route path="/budgets/:id" element={<Protected><BudgetDetailPage /></Protected>} />
      <Route path="/tasks" element={<Protected><TasksListPage /></Protected>} />
      <Route path="/tasks/new" element={<Protected><TaskFormPage /></Protected>} />
      <Route path="/tasks/:id/edit" element={<Protected><TaskFormPage /></Protected>} />
      <Route path="/tasks/:id" element={<Protected><TaskDetailPage /></Protected>} />
      <Route path="/audits" element={<Protected><InspectionsListPage /></Protected>} />
      <Route path="/audits/new" element={<Protected><InspectionFormPage /></Protected>} />
      <Route path="/audits/:id/edit" element={<Protected><InspectionFormPage /></Protected>} />
      <Route path="/audits/:id" element={<Protected><InspectionDetailPage /></Protected>} />
      <Route path="/legal-documents" element={<Protected><LegalDocsListPage /></Protected>} />
      <Route path="/legal-documents/new" element={<Protected><LegalDocFormPage /></Protected>} />
      <Route path="/legal-documents/:id/edit" element={<Protected><LegalDocFormPage /></Protected>} />
      <Route path="/legal-documents/:id" element={<Protected><LegalDocDetailPage /></Protected>} />
      <Route path="/readiness/sites" element={<Protected><DeploymentSitesPage /></Protected>} />
      <Route path="/readiness/sites/new" element={<Protected><DeploymentSiteFormPage /></Protected>} />
      <Route path="/readiness/sites/:id/edit" element={<Protected><DeploymentSiteFormPage /></Protected>} />
      <Route path="/readiness/sites/:id" element={<Protected><DeploymentSiteDetailPage /></Protected>} />
      <Route path="/readiness/recovery" element={<Protected><RecoveryPage /></Protected>} />
      <Route path="/analytics" element={<Protected><AnalyticsPage /></Protected>} />
      <Route path="/inventory" element={<Protected><InventoryPage /></Protected>} />
      <Route path="/commune-materials" element={<Protected><CommuneMaterialsPage /></Protected>} />
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
