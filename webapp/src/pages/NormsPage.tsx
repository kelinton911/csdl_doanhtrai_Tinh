import { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../components/PageHeader';
import { StatusBadge } from '../components/StatusBadge';
import { ErrorState, Skeleton, EmptyState } from '../components/States';
import { Icon, type IconName } from '../components/Icon';
import { toast } from '../lib/toast';
import { dateTime } from '../lib/format';
import {
  DIMENSION_LABEL,
  RESOLVE_STATUS_LABEL,
  SOURCE_STATUS_LABEL,
  addAssignment,
  addMaterialNorm,
  addNormScopes,
  addProgress,
  addRequirement,
  createCommand,
  createNormSet,
  createNormSetVersion,
  importNorms,
  publishSetVersion,
  resolveConflict,
  resolveNorm,
  transitionCommand,
  uploadNormsFile,
  useAssignments,
  useCalcParams,
  useCommands,
  useConflicts,
  useLegacyNorms,
  useNorms,
  useNormDocuments,
  useNormSets,
  useProgress,
  useRequirements,
  useSetVersions,
  type CommandItem,
  type ImportRow,
  type MaterialNorm,
  type Requirement,
  type ResolveResult,
  type ResolveScope,
} from '../lib/norms';

type Tab = 'resolve' | 'sets' | 'edit' | 'conflicts' | 'commands' | 'docs' | 'legacy';
const TABS: Array<{ key: Tab; label: string; icon: IconName }> = [
  { key: 'resolve', label: 'Thử chọn định mức', icon: 'target' },
  { key: 'sets', label: 'Bộ định mức', icon: 'grid' },
  { key: 'edit', label: 'Biên tập & nhập', icon: 'upload' },
  { key: 'conflicts', label: 'Xung đột', icon: 'alert' },
  { key: 'commands', label: 'Chỉ lệnh hậu cần', icon: 'clipboard' },
  { key: 'docs', label: 'Văn bản căn cứ', icon: 'file' },
  { key: 'legacy', label: 'Legacy chưa xác minh', icon: 'lock' },
];

export function NormsPage() {
  const [tab, setTab] = useState<Tab>('resolve');
  // Cho phép chuyển từ tab Bộ định mức sang Thử resolve với material/semantic đã chọn.
  const [prefill, setPrefill] = useState<{ materialCatalogId: string; semanticParam: string } | null>(null);

  const goResolve = (materialCatalogId: string, semanticParam: string) => {
    setPrefill({ materialCatalogId, semanticParam });
    setTab('resolve');
  };

  return (
    <div>
      <PageHeader
        eyebrow="DT-07 · Quyển VII"
        title="Định mức & Chỉ lệnh hậu cần"
        description="Kho định mức CÓ CĂN CỨ + bộ chọn deterministic phục vụ tính nhu cầu (DT-08): SELECTED / NO_RULE / CONFLICT kèm giải thích — không bao giờ ngầm coi = 0."
      />

      <div style={{ display: 'flex', gap: 6, marginBottom: 18, flexWrap: 'wrap' }}>
        {TABS.map((t) => (
          <button
            key={t.key}
            className={tab === t.key ? 'btn btn-primary' : 'btn'}
            onClick={() => setTab(t.key)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <Icon name={t.icon} size={14} />
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'resolve' && <ResolveTab prefill={prefill} />}
      {tab === 'sets' && <SetsTab onPickNorm={goResolve} />}
      {tab === 'edit' && <EditTab />}
      {tab === 'conflicts' && <ConflictsTab onInspect={goResolve} />}
      {tab === 'commands' && <CommandsTab />}
      {tab === 'docs' && <DocsTab />}
      {tab === 'legacy' && <LegacyTab />}
    </div>
  );
}

// ============================ Thử chọn định mức ============================
const SCOPE_FIELDS: Array<{ key: keyof ResolveScope; label: string }> = [
  { key: 'mission', label: 'Nhiệm vụ' },
  { key: 'phase', label: 'Giai đoạn' },
  { key: 'org', label: 'Đơn vị' },
  { key: 'territory', label: 'Địa bàn' },
  { key: 'quality', label: 'Chất lượng' },
  { key: 'scale', label: 'Quy mô' },
  { key: 'time', label: 'Thời kỳ' },
];

function ResolveTab({ prefill }: { prefill: { materialCatalogId: string; semanticParam: string } | null }) {
  const params = useCalcParams();
  const [material, setMaterial] = useState(prefill?.materialCatalogId ?? '');
  const [semantic, setSemantic] = useState(prefill?.semanticParam ?? 'CONSUMPTION_COMBAT');
  const [scope, setScope] = useState<ResolveScope>({});
  const [asOf, setAsOf] = useState('');
  const [result, setResult] = useState<ResolveResult | null>(null);

  // Nếu prefill đổi (bấm “Thử chọn” từ tab khác) thì cập nhật form.
  useEffect(() => {
    if (prefill) {
      setMaterial(prefill.materialCatalogId);
      setSemantic(prefill.semanticParam);
      setResult(null);
    }
  }, [prefill]);

  const run = useMutation({
    mutationFn: () => {
      const cleanScope: ResolveScope = {};
      for (const f of SCOPE_FIELDS) {
        const v = (scope[f.key] ?? '').trim();
        if (v) cleanScope[f.key] = v;
      }
      return resolveNorm({
        materialCatalogId: material.trim(),
        semanticParam: semantic,
        scope: cleanScope,
        asOfTime: asOf || undefined,
      });
    },
    onSuccess: (r) => setResult(r),
    onError: (e) => toast.problem(e, 'Không chọn được định mức'),
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 420px) 1fr', gap: 18, alignItems: 'start' }}>
      <div className="panel" style={{ padding: 16 }}>
        <div className="eyebrow" style={{ marginBottom: 10 }}>Bối cảnh yêu cầu (DT-08 gửi)</div>
        <label className="form-label">Mã vật chất (UUID)</label>
        <input className="input" value={material} onChange={(e) => setMaterial(e.target.value)} placeholder="material_catalog_id" style={{ width: '100%', marginBottom: 10 }} />

        <label className="form-label">Tham số ngữ nghĩa</label>
        <select className="input" value={semantic} onChange={(e) => setSemantic(e.target.value)} style={{ width: '100%', marginBottom: 10 }}>
          {(params.data ?? []).map((p) => (
            <option key={p.id} value={p.semanticParam}>{p.semanticParam} — {p.description}</option>
          ))}
          {(params.data ?? []).length === 0 && <option value={semantic}>{semantic}</option>}
        </select>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 10 }}>
          {SCOPE_FIELDS.map((f) => (
            <div key={f.key}>
              <label className="form-label">{f.label}</label>
              <input
                className="input"
                value={scope[f.key] ?? ''}
                onChange={(e) => setScope((s) => ({ ...s, [f.key]: e.target.value }))}
                placeholder={String(f.key)}
                style={{ width: '100%' }}
              />
            </div>
          ))}
        </div>

        <label className="form-label">Tại thời điểm (as_of, tùy chọn)</label>
        <input className="input" type="datetime-local" value={asOf} onChange={(e) => setAsOf(e.target.value)} style={{ width: '100%', marginBottom: 14 }} />

        <button className="btn btn-primary" disabled={!material.trim() || run.isPending} onClick={() => run.mutate()} style={{ width: '100%' }}>
          {run.isPending ? 'Đang chọn…' : 'Chọn định mức (resolve)'}
        </button>
      </div>

      <div>
        {!result && <EmptyState icon="target" title="Chưa có kết quả" hint="Nhập mã vật chất + ngữ nghĩa + bối cảnh rồi bấm “Chọn định mức”. Kết quả trả về kèm giải thích (trace) vì sao chọn/không chọn." />}
        {result && <ResolveResultView result={result} />}
      </div>
    </div>
  );
}

function statusTone(status: string): 'ok' | 'warn' | 'danger' {
  return status === 'SELECTED' ? 'ok' : status === 'CONFLICT' ? 'danger' : 'warn';
}

function ResolveResultView({ result }: { result: ResolveResult }) {
  const tone = statusTone(result.status);
  const color = tone === 'ok' ? 'var(--ok-fg)' : tone === 'danger' ? 'var(--danger-fg)' : 'var(--warn-fg)';
  const bg = tone === 'ok' ? 'var(--ok-bg)' : tone === 'danger' ? 'var(--danger-bg)' : 'var(--warn-bg)';
  const bd = tone === 'ok' ? 'var(--ok-bd)' : tone === 'danger' ? 'var(--danger-bd)' : 'var(--warn-bd)';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="panel" style={{ padding: 16, borderColor: bd, background: bg, color }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 16 }}>
          <Icon name={result.status === 'SELECTED' ? 'check' : 'alert'} size={18} />
          {RESOLVE_STATUS_LABEL[result.status] ?? result.status}
        </div>
        {result.selected && (
          <div style={{ marginTop: 8, fontSize: 14 }}>
            <div>Giá trị: <b className="num">{result.selected.valueNumeric ?? '—'}</b> {result.selected.rawValue && <span className="muted">(gốc: {result.selected.rawValue})</span>}</div>
            <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>Kiểu: {result.selected.valueType} · norm {result.selected.normId.slice(0, 8)}…</div>
          </div>
        )}
        {result.status === 'CONFLICT' && (
          <div style={{ marginTop: 8, fontSize: 13.5 }}>
            {result.candidateNormIds?.length ?? 0} định mức ngang ưu tiên — hệ thống KHÔNG tự chọn. Giải quyết tại tab “Xung đột”.
          </div>
        )}
        <div style={{ marginTop: 8, fontSize: 12.5, opacity: 0.9 }}>{result.trace.decision}</div>
      </div>

      {result.sourceReference && (
        <div className="panel" style={{ padding: 14 }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>Căn cứ pháp lý (source reference)</div>
          <div style={{ fontSize: 13.5 }}>
            Trang {result.sourceReference.pageNo ?? '—'} · {result.sourceReference.lineRef ?? '—'}
            {result.sourceReference.appendixCode && ` · Phụ lục ${result.sourceReference.appendixCode}`}
          </div>
          {result.sourceReference.quoteText && <div className="muted" style={{ marginTop: 4, fontStyle: 'italic' }}>“{result.sourceReference.quoteText}”</div>}
        </div>
      )}

      <div className="panel" style={{ padding: 14 }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>
          Giải thích (trace) · chiến lược {result.trace.strategy}
          {result.trace.authorityRankApplied && ' · đã áp authority_rank'}
        </div>
        <table className="table" style={{ width: '100%', fontSize: 12.5 }}>
          <thead>
            <tr>
              <th style={{ textAlign: 'left' }}>Định mức</th>
              <th style={{ textAlign: 'center' }}>Đủ ĐK</th>
              <th style={{ textAlign: 'left' }}>Chiều khớp</th>
              <th style={{ textAlign: 'center' }}>Độ đặc thù</th>
              <th style={{ textAlign: 'center' }}>Hạng CQ</th>
              <th style={{ textAlign: 'left' }}>Lý do loại</th>
            </tr>
          </thead>
          <tbody>
            {result.trace.considered.map((c) => (
              <tr key={c.normId}>
                <td className="num">{c.normId.slice(0, 8)}…</td>
                <td style={{ textAlign: 'center' }}>{c.eligible ? '✓' : '—'}</td>
                <td>{c.matchedDimensions.map((d) => DIMENSION_LABEL[d] ?? d).join(', ') || '(tổng quát)'}</td>
                <td style={{ textAlign: 'center' }} className="num">{c.specificity}</td>
                <td style={{ textAlign: 'center' }} className="num">{c.authorityRank ?? '—'}</td>
                <td className="muted">{c.reason ?? ''}</td>
              </tr>
            ))}
            {result.trace.considered.length === 0 && (
              <tr><td colSpan={6} className="muted">Không có ứng viên nào trong các bộ định mức đã công bố.</td></tr>
            )}
          </tbody>
        </table>
        <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>as_of: {result.asOfTime}</div>
      </div>
    </div>
  );
}

// ============================ Bộ định mức ============================
function SetsTab({ onPickNorm }: { onPickNorm: (material: string, semantic: string) => void }) {
  const qc = useQueryClient();
  const sets = useNormSets();
  const [setId, setSetId] = useState<string | undefined>();
  const [versionId, setVersionId] = useState<string | undefined>();
  const versions = useSetVersions(setId);
  const norms = useNorms(versionId);

  const publish = useMutation({
    mutationFn: (id: string) => publishSetVersion(id),
    onSuccess: () => { toast.success('Đã công bố bộ định mức (bất biến).'); qc.invalidateQueries({ queryKey: ['dt07', 'set-versions', setId] }); },
    onError: (e) => toast.problem(e, 'Không công bố được'),
  });

  if (sets.isLoading) return <Skeleton rows={6} />;
  if (sets.error) return <ErrorState error={sets.error} />;
  const list = sets.data?.data ?? [];
  if (list.length === 0) return <EmptyState icon="grid" title="Chưa có bộ định mức" hint="Chạy seed:norms-dt07 hoặc tạo qua API /norm-sets." />;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16, alignItems: 'start' }}>
      <div className="panel" style={{ padding: 8 }}>
        {list.map((s) => (
          <button
            key={s.id}
            className="btn"
            onClick={() => { setSetId(s.id); setVersionId(undefined); }}
            style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: 4, background: setId === s.id ? 'var(--color-neutral-200)' : undefined }}
          >
            <div style={{ fontWeight: 700, fontSize: 13 }}>{s.setCode}</div>
            <div className="muted" style={{ fontSize: 12 }}>{s.name}</div>
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {!setId && <EmptyState icon="grid" title="Chọn một bộ định mức" hint="Chọn ở cột trái để xem các phiên bản." />}
        {setId && versions.isLoading && <Skeleton rows={3} />}
        {setId && versions.data && (
          <div className="panel" style={{ padding: 14 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Phiên bản</div>
            <table className="table" style={{ width: '100%', fontSize: 13 }}>
              <thead><tr><th style={{ textAlign: 'left' }}>Nhãn</th><th style={{ textAlign: 'left' }}>Hiệu lực</th><th>Trạng thái</th><th></th></tr></thead>
              <tbody>
                {versions.data.map((v) => (
                  <tr key={v.id} style={{ background: versionId === v.id ? 'var(--color-neutral-100)' : undefined }}>
                    <td><button className="btn" style={{ padding: '2px 8px' }} onClick={() => setVersionId(v.id)}>{v.versionLabel}</button></td>
                    <td className="muted">{v.effectiveFrom ?? '—'} → {v.effectiveTo ?? '…'}</td>
                    <td style={{ textAlign: 'center' }}><StatusBadge status={v.status} /></td>
                    <td style={{ textAlign: 'right' }}>
                      {(v.status === 'DRAFT' || v.status === 'VALIDATED') && (
                        <button className="btn btn-primary" style={{ padding: '2px 10px' }} disabled={publish.isPending} onClick={() => publish.mutate(v.id)}>Công bố</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {versionId && norms.data && (
          <div className="panel" style={{ padding: 14 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Định mức trong phiên bản</div>
            <NormsTable norms={norms.data} onPick={onPickNorm} />
          </div>
        )}
      </div>
    </div>
  );
}

function NormsTable({ norms, onPick }: { norms: MaterialNorm[]; onPick: (material: string, semantic: string) => void }) {
  if (norms.length === 0) return <EmptyState icon="box" title="Chưa có định mức" hint="Thêm qua API /norm-set-versions/:id/norms." />;
  return (
    <table className="table" style={{ width: '100%', fontSize: 12.5 }}>
      <thead>
        <tr>
          <th style={{ textAlign: 'left' }}>Vật chất</th>
          <th style={{ textAlign: 'left' }}>Ngữ nghĩa</th>
          <th style={{ textAlign: 'right' }}>Giá trị</th>
          <th style={{ textAlign: 'left' }}>Gốc</th>
          <th>Căn cứ</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {norms.map((n) => (
          <tr key={n.id}>
            <td className="num">{n.materialCatalogId.slice(0, 8)}…</td>
            <td>{n.semanticParam}</td>
            <td style={{ textAlign: 'right' }} className="num">{n.valueNumeric ?? '—'}</td>
            <td className="muted">{n.rawValue ?? '—'}</td>
            <td style={{ textAlign: 'center' }}>
              <span style={{ fontSize: 11.5, color: n.sourceStatus === 'VERIFIED' ? 'var(--ok-fg)' : 'var(--warn-fg)' }}>
                {SOURCE_STATUS_LABEL[n.sourceStatus] ?? n.sourceStatus}
              </span>
            </td>
            <td style={{ textAlign: 'right' }}>
              <button className="btn" style={{ padding: '2px 8px' }} onClick={() => onPick(n.materialCatalogId, n.semanticParam)}>Thử chọn</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ============================ Xung đột ============================
function ConflictsTab({ onInspect }: { onInspect: (material: string, semantic: string) => void }) {
  const qc = useQueryClient();
  const conflicts = useConflicts();
  const [pick, setPick] = useState<Record<string, string>>({});
  const [note, setNote] = useState<Record<string, string>>({});

  const solve = useMutation({
    mutationFn: ({ id, resolvedNormId, resolutionNote }: { id: string; resolvedNormId: string; resolutionNote?: string }) =>
      resolveConflict(id, { resolvedNormId, resolutionNote }),
    onSuccess: () => { toast.success('Đã giải quyết xung đột.'); qc.invalidateQueries({ queryKey: ['dt07', 'conflicts'] }); },
    onError: (e) => toast.problem(e, 'Không giải quyết được'),
  });

  if (conflicts.isLoading) return <Skeleton rows={4} />;
  if (conflicts.error) return <ErrorState error={conflicts.error} />;
  const list = conflicts.data ?? [];
  if (list.length === 0) return <EmptyState icon="check" title="Không có xung đột" hint="Xung đột phát sinh khi resolve gặp nhiều định mức ngang ưu tiên (BR-DT07-008)." />;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {list.map((c) => (
        <div key={c.id} className="panel" style={{ padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
            <div>
              <div style={{ fontWeight: 700 }}>{c.semanticParam} · vật chất {c.materialCatalogId.slice(0, 8)}…</div>
              <div className="muted" style={{ fontSize: 12.5 }}>{c.candidateNormIds.length} ứng viên · {dateTime(c.createdAt)}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <StatusBadge status={c.status} />
              <button className="btn" style={{ padding: '2px 8px' }} onClick={() => onInspect(c.materialCatalogId, c.semanticParam)}>Xem lại resolve</button>
            </div>
          </div>

          {c.status === 'OPEN' && (
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 12, flexWrap: 'wrap' }}>
              <div>
                <label className="form-label">Chọn định mức</label>
                <select className="input" value={pick[c.id] ?? ''} onChange={(e) => setPick((p) => ({ ...p, [c.id]: e.target.value }))}>
                  <option value="">— chọn —</option>
                  {c.candidateNormIds.map((n) => <option key={n} value={n}>{n.slice(0, 8)}…</option>)}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: 180 }}>
                <label className="form-label">Ghi chú</label>
                <input className="input" value={note[c.id] ?? ''} onChange={(e) => setNote((p) => ({ ...p, [c.id]: e.target.value }))} style={{ width: '100%' }} placeholder="Lý do chọn" />
              </div>
              <button
                className="btn btn-primary"
                disabled={!pick[c.id] || solve.isPending}
                onClick={() => solve.mutate({ id: c.id, resolvedNormId: pick[c.id], resolutionNote: note[c.id] })}
              >
                Giải quyết
              </button>
            </div>
          )}
          {c.status === 'RESOLVED' && c.resolutionNote && <div className="muted" style={{ marginTop: 8, fontSize: 12.5 }}>Đã chọn {c.resolvedNormId?.slice(0, 8)}… — {c.resolutionNote}</div>}
        </div>
      ))}
    </div>
  );
}

// ============================ Chỉ lệnh (SCR-DT07-07) ============================
const COMMAND_ACTIONS: Record<string, { action: 'issue' | 'start' | 'complete'; label: string }> = {
  DRAFT: { action: 'issue', label: 'Phát hành' },
  ISSUED: { action: 'start', label: 'Bắt đầu' },
  IN_PROGRESS: { action: 'complete', label: 'Hoàn thành' },
};

function CommandsTab() {
  const qc = useQueryClient();
  const commands = useCommands();
  const [selId, setSelId] = useState<string>();
  const [form, setForm] = useState({ title: '', issuingAuthority: '', effectiveDate: '' });

  const invCmds = () => qc.invalidateQueries({ queryKey: ['dt07', 'commands'] });
  const mCreate = useMutation({
    mutationFn: () => createCommand({ title: form.title.trim(), issuingAuthority: form.issuingAuthority.trim(), effectiveDate: form.effectiveDate || undefined }),
    onSuccess: (c) => { toast.success(`Đã tạo chỉ lệnh ${c.commandNo}.`); setForm({ title: '', issuingAuthority: '', effectiveDate: '' }); invCmds(); setSelId(c.id); },
    onError: (e) => toast.problem(e),
  });

  const list = commands.data?.data ?? [];
  const selected = list.find((c) => c.id === selId);

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 16, alignItems: 'start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="panel" style={{ padding: 14 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Chỉ lệnh mới</div>
          <input className="input" placeholder="Tiêu đề" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} style={{ width: '100%', marginBottom: 6 }} />
          <input className="input" placeholder="Cơ quan ban hành" value={form.issuingAuthority} onChange={(e) => setForm({ ...form, issuingAuthority: e.target.value })} style={{ width: '100%', marginBottom: 6 }} />
          <label className="form-label">Hiệu lực từ</label>
          <input className="input" type="date" value={form.effectiveDate} onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })} style={{ width: '100%', marginBottom: 8 }} />
          <button className="btn btn-primary" disabled={!form.title.trim() || !form.issuingAuthority.trim() || mCreate.isPending} onClick={() => mCreate.mutate()} style={{ width: '100%' }}>Tạo chỉ lệnh</button>
        </div>
        <div className="panel" style={{ padding: 8 }}>
          <div className="eyebrow" style={{ padding: '4px 6px' }}>Danh sách</div>
          {commands.isLoading && <Skeleton rows={4} />}
          {list.map((c) => (
            <button key={c.id} className="btn" onClick={() => setSelId(c.id)} style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: 4, background: selId === c.id ? 'var(--color-neutral-200)' : undefined }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 6 }}><span style={{ fontWeight: 700, fontSize: 12.5 }}>{c.commandNo}</span><StatusBadge status={c.status} /></div>
              <div className="muted" style={{ fontSize: 12 }}>{c.title}</div>
            </button>
          ))}
          {!commands.isLoading && list.length === 0 && <div className="muted" style={{ padding: 8, fontSize: 12.5 }}>Chưa có chỉ lệnh.</div>}
        </div>
      </div>

      <div>
        {!selected ? <EmptyState icon="clipboard" title="Chọn hoặc tạo chỉ lệnh" hint="Chọn chỉ lệnh để quản lý yêu cầu vật chất, phân giao và tiến độ." /> : <CommandDetail command={selected} onChanged={invCmds} />}
      </div>
    </div>
  );
}

function CommandDetail({ command, onChanged }: { command: CommandItem; onChanged: () => void }) {
  const qc = useQueryClient();
  const reqs = useRequirements(command.id);
  const [reqForm, setReqForm] = useState({ materialCatalogId: '', requiredQty: '', deadline: '' });
  const [openReq, setOpenReq] = useState<string>();

  const act = COMMAND_ACTIONS[command.status];
  const mTransition = useMutation({
    mutationFn: () => transitionCommand(command.id, act.action),
    onSuccess: () => { toast.success(`Đã ${act.label.toLowerCase()} chỉ lệnh.`); onChanged(); },
    onError: (e) => toast.problem(e),
  });
  const mReq = useMutation({
    mutationFn: () => addRequirement(command.id, { materialCatalogId: reqForm.materialCatalogId.trim(), requiredQty: Number(reqForm.requiredQty), deadline: reqForm.deadline || undefined }),
    onSuccess: () => { toast.success('Đã thêm yêu cầu vật chất.'); setReqForm({ materialCatalogId: '', requiredQty: '', deadline: '' }); qc.invalidateQueries({ queryKey: ['dt07', 'requirements', command.id] }); },
    onError: (e) => toast.problem(e),
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div className="panel" style={{ padding: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12 }}>
          <div>
            <div style={{ fontWeight: 800, fontSize: 16 }}>{command.commandNo}</div>
            <div style={{ fontSize: 14 }}>{command.title}</div>
            <div className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>{command.issuingAuthority} · hiệu lực {command.effectiveDate ?? '—'}</div>
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <StatusBadge status={command.status} />
            {act && <button className="btn btn-primary" disabled={mTransition.isPending} onClick={() => mTransition.mutate()}>{act.label}</button>}
          </div>
        </div>
      </div>

      <div className="panel" style={{ padding: 14 }}>
        <div className="eyebrow" style={{ marginBottom: 8 }}>Yêu cầu vật chất (gắn định mức PUBLISHED tại effective_date — BR-DT07-031)</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 10, flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 200 }}><label className="form-label">Mã vật chất (UUID)</label><input className="input" value={reqForm.materialCatalogId} onChange={(e) => setReqForm({ ...reqForm, materialCatalogId: e.target.value })} placeholder="material_catalog_id" style={{ width: '100%' }} /></div>
          <div><label className="form-label">Số lượng</label><input className="input" type="number" value={reqForm.requiredQty} onChange={(e) => setReqForm({ ...reqForm, requiredQty: e.target.value })} style={{ width: 100 }} /></div>
          <div><label className="form-label">Hạn</label><input className="input" type="date" value={reqForm.deadline} onChange={(e) => setReqForm({ ...reqForm, deadline: e.target.value })} /></div>
          <button className="btn" disabled={!reqForm.materialCatalogId.trim() || !reqForm.requiredQty || mReq.isPending} onClick={() => mReq.mutate()}>Thêm yêu cầu</button>
        </div>
        <table className="table" style={{ width: '100%', fontSize: 12.5 }}>
          <thead><tr><th style={{ textAlign: 'left' }}>Vật chất</th><th style={{ textAlign: 'right' }}>SL</th><th style={{ textAlign: 'left' }}>Hạn</th><th>Định mức gắn</th><th></th></tr></thead>
          <tbody>
            {(reqs.data ?? []).map((r) => (
              <tr key={r.id} style={{ background: openReq === r.id ? 'var(--color-neutral-100)' : undefined }}>
                <td className="num">{r.materialCatalogId.slice(0, 8)}…</td>
                <td style={{ textAlign: 'right' }} className="num">{Number(r.requiredQty)}</td>
                <td className="muted">{r.deadline ?? '—'}</td>
                <td style={{ textAlign: 'center' }}>{r.materialNormId ? <span style={{ color: 'var(--ok-fg)', fontSize: 11.5 }}>✓ đã gắn</span> : <span className="muted" style={{ fontSize: 11.5 }}>—</span>}</td>
                <td style={{ textAlign: 'right' }}><button className="btn" style={{ padding: '2px 8px' }} onClick={() => setOpenReq(openReq === r.id ? undefined : r.id)}>{openReq === r.id ? 'Ẩn' : 'Phân giao'}</button></td>
              </tr>
            ))}
            {(reqs.data ?? []).length === 0 && <tr><td colSpan={5} className="muted">Chưa có yêu cầu.</td></tr>}
          </tbody>
        </table>
        {openReq && <RequirementDetail requirementId={openReq} />}
      </div>
    </div>
  );
}

function RequirementDetail({ requirementId }: { requirementId: string }) {
  const qc = useQueryClient();
  const assigns = useAssignments(requirementId);
  const [form, setForm] = useState({ organizationId: '', allocatedQty: '', deadline: '' });
  const [openAssign, setOpenAssign] = useState<string>();

  const mAssign = useMutation({
    mutationFn: () => addAssignment(requirementId, { organizationId: form.organizationId.trim(), allocatedQty: Number(form.allocatedQty), deadline: form.deadline || undefined }),
    onSuccess: () => { toast.success('Đã phân giao.'); setForm({ organizationId: '', allocatedQty: '', deadline: '' }); qc.invalidateQueries({ queryKey: ['dt07', 'assignments', requirementId] }); },
    onError: (e) => toast.problem(e),
  });

  return (
    <div style={{ marginTop: 10, paddingLeft: 12, borderLeft: '2px solid var(--color-neutral-300)' }}>
      <div className="eyebrow" style={{ marginBottom: 6 }}>Phân giao đơn vị</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 8, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 180 }}><label className="form-label">Đơn vị (UUID)</label><input className="input" value={form.organizationId} onChange={(e) => setForm({ ...form, organizationId: e.target.value })} placeholder="organization_id" style={{ width: '100%' }} /></div>
        <div><label className="form-label">SL cấp</label><input className="input" type="number" value={form.allocatedQty} onChange={(e) => setForm({ ...form, allocatedQty: e.target.value })} style={{ width: 100 }} /></div>
        <button className="btn" disabled={!form.organizationId.trim() || !form.allocatedQty || mAssign.isPending} onClick={() => mAssign.mutate()}>Phân giao</button>
      </div>
      <table className="table" style={{ width: '100%', fontSize: 12 }}>
        <thead><tr><th style={{ textAlign: 'left' }}>Đơn vị</th><th style={{ textAlign: 'right' }}>SL cấp</th><th style={{ textAlign: 'left' }}>Hạn</th><th></th></tr></thead>
        <tbody>
          {(assigns.data ?? []).map((a) => (
            <tr key={a.id} style={{ background: openAssign === a.id ? 'var(--color-neutral-100)' : undefined }}>
              <td className="num">{a.organizationId.slice(0, 8)}…</td>
              <td style={{ textAlign: 'right' }} className="num">{Number(a.allocatedQty)}</td>
              <td className="muted">{a.deadline ?? '—'}</td>
              <td style={{ textAlign: 'right' }}><button className="btn" style={{ padding: '2px 8px' }} onClick={() => setOpenAssign(openAssign === a.id ? undefined : a.id)}>{openAssign === a.id ? 'Ẩn' : 'Tiến độ'}</button></td>
            </tr>
          ))}
          {(assigns.data ?? []).length === 0 && <tr><td colSpan={4} className="muted">Chưa phân giao.</td></tr>}
        </tbody>
      </table>
      {openAssign && <AssignmentProgress assignmentId={openAssign} />}
    </div>
  );
}

function AssignmentProgress({ assignmentId }: { assignmentId: string }) {
  const qc = useQueryClient();
  const prog = useProgress(assignmentId);
  const [form, setForm] = useState({ reportedQty: '', note: '' });

  const mProg = useMutation({
    mutationFn: () => addProgress(assignmentId, { reportedQty: Number(form.reportedQty), note: form.note || undefined }),
    onSuccess: () => { toast.success('Đã cập nhật tiến độ.'); setForm({ reportedQty: '', note: '' }); qc.invalidateQueries({ queryKey: ['dt07', 'progress', assignmentId] }); },
    onError: (e) => toast.problem(e),
  });

  return (
    <div style={{ marginTop: 8, paddingLeft: 12, borderLeft: '2px solid var(--color-neutral-300)' }}>
      <div className="eyebrow" style={{ marginBottom: 6 }}>Tiến độ thực hiện</div>
      <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 8, flexWrap: 'wrap' }}>
        <div><label className="form-label">SL báo cáo</label><input className="input" type="number" value={form.reportedQty} onChange={(e) => setForm({ ...form, reportedQty: e.target.value })} style={{ width: 110 }} /></div>
        <div style={{ flex: 1, minWidth: 160 }}><label className="form-label">Ghi chú</label><input className="input" value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} style={{ width: '100%' }} /></div>
        <button className="btn" disabled={!form.reportedQty || mProg.isPending} onClick={() => mProg.mutate()}>Cập nhật</button>
      </div>
      <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5 }}>
        {(prog.data ?? []).map((p) => (
          <li key={p.id} className="muted">{Number(p.reportedQty)} · {p.status}{p.note ? ` — ${p.note}` : ''} {p.reportedAt && <span>({dateTime(p.reportedAt)})</span>}</li>
        ))}
        {(prog.data ?? []).length === 0 && <li className="muted">Chưa có báo cáo tiến độ.</li>}
      </ul>
    </div>
  );
}

