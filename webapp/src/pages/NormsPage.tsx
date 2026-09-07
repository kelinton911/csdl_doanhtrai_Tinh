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
  publishSetVersion,
  resolveConflict,
  resolveNorm,
  useCalcParams,
  useCommands,
  useConflicts,
  useNorms,
  useNormDocuments,
  useNormSets,
  useSetVersions,
  type MaterialNorm,
  type ResolveResult,
  type ResolveScope,
} from '../lib/norms';

type Tab = 'resolve' | 'sets' | 'conflicts' | 'commands' | 'docs';
const TABS: Array<{ key: Tab; label: string; icon: IconName }> = [
  { key: 'resolve', label: 'Thử chọn định mức', icon: 'target' },
  { key: 'sets', label: 'Bộ định mức', icon: 'grid' },
  { key: 'conflicts', label: 'Xung đột', icon: 'alert' },
  { key: 'commands', label: 'Chỉ lệnh hậu cần', icon: 'clipboard' },
  { key: 'docs', label: 'Văn bản căn cứ', icon: 'file' },
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
      {tab === 'conflicts' && <ConflictsTab onInspect={goResolve} />}
      {tab === 'commands' && <CommandsTab />}
      {tab === 'docs' && <DocsTab />}
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

// ============================ Chỉ lệnh ============================
function CommandsTab() {
  const commands = useCommands();
  if (commands.isLoading) return <Skeleton rows={5} />;
  if (commands.error) return <ErrorState error={commands.error} />;
  const list = commands.data?.data ?? [];
  if (list.length === 0) return <EmptyState icon="clipboard" title="Chưa có chỉ lệnh" hint="Tạo qua API /commands." />;
  return (
    <div className="panel" style={{ padding: 14 }}>
      <table className="table" style={{ width: '100%', fontSize: 13 }}>
        <thead><tr><th style={{ textAlign: 'left' }}>Số chỉ lệnh</th><th style={{ textAlign: 'left' }}>Tiêu đề</th><th style={{ textAlign: 'left' }}>Cơ quan</th><th style={{ textAlign: 'left' }}>Hiệu lực</th><th>Trạng thái</th></tr></thead>
        <tbody>
          {list.map((c) => (
            <tr key={c.id}>
              <td className="num">{c.commandNo}</td>
              <td>{c.title}</td>
              <td>{c.issuingAuthority}</td>
              <td className="muted">{c.effectiveDate ?? '—'}</td>
              <td style={{ textAlign: 'center' }}><StatusBadge status={c.status} /></td>
            </tr>
          ))}
        </tbody>
      </table>
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
