import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from '../lib/toast';
import {
  CHANGE_TYPE_LABEL,
  USAGE_TYPE_LABEL,
  fetchAreaAtSnapshot,
  useAllocations,
  useChanges,
  useDataQuality,
  useLandParcels,
} from '../lib/landRegistry';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { ErrorState, Skeleton, EmptyState } from '../components/States';
import { Modal } from '../components/Modal';
import { Icon } from '../components/Icon';

// SCR-DT02-03/04/09 — Hồ sơ điểm đất: phân bổ hiện trạng (Σ ≤ diện tích), biến động (timeline),
// diện tích tại thời điểm kiểm kê, kiểm tra chất lượng dữ liệu.
export function LandRegistryPage() {
  const qc = useQueryClient();
  const parcels = useLandParcels();
  const [landPointId, setLandPointId] = useState('');
  const [allocOpen, setAllocOpen] = useState(false);
  const [changeOpen, setChangeOpen] = useState(false);
  const [asOf, setAsOf] = useState('2026-09-06');
  const [areaResult, setAreaResult] = useState<{ baseAreaM2: number; areaAtSnapshotM2: number } | null>(null);

  useEffect(() => {
    if (!landPointId && parcels.data?.length) setLandPointId(parcels.data[0].id);
  }, [parcels.data, landPointId]);

  const parcel = parcels.data?.find((p) => p.id === landPointId);
  const landArea = Number(parcel?.landArea ?? 0);
  const allocations = useAllocations(landPointId || undefined);
  const changes = useChanges(landPointId || undefined);
  const dq = useDataQuality();

  const allocatedTotal = useMemo(
    () => (allocations.data ?? []).filter((a) => a.status === 'ACTIVE').reduce((s, a) => s + Number(a.areaM2), 0),
    [allocations.data],
  );

  return (
    <div>
      <PageHeader
        eyebrow="DT-02 · Hồ sơ Doanh trại"
        title="Hồ sơ điểm đất"
        description="Phân bổ hiện trạng (Σ ≤ diện tích), biến động tăng/giảm, diện tích tại thời điểm kiểm kê."
      />

      <div className="panel" style={{ padding: 12, marginBottom: 14, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
          <span className="muted">Điểm đất:</span>
          <select value={landPointId} onChange={(e) => setLandPointId(e.target.value)} style={{ minWidth: 260 }}>
            {(parcels.data ?? []).map((p) => (
              <option key={p.id} value={p.id}>{p.code ? `${p.code} — ` : ''}{p.name ?? p.id.slice(0, 8)}</option>
            ))}
          </select>
        </label>
        {parcel && (
          <span className="muted" style={{ fontSize: 13 }}>
            Diện tích: <b className="num">{landArea.toLocaleString('vi-VN')}</b> m² · Đã phân bổ:{' '}
            <b className="num" style={{ color: allocatedTotal > landArea ? 'var(--danger-fg)' : 'var(--ok-fg)' }}>
              {allocatedTotal.toLocaleString('vi-VN')}
            </b> m²
          </span>
        )}
      </div>

      {parcels.isLoading ? <Skeleton rows={6} /> : !parcels.data?.length ? (
        <EmptyState icon="map" title="Chưa có điểm đất" hint="Tạo khu đất ở màn Khu đất quốc phòng trước." />
      ) : (
        <div style={{ display: 'grid', gap: 16 }}>
          {/* Phân bổ hiện trạng */}
          <section className="panel" style={{ padding: 0, overflow: 'hidden' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--color-neutral-200)' }}>
              <h2 style={{ fontSize: 15, fontWeight: 700 }}>Phân bổ hiện trạng</h2>
              <button className="btn btn-primary btn-sm" onClick={() => setAllocOpen(true)}><Icon name="plus" size={14} /> Thêm phân bổ</button>
            </div>
            {allocations.isLoading ? <div style={{ padding: 16 }}><Skeleton rows={3} /></div> :
              !allocations.data?.length ? <div style={{ padding: 16 }}><EmptyState icon="box" title="Chưa có phân bổ" /></div> : (
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
                  <thead><tr style={{ textAlign: 'left', color: 'var(--color-neutral-600)', fontSize: 12 }}>
                    <th style={{ padding: '8px 16px' }}>Loại sử dụng</th><th>Diện tích (m²)</th><th>Hiệu lực từ</th><th>Trạng thái</th>
                  </tr></thead>
                  <tbody>
                    {allocations.data.map((a) => (
                      <tr key={a.id} style={{ borderTop: '1px solid var(--color-neutral-200)' }}>
                        <td style={{ padding: '8px 16px' }}>{USAGE_TYPE_LABEL[a.usageType] ?? a.usageType}</td>
                        <td className="num">{Number(a.areaM2).toLocaleString('vi-VN')}</td>
                        <td>{a.effectiveFrom ?? '—'}</td>
                        <td><StatusBadge status={a.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
          </section>

          {/* Biến động (timeline) + diện tích tại snapshot */}
          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, alignItems: 'start' }}>
            <section className="panel" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid var(--color-neutral-200)' }}>
                <h2 style={{ fontSize: 15, fontWeight: 700 }}>Biến động điểm đất</h2>
                <button className="btn btn-primary btn-sm" onClick={() => setChangeOpen(true)}><Icon name="plus" size={14} /> Ghi biến động</button>
              </div>
              {changes.isLoading ? <div style={{ padding: 16 }}><Skeleton rows={3} /></div> :
                !changes.data?.length ? <div style={{ padding: 16 }}><EmptyState icon="clock" title="Chưa có biến động" /></div> : (
                  <ul style={{ listStyle: 'none', margin: 0, padding: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {changes.data.map((c) => (
                      <li key={c.id} style={{ display: 'flex', gap: 12, alignItems: 'baseline', padding: '6px 8px', borderLeft: '3px solid var(--color-accent-400, #60a5fa)' }}>
                        <span className="num muted" style={{ minWidth: 92 }}>{c.effectiveDate}</span>
                        <span style={{ fontWeight: 600 }}>{CHANGE_TYPE_LABEL[c.changeType] ?? c.changeType}</span>
                        <span className="num" style={{ color: Number(c.areaDeltaM2) >= 0 ? 'var(--ok-fg)' : 'var(--danger-fg)' }}>
                          {Number(c.areaDeltaM2) >= 0 ? '+' : ''}{Number(c.areaDeltaM2).toLocaleString('vi-VN')} m²
                        </span>
                        {c.reason && <span className="muted" style={{ fontSize: 13 }}>· {c.reason}</span>}
                      </li>
                    ))}
                  </ul>
                )}
            </section>

            <section className="panel" style={{ padding: 16 }}>
              <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Diện tích tại thời điểm</h2>
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} />
                <button className="btn btn-ghost btn-sm" onClick={async () => {
                  try { setAreaResult(await fetchAreaAtSnapshot(landPointId, asOf)); }
                  catch (e) { toast.problem(e); }
                }}>Tính</button>
              </div>
              {areaResult && (
                <div style={{ fontSize: 13.5 }}>
                  <div className="muted">Diện tích gốc: <b className="num">{areaResult.baseAreaM2.toLocaleString('vi-VN')}</b> m²</div>
                  <div style={{ marginTop: 6, fontSize: 22, fontWeight: 800 }} className="num">{areaResult.areaAtSnapshotM2.toLocaleString('vi-VN')} m²</div>
                  <div className="muted" style={{ fontSize: 12 }}>tại {asOf} (số kỳ trước không đổi)</div>
                </div>
              )}
            </section>
          </div>

          {/* Kiểm tra chất lượng dữ liệu */}
          <section className="panel" style={{ padding: 16 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>Kiểm tra chất lượng dữ liệu (DQ-DT02)</h2>
            {dq.isLoading ? <Skeleton rows={2} /> : dq.isError ? <ErrorState error={dq.error} /> :
              dq.data?.issueCount === 0 ? (
                <div style={{ color: 'var(--ok-fg)', display: 'flex', gap: 8, alignItems: 'center' }}><Icon name="check" size={16} /> Không phát hiện vấn đề.</div>
              ) : (
                <ul style={{ margin: 0, paddingLeft: 18, color: 'var(--danger-fg)' }}>
                  {dq.data?.issues.map((i, idx) => <li key={idx}><b className="num">{i.code}</b> · điểm đất {i.landPointId.slice(0, 8)}: {i.detail}</li>)}
                </ul>
              )}
          </section>
        </div>
      )}

      {allocOpen && <AllocModal landPointId={landPointId} onClose={() => setAllocOpen(false)} onDone={() => { setAllocOpen(false); qc.invalidateQueries({ queryKey: ['dt02', 'allocations'] }); qc.invalidateQueries({ queryKey: ['dt02', 'data-quality'] }); }} />}
      {changeOpen && <ChangeModal landPointId={landPointId} onClose={() => setChangeOpen(false)} onDone={() => { setChangeOpen(false); qc.invalidateQueries({ queryKey: ['dt02', 'changes'] }); }} />}
    </div>
  );
}

function AllocModal({ landPointId, onClose, onDone }: { landPointId: string; onClose: () => void; onDone: () => void }) {
  const [usageType, setUsageType] = useState('BUILDING_LAND');
  const [areaM2, setAreaM2] = useState('');
  const mut = useMutation({
    mutationFn: async () => api.post(`/dt02/land-points/${landPointId}/usage`, { usageType, areaM2: Number(areaM2) }),
    onSuccess: () => { toast.success('Đã thêm phân bổ.'); onDone(); },
    onError: (e) => toast.problem(e, 'Thêm phân bổ thất bại'),
  });
  return (
    <Modal open title="Thêm phân bổ hiện trạng" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} style={{ display: 'grid', gap: 12 }}>
        <label style={{ display: 'grid', gap: 4 }}>
          <span className="muted" style={{ fontSize: 13 }}>Loại sử dụng</span>
          <select value={usageType} onChange={(e) => setUsageType(e.target.value)}>
            {Object.entries(USAGE_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span className="muted" style={{ fontSize: 13 }}>Diện tích (m²)</span>
          <input type="number" value={areaM2} onChange={(e) => setAreaM2(e.target.value)} required min={0.01} step="0.01" />
          <span className="muted" style={{ fontSize: 12 }}>Tổng phân bổ không được vượt diện tích điểm đất (BR-DT02-004).</span>
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Hủy</button>
          <button type="submit" className="btn btn-primary" disabled={mut.isPending || !areaM2}>Thêm</button>
        </div>
      </form>
    </Modal>
  );
}

function ChangeModal({ landPointId, onClose, onDone }: { landPointId: string; onClose: () => void; onDone: () => void }) {
  const [changeType, setChangeType] = useState('INCREASE');
  const [areaDeltaM2, setAreaDeltaM2] = useState('');
  const [effectiveDate, setEffectiveDate] = useState('2026-09-06');
  const [reason, setReason] = useState('');
  const mut = useMutation({
    mutationFn: async () => api.post(`/dt02/land-points/${landPointId}/changes`, { changeType, areaDeltaM2: Number(areaDeltaM2), effectiveDate, reason: reason || undefined }),
    onSuccess: () => { toast.success('Đã ghi biến động.'); onDone(); },
    onError: (e) => toast.problem(e, 'Ghi biến động thất bại'),
  });
  return (
    <Modal open title="Ghi biến động điểm đất" onClose={onClose}>
      <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} style={{ display: 'grid', gap: 12 }}>
        <label style={{ display: 'grid', gap: 4 }}>
          <span className="muted" style={{ fontSize: 13 }}>Loại biến động</span>
          <select value={changeType} onChange={(e) => setChangeType(e.target.value)}>
            {Object.entries(CHANGE_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span className="muted" style={{ fontSize: 13 }}>Chênh lệch diện tích (m², âm nếu giảm)</span>
          <input type="number" value={areaDeltaM2} onChange={(e) => setAreaDeltaM2(e.target.value)} required step="0.01" />
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span className="muted" style={{ fontSize: 13 }}>Ngày hiệu lực</span>
          <input type="date" value={effectiveDate} onChange={(e) => setEffectiveDate(e.target.value)} required />
        </label>
        <label style={{ display: 'grid', gap: 4 }}>
          <span className="muted" style={{ fontSize: 13 }}>Lý do</span>
          <input value={reason} onChange={(e) => setReason(e.target.value)} />
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button type="button" className="btn btn-ghost" onClick={onClose}>Hủy</button>
          <button type="submit" className="btn btn-primary" disabled={mut.isPending || !areaDeltaM2}>Ghi</button>
        </div>
      </form>
    </Modal>
  );
}