// ============================ Biên tập & nhập (SCR-DT07-04) ============================
const DIMENSION_TYPES = ['ORG', 'TERRITORY', 'MISSION', 'PHASE', 'QUALITY', 'SCALE', 'TIME'];

function simpleHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return (h >>> 0).toString(16);
}

// CSV mỗi dòng: materialCatalogId,semanticParam,valueNumeric,rawValue
function parseCsv(text: string): ImportRow[] {
  return text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith('#'))
    .map((l) => {
      const [materialCatalogId, semanticParam, valueNumeric, ...rest] = l.split(',').map((c) => c.trim());
      return {
        materialCatalogId,
        semanticParam,
        valueNumeric: valueNumeric ? Number(valueNumeric) : undefined,
        rawValue: rest.join(',') || undefined,
      } as ImportRow;
    })
    .filter((r) => r.materialCatalogId && r.semanticParam);
}

function EditTab() {
  const qc = useQueryClient();
  const sets = useNormSets();
  const params = useCalcParams();
  const [setId, setSetId] = useState<string>();
  const versions = useSetVersions(setId);
  const [versionId, setVersionId] = useState<string>();
  const norms = useNorms(versionId);

  const [setForm, setSetForm] = useState({ setCode: '', name: '' });
  const [verForm, setVerForm] = useState({ versionLabel: '', effectiveFrom: '' });
  const [nm, setNm] = useState({ materialCatalogId: '', semanticParam: 'CONSUMPTION_COMBAT', valueNumeric: '', rawValue: '', sourceReferenceId: '' });
  const [csv, setCsv] = useState('');
  const [scope, setScope] = useState({ normId: '', dimensionType: 'MISSION', dimensionValue: '' });

  const invSets = () => qc.invalidateQueries({ queryKey: ['dt07', 'sets'] });
  const invVers = () => qc.invalidateQueries({ queryKey: ['dt07', 'set-versions', setId] });
  const invNorms = () => qc.invalidateQueries({ queryKey: ['dt07', 'norms', versionId] });

  const mSet = useMutation({
    mutationFn: () => createNormSet({ setCode: setForm.setCode.trim(), name: setForm.name.trim() }),
    onSuccess: (s) => { toast.success('Đã tạo bộ định mức.'); setSetForm({ setCode: '', name: '' }); invSets(); setSetId(s.id); },
    onError: (e) => toast.problem(e),
  });
  const mVer = useMutation({
    mutationFn: () => createNormSetVersion(setId as string, { versionLabel: verForm.versionLabel.trim(), effectiveFrom: verForm.effectiveFrom || undefined }),
    onSuccess: (v) => { toast.success('Đã tạo phiên bản (DRAFT).'); setVerForm({ versionLabel: '', effectiveFrom: '' }); invVers(); setVersionId(v.id); },
    onError: (e) => toast.problem(e),
  });
  const mPublish = useMutation({
    mutationFn: (id: string) => publishSetVersion(id),
    onSuccess: () => { toast.success('Đã công bố (bất biến).'); invVers(); },
    onError: (e) => toast.problem(e),
  });
  const mNorm = useMutation({
    mutationFn: () => addMaterialNorm(versionId as string, {
      materialCatalogId: nm.materialCatalogId.trim(),
      semanticParam: nm.semanticParam,
      valueNumeric: nm.valueNumeric ? Number(nm.valueNumeric) : undefined,
      rawValue: nm.rawValue || undefined,
      sourceReferenceId: nm.sourceReferenceId.trim() || undefined,
    }),
    onSuccess: () => { toast.success(nm.sourceReferenceId ? 'Đã thêm định mức (VERIFIED).' : 'Đã thêm định mức (LEGACY — chưa căn cứ).'); setNm({ ...nm, materialCatalogId: '', valueNumeric: '', rawValue: '' }); invNorms(); },
    onError: (e) => toast.problem(e),
  });
  const mScope = useMutation({
    mutationFn: () => addNormScopes(scope.normId, [{ dimensionType: scope.dimensionType, dimensionValue: scope.dimensionValue.trim() }]),
    onSuccess: () => { toast.success('Đã gắn chiều phạm vi.'); setScope({ ...scope, dimensionValue: '' }); },
    onError: (e) => toast.problem(e),
  });
  const mImport = useMutation({
    mutationFn: () => importNorms({ fileName: 'paste.csv', fileHash: `ui-${simpleHash(csv)}-${Date.now()}`, normSetVersionId: versionId, rows: parseCsv(csv) }),
    onSuccess: (r) => { toast.success(`Đã nhập ${r.created} định mức (DRAFT/LEGACY).`); setCsv(''); invNorms(); qc.invalidateQueries({ queryKey: ['dt07', 'legacy'] }); },
    onError: (e) => toast.problem(e),
  });
  const mUpload = useMutation({
    mutationFn: (file: File) => uploadNormsFile(file, versionId),
    onSuccess: (r) => { toast.success(`Đã nhập ${r.created}/${r.batch.totalRows} dòng từ file (DRAFT/LEGACY).`); invNorms(); qc.invalidateQueries({ queryKey: ['dt07', 'legacy'] }); },
    onError: (e) => toast.problem(e, 'Không nhập được file'),
  });

  const setList = sets.data?.data ?? [];
  const selectedVer = (versions.data ?? []).find((v) => v.id === versionId);
  const editable = selectedVer && (selectedVer.status === 'DRAFT' || selectedVer.status === 'VALIDATED');
  const semanticOptions = params.data ?? [];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '300px 1fr', gap: 16, alignItems: 'start' }}>
      {/* Cột trái: tạo & chọn bộ */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="panel" style={{ padding: 14 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Tạo bộ định mức</div>
          <input className="input" placeholder="Mã bộ (set_code)" value={setForm.setCode} onChange={(e) => setSetForm({ ...setForm, setCode: e.target.value })} style={{ width: '100%', marginBottom: 6 }} />
          <input className="input" placeholder="Tên bộ" value={setForm.name} onChange={(e) => setSetForm({ ...setForm, name: e.target.value })} style={{ width: '100%', marginBottom: 8 }} />
          <button className="btn btn-primary" disabled={!setForm.setCode.trim() || !setForm.name.trim() || mSet.isPending} onClick={() => mSet.mutate()} style={{ width: '100%' }}>Tạo bộ</button>
        </div>
        <div className="panel" style={{ padding: 8 }}>
          <div className="eyebrow" style={{ padding: '4px 6px' }}>Chọn bộ</div>
          {setList.map((s) => (
            <button key={s.id} className="btn" onClick={() => { setSetId(s.id); setVersionId(undefined); }} style={{ display: 'block', width: '100%', textAlign: 'left', marginBottom: 4, background: setId === s.id ? 'var(--color-neutral-200)' : undefined }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{s.setCode}</div>
              <div className="muted" style={{ fontSize: 12 }}>{s.name}</div>
            </button>
          ))}
          {setList.length === 0 && <div className="muted" style={{ padding: 8, fontSize: 12.5 }}>Chưa có bộ nào.</div>}
        </div>
      </div>

      {/* Cột phải: phiên bản + định mức + nhập */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {!setId && <EmptyState icon="grid" title="Chọn hoặc tạo bộ định mức" hint="Chọn bộ ở cột trái để thêm phiên bản và định mức." />}

        {setId && (
          <div className="panel" style={{ padding: 14 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>Phiên bản của bộ</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginBottom: 10, flexWrap: 'wrap' }}>
              <div><label className="form-label">Nhãn</label><input className="input" value={verForm.versionLabel} onChange={(e) => setVerForm({ ...verForm, versionLabel: e.target.value })} placeholder="v1" /></div>
              <div><label className="form-label">Hiệu lực từ</label><input className="input" type="date" value={verForm.effectiveFrom} onChange={(e) => setVerForm({ ...verForm, effectiveFrom: e.target.value })} /></div>
              <button className="btn btn-primary" disabled={!verForm.versionLabel.trim() || mVer.isPending} onClick={() => mVer.mutate()}>Tạo phiên bản</button>
            </div>
            <table className="table" style={{ width: '100%', fontSize: 13 }}>
              <thead><tr><th style={{ textAlign: 'left' }}>Nhãn</th><th style={{ textAlign: 'left' }}>Hiệu lực</th><th>Trạng thái</th><th></th></tr></thead>
              <tbody>
                {(versions.data ?? []).map((v) => (
                  <tr key={v.id} style={{ background: versionId === v.id ? 'var(--color-neutral-100)' : undefined }}>
                    <td><button className="btn" style={{ padding: '2px 8px' }} onClick={() => setVersionId(v.id)}>{v.versionLabel}</button></td>
                    <td className="muted">{v.effectiveFrom ?? '—'} → {v.effectiveTo ?? '…'}</td>
                    <td style={{ textAlign: 'center' }}><StatusBadge status={v.status} /></td>
                    <td style={{ textAlign: 'right' }}>{(v.status === 'DRAFT' || v.status === 'VALIDATED') && <button className="btn btn-primary" style={{ padding: '2px 10px' }} disabled={mPublish.isPending} onClick={() => mPublish.mutate(v.id)}>Công bố</button>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {versionId && !editable && <EmptyState icon="lock" title="Phiên bản đã công bố — bất biến" hint="Chỉ sửa/nhập được trên phiên bản DRAFT/VALIDATED. Tạo phiên bản mới để chỉnh sửa (BR-DT07-002)." />}

        {versionId && editable && (
          <>
            <div className="panel" style={{ padding: 14 }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Thêm định mức (biên tập)</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 8 }}>
                <div style={{ gridColumn: '1 / span 2' }}><label className="form-label">Mã vật chất (UUID)</label><input className="input" value={nm.materialCatalogId} onChange={(e) => setNm({ ...nm, materialCatalogId: e.target.value })} placeholder="material_catalog_id" style={{ width: '100%' }} /></div>
                <div><label className="form-label">Ngữ nghĩa</label>
                  <select className="input" value={nm.semanticParam} onChange={(e) => setNm({ ...nm, semanticParam: e.target.value })} style={{ width: '100%' }}>
                    {semanticOptions.map((p) => <option key={p.id} value={p.semanticParam}>{p.semanticParam}</option>)}
                    {semanticOptions.length === 0 && <option value={nm.semanticParam}>{nm.semanticParam}</option>}
                  </select>
                </div>
                <div><label className="form-label">Giá trị số</label><input className="input" type="number" value={nm.valueNumeric} onChange={(e) => setNm({ ...nm, valueNumeric: e.target.value })} style={{ width: '100%' }} /></div>
                <div><label className="form-label">Giá trị gốc</label><input className="input" value={nm.rawValue} onChange={(e) => setNm({ ...nm, rawValue: e.target.value })} placeholder="15 lít/xe/ngày" style={{ width: '100%' }} /></div>
                <div><label className="form-label">ID trích dẫn căn cứ (để VERIFIED)</label><input className="input" value={nm.sourceReferenceId} onChange={(e) => setNm({ ...nm, sourceReferenceId: e.target.value })} placeholder="source_reference_id" style={{ width: '100%' }} /></div>
              </div>
              <button className="btn btn-primary" disabled={!nm.materialCatalogId.trim() || mNorm.isPending} onClick={() => mNorm.mutate()}>Thêm định mức</button>
              <div className="muted" style={{ fontSize: 12, marginTop: 6 }}>Không nhập trích dẫn → định mức là LEGACY_UNVERIFIED, không dùng cho resolve (BR-DT07-026).</div>
            </div>

            <div className="panel" style={{ padding: 14 }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Định mức trong phiên bản + gắn chiều phạm vi</div>
              <NormsTableEditable norms={norms.data ?? []} />
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', marginTop: 10, flexWrap: 'wrap' }}>
                <div><label className="form-label">Định mức</label>
                  <select className="input" value={scope.normId} onChange={(e) => setScope({ ...scope, normId: e.target.value })}>
                    <option value="">— chọn —</option>
                    {(norms.data ?? []).map((n) => <option key={n.id} value={n.id}>{n.id.slice(0, 8)}… · {n.semanticParam}</option>)}
                  </select>
                </div>
                <div><label className="form-label">Chiều</label>
                  <select className="input" value={scope.dimensionType} onChange={(e) => setScope({ ...scope, dimensionType: e.target.value })}>
                    {DIMENSION_TYPES.map((d) => <option key={d} value={d}>{DIMENSION_LABEL[d] ?? d}</option>)}
                  </select>
                </div>
                <div><label className="form-label">Giá trị</label><input className="input" value={scope.dimensionValue} onChange={(e) => setScope({ ...scope, dimensionValue: e.target.value })} placeholder="ATTACK" /></div>
                <button className="btn" disabled={!scope.normId || !scope.dimensionValue.trim() || mScope.isPending} onClick={() => mScope.mutate()}>Gắn chiều</button>
              </div>
            </div>

            <div className="panel" style={{ padding: 14 }}>
              <div className="eyebrow" style={{ marginBottom: 8 }}>Nhập từ file .xlsx / .csv (→ DRAFT/LEGACY)</div>
              <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>Cột: <code>materialCatalogId, semanticParam, valueNumeric, rawValue, unitId</code> (có/không header đều được). Parse phía máy chủ, file_hash = sha256.</div>
              <input
                type="file"
                accept=".xlsx,.csv"
                disabled={mUpload.isPending}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) { mUpload.mutate(f); e.target.value = ''; } }}
                style={{ fontSize: 13, marginBottom: 12 }}
              />
              <div className="eyebrow" style={{ marginBottom: 6 }}>Hoặc dán nhanh CSV</div>
              <textarea className="input" value={csv} onChange={(e) => setCsv(e.target.value)} rows={4} style={{ width: '100%', fontFamily: 'monospace', fontSize: 12 }} placeholder="uuid,CONSUMPTION_COMBAT,12,12 lít/xe/ngày" />
              <button className="btn btn-primary" disabled={!csv.trim() || mImport.isPending} onClick={() => mImport.mutate()} style={{ marginTop: 8 }}>Nhập CSV {parseCsv(csv).length ? `(${parseCsv(csv).length} dòng)` : ''}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function NormsTableEditable({ norms }: { norms: MaterialNorm[] }) {
  if (norms.length === 0) return <div className="muted" style={{ fontSize: 12.5 }}>Chưa có định mức trong phiên bản này.</div>;
  return (
    <table className="table" style={{ width: '100%', fontSize: 12.5 }}>
      <thead><tr><th style={{ textAlign: 'left' }}>ID</th><th style={{ textAlign: 'left' }}>Vật chất</th><th style={{ textAlign: 'left' }}>Ngữ nghĩa</th><th style={{ textAlign: 'right' }}>Giá trị</th><th>Căn cứ</th></tr></thead>
      <tbody>
        {norms.map((n) => (
          <tr key={n.id}>
            <td className="num">{n.id.slice(0, 8)}…</td>
            <td className="num">{n.materialCatalogId.slice(0, 8)}…</td>
            <td>{n.semanticParam}</td>
            <td style={{ textAlign: 'right' }} className="num">{n.valueNumeric ?? '—'}</td>
            <td style={{ textAlign: 'center' }}><span style={{ fontSize: 11.5, color: n.sourceStatus === 'VERIFIED' ? 'var(--ok-fg)' : 'var(--warn-fg)' }}>{SOURCE_STATUS_LABEL[n.sourceStatus] ?? n.sourceStatus}</span></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ============================ Legacy chưa xác minh (SCR-DT07-08) ============================
function LegacyTab() {
  const legacy = useLegacyNorms();
  if (legacy.isLoading) return <Skeleton rows={5} />;
  if (legacy.error) return <ErrorState error={legacy.error} />;
  const list = legacy.data ?? [];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="panel" style={{ padding: 14, borderColor: 'var(--warn-bd)', background: 'var(--warn-bg)', color: 'var(--warn-fg)', display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <Icon name="alert" size={20} />
        <div style={{ fontSize: 13.5 }}>
          <b>Định mức chưa có căn cứ pháp lý (LEGACY_UNVERIFIED).</b> Các định mức này <b>không</b> được bộ chọn <code>resolve</code> dùng chính thức (BR-DT07-026). Hãy gắn trích dẫn căn cứ để chuyển sang VERIFIED.
        </div>
      </div>
      {list.length === 0 ? (
        <EmptyState icon="check" title="Không có định mức legacy" hint="Mọi định mức đều đã có căn cứ." />
      ) : (
        <div className="panel" style={{ padding: 14 }}>
          <table className="table" style={{ width: '100%', fontSize: 12.5 }}>
            <thead><tr><th style={{ textAlign: 'left' }}>Bộ</th><th style={{ textAlign: 'left' }}>Phiên bản</th><th style={{ textAlign: 'left' }}>Vật chất</th><th style={{ textAlign: 'left' }}>Ngữ nghĩa</th><th style={{ textAlign: 'right' }}>Giá trị</th><th style={{ textAlign: 'left' }}>Nguồn nhập</th></tr></thead>
            <tbody>
              {list.map((n) => (
                <tr key={n.id}>
                  <td>{n.setCode}</td>
                  <td>{n.versionLabel} <span className="muted">({n.versionStatus})</span></td>
                  <td className="num">{n.materialCatalogId.slice(0, 8)}…</td>
                  <td>{n.semanticParam}</td>
                  <td style={{ textAlign: 'right' }} className="num">{n.valueNumeric ?? '—'}</td>
                  <td className="muted">{n.importBatchId ? 'Nhập Excel/CSV' : 'Nhập tay'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================ Văn bản căn cứ ============================
function DocsTab() {
  const docs = useNormDocuments();
  if (docs.isLoading) return <Skeleton rows={5} />;
  if (docs.error) return <ErrorState error={docs.error} />;
  const list = docs.data?.data ?? [];
  if (list.length === 0) return <EmptyState icon="file" title="Chưa có văn bản căn cứ" hint="Định mức không có căn cứ sẽ là LEGACY_UNVERIFIED và bị loại khỏi resolve (BR-DT07-026)." />;
  return (
    <div className="panel" style={{ padding: 14 }}>
      <table className="table" style={{ width: '100%', fontSize: 13 }}>
        <thead><tr><th style={{ textAlign: 'left' }}>Số hiệu</th><th style={{ textAlign: 'left' }}>Trích yếu</th><th style={{ textAlign: 'left' }}>Cơ quan</th><th style={{ textAlign: 'left' }}>Ngày ban hành</th></tr></thead>
        <tbody>
          {list.map((d) => (
            <tr key={d.id}>
              <td className="num">{d.docNo}</td>
              <td>{d.title}</td>
              <td>{d.issuingAuthority}</td>
              <td className="muted">{d.issueDate ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
