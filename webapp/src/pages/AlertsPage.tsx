import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api, toProblem } from '../lib/api';
import { useAuth } from '../lib/auth';
import { PageHeader } from '../components/PageHeader';
import { Icon } from '../components/Icon';
import { Skeleton, ErrorState, EmptyState } from '../components/States';
import { dateTime } from '../lib/format';

interface Alert { id: string; alertType: string; severity: string; title: string; description: string | null; status: string; dueAt: string | null; createdAt: string }

const SEV: Record<string, { label: string; fg: string; bg: string; bd: string; order: number }> = {
  CRITICAL: { label: 'Nghiêm trọng', fg: 'var(--danger-fg)', bg: 'var(--danger-bg)', bd: 'var(--danger-bd)', order: 0 },
  HIGH: { label: 'Cao', fg: 'var(--danger-fg)', bg: 'var(--danger-bg)', bd: 'var(--danger-bd)', order: 1 },
  MEDIUM: { label: 'Trung bình', fg: 'var(--warn-fg)', bg: 'var(--warn-bg)', bd: 'var(--warn-bd)', order: 2 },
  LOW: { label: 'Thấp', fg: 'var(--info-fg)', bg: 'var(--info-bg)', bd: 'var(--info-bd)', order: 3 },
};
const STATUS_FILTER = [
  { key: '', label: 'Tất cả' },
  { key: 'OPEN', label: 'Cần xử lý' },
  { key: 'ASSIGNED', label: 'Đã giao' },
  { key: 'CLOSED', label: 'Đã đóng' },
];

export function AlertsPage() {
  const qc = useQueryClient();
  const { hasRole } = useAuth();
  const canAct = hasRole('BARRACKS_OFFICER', 'SYS_ADMIN', 'PROVINCIAL_COMMAND');
  const [status, setStatus] = useState('OPEN');

  const summary = useQuery({ queryKey: ['alert-summary'], queryFn: async () => (await api.get('/alerts/summary')).data as { open: number; bySeverity: Record<string, number> } });
  const alerts = useQuery({ queryKey: ['alerts', status], queryFn: async () => (await api.get('/alerts', { params: { status: status || undefined, size: 100 } })).data as { data: Alert[] } });

  const assign = useMutation({ mutationFn: async (id: string) => api.post(`/alerts/${id}/assign`, {}), onSuccess: () => invalidate() });
  const close = useMutation({ mutationFn: async ({ id, resolution }: { id: string; resolution: string }) => api.post(`/alerts/${id}/close`, { resolution }), onSuccess: () => invalidate() });
  function invalidate() { qc.invalidateQueries({ queryKey: ['alerts'] }); qc.invalidateQueries({ queryKey: ['alert-summary'] }); }

  const generate = useMutation({ mutationFn: async () => api.post('/alerts/generate'), onSuccess: () => invalidate() });

  const rows = [...(alerts.data?.data ?? [])].sort((a, b) => (SEV[a.severity]?.order ?? 9) - (SEV[b.severity]?.order ?? 9));

  return (
    <>
      <PageHeader
        eyebrow="Trung tâm cảnh báo"
        title="Cảnh báo & xử lý"
        description="Phân loại theo mức độ, giao việc và đóng cảnh báo (bắt buộc ghi kết quả). Gom trùng theo đối tượng."
        actions={canAct && <button className="btn" onClick={() => generate.mutate()} disabled={generate.isPending}><Icon name="refresh" size={16} /> Quét sinh cảnh báo</button>}
      />

      {summary.data && (
        <div style={{ display: 'flex', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
          <SumCard label="Đang mở" value={summary.data.open} tone="neutral" />
          {Object.entries(summary.data.bySeverity).sort((a, b) => (SEV[a[0]]?.order ?? 9) - (SEV[b[0]]?.order ?? 9)).map(([s, n]) => (
            <SumCard key={s} label={SEV[s]?.label ?? s} value={n} tone={s} />
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {STATUS_FILTER.map((f) => (
          <button key={f.key} className="btn btn-sm" onClick={() => setStatus(f.key)} style={{ background: status === f.key ? 'var(--color-accent-600)' : 'var(--surface-1)', color: status === f.key ? '#fff' : 'var(--color-text)', borderColor: status === f.key ? 'var(--color-accent-600)' : 'var(--color-neutral-400)' }}>{f.label}</button>
        ))}
      </div>

      {alerts.isError ? <ErrorState error={alerts.error} /> : alerts.isLoading ? <Skeleton rows={6} /> : rows.length === 0 ? (
        <EmptyState icon="check" title="Không có cảnh báo" hint="Không có cảnh báo trong bộ lọc hiện tại." />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {rows.map((a) => {
            const s = SEV[a.severity] ?? SEV.MEDIUM;
            return (
              <div key={a.id} className="panel" style={{ padding: '12px 16px', borderLeft: `4px solid ${s.fg}`, display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: s.fg, background: s.bg, border: `1px solid ${s.bd}`, padding: '1px 7px', borderRadius: 5 }}>{s.label}</span>
                    <span style={{ fontWeight: 600 }}>{a.title}</span>
                  </div>
                  <div className="muted num" style={{ fontSize: 11.5, marginTop: 3 }}>
                    {a.description ? a.description + ' · ' : ''}{dateTime(a.createdAt)}{a.dueAt ? ` · Hạn: ${dateTime(a.dueAt)}` : ''}
                  </div>
                </div>
                {canAct && a.status !== 'CLOSED' && (
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {a.status === 'OPEN' && <button className="btn btn-sm" onClick={() => assign.mutate(a.id)}><Icon name="user" size={14} /> Nhận</button>}
                    <button className="btn btn-sm btn-primary" onClick={() => { const r = prompt('Kết quả xử lý:'); if (r) close.mutate({ id: a.id, resolution: r }); }}><Icon name="check" size={14} /> Đóng</button>
                  </div>
                )}
                {a.status === 'CLOSED' && <span style={{ fontSize: 12, color: 'var(--ok-fg)', flexShrink: 0 }}><Icon name="check" size={14} /> Đã đóng</span>}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function SumCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  const s = SEV[tone];
  const color = s?.fg ?? 'var(--color-text)';
  return (
    <div className="card" style={{ padding: '12px 18px', minWidth: 130, borderTop: `3px solid ${color}` }}>
      <div className="eyebrow">{label}</div>
      <div className="num" style={{ fontSize: 26, fontWeight: 700, color }}>{value}</div>
    </div>
  );
}
