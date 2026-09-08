import { useEffect, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, ErrorState, Skeleton } from '../components/States';
import { Icon, type IconName } from '../components/Icon';
import { toast } from '../lib/toast';
import {
  CAMPAIGN_STATUS_LABEL,
  COUNT_TYPE_LABEL,
  VARIANCE_TYPE_LABEL,
  approveAdjustment,
  buildBookSnapshot,
  buildDataset,
  computeVariances,
  createAdjustment,
  createCampaign,
  createOfficial,
  createSheet,
  cutoffCampaign,
  lockOfficial,
  recountSheet,
  resolveVariance,
  reviseOfficial,
  saveQuality,
  submitSheet,
  unlockOfficial,
  updateSheetLines,
  useAdjustments,
  useBookSnapshot,
  useCampaign,
  useCampaigns,
  useDatasets,
  useOfficial,
  useReconciliation,
  useSheetDetail,
  useSheets,
  useVariances,
  type Sheet,
  type SheetLine,
} from '../lib/dt10';

type Step = 'setup' | 'count' | 'variance' | 'official' | 'adjust' | 'dataset';
const STEPS: Array<{ key: Step; label: string; icon: IconName }> = [
  { key: 'setup', label: 'Cutoff & book_snapshot', icon: 'lock' },
  { key: 'count', label: 'Kiểm đếm (blind) & chất lượng', icon: 'clipboard' },
  { key: 'variance', label: 'Đối chiếu lệch', icon: 'alert' },
  { key: 'official', label: 'Chốt chính thức & khóa', icon: 'check' },
  { key: 'adjust', label: 'Điều chỉnh → DT-05', icon: 'refresh' },
  { key: 'dataset', label: 'Dataset & hậu kiểm', icon: 'download' },
];

