import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { DataTable, type Column } from '../components/DataTable';
import { Icon } from '../components/Icon';
import { Skeleton, ErrorState } from '../components/States';
import { downloadCsv } from '../lib/csv';

// Tiềm lực Hậu cần - Kỹ thuật tổng hợp theo địa bàn (xã/phường/đặc khu). Đọc từ
// GET /dashboard/potential-by-area — gom doanh trại/công trình/sức chứa/tồn kho về từng địa bàn.
interface AreaPotential {
  id: string;
  code: string;
  name: string;
  type: string;
  barracksCount: number;
  capacity: number;
  landArea: number;
  facilityCount: number;
  poorFacilities: number;
  stockOnHand: number;
}
interface PotentialResp {
  generatedAt: string;
  areas: AreaPotential[];
  unallocatedStockOnHand: number;
}

const AREA_TYPE_LABEL: Record<string, string> = { COMMUNE: 'Xã', WARD: 'Phường', SPECIAL_ZONE: 'Đặc khu' };
const num = (n: number) => n.toLocaleString('vi-VN');
const num1 = (n: number) => n.toLocaleString('vi-VN', { maximumFractionDigits: 1 });

export function PotentialPage() {
  const q = useQuery({
    queryKey: ['potential-by-area'],
    queryFn: async () => (await api.get('/dashboard/potential-by-area')).data as PotentialResp,
  });

  const areas = q.data?.areas ?? [];
  const totals = useMemo(() => areas.reduce(
    (acc, a) => ({
      barracks: acc.barracks + a.barracksCount,
      facilities: acc.facilities + a.facilityCount,
      capacity: acc.capacity + a.capacity,
      landArea: acc.landArea + a.landArea,
      poor: acc.poor + a.poorFacilities,
      stock: acc.stock + a.stockOnHand,
    }),
    { barracks: 0, facilities: 0, capacity: 0, landArea: 0, poor: 0, stock: 0 },
  ), [areas]);

  const columns: Column<AreaPotential>[] = [
    { key: 'type', header: 'Loại', width: 90, render: (a) => <span style={{ fontSize: 11, background: 'var(--dom-cmd-bg, var(--surface-2))', color: 'var(--color-text)', padding: '1px 7px', borderRadius: 5 }}>{AREA_TYPE_LABEL[a.type] ?? a.type}</span> },
    { key: 'name', header: 'Địa bàn', render: (a) => <div><div style={{ fontWeight: 600 }}>{a.name}</div><div className="num muted" style={{ fontSize: 11 }}>{a.code}</div></div> },
    { key: 'barracks', header: 'Doanh trại', align: 'right', mono: true, render: (a) => num(a.barracksCount) },
    { key: 'facilities', header: 'Công trình', align: 'right', mono: true, render: (a) => num(a.facilityCount) },
    { key: 'poor', header: 'CT kém', align: 'right', mono: true, render: (a) => <span style={{ color: a.poorFacilities > 0 ? 'var(--danger-fg)' : 'var(--color-neutral-500)', fontWeight: a.poorFacilities > 0 ? 700 : 400 }}>{num(a.poorFacilities)}</span> },
    { key: 'capacity', header: 'Sức chứa', align: 'right', mono: true, render: (a) => num(a.capacity) },
    { key: 'land', header: 'Diện tích (m²)', align: 'right', mono: true, render: (a) => num1(a.landArea) },
    { key: 'stock', header: 'Tồn kho', align: 'right', mono: true, render: (a) => num1(a.stockOnHand) },
  ];

  const exportCsv = () => downloadCsv('tiem-luc-hc-kt-theo-dia-ban', areas, [
    { header: 'Mã địa bàn', value: (a) => a.code },
    { header: 'Địa bàn', value: (a) => a.name },
    { header: 'Loại', value: (a) => AREA_TYPE_LABEL[a.type] ?? a.type },
    { header: 'Doanh trại', value: (a) => a.barracksCount },
    { header: 'Công trình', value: (a) => a.facilityCount },
    { header: 'Công trình chất lượng kém', value: (a) => a.poorFacilities },
    { header: 'Sức chứa', value: (a) => a.capacity },
    { header: 'Diện tích (m2)', value: (a) => a.landArea },
    { header: 'Tồn kho (đơn vị quy đổi)', value: (a) => a.stockOnHand },
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Tiềm lực Hậu cần - Kỹ thuật"
        title="Tiềm lực theo địa bàn (xã/phường/đặc khu)"
        description="Tổng hợp doanh trại, công trình, sức chứa, diện tích và tồn kho quy về từng địa bàn hành chính cấp xã. Số liệu thời gian thực; báo cáo chính thức đọc snapshot ở mục Báo cáo."
      />

      {q.isError ? <ErrorState error={q.error} /> : q.isLoading ? <Skeleton rows={6} /> : (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 18 }}>
            <Stat label="Địa bàn" value={num(areas.length)} />
            <Stat label="Doanh trại" value={num(totals.barracks)} />
            <Stat label="Công trình" value={num(totals.facilities)} />
            <Stat label="Công trình kém" value={num(totals.poor)} danger={totals.poor > 0} />
            <Stat label="Tổng sức chứa" value={num(totals.capacity)} />
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
            <span className="muted" style={{ fontSize: 12 }}>
              {q.data?.unallocatedStockOnHand ? `Tồn kho chưa gắn địa bàn (kho không thuộc doanh trại): ${num1(q.data.unallocatedStockOnHand)}` : 'Toàn bộ tồn kho đã quy về địa bàn.'}
            </span>
            <button className="btn btn-sm" onClick={exportCsv} disabled={areas.length === 0}><Icon name="download" size={14} /> Xuất CSV</button>
          </div>

          <DataTable columns={columns} rows={areas} rowKey={(a) => a.id} emptyTitle="Chưa có địa bàn" />
        </>
      )}
    </>
  );
}

function Stat({ label, value, danger }: { label: string; value: string; danger?: boolean }) {
  return (
    <div style={{ border: '1px solid var(--color-neutral-300)', borderRadius: 10, padding: '12px 14px', background: 'var(--surface-1)' }}>
      <div className="muted" style={{ fontSize: 12, marginBottom: 4 }}>{label}</div>
      <div className="num" style={{ fontSize: 22, fontWeight: 700, color: danger ? 'var(--danger-fg)' : 'var(--color-text)' }}>{value}</div>
    </div>
  );
}
