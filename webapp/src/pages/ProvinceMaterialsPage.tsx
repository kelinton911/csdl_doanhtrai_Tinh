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
import { SITE_TYPES, SITE_TYPE_LABEL, siteTypeLabel } from '../lib/siteType';

interface SummaryRow {
  siteType: string | null;
  areaId: string | null;
  areaName: string | null;
  categoryCode: string | null;
  categoryName: string | null;
  materialKinds: number;
  totalOnHand: number;
}

const areaLabel = (r: SummaryRow) => r.areaName ?? '— (chưa gắn xã)';
const catLabel = (r: SummaryRow) => r.categoryName ?? r.categoryCode ?? '— (chưa phân nhóm)';

// Feature 01 — "Nguồn vật chất thường xuyên của Tỉnh": cuộn tồn thực tế toàn tỉnh, TÁCH THEO
// LOẠI ĐỊA ĐIỂM NGUỒN (xã / đơn vị trực thuộc / kho Tỉnh / căn cứ chiến đấu / phân căn cứ /
// căn cứ HC-KT mật). Căn cứ mật chỉ hiển thị cho vai trò xem toàn tỉnh (được backend chặn).
export function ProvinceMaterialsPage() {
  const [siteType, setSiteType] = useState('');

  const q = useQuery({
    queryKey: ['inventory-province-routine', siteType],
    queryFn: async () =>
      (await api.get('/inventory/province-routine-summary', { params: { siteType: siteType || undefined } }))
        .data as SummaryRow[],
    placeholderData: keepPreviousData,
  });

  const rows = q.data ?? [];

  // Tổng lượng tồn gộp theo từng loại nguồn (phục vụ dải KPI).
  const bySite = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of rows) {
      const k = r.siteType ?? 'none';
      m.set(k, (m.get(k) ?? 0) + r.totalOnHand);
    }
    return m;
  }, [rows]);

  const totals = useMemo(() => {
    const totalOnHand = rows.reduce((s, r) => s + r.totalOnHand, 0);
    const materialKinds = rows.reduce((s, r) => s + r.materialKinds, 0);
    const siteCount = new Set(rows.map((r) => r.siteType ?? 'none')).size;
    return { totalOnHand, materialKinds, siteCount };
  }, [rows]);

  const exporting = useMutation({
    mutationFn: async () => {
      const cols: CsvColumn<SummaryRow>[] = [
        { header: 'Loại nguồn', value: (r) => siteTypeLabel(r.siteType) },
        { header: 'Xã/phường', value: areaLabel },
        { header: 'Nhóm ngành', value: catLabel },
        { header: 'Số loại VC', value: (r) => r.materialKinds },
        { header: 'Tổng tồn', value: (r) => r.totalOnHand },
      ];
      downloadCsv(`vat-chat-thuong-xuyen-cua-tinh-${new Date().toISOString().slice(0, 10)}`, rows, cols);
      return rows.length;
    },
    onSuccess: (n) => toast.success(`Đã xuất ${n} dòng ra CSV.`),
    onError: (e) => toast.problem(e, 'Không xuất được CSV'),
  });

  const columns: Column<SummaryRow>[] = [
    { key: 'site', header: 'Loại nguồn', render: (r) => <span style={{ fontWeight: 600 }}>{siteTypeLabel(r.siteType)}</span> },
    { key: 'area', header: 'Xã/phường', render: areaLabel },
    { key: 'cat', header: 'Nhóm ngành', render: catLabel },
    { key: 'kinds', header: 'Số loại VC', render: (r) => num(r.materialKinds), align: 'right', mono: true },
    { key: 'onhand', header: 'Tổng tồn', render: (r) => num(r.totalOnHand), align: 'right', mono: true },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Nguồn vật chất thường xuyên của Tỉnh"
        title="Tổng hợp vật chất thường xuyên toàn tỉnh"
        description="Gộp tồn kho thực (đã ghi sổ) toàn tỉnh, tách theo loại địa điểm nguồn: xã, đơn vị trực thuộc, kho của Tỉnh, căn cứ chiến đấu, phân căn cứ, căn cứ HC-KT (mật). Căn cứ mật chỉ hiển thị cho cấp Tỉnh."
      />

      <div style={{ display: 'flex', gap: 12, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <select className="input" style={{ maxWidth: 280 }} value={siteType} onChange={(e) => setSiteType(e.target.value)}>
          <option value="">Tất cả loại nguồn</option>
          {SITE_TYPES.map((s) => <option key={s} value={s}>{SITE_TYPE_LABEL[s]}</option>)}
        </select>
        <div style={{ flex: 1 }} />
        <button className="btn" disabled={exporting.isPending || rows.length === 0} onClick={() => exporting.mutate()} title="Xuất bảng tổng hợp ra CSV">
          <Icon name="download" size={15} /> {exporting.isPending ? 'Đang xuất…' : 'Xuất CSV'}
        </button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <Kpi label="Số loại nguồn có tồn" value={num(totals.siteCount)} />
        <Kpi label="Tổng số loại vật chất" value={num(totals.materialKinds)} />
        <Kpi label="Tổng lượng tồn (gộp ĐVT)" value={num(totals.totalOnHand)} muted />
      </div>

      {/* Dải tổng theo từng loại nguồn để nắm nhanh cơ cấu. */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        {SITE_TYPES.filter((s) => bySite.has(s)).map((s) => (
          <span key={s} className="chip" style={{ border: '1px solid var(--border)', borderRadius: 8, padding: '4px 10px', fontSize: 12.5 }}>
            {SITE_TYPE_LABEL[s]}: <b className="num">{num(bySite.get(s) ?? 0)}</b>
          </span>
        ))}
      </div>

      {q.isError ? <ErrorState error={q.error} /> : (
        <DataTable
          columns={columns}
          rows={rows}
          loading={q.isLoading}
          rowKey={(r) => `${r.siteType ?? 'none'}-${r.areaId ?? 'none'}-${r.categoryCode ?? 'none'}`}
          emptyTitle="Chưa có tồn kho để tổng hợp"
        />
      )}
      <p className="muted" style={{ fontSize: 12, marginTop: 8 }}>
        Bảng TỔNG HỢP từ tồn thực đã ghi sổ theo loại địa điểm nguồn. Phân loại nguồn được đặt ở
        hồ sơ kho (trường “Loại địa điểm nguồn”). “Tổng lượng tồn” cộng gộp mọi đơn vị tính nên
        chỉ mang tính tham khảo.
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