export function InventoryCountPage() {
  const qc = useQueryClient();
  const campaigns = useCampaigns();
  const [selected, setSelected] = useState<string | undefined>();
  const [form, setForm] = useState({ campaignCode: '', name: '', organizationId: '' });

  const createMut = useMutation({
    mutationFn: () =>
      createCampaign({
        campaignCode: form.campaignCode,
        name: form.name,
        scopeJson: form.organizationId ? { organizationId: form.organizationId } : {},
      }),
    onSuccess: (c) => {
      toast.success(`Đã lập đợt kiểm kê ${c.campaignCode}`);
      setForm({ campaignCode: '', name: '', organizationId: '' });
      qc.invalidateQueries({ queryKey: ['dt10', 'campaigns'] });
      setSelected(c.id);
    },
    onError: (e) => toast.problem(e, 'Không lập được đợt kiểm kê'),
  });

  return (
    <div>
      <PageHeader
        eyebrow="DT-10 · Quyển X"
        title="Kiểm kê & chốt số liệu"
        description="Ba lớp độc lập Sổ sách (book_snapshot tại cutoff) / Thực đếm (blind) / Chính thức (official khóa bất biến). Recount là vòng mới; điều chỉnh đi qua DT-05 (không sửa số dư trực tiếp); dataset gắn snapshot_version cấp cho DT-11."
      />

      <div style={{ display: 'grid', gridTemplateColumns: '340px 1fr', gap: 18, alignItems: 'start' }}>
        <div style={{ display: 'grid', gap: 14 }}>
          <div className="panel" style={{ padding: 14 }}>
            <h3 style={{ marginTop: 0, fontSize: 15 }}>Lập đợt kiểm kê</h3>
            <div style={{ display: 'grid', gap: 8 }}>
              <input className="input" placeholder="Mã đợt (campaign_code)" value={form.campaignCode} onChange={(e) => setForm({ ...form, campaignCode: e.target.value })} />
              <input className="input" placeholder="Tên đợt" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              <input className="input" placeholder="organizationId phạm vi (tùy chọn)" value={form.organizationId} onChange={(e) => setForm({ ...form, organizationId: e.target.value })} />
              <button className="btn btn-primary" disabled={!form.campaignCode || !form.name || createMut.isPending} onClick={() => createMut.mutate()}>
                <Icon name="plus" size={15} /> Lập đợt
              </button>
            </div>
          </div>

          {campaigns.isLoading ? (
            <Skeleton rows={4} />
          ) : campaigns.error ? (
            <ErrorState error={campaigns.error} />
          ) : !campaigns.data?.data.length ? (
            <EmptyState icon="clipboard" title="Chưa có đợt kiểm kê" hint="Lập đợt mới để bắt đầu." />
          ) : (
            <div style={{ display: 'grid', gap: 8 }}>
              {campaigns.data.data.map((c) => (
                <button
                  key={c.id}
                  className="panel"
                  onClick={() => setSelected(c.id)}
                  style={{ textAlign: 'left', padding: 12, cursor: 'pointer', borderColor: selected === c.id ? 'var(--color-accent-500, #0ea5a4)' : undefined }}
                >
                  <div style={{ fontWeight: 700 }}>{c.name}</div>
                  <div className="muted" style={{ fontSize: 12 }}>
                    {c.campaignCode} · {COUNT_TYPE_LABEL[c.countType] ?? c.countType} · {CAMPAIGN_STATUS_LABEL[c.status] ?? c.status}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div>{selected ? <CampaignDetail campaignId={selected} /> : <EmptyState icon="target" title="Chọn một đợt kiểm kê" hint="Chọn ở danh sách bên trái để thao tác." />}</div>
      </div>
    </div>
  );
}

function CampaignDetail({ campaignId }: { campaignId: string }) {
  const [step, setStep] = useState<Step>('setup');
  const campaign = useCampaign(campaignId);

  return (
    <div style={{ display: 'grid', gap: 16 }}>
      <div className="panel" style={{ padding: 14 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ margin: 0 }}>{campaign.data?.name ?? '…'}</h3>
            <div className="muted" style={{ fontSize: 12 }}>
              Trạng thái: {campaign.data ? (CAMPAIGN_STATUS_LABEL[campaign.data.status] ?? campaign.data.status) : '…'}
              {campaign.data?.cutoffTime && ` · cutoff ${new Date(campaign.data.cutoffTime).toLocaleString('vi-VN')}`}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {STEPS.map((s) => (
          <button key={s.key} className={step === s.key ? 'btn btn-primary' : 'btn'} onClick={() => setStep(s.key)}>
            <Icon name={s.icon} size={14} /> {s.label}
          </button>
        ))}
      </div>

      {step === 'setup' && <SetupStep campaignId={campaignId} />}
      {step === 'count' && <CountStep campaignId={campaignId} />}
      {step === 'variance' && <VarianceStep campaignId={campaignId} />}
      {step === 'official' && <OfficialStep campaignId={campaignId} />}
      {step === 'adjust' && <AdjustStep campaignId={campaignId} />}
      {step === 'dataset' && <DatasetStep campaignId={campaignId} />}
    </div>
  );
}

// SCR-DT10-02 — Thiết lập đợt + cutoff + dựng book_snapshot.
function SetupStep({ campaignId }: { campaignId: string }) {
  const qc = useQueryClient();
  const book = useBookSnapshot(campaignId);
  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['dt10', 'book', campaignId] });
    qc.invalidateQueries({ queryKey: ['dt10', 'campaign', campaignId] });
    qc.invalidateQueries({ queryKey: ['dt10', 'campaigns'] });
  };
  const cutoffMut = useMutation({ mutationFn: () => cutoffCampaign(campaignId), onSuccess: () => { toast.success('Đã chốt cutoff'); invalidate(); }, onError: (e) => toast.problem(e, 'Không chốt được cutoff') });
  const buildMut = useMutation({ mutationFn: () => buildBookSnapshot(campaignId), onSuccess: () => { toast.success('Đã dựng book_snapshot (bất biến)'); invalidate(); }, onError: (e) => toast.problem(e, 'Không dựng được book_snapshot') });

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="panel" style={{ padding: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="btn" disabled={cutoffMut.isPending} onClick={() => cutoffMut.mutate()}><Icon name="clock" size={14} /> Chốt cutoff</button>
        <button className="btn btn-primary" disabled={buildMut.isPending} onClick={() => buildMut.mutate()}><Icon name="lock" size={14} /> Dựng book_snapshot</button>
        <span className="muted" style={{ fontSize: 12.5 }}>Book_snapshot dựng từ sổ cái DT-04 tại cutoff, khóa bất biến (checksum).</span>
      </div>

      {book.isLoading ? (
        <Skeleton rows={3} />
      ) : book.error ? (
        <EmptyState icon="lock" title="Chưa dựng book_snapshot" hint="Chốt cutoff rồi dựng book_snapshot." />
      ) : (
        <div className="panel" style={{ padding: 16 }}>
          <div className="muted" style={{ fontSize: 12, fontFamily: 'monospace' }}>
            checksum {book.data!.snapshot.checksum.slice(0, 20)}… · {book.data!.snapshot.locked ? 'ĐÃ KHÓA' : 'mở'} · asOf {new Date(book.data!.snapshot.asOf).toLocaleString('vi-VN')}
          </div>
          <div style={{ overflowX: 'auto', marginTop: 10 }}>
            <table className="table">
              <thead><tr><th>Vật chất</th><th>Lô</th><th>Số sổ (book)</th><th>C1..C5</th></tr></thead>
              <tbody>
                {book.data!.lines.map((l) => (
                  <tr key={l.id}>
                    <td style={{ fontFamily: 'monospace' }}>{l.materialCatalogId.slice(0, 12)}…</td>
                    <td>{l.lotId ? l.lotId.slice(0, 8) : '—'}</td>
                    <td className="num">{l.bookQty}</td>
                    <td className="num">{[l.grade1, l.grade2, l.grade3, l.grade4, l.grade5].map(Number).join(' / ')}</td>
                  </tr>
                ))}
                {!book.data!.lines.length && <tr><td colSpan={4} className="muted">Không có dòng sổ (sổ cái trống theo phạm vi).</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// SCR-DT10-03/04/06 — Phiếu kiểm đếm blind (autosave) + chất lượng C1–5 + recount.
function CountStep({ campaignId }: { campaignId: string }) {
  const qc = useQueryClient();
  const sheets = useSheets(campaignId);
  const [sheetId, setSheetId] = useState<string | undefined>();
  const [org, setOrg] = useState('');

  const createMut = useMutation({
    mutationFn: () => createSheet(campaignId, { organizationId: org || undefined }),
    onSuccess: (s: Sheet) => { toast.success('Đã tạo phiếu kiểm đếm (blind)'); qc.invalidateQueries({ queryKey: ['dt10', 'sheets', campaignId] }); setSheetId(s.id); setOrg(''); },
    onError: (e) => toast.problem(e, 'Không tạo được phiếu'),
  });

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="panel" style={{ padding: 16, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <input className="input" placeholder="organizationId (tùy chọn)" value={org} onChange={(e) => setOrg(e.target.value)} />
        <button className="btn btn-primary" disabled={createMut.isPending} onClick={() => createMut.mutate()}><Icon name="plus" size={14} /> Tạo phiếu</button>
        <span className="muted" style={{ fontSize: 12.5 }}>Blind: phiếu KHÔNG hiển thị số sổ khi đếm.</span>
      </div>

      {sheets.isLoading ? (
        <Skeleton rows={3} />
      ) : !sheets.data?.length ? (
        <EmptyState icon="clipboard" title="Chưa có phiếu kiểm đếm" />
      ) : (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {sheets.data.map((s) => (
            <button key={s.id} className={sheetId === s.id ? 'btn btn-primary' : 'btn'} onClick={() => setSheetId(s.id)}>
              Phiếu {s.id.slice(0, 6)} · vòng {s.currentRound} · {s.status}
            </button>
          ))}
        </div>
      )}

      {sheetId && <SheetEditor sheetId={sheetId} campaignId={campaignId} />}
    </div>
  );
}

function SheetEditor({ sheetId, campaignId }: { sheetId: string; campaignId: string }) {
  const qc = useQueryClient();
  const detail = useSheetDetail(sheetId);
  const [draft, setDraft] = useState<Array<{ materialCatalogId: string; physicalQty: string }>>([{ materialCatalogId: '', physicalQty: '' }]);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const dirty = useRef(false);

  const editable = detail.data?.sheet.status === 'DRAFT' || detail.data?.sheet.status === 'NEEDS_REVISION';

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['dt10', 'sheet', sheetId] });
    qc.invalidateQueries({ queryKey: ['dt10', 'sheets', campaignId] });
  };

  // Autosave debounce 1200ms khi có thay đổi hợp lệ (SCR-DT10-03).
  useEffect(() => {
    if (!editable || !dirty.current) return;
    const valid = draft.filter((d) => d.materialCatalogId && d.physicalQty !== '');
    const t = setTimeout(async () => {
      try {
        await updateSheetLines(sheetId, valid.map((d) => ({ materialCatalogId: d.materialCatalogId, physicalQty: Number(d.physicalQty) })));
        setSavedAt(new Date().toLocaleTimeString('vi-VN'));
        dirty.current = false;
        invalidate();
      } catch (e) { toast.problem(e, 'Autosave lỗi'); }
    }, 1200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, editable, sheetId]);

  const submitMut = useMutation({ mutationFn: () => submitSheet(sheetId), onSuccess: () => { toast.success('Đã gửi phiếu'); invalidate(); }, onError: (e) => toast.problem(e, 'Không gửi được (phiếu rỗng?)') });
  const recountMut = useMutation({ mutationFn: () => recountSheet(sheetId, 'Kiểm đếm lại'), onSuccess: () => { toast.success('Đã mở vòng mới (giữ vòng trước)'); setDraft([{ materialCatalogId: '', physicalQty: '' }]); invalidate(); }, onError: (e) => toast.problem(e, 'Không recount được') });

  if (detail.isLoading) return <Skeleton rows={4} />;
  if (detail.error) return <ErrorState error={detail.error} />;
  const s = detail.data!.sheet;

  return (
    <div className="panel" style={{ padding: 16, display: 'grid', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
        <div><b>Phiếu {s.id.slice(0, 6)}</b> <span className="muted">· vòng {s.currentRound} · {s.status}</span> {savedAt && <span className="muted" style={{ fontSize: 12 }}>· đã lưu {savedAt}</span>}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn" disabled={!editable || submitMut.isPending} onClick={() => submitMut.mutate()}><Icon name="upload" size={14} /> Gửi phiếu</button>
          <button className="btn" disabled={s.status === 'DRAFT' || recountMut.isPending} onClick={() => recountMut.mutate()}><Icon name="refresh" size={14} /> Kiểm đếm lại (vòng mới)</button>
        </div>
      </div>

      {editable && (
        <div style={{ display: 'grid', gap: 8 }}>
          <div className="muted" style={{ fontSize: 12 }}>Nhập số thực đếm (blind — không có số sổ). Autosave sau 1.2s.</div>
          {draft.map((d, i) => (
            <div key={i} style={{ display: 'flex', gap: 8 }}>
              <input className="input" placeholder="material_catalog_id" value={d.materialCatalogId} onChange={(e) => { dirty.current = true; setDraft(draft.map((x, j) => (j === i ? { ...x, materialCatalogId: e.target.value } : x))); }} />
              <input className="input" style={{ width: 140 }} placeholder="Số thực đếm" value={d.physicalQty} onChange={(e) => { dirty.current = true; setDraft(draft.map((x, j) => (j === i ? { ...x, physicalQty: e.target.value } : x))); }} />
            </div>
          ))}
          <button className="btn btn-sm" onClick={() => setDraft([...draft, { materialCatalogId: '', physicalQty: '' }])}><Icon name="plus" size={13} /> Thêm dòng</button>
        </div>
      )}

      <div style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead><tr><th>Vòng</th><th>Vật chất</th><th>Thực đếm</th><th>Chất lượng C1–5</th></tr></thead>
          <tbody>
            {detail.data!.lines.map((l) => <QualityRow key={l.id} line={l} onSaved={invalidate} />)}
            {!detail.data!.lines.length && <tr><td colSpan={4} className="muted">Chưa có dòng nào.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function QualityRow({ line, onSaved }: { line: SheetLine; onSaved: () => void }) {
  const [g, setG] = useState(['', '', '', '', '']);
  const saveMut = useMutation({
    mutationFn: () => saveQuality(line.id, { grade1: Number(g[0] || 0), grade2: Number(g[1] || 0), grade3: Number(g[2] || 0), grade4: Number(g[3] || 0), grade5: Number(g[4] || 0) }),
    onSuccess: () => { toast.success('Đã lưu chất lượng'); onSaved(); },
    onError: (e) => toast.problem(e, 'Σ chất lượng phải = số thực đếm'),
  });
  return (
    <tr>
      <td>{line.roundNo}</td>
      <td style={{ fontFamily: 'monospace' }}>{line.materialCatalogId.slice(0, 12)}…</td>
      <td className="num">{line.physicalQty}</td>
      <td>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          {g.map((v, i) => (
            <input key={i} className="input" style={{ width: 48, padding: '4px 6px' }} placeholder={`C${i + 1}`} value={v} onChange={(e) => setG(g.map((x, j) => (j === i ? e.target.value : x)))} />
          ))}
          <button className="btn btn-sm" disabled={saveMut.isPending} onClick={() => saveMut.mutate()}>Lưu</button>
        </div>
      </td>
    </tr>
  );
}

// SCR-DT10-05 — Đối chiếu lệch.
function VarianceStep({ campaignId }: { campaignId: string }) {
  const qc = useQueryClient();
  const variances = useVariances(campaignId);
  const computeMut = useMutation({ mutationFn: () => computeVariances(campaignId), onSuccess: () => { toast.success('Đã đối chiếu'); qc.invalidateQueries({ queryKey: ['dt10', 'variances', campaignId] }); qc.invalidateQueries({ queryKey: ['dt10', 'campaign', campaignId] }); }, onError: (e) => toast.problem(e, 'Không đối chiếu được (đã có book_snapshot?)') });
  const resolveMut = useMutation({ mutationFn: (id: string) => resolveVariance(id, 'Đã xử lý'), onSuccess: () => { toast.success('Đã đánh dấu xử lý'); qc.invalidateQueries({ queryKey: ['dt10', 'variances', campaignId] }); }, onError: (e) => toast.problem(e, 'Lỗi') });

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="panel" style={{ padding: 16 }}>
        <button className="btn btn-primary" disabled={computeMut.isPending} onClick={() => computeMut.mutate()}><Icon name="alert" size={14} /> Đối chiếu Book ↔ Physical</button>
      </div>
      {variances.isLoading ? <Skeleton rows={3} /> : !variances.data?.length ? (
        <EmptyState icon="check" title="Chưa có chênh lệch" hint="Bấm Đối chiếu để sinh danh sách." />
      ) : (
        <div className="panel" style={{ overflowX: 'auto' }}>
          <table className="table">
            <thead><tr><th>Vật chất</th><th>Sổ</th><th>Thực</th><th>Lệch</th><th>Loại</th><th>Trạng thái</th><th></th></tr></thead>
            <tbody>
              {variances.data.map((v) => (
                <tr key={v.id}>
                  <td style={{ fontFamily: 'monospace' }}>{v.materialCatalogId.slice(0, 12)}…</td>
                  <td className="num">{v.bookQty}</td>
                  <td className="num">{v.physicalQty}</td>
                  <td className="num">{v.varianceQty}</td>
                  <td>{VARIANCE_TYPE_LABEL[v.varianceType] ?? v.varianceType}</td>
                  <td>{v.status}</td>
                  <td>{v.status === 'OPEN' && <button className="btn btn-sm" disabled={resolveMut.isPending} onClick={() => resolveMut.mutate(v.id)}>Đã xử lý</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// SCR-DT10-07 — Chốt số chính thức + khóa.
function OfficialStep({ campaignId }: { campaignId: string }) {
  const qc = useQueryClient();
  const official = useOfficial(campaignId);
  const [reason, setReason] = useState('');
  const invalidate = () => { qc.invalidateQueries({ queryKey: ['dt10', 'official', campaignId] }); qc.invalidateQueries({ queryKey: ['dt10', 'campaign', campaignId] }); qc.invalidateQueries({ queryKey: ['dt10', 'campaigns'] }); };

  const createMut = useMutation({ mutationFn: () => createOfficial(campaignId), onSuccess: () => { toast.success('Đã chốt official_snapshot'); invalidate(); }, onError: (e) => toast.problem(e, 'Không chốt được (đang khóa? cần đối chiếu?)') });
  const lockMut = useMutation({ mutationFn: () => lockOfficial(campaignId), onSuccess: () => { toast.success('Đã khóa (bất biến)'); invalidate(); }, onError: (e) => toast.problem(e, 'Không khóa được') });
  const unlockMut = useMutation({ mutationFn: () => unlockOfficial(campaignId, reason || 'Điều chỉnh'), onSuccess: () => { toast.success('Đã mở khóa'); setReason(''); invalidate(); }, onError: (e) => toast.problem(e, 'Không mở khóa được') });
  const reviseMut = useMutation({ mutationFn: () => reviseOfficial(campaignId, reason || 'Cập nhật'), onSuccess: () => { toast.success('Đã tạo revision (version mới)'); setReason(''); invalidate(); }, onError: (e) => toast.problem(e, 'Không revise được (đang khóa?)') });

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="panel" style={{ padding: 16, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <button className="btn btn-primary" disabled={createMut.isPending} onClick={() => createMut.mutate()}><Icon name="check" size={14} /> Chốt số chính thức</button>
        <button className="btn" disabled={lockMut.isPending} onClick={() => lockMut.mutate()}><Icon name="lock" size={14} /> Khóa</button>
        <input className="input" style={{ width: 200 }} placeholder="Lý do (mở khóa/revise)" value={reason} onChange={(e) => setReason(e.target.value)} />
        <button className="btn" disabled={unlockMut.isPending} onClick={() => unlockMut.mutate()}>Mở khóa</button>
        <button className="btn" disabled={reviseMut.isPending} onClick={() => reviseMut.mutate()}><Icon name="edit" size={14} /> Tạo revision</button>
      </div>
      {official.isLoading ? <Skeleton rows={3} /> : official.error ? (
        <EmptyState icon="check" title="Chưa có official_snapshot" hint="Đối chiếu xong rồi Chốt số chính thức." />
      ) : (
        <div className="panel" style={{ padding: 16 }}>
          <div className="muted" style={{ fontSize: 12.5, fontFamily: 'monospace' }}>
            version {official.data!.snapshot.version} · {official.data!.locked ? 'ĐÃ KHÓA (bất biến)' : 'mở'} · checksum {official.data!.snapshot.checksum.slice(0, 20)}…
          </div>
          <div style={{ overflowX: 'auto', marginTop: 10 }}>
            <table className="table">
              <thead><tr><th>Vật chất</th><th>Lô</th><th>Số chính thức</th></tr></thead>
              <tbody>
                {official.data!.lines.map((l) => (
                  <tr key={l.id}><td style={{ fontFamily: 'monospace' }}>{l.materialCatalogId.slice(0, 12)}…</td><td>{l.lotId ? l.lotId.slice(0, 8) : '—'}</td><td className="num">{l.officialQty}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// SCR-DT10-08 — Điều chỉnh → DT-05.
function AdjustStep({ campaignId }: { campaignId: string }) {
  const qc = useQueryClient();
  const variances = useVariances(campaignId);
  const adjustments = useAdjustments(campaignId);
  const invalidate = () => { qc.invalidateQueries({ queryKey: ['dt10', 'adjustments', campaignId] }); qc.invalidateQueries({ queryKey: ['dt10', 'campaign', campaignId] }); };
  const createMut = useMutation({ mutationFn: (varianceId: string) => createAdjustment(campaignId, varianceId), onSuccess: () => { toast.success('Đã lập yêu cầu điều chỉnh'); invalidate(); }, onError: (e) => toast.problem(e, 'Không lập được (cần organizationId phạm vi)') });
  const approveMut = useMutation({ mutationFn: (id: string) => approveAdjustment(id), onSuccess: () => { toast.success('Đã duyệt → sinh chứng từ DT-05 (POSTED)'); invalidate(); }, onError: (e) => toast.problem(e, 'Không duyệt được') });

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="panel" style={{ padding: 16 }}>
        <h4 style={{ marginTop: 0 }}>Chọn chênh lệch để lập điều chỉnh</h4>
        {!variances.data?.length ? <span className="muted">Chưa có chênh lệch (đối chiếu trước).</span> : (
          <div style={{ display: 'grid', gap: 6 }}>
            {variances.data.map((v) => (
              <div key={v.id} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v.materialCatalogId.slice(0, 12)}…</span>
                <span className="muted">{VARIANCE_TYPE_LABEL[v.varianceType] ?? v.varianceType} · Δ {v.varianceQty}</span>
                <button className="btn btn-sm" disabled={createMut.isPending} onClick={() => createMut.mutate(v.id)}>Lập điều chỉnh</button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="panel" style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead><tr><th>Mã YC</th><th>Vật chất</th><th>Δ</th><th>Trạng thái</th><th>Chứng từ DT-05</th><th></th></tr></thead>
          <tbody>
            {(adjustments.data ?? []).map((a) => (
              <tr key={a.id}>
                <td>{a.requestCode}</td>
                <td style={{ fontFamily: 'monospace' }}>{a.materialCatalogId.slice(0, 10)}…</td>
                <td className="num">{a.proposedDelta}</td>
                <td>{a.status}</td>
                <td style={{ fontFamily: 'monospace' }}>{a.dt05DocumentId ? a.dt05DocumentId.slice(0, 8) + '…' : '—'}</td>
                <td>{a.status !== 'POSTED' && <button className="btn btn-sm" disabled={approveMut.isPending} onClick={() => approveMut.mutate(a.id)}>Duyệt → DT-05</button>}</td>
              </tr>
            ))}
            {!adjustments.data?.length && <tr><td colSpan={6} className="muted">Chưa có yêu cầu điều chỉnh.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// SCR-DT10-09/10 — Dataset biểu KK (→ DT-11) + reconciliation hậu kiểm.
function DatasetStep({ campaignId }: { campaignId: string }) {
  const qc = useQueryClient();
  const datasets = useDatasets(campaignId);
  const recon = useReconciliation(campaignId);
  const [formCode, setFormCode] = useState('03/KK');
  const buildMut = useMutation({ mutationFn: () => buildDataset(campaignId, formCode), onSuccess: (d) => { toast.success(`Đã sinh dataset ${d.formCode} (version ${d.snapshotVersion})`); qc.invalidateQueries({ queryKey: ['dt10', 'datasets', campaignId] }); }, onError: (e) => toast.problem(e, 'Không sinh được (cần official_snapshot)') });

  return (
    <div style={{ display: 'grid', gap: 14 }}>
      <div className="panel" style={{ padding: 16, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <select className="input" value={formCode} onChange={(e) => setFormCode(e.target.value)}>
          {['01/KK', '02/KK', '03/KK', '01/KKDT', '02/KKDT', '03/KKDT'].map((f) => <option key={f} value={f}>{f}</option>)}
        </select>
        <button className="btn btn-primary" disabled={buildMut.isPending} onClick={() => buildMut.mutate()}><Icon name="download" size={14} /> Sinh dataset → DT-11</button>
      </div>

      <div className="panel" style={{ overflowX: 'auto' }}>
        <table className="table">
          <thead><tr><th>Biểu</th><th>snapshot_version</th><th>dataset_hash</th><th>Thời điểm</th></tr></thead>
          <tbody>
            {(datasets.data ?? []).map((d) => (
              <tr key={d.id}><td>{d.formCode}</td><td className="num">{d.snapshotVersion}</td><td style={{ fontFamily: 'monospace' }}>{d.datasetHash.slice(0, 16)}…</td><td>{new Date(d.createdAt).toLocaleString('vi-VN')}</td></tr>
            ))}
            {!datasets.data?.length && <tr><td colSpan={4} className="muted">Chưa sinh dataset.</td></tr>}
          </tbody>
        </table>
      </div>

      {recon.data && (
        <div className="panel" style={{ padding: 16 }}>
          <h4 style={{ marginTop: 0 }}>Reconciliation hậu kiểm (official v{recon.data.snapshotVersion} ↔ HC hiện tại)</h4>
          <div style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead><tr><th>Vật chất</th><th>Chính thức</th><th>HC hiện tại</th><th>Lệch</th></tr></thead>
              <tbody>
                {recon.data.rows.map((r, i) => (
                  <tr key={i}><td style={{ fontFamily: 'monospace' }}>{r.materialCatalogId.slice(0, 12)}…</td><td className="num">{r.officialQty}</td><td className="num">{r.hcNow}</td><td className="num">{r.diff}</td></tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
