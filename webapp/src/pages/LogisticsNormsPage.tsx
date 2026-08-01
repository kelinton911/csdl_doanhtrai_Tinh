import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { api, toProblem } from '../lib/api';
import { useAuth } from '../lib/auth';
import { PageHeader } from '../components/PageHeader';
import { DataTable, type Column } from '../components/DataTable';
import { Icon } from '../components/Icon';
import { ErrorState } from '../components/States';
import { num } from '../lib/format';

// Khâu 4 — Định mức HC-KT (tra cứu) + tính bảo đảm chiến đấu (dự thảo, cấp Tỉnh).
const BRANCH_LABEL: Record<string, string> = {
  QN: 'Quân nhu', QY: 'Quân y', XD: 'Xăng dầu', VT: 'Vận tải', DT: 'Doanh trại', QS: 'Quân số',
};
const BRANCHES = ['QN', 'QY', 'DT', 'XD', 'VT', 'QS'];

interface Norm { id: string; branch: string; code: string; name: string; unit: string | null; value: string | null; basis: string | null; calcRole: string; notes: string | null }
interface ComputedLine { code: string; name: string; unit: string | null; quantity: number; count?: number; formula: string }
interface ComputeResult { params: { troopCount: number; durationDays: number; combatType: string; casualtyRatePct: number }; estimatedTB: number; status: string; note: string; branches: Record<string, ComputedLine[]> }

