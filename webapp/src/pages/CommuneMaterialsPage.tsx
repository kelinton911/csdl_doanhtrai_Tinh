import { useMemo, useState } from 'react';
import { useMutation, useQuery, keepPreviousData } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from '../lib/toast';
import { PageHeader } from '../components/PageHeader';
import { DataTable, type Column } from '../components/DataTable';
import { Icon } from '../components/Icon';
import { ErrorState } from '../components/States';
import { num } from '../lib/format';
import { downloadCsv, type CsvColumn } from '../lib/csv';

interface AreaOpt { id: string; name: string }
interface SummaryRow {
  areaId: string | null;
  areaName: string | null;
  categoryCode: string | null;
  categoryName: string | null;
  materialKinds: number;
  totalOnHand: number;
}

const areaLabel = (r: { areaName: string | null }) => r.areaName ?? '— (chưa gắn xã)';
const catLabel = (r: SummaryRow) => r.categoryName ?? r.categoryCode ?? '— (chưa phân nhóm)';

// Khâu 1 — "Vật chất chung của xã": tổng hợp tồn kho thực theo xã × nhóm ngành.
// Lọc theo từng xã hoặc bỏ trống = tổng toàn tỉnh (theo phạm vi dữ liệu của người dùng).
export function CommuneMaterialsPage() {
  const [areaId, setAreaId] = useState('');

  const areas = useQuery({
    queryKey: ['areas'],
    queryFn: async () => (await api.get('/administrative-areas', { params: { size: 200 } })).data as { data: AreaOpt[] },
  });

  const q = useQuery({
    queryKey: ['inventory-summary-by-area', areaId],
    queryFn: async () =>
      (await api.get('/inventory/summary-by-area', { params: { areaId: areaId || undefined } })).data as SummaryRow[],
    placeholderData: keepPreviousData,
  });

  const rows = q.data ?? [];
  const totals = useMemo(() => {
    const totalOnHand = rows.reduce((s, r) => s + r.totalOnHand, 0);
    const materialKinds = rows.reduce((s, r) => s + r.materialKinds, 0);
    const areaCount = new Set(rows.map((r) => r.areaId ?? 'none')).size;
    return { totalOnHand, materialKinds, areaCount };
  }, [rows]);

  const exporting = useMutation({
    mutationFn: async () => {
      const cols: CsvColumn<SummaryRow>[] = [
        { header: 'Xã/phường', value: areaLabel },
        { header: 'Nhóm ngành', value: catLabel },
        { header: 'Số loại VC', value: (r) => r.materialKinds },
        { header: 'Tổng tồn', value: (r) => r.totalOnHand },
      ];
      downloadCsv(`vat-chat-chung-cua-xa-${new Date().toISOString().slice(0, 10)}`, rows, cols);
      return rows.length;
    },
    onSuccess: (n) => toast.success(`Đã xuất ${n} dòng ra CSV.`),
    onError: (e) => toast.problem(e, 'Không xuất được CSV'),
  });

  const columns: Column<SummaryRow>[] = [
    { key: 'area', header: 'Xã/phường', render: (r) => <span style={{ fontWeight: 600 }}>{areaLabel(r)}</span> },
    { key: 'cat', header: 'Nhóm ngành', render: catLabel },
    { key: 'kinds', header: 'Số loại VC', render: (r) => num(r.materialKinds), align: 'right', mono: true },
    { key: 'onhand', header: 'Tổng tồn', render: (r) => num(r.totalOnHand), align: 'right', mono: true },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Vật chất chung của xã"
        title="Tổng hợp vật chất tồn theo xã"
        description="Gộp tồn kho thực (đã ghi sổ) từ các kho/trạm trên địa bàn theo xã × nhóm ngành. Chọn một xã để xem riêng, hoặc để trống để xem tổng toàn tỉnh."
      />

      <div style={{ display: 'flex', gap: 12, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <select className="input" style={{ maxWidth: 260 }} value={areaId} onChange={(e) => setAreaId(e.target.value)}>
          <option value="">Tất cả xã (tổng toàn tỉnh)</option>
          {(areas.data?.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button className="btn" disabled={exporting.isPending || rows.length === 0} onClick={() => exporting.mutate()} title="Xuất bảng tổng hợp ra CSV">
          <Icon name="download" size={15} /> {exporting.isPending ? 'Đang xuất…' : 'Xuất CSV'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <Kpi label={areaId ? 'Xã đang xem' : 'Số xã có tồn'} value={areaId ? '1' : num(totals.areaCount)} />
        <Kpi label="Tổng số loại vật chất" value={num(totals.materialKinds)} />
        <Kpi label="Tổng lượng tồn (gộp ĐVT)" value={num(totals.totalOnHand)} muted />
      </div>

      {q.isError ? <ErrorState error={q.error} /> : (
        <DataTable
          columns={columns}
          rows={rows}
          loading={q.isLoading}
          rowKey={(r) => `${r.areaId ?? 'none'}-${r.categoryCode ?? 'none'}`}
          emptyTitle="Chưa có tồn kho để tổng hợp"
        />
      )}
      <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
        Lưu ý: "Tổng lượng tồn" cộng gộp mọi đơn vị tính nên chỉ mang tính tham khảo; số liệu chính xác xem theo từng vật chất ở mục "Vật chất trên địa bàn".
      </p>
    </>
  );
}

function Kpi({ label, value, muted }: { label: string; value: string; muted?: boolean }) {
  return (
    <div style={{ flex: '1 1 180px', border: '1px solid var(--border)', borderRadius: 10, padding: '12px 14px', background: 'var(--surface-1)' }}>
      <div className="muted" style={{ fontSize: 12.5, marginBottom: 4 }}>{label}</div>
      <div className="num" style={{ fontSize: 22, fontWeight: 700, color: muted ? 'var(--color-text-muted)' : 'var(--color-text)' }}>{value}</div>
    </div>
  );
}
