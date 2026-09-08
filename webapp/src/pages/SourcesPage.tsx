import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, ErrorState, Skeleton } from '../components/States';
import { Icon, type IconName } from '../components/Icon';
import { toast } from '../lib/toast';
import {
  VERIFY_STATUS_LABEL,
  addMaterial,
  assessMobilization,
  createSource,
  useSource,
  useSources,
  verifyMaterial,
  type SourceMaterialView,
} from '../lib/dt09';

type Tab = 'list' | 'detail';
const TABS: Array<{ key: Tab; label: string; icon: IconName }> = [
  { key: 'list', label: 'Danh sách nguồn', icon: 'map' },
  { key: 'detail', label: 'Hồ sơ nguồn', icon: 'file' },
];

function verifyTone(status: string | undefined): string {
  if (status === 'VERIFIED') return 'var(--color-success-600, #16a34a)';
  if (status === 'EXPIRED') return 'var(--color-danger-600, #dc2626)';
  return 'var(--color-neutral-500, #6b7280)';
}

export function SourcesPage() {
  const [tab, setTab] = useState<Tab>('list');
  const [selectedId, setSelectedId] = useState<string | undefined>();
  const qc = useQueryClient();
  const sources = useSources();

  // ---- Khai báo nguồn (SCR-01) ----
  const [form, setForm] = useState({ name: '', adminUnitId: '', sourceType: 'SUPPLIER', contactPhone: '', address: '' });
  const createMut = useMutation({
    mutationFn: () => createSource({ ...form }),
    onSuccess: (s) => {
      toast.success(`Đã khai báo nguồn ${s.sourceCode}`);
      setForm({ name: '', adminUnitId: '', sourceType: 'SUPPLIER', contactPhone: '', address: '' });
      qc.invalidateQueries({ queryKey: ['dt09', 'sources'] });
      setSelectedId(s.id);
      setTab('detail');
    },
    onError: (e) => toast.problem(e, 'Không khai báo được nguồn'),
  });

  const openDetail = (id: string) => {
    setSelectedId(id);
    setTab('detail');
  };

  return (
    <div>
      <PageHeader
        eyebrow="DT-09 · Quyển IX"
        title="Nguồn địa bàn"
        description="Hồ sơ nguồn khai thác tại chỗ theo xã/điểm (DT-02): khai báo vật chất → xác minh (vòng đời tin cậy UNVERIFIED→VERIFIED→EXPIRED) → đánh giá huy động. Lưu ý: VERIFIED ≠ ELIGIBLE (còn phụ thuộc huy động & lead-time)."
      />

      <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? 'btn btn-primary' : 'btn'} onClick={() => setTab(t.key)}>
            <Icon name={t.icon} size={15} /> {t.label}
          </button>
        ))}
      </div>

      {tab === 'list' && (
        <div style={{ display: 'grid', gap: 18 }}>
          <div className="panel" style={{ padding: 16 }}>
            <h3 style={{ marginTop: 0 }}>Khai báo nguồn</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
              <input className="input" placeholder="Tên nguồn" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input className="input" placeholder="admin_unit_id (xã/điểm)" value={form.adminUnitId} onChange={(e) => setForm({ ...form, adminUnitId: e.target.value })} />
              <input className="input" placeholder="Loại nguồn (SUPPLIER…)" value={form.sourceType} onChange={(e) => setForm({ ...form, sourceType: e.target.value })} />
              <input className="input" placeholder="Điện thoại liên hệ" value={form.contactPhone} onChange={(e) => setForm({ ...form, contactPhone: e.target.value })} />
              <input className="input" placeholder="Địa chỉ" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div style={{ marginTop: 12 }}>
              <button
                className="btn btn-primary"
                disabled={!form.name || !form.adminUnitId || createMut.isPending}
                onClick={() => createMut.mutate()}
              >
                <Icon name="plus" size={15} /> Khai báo nguồn
              </button>
            </div>
          </div>

          {sources.isLoading ? (
            <Skeleton rows={5} />
          ) : sources.error ? (
            <ErrorState error={sources.error} />
          ) : !sources.data?.data.length ? (
            <EmptyState icon="map" title="Chưa có nguồn địa bàn" hint="Khai báo nguồn khai thác tại chỗ theo xã/điểm." />
          ) : (
            <div className="panel" style={{ overflowX: 'auto' }}>
              <table className="table">
                <thead>
                  <tr><th>Mã</th><th>Tên</th><th>Loại</th><th>Xã/điểm</th><th>Trạng thái</th><th></th></tr>
                </thead>
                <tbody>
                  {sources.data.data.map((s) => (
                    <tr key={s.id}>
                      <td>{s.sourceCode}</td>
                      <td>{s.name}</td>
                      <td>{s.sourceType}</td>
                      <td style={{ fontFamily: 'monospace', fontSize: 12 }}>{s.adminUnitId?.slice(0, 8)}</td>
                      <td>{s.status}</td>
                      <td><button className="btn" onClick={() => openDetail(s.id)}>Chọn</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === 'detail' && (
        selectedId ? <SourceDetailPanel sourceId={selectedId} /> : <EmptyState icon="file" title="Chọn một nguồn ở tab Danh sách" />
      )}
    </div>
  );
}

function SourceDetailPanel({ sourceId }: { sourceId: string }) {
  const qc = useQueryClient();
  const detail = useSource(sourceId);
  const [mat, setMat] = useState({ materialCatalogId: '', declaredQty: '' });

  const invalidate = () => qc.invalidateQueries({ queryKey: ['dt09', 'source', sourceId] });

  const addMut = useMutation({
    mutationFn: () => addMaterial(sourceId, { materialCatalogId: mat.materialCatalogId, declaredQty: Number(mat.declaredQty) }),
    onSuccess: () => {
      toast.success('Đã thêm vật chất khai báo');
      setMat({ materialCatalogId: '', declaredQty: '' });
      invalidate();
    },
    onError: (e) => toast.problem(e, 'Không thêm được vật chất'),
  });

  if (detail.isLoading) return <Skeleton rows={6} />;
  if (detail.error) return <ErrorState error={detail.error} />;
  const src = detail.data!;

  return (
    <div style={{ display: 'grid', gap: 18 }}>
      <div className="panel" style={{ padding: 16 }}>
        <h3 style={{ marginTop: 0 }}>{src.name} <span className="muted">({src.sourceCode})</span></h3>
        <div className="muted">Loại: {src.sourceType} · Xã/điểm: {src.adminUnitId?.slice(0, 8)} · Hiệu lực từ {src.effectiveFrom}</div>
      </div>

      <div className="panel" style={{ padding: 16 }}>
        <h4 style={{ marginTop: 0 }}>Thêm vật chất khai báo</h4>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <input className="input" placeholder="material_catalog_id" value={mat.materialCatalogId} onChange={(e) => setMat({ ...mat, materialCatalogId: e.target.value })} />
          <input className="input" placeholder="Số lượng khai báo" value={mat.declaredQty} onChange={(e) => setMat({ ...mat, declaredQty: e.target.value })} />
          <button className="btn btn-primary" disabled={!mat.materialCatalogId || !mat.declaredQty || addMut.isPending} onClick={() => addMut.mutate()}>
            <Icon name="plus" size={15} /> Thêm vật chất
          </button>
        </div>
      </div>

      {!src.materials.length ? (
        <EmptyState icon="box" title="Chưa có vật chất khai báo" />
      ) : (
        src.materials.map((m) => <MaterialCard key={m.id} m={m} onDone={invalidate} />)
      )}
    </div>
  );
}

function MaterialCard({ m, onDone }: { m: SourceMaterialView; onDone: () => void }) {
  const [ver, setVer] = useState({ verifiedQty: '', expiresAt: '' });
  const [mob, setMob] = useState({ mobilizableQty: '', leadTimeDays: '' });

  const verifyMut = useMutation({
    mutationFn: () =>
      verifyMaterial(m.id, { status: 'VERIFIED', verifiedQty: Number(ver.verifiedQty), expiresAt: ver.expiresAt || undefined }),
    onSuccess: () => {
      toast.success('Đã xác minh nguồn');
      onDone();
    },
    onError: (e) => toast.problem(e, 'Không xác minh được'),
  });

  const assessMut = useMutation({
    mutationFn: () => assessMobilization(m.id, { mobilizableQty: Number(mob.mobilizableQty), leadTimeDays: Number(mob.leadTimeDays) }),
    onSuccess: () => {
      toast.success('Đã đánh giá huy động');
      onDone();
    },
    onError: (e) => toast.problem(e, 'Không đánh giá được (mobilizable ≤ verified?)'),
  });

  const eff = m.verification?.effectiveStatus;

  return (
    <div className="panel" style={{ padding: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontFamily: 'monospace' }}>{m.materialCatalogId.slice(0, 12)}… · khai báo {m.declaredQty}</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <span style={{ color: verifyTone(eff), fontWeight: 700 }} data-testid="verify-status">
            {VERIFY_STATUS_LABEL[eff ?? 'UNVERIFIED']}
          </span>
          {m.mobilization && <span className="muted">huy động {m.mobilization.mobilizableQty} · lead {m.mobilization.leadTimeDays}d</span>}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 14, marginTop: 12 }}>
        <div>
          <div className="muted" style={{ marginBottom: 6 }}>Xác minh (BR-001/002)</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input className="input" placeholder="verified_qty" value={ver.verifiedQty} onChange={(e) => setVer({ ...ver, verifiedQty: e.target.value })} />
            <input className="input" placeholder="Hết hạn (YYYY-MM-DD)" value={ver.expiresAt} onChange={(e) => setVer({ ...ver, expiresAt: e.target.value })} />
            <button className="btn" disabled={!ver.verifiedQty || verifyMut.isPending} onClick={() => verifyMut.mutate()}>
              <Icon name="check" size={14} /> Xác minh
            </button>
          </div>
        </div>
        <div>
          <div className="muted" style={{ marginBottom: 6 }}>Đánh giá huy động (BR-003: ≤ verified)</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input className="input" placeholder="mobilizable_qty" value={mob.mobilizableQty} onChange={(e) => setMob({ ...mob, mobilizableQty: e.target.value })} />
            <input className="input" placeholder="lead_time (ngày)" value={mob.leadTimeDays} onChange={(e) => setMob({ ...mob, leadTimeDays: e.target.value })} />
            <button className="btn" disabled={!mob.mobilizableQty || !mob.leadTimeDays || assessMut.isPending} onClick={() => assessMut.mutate()}>
              <Icon name="target" size={14} /> Đánh giá huy động
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
