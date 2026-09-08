import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { PageHeader } from '../components/PageHeader';
import { EmptyState, ErrorState, Skeleton } from '../components/States';
import { Icon } from '../components/Icon';
import { toast } from '../lib/toast';
import {
  CELL_STATE_LABEL,
  REPORT_STATUS_LABEL,
  VALIDATION_STATUS_LABEL,
  addField,
  approveReport,
  createDatasetDefinition,
  createDefinition,
  createReport,
  createTemplate,
  downloadReport,
  generateDataset,
  issueReport,
  reissueReport,
  rollupReport,
  useDatasetValidations,
  useDefinitions,
  useLineage,
  useReports,
  useRollupStatus,
  useTemplateVersions,
  validateDataset,
  validateReport,
  type DatasetInstance,
  type ReportDefinition,
  type ReportInstance,
} from '../lib/dt11';

// DT-11 — Báo cáo & biểu mẫu (Quyển XI). SCR-DT11-01..09: danh mục biểu (cấu hình) → template/dataset →
// sinh & validate dataset từ snapshot chuẩn → lập báo cáo → tổng hợp đơn vị → duyệt & phát hành (checksum) →
// truy vết ô → kho báo cáo (version). Business rule ở backend.
export function ReportPage() {
  const qc = useQueryClient();
  const defs = useDefinitions();
  const reports = useReports();

  const [selectedDefId, setSelectedDefId] = useState<string>();
  const selectedDef = useMemo(() => defs.data?.find((d) => d.id === selectedDefId), [defs.data, selectedDefId]);
  const templates = useTemplateVersions(selectedDefId);
  const published = templates.data?.find((t) => t.status === 'PUBLISHED') ?? templates.data?.[0];
  const datasetCode = published?.layoutSchemaJson?.datasetDefinitionCode;

  const [sourceRef, setSourceRef] = useState('');
  const [dataset, setDataset] = useState<DatasetInstance>();
  const [report, setReport] = useState<ReportInstance>();
  const [cell, setCell] = useState('');
  const validations = useDatasetValidations(dataset?.id);
  const lineage = useLineage(report?.id, cell);
  const rollup = useRollupStatus(report?.id);

  // Thêm biểu mới bằng cấu hình (SCR-01/02/03 — BR-DT11-019)
  const [newForm, setNewForm] = useState({ formCode: '', title: '' });
  const addDefMut = useMutation({
    mutationFn: async () => {
      const def = await createDefinition({ formCode: newForm.formCode, title: newForm.title, category: 'CUSTOM' });
      const ds = await createDatasetDefinition({ code: `ds-${def.formCode.replace(/[^A-Za-z0-9]+/g, '')}-${Date.now()}`, title: newForm.title, sourceType: 'DT10_OFFICIAL_SNAPSHOT' });
      await addField(ds.id, { fieldKey: 'materialCatalogId', sourcePath: 'materialCatalogId', header: 'Vật chất', dataType: 'string', orderNo: 0 });
      await addField(ds.id, { fieldKey: 'total', sourcePath: 'total', header: 'Số lượng', dataType: 'number', orderNo: 1 });
      await createTemplate(def.id, { layoutSchemaJson: { datasetDefinitionCode: ds.code, columns: [{ key: 'materialCatalogId', header: 'Vật chất' }, { key: 'total', header: 'Số lượng' }] }, publish: true });
      return def;
    },
    onSuccess: (def) => {
      toast.success(`Đã thêm biểu ${def.formCode} bằng cấu hình`);
      setNewForm({ formCode: '', title: '' });
      qc.invalidateQueries({ queryKey: ['dt11', 'definitions'] });
      setSelectedDefId(def.id);
    },
    onError: (e) => toast.problem(e, 'Không thêm được biểu'),
  });

  const genMut = useMutation({
    mutationFn: () => {
      const ref: Record<string, unknown> = {};
      const v = sourceRef.trim();
      if (v) ref.campaignId = v;
      ref.formCode = selectedDef?.formCode;
      return generateDataset({ datasetDefinitionCode: datasetCode!, sourceRef: ref });
    },
    onSuccess: (d) => {
      toast.success(`Đã sinh dataset (${d.rowCount} dòng) · hash ${d.datasetHash.slice(0, 10)}…`);
      setDataset(d);
      setReport(undefined);
    },
    onError: (e) => toast.problem(e, 'Không sinh được dataset'),
  });

  const validateDsMut = useMutation({
    mutationFn: () => validateDataset(dataset!.id),
    onSuccess: () => {
      toast.success('Đã validate dataset');
      qc.invalidateQueries({ queryKey: ['dt11', 'validations', dataset?.id] });
    },
    onError: (e) => toast.problem(e, 'Validate thất bại'),
  });

  const createReportMut = useMutation({
    mutationFn: () => createReport({ formCode: selectedDef!.formCode, datasetInstanceId: dataset!.id }),
    onSuccess: (r) => {
      toast.success(`Đã lập báo cáo ${r.reportCode}`);
      setReport(r);
      qc.invalidateQueries({ queryKey: ['dt11', 'reports'] });
    },
    onError: (e) => toast.problem(e, 'Không lập được báo cáo'),
  });

  const stepMut = useMutation({
    mutationFn: async (action: 'validate' | 'approve' | 'issue' | 'reissue') => {
      if (!report) throw new Error('no report');
      if (action === 'validate') return validateReport(report.id);
      if (action === 'approve') return approveReport(report.id);
      if (action === 'issue') return issueReport(report.id, 'pdf');
      return reissueReport(report.id, 'pdf');
    },
    onSuccess: (r) => {
      const inst = r as ReportInstance;
      toast.success(`Trạng thái: ${REPORT_STATUS_LABEL[inst.status] ?? inst.status}`);
      setReport(inst);
      qc.invalidateQueries({ queryKey: ['dt11', 'reports'] });
      qc.invalidateQueries({ queryKey: ['dt11', 'lineage', inst.id] });
      qc.invalidateQueries({ queryKey: ['dt11', 'rollup', inst.id] });
    },
    onError: (e) => toast.problem(e, 'Thao tác thất bại'),
  });

  const downloadMut = useMutation({
    mutationFn: (id: string) => downloadReport(id),
    onSuccess: (d) => {
      toast.success(`Tệp ${d.reportCode} · checksum ${d.checksum?.slice(0, 12)}…`);
      window.open(d.url, '_blank');
    },
    onError: (e) => toast.problem(e, 'Không tải được tệp'),
  });

  const rollupMut = useMutation({
    mutationFn: () =>
      rollupReport(report!.id, [
        { childOrgId: '11111111-1111-1111-1111-111111111111', childOrgName: 'Đơn vị A (đã gửi)', childInstanceId: report!.id, submissionStatus: 'SUBMITTED' },
        { childOrgId: '22222222-2222-2222-2222-222222222222', childOrgName: 'Đơn vị B (chưa gửi)', submissionStatus: 'MISSING' },
      ]),
    onSuccess: () => {
      toast.success('Đã tổng hợp (đơn vị chưa gửi ≠ 0)');
      qc.invalidateQueries({ queryKey: ['dt11', 'rollup', report?.id] });
    },
    onError: (e) => toast.problem(e, 'Tổng hợp thất bại'),
  });

  return (
    <div>
      <PageHeader eyebrow="DT-11 · Quyển XI" title="Báo cáo & biểu mẫu" description="Report Engine cấu hình: biểu → dataset từ snapshot chuẩn → validate → phát hành (checksum bất biến) → truy vết ô về nguồn." />

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 18, alignItems: 'start' }}>
        {/* SCR-DT11-01: Danh mục biểu (cấu hình) */}
        <div className="panel">
          <h3 style={{ marginTop: 0 }}>Danh mục biểu ({defs.data?.length ?? 0})</h3>
          {defs.isLoading ? (
            <Skeleton rows={5} />
          ) : defs.error ? (
            <ErrorState error={defs.error} />
          ) : !defs.data?.length ? (
            <EmptyState title="Chưa có biểu" hint="Chạy seed:report-dt11 hoặc thêm biểu bên dưới." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 360, overflow: 'auto' }}>
              {defs.data.map((d: ReportDefinition) => (
                <button
                  key={d.id}
                  className={`row-select ${d.id === selectedDefId ? 'active' : ''}`}
                  onClick={() => {
                    setSelectedDefId(d.id);
                    setDataset(undefined);
                    setReport(undefined);
                  }}
                  style={{ textAlign: 'left', padding: '8px 10px', borderRadius: 8, border: '1px solid var(--surface-3, #d9e2ec)', background: d.id === selectedDefId ? 'var(--surface-2, #f0f4f8)' : 'transparent', cursor: 'pointer' }}
                >
                  <strong>{d.formCode}</strong> <span className="muted">· {d.category}</span>
                  <div className="muted" style={{ fontSize: 12 }}>{d.title}</div>
                </button>
              ))}
            </div>
          )}

          <div style={{ marginTop: 14, borderTop: '1px solid var(--surface-3,#d9e2ec)', paddingTop: 12 }}>
            <h4 style={{ margin: '0 0 8px' }}>Thêm biểu bằng cấu hình</h4>
            <input className="input" placeholder="Mã biểu (vd 09/KK)" value={newForm.formCode} onChange={(e) => setNewForm({ ...newForm, formCode: e.target.value })} />
            <input className="input" placeholder="Tên biểu" value={newForm.title} onChange={(e) => setNewForm({ ...newForm, title: e.target.value })} style={{ marginTop: 6 }} />
            <button className="btn btn-primary" style={{ marginTop: 8 }} disabled={!newForm.formCode || !newForm.title || addDefMut.isPending} onClick={() => addDefMut.mutate()}>
              <Icon name="plus" size={15} /> Thêm biểu (không sửa code)
            </button>
          </div>
        </div>

        {/* Workflow biểu đang chọn */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {!selectedDef ? (
            <div className="panel"><EmptyState title="Chọn một biểu" hint="Chọn biểu ở danh mục bên trái để cấu hình dataset và phát hành báo cáo." /></div>
          ) : (
            <>
              {/* SCR-DT11-02/03: template & dataset */}
              <div className="panel">
                <h3 style={{ marginTop: 0 }}>{selectedDef.formCode} — {selectedDef.title}</h3>
                <div className="muted" style={{ fontSize: 13 }}>
                  Template PUBLISHED v{published?.versionNo ?? '—'} · dataset: <code>{datasetCode ?? '—'}</code> · cột: {(published?.layoutSchemaJson?.columns ?? []).map((c) => c.header).join(', ') || '—'}
                </div>
              </div>

              {/* SCR-DT11-04: sinh & validate dataset */}
              <div className="panel">
                <h3 style={{ marginTop: 0 }}>4 · Sinh & validate dataset (snapshot chuẩn)</h3>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                  <input className="input" style={{ maxWidth: 380 }} placeholder="campaignId (nguồn DT-10 official snapshot)" value={sourceRef} onChange={(e) => setSourceRef(e.target.value)} />
                  <button className="btn btn-primary" disabled={!datasetCode || genMut.isPending} onClick={() => genMut.mutate()}>
                    <Icon name="refresh" size={15} /> Sinh dataset
                  </button>
                  <button className="btn" disabled={!dataset || validateDsMut.isPending} onClick={() => validateDsMut.mutate()}>
                    <Icon name="check" size={15} /> Validate dataset
                  </button>
                </div>
                {dataset && (
                  <div style={{ marginTop: 10, fontSize: 13 }}>
                    <div>Số dòng: <strong>{dataset.rowCount}</strong> · trạng thái: {dataset.status}</div>
                    <div className="muted">dataset_hash: <code>{dataset.datasetHash}</code></div>
                    <div className="muted">source_fingerprint: <code>{dataset.sourceFingerprint}</code></div>
                    {!!validations.data?.length && (
                      <table className="table" style={{ marginTop: 8 }}>
                        <thead><tr><th>Kiểm tra</th><th>Kết quả</th><th>Thông điệp</th></tr></thead>
                        <tbody>
                          {validations.data.map((v) => (
                            <tr key={v.id}>
                              <td>{v.checkType}</td>
                              <td style={{ color: v.status === 'FAIL' ? 'var(--danger-fg,#b00)' : v.status === 'WARN' ? 'var(--warn-fg,#a60)' : 'var(--ok-fg,#070)' }}>{VALIDATION_STATUS_LABEL[v.status] ?? v.status}</td>
                              <td className="muted">{v.message}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                )}
              </div>

              {/* SCR-DT11-05/07: lập, duyệt & phát hành */}
              <div className="panel">
                <h3 style={{ marginTop: 0 }}>5–7 · Lập báo cáo → duyệt → phát hành</h3>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button className="btn btn-primary" disabled={!dataset || createReportMut.isPending} onClick={() => createReportMut.mutate()}>
                    <Icon name="file" size={15} /> Lập báo cáo
                  </button>
                  <button className="btn" disabled={!report || stepMut.isPending} onClick={() => stepMut.mutate('validate')}>Validate</button>
                  <button className="btn" disabled={!report || stepMut.isPending} onClick={() => stepMut.mutate('approve')}>Duyệt</button>
                  <button className="btn" disabled={!report || stepMut.isPending} onClick={() => stepMut.mutate('issue')}>
                    <Icon name="lock" size={15} /> Phát hành
                  </button>
                  <button className="btn" disabled={!report || report.status !== 'ISSUED' || stepMut.isPending} onClick={() => stepMut.mutate('reissue')}>
                    <Icon name="refresh" size={15} /> Phát hành lại (version)
                  </button>
                </div>
                {report && (
                  <div style={{ marginTop: 10, fontSize: 13 }}>
                    <div>{report.reportCode} · v{report.versionNo} · <strong>{REPORT_STATUS_LABEL[report.status] ?? report.status}</strong></div>
                    {report.checksum && (
                      <div className="muted">
                        checksum: <code>{report.checksum}</code>{' '}
                        <button className="btn btn-small" onClick={() => downloadMut.mutate(report.id)}><Icon name="download" size={14} /> Tải</button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* SCR-DT11-06: tổng hợp nhiều đơn vị */}
              {report && (
                <div className="panel">
                  <h3 style={{ marginTop: 0 }}>6 · Tổng hợp nhiều đơn vị (đơn vị chưa gửi ≠ 0)</h3>
                  <button className="btn" disabled={rollupMut.isPending} onClick={() => rollupMut.mutate()}>Tổng hợp A (đã gửi) + B (chưa gửi)</button>
                  {rollup.data && (
                    <div style={{ marginTop: 10, fontSize: 13 }}>
                      <div>Đã gửi: <strong>{rollup.data.submittedCount}</strong> · Chưa gửi: <strong style={{ color: 'var(--warn-fg,#a60)' }}>{rollup.data.missingCount}</strong></div>
                      <div className="muted">Tổng hợp (chỉ đơn vị đã gửi): {JSON.stringify(rollup.data.aggregatedTotals)}</div>
                      <ul style={{ margin: '6px 0 0' }}>
                        {rollup.data.children.map((c) => (
                          <li key={c.childOrgId}>{c.childOrgName ?? c.childOrgId}: {c.submissionStatus === 'SUBMITTED' ? 'Đã gửi' : 'Chưa gửi'}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* SCR-DT11-08: truy vết ô → nguồn */}
              {report && report.status !== 'DRAFT' && (
                <div className="panel">
                  <h3 style={{ marginTop: 0 }}>8 · Truy vết ô → dataset → snapshot</h3>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
                    <input className="input" style={{ maxWidth: 380 }} placeholder="cell_ref (vd <materialCatalogId>:total)" value={cell} onChange={(e) => setCell(e.target.value)} />
                    <button className="btn" onClick={() => qc.invalidateQueries({ queryKey: ['dt11', 'lineage', report.id] })}>
                      <Icon name="search" size={15} /> Truy vết
                    </button>
                  </div>
                  {!!lineage.data?.length && (
                    <table className="table" style={{ marginTop: 8 }}>
                      <thead><tr><th>Ô</th><th>Trường</th><th>Trạng thái</th><th>Giá trị</th><th>Nguồn</th></tr></thead>
                      <tbody>
                        {lineage.data.slice(0, 30).map((l) => (
                          <tr key={l.id}>
                            <td><code>{l.cellRef}</code></td>
                            <td>{l.datasetField}</td>
                            <td>{CELL_STATE_LABEL[l.cellState] ?? l.cellState}</td>
                            <td>{l.value ?? '—'}</td>
                            <td className="muted" style={{ fontSize: 11 }}>{JSON.stringify(l.snapshotRef)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
            </>
          )}

          {/* SCR-DT11-09: kho báo cáo đã phát hành (version) */}
          <div className="panel">
            <h3 style={{ marginTop: 0 }}>9 · Kho báo cáo (version)</h3>
            {reports.isLoading ? (
              <Skeleton rows={3} />
            ) : !reports.data?.length ? (
              <EmptyState title="Chưa có báo cáo" hint="Lập & phát hành báo cáo ở trên." />
            ) : (
              <table className="table">
                <thead><tr><th>Mã</th><th>Version</th><th>Trạng thái</th><th>Checksum</th><th></th></tr></thead>
                <tbody>
                  {reports.data.slice(0, 30).map((r) => (
                    <tr key={r.id}>
                      <td><code>{r.reportCode}</code></td>
                      <td>v{r.versionNo}</td>
                      <td>{REPORT_STATUS_LABEL[r.status] ?? r.status}</td>
                      <td className="muted" style={{ fontSize: 11 }}>{r.checksum ? r.checksum.slice(0, 16) + '…' : '—'}</td>
                      <td>{r.checksum && <button className="btn btn-small" onClick={() => downloadMut.mutate(r.id)}><Icon name="download" size={14} /> Tải</button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
