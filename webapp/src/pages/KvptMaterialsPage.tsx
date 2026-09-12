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
interface KvptRow {
  areaId: string | null;
  areaName: string | null;
  catalogGroup: string | null;
  materialCatalogId: string | null;
  materialCode: string | null;
  materialName: string | null;
  totalQuantity: number;
  communeCount: number;
}

const areaLabel = (r: KvptRow) => r.areaName ?? '— (chưa gắn xã)';
const groupLabel = (g: string | null) => (g === 'LOCAL_POTENTIAL' ? 'Tiềm lực địa phương' : g === 'STANDARD' ? 'Danh mục chuẩn' : '—');
const materialLabel = (r: KvptRow) => [r.materialCode, r.materialName].filter(Boolean).join(' — ') || '—';

// Feature 02 — "Vật chất Khu vực phòng thủ (KVPT)": cuộn dòng vật chất tiềm lực HC-KT địa phương
// từ các bản khai cấp xã ĐÃ DUYỆT, gộp theo xã × nguồn danh mục × vật chất.
export function KvptMaterialsPage() {
  const [areaId, setAreaId] = useState('');
  const [group, setGroup] = useState('');

  const areas = useQuery({
    queryKey: ['areas'],
    queryFn: async () => (await api.get('/administrative-areas', { params: { size: 200 } })).data as { data: AreaOpt[] },
  });

  const q = useQuery({
    queryKey: ['kvpt-summary', areaId, group],
    queryFn: async () =>
      (await api.get('/commune-potentials/kvpt-summary', { params: { areaId: areaId || undefined, catalogGroup: group || undefined } }))
        .data as KvptRow[],
    placeholderData: keepPreviousData,
  });

  const rows = q.data ?? [];
  const totals = useMemo(() => {
    const totalQuantity = rows.reduce((s, r) => s + r.totalQuantity, 0);
    const materialKinds = new Set(rows.map((r) => r.materialCatalogId ?? 'none')).size;
    const areaCount = new Set(rows.map((r) => r.areaId ?? 'none')).size;
    return { totalQuantity, materialKinds, areaCount };
  }, [rows]);

  const exporting = useMutation({
    mutationFn: async () => {
      const cols: CsvColumn<KvptRow>[] = [
        { header: 'Xã/phường', value: areaLabel },
        { header: 'Nguồn', value: (r) => groupLabel(r.catalogGroup) },
        { header: 'Vật chất', value: materialLabel },
        { header: 'Tổng số lượng', value: (r) => r.totalQuantity },
        { header: 'Số xã khai', value: (r) => r.communeCount },
      ];
      downloadCsv(`vat-chat-kvpt-${new Date().toISOString().slice(0, 10)}`, rows, cols);
      return rows.length;
    },
    onSuccess: (n) => toast.success(`Đã xuất ${n} dòng ra CSV.`),
    onError: (e) => toast.problem(e, 'Không xuất được CSV'),
  });

  const columns: Column<KvptRow>[] = [
    { key: 'area', header: 'Xã/phường', render: (r) => <span style={{ fontWeight: 600 }}>{areaLabel(r)}</span> },
    { key: 'group', header: 'Nguồn', render: (r) => groupLabel(r.catalogGroup) },
    { key: 'mat', header: 'Vật chất', render: materialLabel },
    { key: 'qty', header: 'Tổng số lượng', render: (r) => num(r.totalQuantity), align: 'right', mono: true },
    { key: 'communes', header: 'Số xã khai', render: (r) => num(r.communeCount), align: 'right', mono: true },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Vật chất Khu vực phòng thủ (KVPT)"
        title="Tổng hợp vật chất tiềm lực HC-KT khu vực phòng thủ"
        description="Gộp các dòng vật chất tiềm lực HC-KT địa phương từ các bản khai cấp xã ĐÃ DUYỆT, theo xã × nguồn danh mục × vật chất. Chỉ bản khai đã duyệt được tính."
      />

      <div style={{ display: 'flex', gap: 12, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <select className="input" style={{ maxWidth: 240 }} value={areaId} onChange={(e) => setAreaId(e.target.value)}>
          <option value="">Tất cả xã (toàn tỉnh)</option>
          {(areas.data?.data ?? []).map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <select className="input" style={{ maxWidth: 220 }} value={group} onChange={(e) => setGroup(e.target.value)}>
          <option value="">Tất cả nguồn danh mục</option>
          <option value="STANDARD">Danh mục chuẩn</option>
          <option value="LOCAL_POTENTIAL">Tiềm lực địa phương</option>
        </select>
        <div style={{ flex: 1 }} />
        <button className="btn" disabled={exporting.isPending || rows.length === 0} onClick={() => exporting.mutate()} title="Xuất bảng tổng hợp ra CSV">
          <Icon name="download" size={15} /> {exporting.isPending ? 'Đang xuất…' : 'Xuất CSV'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <Kpi label={areaId ? 'Xã đang xem' : 'Số xã có khai'} value={areaId ? '1' : num(totals.areaCount)} />
        <Kpi label="Tổng số loại vật chất" value={num(totals.materialKinds)} />
        <Kpi label="Tổng số lượng (gộp ĐVT)" value={num(totals.totalQuantity)} muted />
      </div>

      {q.isError ? <ErrorState error={q.error} /> : (
        <DataTable
          columns={columns}
          rows={rows}
          loading={q.isLoading}
          rowKey={(r) => `${r.areaId ?? 'none'}-${r.catalogGroup ?? 'none'}-${r.materialCatalogId ?? 'none'}`}
          emptyTitle="Chưa có vật chất KVPT đã duyệt để tổng hợp"
        />
      )}
      <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
        Nguồn dữ liệu: dòng vật chất trong “Khai báo tiềm lực HC-KT” của các xã, chỉ tính bản
        <b> đã duyệt</b>. “Tổng số lượng” cộng gộp mọi đơn vị tính nên chỉ mang tính tham khảo.
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
