import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuth, ROLE_LABEL } from '../lib/auth';
import { PageHeader } from '../components/PageHeader';
import { KpiCard } from '../components/KpiCard';
import { Skeleton, ErrorState } from '../components/States';
import { num } from '../lib/format';

interface Paged<T> {
  data: T[];
  meta: { total: number };
}

// Dashboard chỉ huy (Frontend §6.2). Pha A: KPI thật từ API; Pha B bổ sung biểu đồ, bản đồ,
// và endpoint tổng hợp /dashboard/summary.
export function DashboardPage() {
  const { profile } = useAuth();
  const barracks = useQuery({
    queryKey: ['barracks-count'],
    queryFn: async () => (await api.get<Paged<unknown>>('/barracks', { params: { size: 1 } })).data,
  });

  return (
    <>
      <PageHeader
        eyebrow="Tổng quan chỉ huy"
        title={`Xin chào, ${profile?.fullName ?? ''}`}
        description={`Vai trò: ${(profile?.roles ?? []).map((r) => ROLE_LABEL[r] ?? r).join(', ')}. Toàn bộ số liệu trong bản dựng này là dữ liệu giả lập phục vụ thiết kế.`}
      />

      {barracks.isLoading && <Skeleton rows={3} />}
      {barracks.isError && <ErrorState error={barracks.error} />}
      {barracks.data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 16 }}>
          <KpiCard
            label="Tổng số doanh trại"
            value={num(barracks.data.meta.total)}
            unit="hồ sơ"
            icon="building"
            dom="asset"
            hint="Cập nhật thời gian thực"
          />
          <KpiCard label="Công trình đang khai thác" value="—" unit="công trình" icon="grid" dom="cmd" hint="Bổ sung ở Pha B" />
          <KpiCard label="Tỷ lệ dữ liệu đã xác nhận" value="—" unit="%" icon="check" dom="cap" hint="Bổ sung ở Pha B" />
          <KpiCard label="Cảnh báo trọng yếu" value="—" icon="alert" dom="repair" hint="Bổ sung ở Pha H" />
        </div>
      )}

      <div className="panel" style={{ padding: 20, marginTop: 20, display: 'flex', gap: 12, alignItems: 'center' }}>
        <span style={{ color: 'var(--info-fg)' }}>ℹ️</span>
        <div style={{ fontSize: 13.5 }}>
          Nền tảng (Pha A) đã hoạt động: đăng nhập, phân quyền theo vai trò, nhật ký truy nguyên,
          lưu trữ tệp và khung ứng dụng. Các module nghiệp vụ được bổ sung theo từng pha.
        </div>
      </div>
    </>
  );
}
