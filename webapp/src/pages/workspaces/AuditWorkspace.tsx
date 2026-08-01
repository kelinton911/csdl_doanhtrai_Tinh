import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { PageHeader } from '../../components/PageHeader';
import { KpiCard } from '../../components/KpiCard';
import { Skeleton, ErrorState } from '../../components/States';
import { Icon } from '../../components/Icon';
import { QuickActions } from '../../components/QuickActions';
import { quickActionsFor, ROLE_TAGLINE } from '../../lib/roles';
import { num } from '../../lib/format';

interface Command {
  inspections: { inProgress: number; openFindings: number; overdueFindings: number };
  legalDocs: { effective: number; expiringSoon: number };
  land: { disputed: number; encroached: number };
}
interface DQ { issues: Array<{ key: string; label: string; count: number; route: string; tone: string }>; totalIssues: number }

// Workspace CÁN BỘ KIỂM TRA / THANH TRA — giám sát & phát hiện: đợt thanh tra, kiến nghị
// tồn đọng/quá hạn, chất lượng dữ liệu và văn bản định mức. Thiên về đọc & theo dõi.
export function AuditWorkspace({ fullName }: { fullName?: string }) {
  const nav = useNavigate();
  const cmd = useQuery({
    queryKey: ['dashboard-command', 'audit'],
    queryFn: async () => (await api.get<Command>('/dashboard/command')).data,
    refetchInterval: 90_000,
  });
  const dq = useQuery({
    queryKey: ['analytics-dq', 'audit'],
    queryFn: async () => (await api.get('/analytics/data-quality')).data as DQ,
  });

  const d = cmd.data;

  return (
    <>
      <PageHeader
        eyebrow="Kiểm tra · Thanh tra · Giám sát"
        title={`Bàn kiểm tra - thanh tra${fullName ? ` — ${fullName}` : ''}`}
        description={ROLE_TAGLINE.AUDITOR}
      />
      <QuickActions actions={quickActionsFor('audit')} />

      {cmd.isLoading && <Skeleton rows={4} />}
      {cmd.isError && <ErrorState error={cmd.error} />}
      {d && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))', gap: 16 }}>
          <KpiCard label="Đợt thanh tra đang tiến hành" value={num(d.inspections.inProgress)} icon="shield" dom="audit" onClick={() => nav('/audits')} />
          <KpiCard label="Kiến nghị chưa xử lý" value={num(d.inspections.openFindings)} icon="clipboard" dom="audit" hint="Cần theo dõi" onClick={() => nav('/audits')} />
          <KpiCard label="Kiến nghị quá hạn" value={num(d.inspections.overdueFindings)} icon="alert" dom="repair" onClick={() => nav('/audits')} />
          <KpiCard label="Tranh chấp / lấn chiếm đất" value={num(d.land.disputed + d.land.encroached)} unit="vụ" icon="map" dom="geo" onClick={() => nav('/land-parcels')} />
          <KpiCard label="Văn bản đang hiệu lực" value={num(d.legalDocs.effective)} icon="file" dom="plan" onClick={() => nav('/legal-documents')} />
          <KpiCard label="Văn bản sắp hết hiệu lực" value={num(d.legalDocs.expiringSoon)} icon="clock" dom="report" onClick={() => nav('/legal-documents')} />
        </div>
      )}

      <div className="card" style={{ padding: 18, marginTop: 22 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div className="eyebrow">Rà soát chất lượng dữ liệu</div>
          <button className="btn btn-sm" onClick={() => nav('/analytics')}><Icon name="chart" size={14} /> Phân tích đầy đủ</button>
        </div>
        {dq.isLoading ? <Skeleton rows={3} /> : dq.isError ? <ErrorState error={dq.error} /> : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 12 }}>
            {(dq.data?.issues ?? []).map((iss) => {
              const color = iss.tone === 'danger' ? 'var(--danger-fg)' : 'var(--warn-fg)';
              return (
                <button key={iss.key} className="card rowh" onClick={() => nav(iss.route)} style={{ padding: 14, cursor: 'pointer', textAlign: 'left', borderLeft: `4px solid ${iss.count > 0 ? color : 'var(--ok-fg)'}` }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{iss.label}</span>
                    <b className="num" style={{ fontSize: 20, color: iss.count > 0 ? color : 'var(--ok-fg)' }}>{num(iss.count)}</b>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
