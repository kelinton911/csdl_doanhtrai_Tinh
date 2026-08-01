import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuth } from '../lib/auth';
import { PageHeader } from '../components/PageHeader';
import { EvidenceDrawer } from '../components/EvidenceDrawer';
import { Skeleton, ErrorState } from '../components/States';
import { Icon } from '../components/Icon';
import { dateTime } from '../lib/format';
import { DocStatusChip } from './LegalDocsListPage';
import { DOC_TYPE_LABEL, FIELD_LABEL, CONFIDENTIALITY_LABEL, confidentialityColor } from '../lib/legalDoc';

interface DocRef { id: string; code: string; docNumber: string; title: string }
interface Doc {
  id: string; code: string; docNumber: string; title: string; docType: string; issuingBody: string | null;
  issuedDate: string | null; effectiveDate: string | null; expiryDate: string | null; effectiveStatus: string;
  field: string; confidentiality: string; summary: string | null; keywords: string | null;
  sourceUrl: string | null; notes: string | null; updatedAt: string;
  supersedes: DocRef | null; supersededBy: DocRef[];
}

export function LegalDocDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const { can } = useAuth();
  const [files, setFiles] = useState(false);

  const d = useQuery({ queryKey: ['legal-document', id], queryFn: async () => (await api.get<Doc>(`/legal-documents/${id}`)).data });
  const canManage = can('BARRACKS_OFFICER', 'PROVINCIAL_COMMAND', 'SYS_ADMIN');

  if (d.isLoading) return <Skeleton rows={6} />;
  if (d.isError || !d.data) return <ErrorState error={d.error} />;
  const v = d.data;
  const expiringSoon = v.effectiveStatus === 'EFFECTIVE' && v.expiryDate && new Date(v.expiryDate) < new Date(Date.now() + 60 * 86400000);
  const expired = v.expiryDate && new Date(v.expiryDate) < new Date();

  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={() => nav('/legal-documents')} style={{ marginBottom: 8 }}>
        <Icon name="chevron" size={14} className="rot180" /> Danh sách văn bản
      </button>
      <PageHeader
        eyebrow={`${v.docNumber} · ${DOC_TYPE_LABEL[v.docType] ?? v.docType}`}
        title={v.title}
        description={`${v.issuingBody ?? ''} · Cập nhật ${dateTime(v.updatedAt)}`}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <DocStatusChip status={v.effectiveStatus} />
            <button className="btn" onClick={() => setFiles(true)}><Icon name="file" size={16} /> Tệp văn bản</button>
            {canManage && <button className="btn" onClick={() => nav(`/legal-documents/${id}/edit`)}><Icon name="edit" size={16} /> Sửa</button>}
          </div>
        }
      />

      {expired && v.effectiveStatus === 'EFFECTIVE' && <Banner tone="danger">Văn bản đã quá ngày hết hiệu lực ({String(v.expiryDate).slice(0, 10)}) nhưng vẫn ghi "Đang hiệu lực" — cần rà soát.</Banner>}
      {!expired && expiringSoon && <Banner tone="warn">Văn bản sắp hết hiệu lực ({String(v.expiryDate).slice(0, 10)}).</Banner>}

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16 }} className="field-grid">
        <div className="card" style={{ padding: 18 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Thông tin văn bản</div>
          <Field label="Số/ký hiệu" value={v.docNumber} mono />
          <Field label="Loại" value={DOC_TYPE_LABEL[v.docType] ?? v.docType} />
          <Field label="Cơ quan ban hành" value={v.issuingBody ?? '—'} />
          <Field label="Lĩnh vực" value={FIELD_LABEL[v.field] ?? v.field} />
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-neutral-200)' }}>
            <span className="muted" style={{ fontSize: 13 }}>Độ mật</span>
            <span style={{ color: confidentialityColor(v.confidentiality), fontWeight: 700, fontSize: 13 }}>{CONFIDENTIALITY_LABEL[v.confidentiality] ?? v.confidentiality}</span>
          </div>
          <Field label="Ban hành" value={v.issuedDate ? String(v.issuedDate).slice(0, 10) : '—'} mono />
          <Field label="Hiệu lực từ" value={v.effectiveDate ? String(v.effectiveDate).slice(0, 10) : '—'} mono />
          <Field label="Hết hiệu lực" value={v.expiryDate ? String(v.expiryDate).slice(0, 10) : '—'} mono />
          {v.sourceUrl && <div style={{ paddingTop: 8 }}><a href={v.sourceUrl} target="_blank" rel="noreferrer" className="btn btn-sm btn-ghost" style={{ padding: 0 }}><Icon name="download" size={14} /> Nguồn văn bản</a></div>}
        </div>
        <div className="card" style={{ padding: 18 }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Liên kết thay thế</div>
          {v.supersedes ? (
            <div style={{ marginBottom: 12 }}>
              <div className="muted" style={{ fontSize: 12 }}>Văn bản này thay thế:</div>
              <button className="btn btn-sm btn-ghost" style={{ padding: 0, textAlign: 'left' }} onClick={() => nav(`/legal-documents/${v.supersedes!.id}`)}>
                <Icon name="chevron" size={13} /> {v.supersedes.docNumber} — {v.supersedes.title}
              </button>
            </div>
          ) : <div className="muted" style={{ fontSize: 13, marginBottom: 12 }}>Không thay thế văn bản nào.</div>}
          {v.supersededBy.length > 0 ? (
            <div>
              <div className="muted" style={{ fontSize: 12 }}>Bị thay thế bởi:</div>
              {v.supersededBy.map((s) => (
                <button key={s.id} className="btn btn-sm btn-ghost" style={{ padding: 0, display: 'block', textAlign: 'left' }} onClick={() => nav(`/legal-documents/${s.id}`)}>
                  <Icon name="chevron" size={13} /> {s.docNumber} — {s.title}
                </button>
              ))}
            </div>
          ) : <div className="muted" style={{ fontSize: 13 }}>Chưa bị văn bản nào thay thế.</div>}
        </div>
      </div>

      {(v.summary || v.keywords) && (
        <div className="card" style={{ padding: 18, marginTop: 16 }}>
          <div className="eyebrow" style={{ marginBottom: 8 }}>Tóm tắt & từ khóa</div>
          {v.summary && <p style={{ fontSize: 13.5, margin: '0 0 8px' }}>{v.summary}</p>}
          {v.keywords && <div className="muted" style={{ fontSize: 12.5 }}>Từ khóa: {v.keywords}</div>}
          {v.notes && <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>{v.notes}</div>}
        </div>
      )}

      {files && <EvidenceDrawer entityType="legal_document" entityId={id!} title={`Tệp văn bản · ${v.docNumber}`} onClose={() => setFiles(false)} />}
    </>
  );
}

function Field({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (<div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--color-neutral-200)', gap: 12 }}><span className="muted" style={{ fontSize: 13 }}>{label}</span><span className={mono ? 'num' : undefined} style={{ fontWeight: 600, fontSize: 13.5, textAlign: 'right' }}>{value}</span></div>);
}
function Banner({ tone, children }: { tone: 'warn' | 'danger'; children: React.ReactNode }) {
  const c = tone === 'danger' ? { fg: 'var(--danger-fg)', bg: 'var(--danger-bg)', bd: 'var(--danger-bd)' } : { fg: 'var(--warn-fg)', bg: 'var(--warn-bg)', bd: 'var(--warn-bd)' };
  return <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 8, border: `1px solid ${c.bd}`, background: c.bg, color: c.fg, display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600, fontSize: 13 }}><Icon name="clock" size={18} /> {children}</div>;
}
