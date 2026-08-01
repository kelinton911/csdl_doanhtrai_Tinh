import { lazy, Suspense } from 'react';
import { useAuth } from '../lib/auth';
import { workspaceForRoles, type WorkspaceKey } from '../lib/roles';
import { Skeleton } from '../components/States';

// Mỗi vai trò có một WORKSPACE (giao diện làm việc) riêng — bố cục, hành động nhanh, panel
// và tông màu khác nhau, KHÔNG dùng chung một dashboard. Trang này chỉ điều phối: chọn
// workspace theo VAI TRÒ HIỆU LỰC (đổi khi admin "xem như"). Lazy-load để không tải phụ
// thuộc nặng (bản đồ/biểu đồ) của vai trò khác.
const AdminWorkspace = lazy(() => import('./workspaces/AdminWorkspace').then((m) => ({ default: m.AdminWorkspace })));
const CommandWorkspace = lazy(() => import('./workspaces/CommandWorkspace').then((m) => ({ default: m.CommandWorkspace })));
const OfficerWorkspace = lazy(() => import('./workspaces/OfficerWorkspace').then((m) => ({ default: m.OfficerWorkspace })));
const CommuneWorkspace = lazy(() => import('./workspaces/CommuneWorkspace').then((m) => ({ default: m.CommuneWorkspace })));
const ReviewWorkspace = lazy(() => import('./workspaces/ReviewWorkspace').then((m) => ({ default: m.ReviewWorkspace })));
const AuditWorkspace = lazy(() => import('./workspaces/AuditWorkspace').then((m) => ({ default: m.AuditWorkspace })));
const ReportWorkspace = lazy(() => import('./workspaces/ReportWorkspace').then((m) => ({ default: m.ReportWorkspace })));

export function DashboardPage() {
  const { profile, effectiveRoles } = useAuth();
  const ws: WorkspaceKey = workspaceForRoles(effectiveRoles);
  const fullName = profile?.fullName;

  return (
    <Suspense fallback={<Skeleton rows={6} />}>
      {ws === 'admin' && <AdminWorkspace fullName={fullName} />}
      {ws === 'command' && <CommandWorkspace fullName={fullName} />}
      {ws === 'officer' && <OfficerWorkspace fullName={fullName} />}
      {ws === 'commune' && <CommuneWorkspace fullName={fullName} />}
      {ws === 'review' && <ReviewWorkspace fullName={fullName} />}
      {ws === 'audit' && <AuditWorkspace fullName={fullName} />}
      {ws === 'report' && <ReportWorkspace fullName={fullName} />}
    </Suspense>
  );
}