export function LogisticsNormsPage() {
  const { can } = useAuth();
  const canCompute = can('PROVINCIAL_COMMAND', 'BARRACKS_OFFICER', 'SYS_ADMIN');
  const [tab, setTab] = useState<'norms' | 'compute'>('norms');
  const [branch, setBranch] = useState('');

  const norms = useQuery({
    queryKey: ['logistics-norms', branch],
    queryFn: async () => (await api.get('/logistics-norms', { params: { branch: branch || undefined } })).data as Norm[],
  });

  const columns: Column<Norm>[] = [
    { key: 'branch', header: 'Ngành', render: (r) => <span className="badge">{BRANCH_LABEL[r.branch] ?? r.branch}</span>, width: 100 },
    { key: 'code', header: 'Mã', render: (r) => r.code, mono: true, width: 130 },
    { key: 'name', header: 'Định mức', render: (r) => <span style={{ fontWeight: 600 }}>{r.name}</span> },
    { key: 'value', header: 'Trị số', render: (r) => (r.value !== null ? num(Number(r.value)) : '—'), align: 'right', mono: true },
    { key: 'basis', header: 'Cơ sở tính', render: (r) => <span className="muted" style={{ fontSize: 12.5 }}>{r.basis ?? '—'}</span> },
    { key: 'role', header: 'Dùng tính', render: (r) => (r.calcRole === 'REFERENCE' ? <span className="muted" style={{ fontSize: 11 }}>tra cứu</span> : <span style={{ fontSize: 11, color: 'var(--ok-fg)', fontWeight: 700 }}>tự tính</span>) },
  ];

  return (
    <>
      <PageHeader
        eyebrow="Bảo đảm chiến đấu"
        title="Định mức HC-KT & tính toán bảo đảm"
        description="Quy ước tính toán hậu cần - kỹ thuật (6 ngành) theo văn kiện. Định mức để tra cứu; phần tính toán bảo đảm là bản dự thảo cấp Tỉnh."
      />

      <div style={{ display: 'flex', gap: 4, background: 'var(--color-neutral-200)', padding: 4, borderRadius: 8, marginBottom: 14, width: 'fit-content' }}>
        <button className="btn btn-sm" onClick={() => setTab('norms')} style={{ border: 'none', background: tab === 'norms' ? 'var(--surface-1)' : 'transparent', fontWeight: tab === 'norms' ? 700 : 500 }}>Định mức (tra cứu)</button>
        {canCompute && <button className="btn btn-sm" onClick={() => setTab('compute')} style={{ border: 'none', background: tab === 'compute' ? 'var(--surface-1)' : 'transparent', fontWeight: tab === 'compute' ? 700 : 500 }}>Tính bảo đảm</button>}
      </div>

      {tab === 'norms' ? (
        <>
          <div style={{ display: 'flex', gap: 12, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
            <select className="input" style={{ maxWidth: 220 }} value={branch} onChange={(e) => setBranch(e.target.value)}>
              <option value="">Tất cả ngành</option>
              {BRANCHES.map((b) => <option key={b} value={b}>{BRANCH_LABEL[b]}</option>)}
            </select>
            <span className="muted" style={{ fontSize: 12 }}>Nguồn: Quy ước tính toán làm văn kiện hậu cần chiến đấu.</span>
          </div>
          {norms.isError ? <ErrorState error={norms.error} /> : (
            <DataTable columns={columns} rows={norms.data} loading={norms.isLoading} rowKey={(r) => r.id} emptyTitle="Chưa có định mức" />
          )}
        </>
      ) : (
        <ComputePanel />
      )}
    </>
  );
}

function ComputePanel() {
  const [f, setF] = useState({ troopCount: '2331', durationDays: '5', combatType: 'TIEN_CONG', casualtyRatePct: '' });
  const [result, setResult] = useState<ComputeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const compute = useMutation({
    mutationFn: async () => (await api.post('/logistics-norms/compute', {
      troopCount: Number(f.troopCount),
      durationDays: Number(f.durationDays),
      combatType: f.combatType,
      casualtyRatePct: f.casualtyRatePct ? Number(f.casualtyRatePct) : undefined,
    })).data as ComputeResult,
    onSuccess: (d) => { setResult(d); setError(null); },
    onError: (e) => setError(toProblem(e).title),
  });

  return (
    <div>
      <div className="card" style={{ padding: 14, marginBottom: 14 }}>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
          <div><label className="field-label">Quân số</label><input className="input num" type="number" min={1} style={{ width: 130 }} value={f.troopCount} onChange={(e) => setF((s) => ({ ...s, troopCount: e.target.value }))} /></div>
          <div><label className="field-label">Số ngày</label><input className="input num" type="number" min={1} style={{ width: 90 }} value={f.durationDays} onChange={(e) => setF((s) => ({ ...s, durationDays: e.target.value }))} /></div>
          <div><label className="field-label">Loại tác chiến</label><select className="input" value={f.combatType} onChange={(e) => setF((s) => ({ ...s, combatType: e.target.value }))}><option value="TIEN_CONG">Tiến công (15%)</option><option value="PHONG_NGU">Phòng ngự (9%)</option></select></div>
          <div><label className="field-label">Tỷ lệ TB % (tùy chọn)</label><input className="input num" type="number" min={0} max={100} style={{ width: 130 }} placeholder="mặc định" value={f.casualtyRatePct} onChange={(e) => setF((s) => ({ ...s, casualtyRatePct: e.target.value }))} /></div>
          <button className="btn btn-primary" disabled={!f.troopCount || !f.durationDays || compute.isPending} onClick={() => compute.mutate()}><Icon name="target" size={15} /> {compute.isPending ? 'Đang tính…' : 'Tính bảo đảm'}</button>
        </div>
        {error && <div style={{ marginTop: 12, color: 'var(--danger-fg)', display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="alert" size={15} /> {error}</div>}
      </div>

      {result && (
        <div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 12, flexWrap: 'wrap' }}>
            <span style={{ padding: '3px 10px', borderRadius: 6, background: 'var(--warn-bg, #fef3c7)', color: 'var(--warn-fg, #92400e)', fontWeight: 700, fontSize: 12 }}>DỰ THẢO</span>
            <span className="muted" style={{ fontSize: 13 }}>Quân số {num(result.params.troopCount)} · {result.params.durationDays} ngày · {result.params.combatType === 'PHONG_NGU' ? 'phòng ngự' : 'tiến công'} · TB {result.params.casualtyRatePct}% → <b>{num(result.estimatedTB)}</b> thương binh dự kiến</span>
          </div>
          <p className="muted" style={{ fontSize: 12, marginTop: 0 }}>{result.note}</p>
          {Object.entries(result.branches).map(([br, lines]) => (
            <div key={br} className="card" style={{ padding: 0, marginBottom: 12, overflow: 'hidden' }}>
              <div style={{ padding: '8px 14px', background: 'var(--color-neutral-100)', fontWeight: 700 }}>{BRANCH_LABEL[br] ?? br}</div>
              <table className="tbl" style={{ width: '100%' }}>
                <thead><tr><th>Nội dung</th><th style={{ textAlign: 'right' }}>Nhu cầu</th><th style={{ width: 70 }}>ĐVT</th><th>Cách tính</th></tr></thead>
                <tbody>
                  {lines.map((l) => (
                    <tr key={l.code}>
                      <td style={{ fontWeight: 600 }}>{l.name}{l.count !== undefined ? <span className="muted" style={{ fontSize: 11, marginLeft: 6 }}>({num(l.count)})</span> : null}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700 }} className="num">{num(l.quantity)}</td>
                      <td className="muted" style={{ fontSize: 12 }}>{l.unit ?? '—'}</td>
                      <td className="muted" style={{ fontSize: 12 }}>{l.formula}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
