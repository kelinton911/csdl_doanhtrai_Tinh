import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { api, toProblem } from '../lib/api';
import { toast } from '../lib/toast';
import { useAuth } from '../lib/auth';
import { PageHeader } from '../components/PageHeader';
import { EvidenceDrawer } from '../components/EvidenceDrawer';
import { DataTable, type Column } from '../components/DataTable';
import { Modal } from '../components/Modal';
import { AsyncPicker } from '../components/AsyncPicker';
import { Skeleton, ErrorState } from '../components/States';
import { Icon } from '../components/Icon';
import { currency, dateTime } from '../lib/format';
import { BudgetStatusChip, SpendBar } from './BudgetsListPage';
import { FUNDING_LABEL, LINE_CATEGORY_LABEL, LINE_CATEGORY_OPTIONS } from '../lib/budget';

interface Line { id: string; name: string; category: string; allocatedAmount: number; spent: number; projectId: string | null; projectName: string | null; note: string | null }
interface Plan {
  id: string; code: string; name: string; fiscalYear: number; fundingSource: string | null;
  plannedAmount: string; status: string; notes: string | null; orgName: string | null; areaName: string | null;
  allocated: number; spent: number; remaining: number; lines: Line[]; updatedAt: string;
}
interface Expense { id: string; expenseDate: string; amount: number; voucherNo: string | null; description: string | null; lineName: string | null; projectName: string | null }

const TABS = ['Phân bổ hạn mức', 'Giải ngân & chứng từ'] as const;

export function BudgetDetailPage() {
  const { id } = useParams();
  const nav = useNavigate();
  const qc = useQueryClient();
  const { can } = useAuth();
  const [tab, setTab] = useState<(typeof TABS)[number]>('Phân bổ hạn mức');
  const [docs, setDocs] = useState(false);
  const [lineOpen, setLineOpen] = useState(false);
  const [expOpen, setExpOpen] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const p = useQuery({ queryKey: ['budget', id], queryFn: async () => (await api.get<Plan>(`/budgets/${id}`)).data });
  const expenses = useQuery({ queryKey: ['budget', id, 'expenses'], queryFn: async () => (await api.get<Expense[]>(`/budgets/${id}/expenses`)).data, enabled: tab === 'Giải ngân & chứng từ' });

  const canManage = can('PROVINCIAL_COMMAND', 'BARRACKS_OFFICER', 'SYS_ADMIN');
  const refresh = () => { qc.invalidateQueries({ queryKey: ['budget', id] }); qc.invalidateQueries({ queryKey: ['budgets-summary'] }); };

  const act = useMutation({
    mutationFn: async (action: 'approve' | 'close') => (await api.post(`/budgets/${id}/${action}`)).data,
    onSuccess: (_d, a) => { setActionError(null); refresh(); toast.success(a === 'approve' ? 'Đã chốt dự toán.' : 'Đã quyết toán.'); },
    onError: (e) => { setActionError(toProblem(e).title); toast.problem(e); },
  });
  const delLine = useMutation({
    mutationFn: async (lineId: string) => api.delete(`/budgets/${id}/lines/${lineId}`),
    onSuccess: () => { refresh(); toast.success('Đã xóa khoản mục.'); },
    onError: (e) => toast.problem(e),
  });
  const delExp = useMutation({
    mutationFn: async (expId: string) => api.delete(`/budgets/${id}/expenses/${expId}`),
    onSuccess: () => { refresh(); qc.invalidateQueries({ queryKey: ['budget', id, 'expenses'] }); toast.success('Đã xóa chứng từ.'); },
    onError: (e) => toast.problem(e),
  });

  if (p.isLoading) return <Skeleton rows={6} />;
  if (p.isError || !p.data) return <ErrorState error={p.error} />;
  const d = p.data;
  const planned = Number(d.plannedAmount);
  const editable = d.status !== 'CLOSED';
  const overAllocated = d.allocated > planned && planned > 0;
  const overSpent = d.spent > planned && planned > 0;

  const lineCols: Column<Line>[] = [
    { key: 'name', header: 'Khoản mục', render: (l) => <div><div style={{ fontWeight: 600 }}>{l.name}</div>{l.projectName && <div className="muted" style={{ fontSize: 11 }}>DA: {l.projectName}</div>}</div> },
    { key: 'cat', header: 'Loại', render: (l) => LINE_CATEGORY_LABEL[l.category] ?? l.category },
    { key: 'alloc', header: 'Hạn mức', render: (l) => currency(l.allocatedAmount), align: 'right', mono: true },
    { key: 'spent', header: 'Đã chi/Hạn mức', render: (l) => <SpendBar spent={l.spent} planned={l.allocatedAmount} />, align: 'right' },
    { key: 'act', header: '', align: 'right', render: (l) => canManage && editable ? <button className="btn btn-sm btn-ghost" onClick={() => delLine.mutate(l.id)}><Icon name="logout" size={13} /></button> : null },
  ];
  const expCols: Column<Expense>[] = [
    { key: 'date', header: 'Ngày', render: (e) => e.expenseDate, mono: true, width: 110 },
    { key: 'voucher', header: 'Chứng từ', render: (e) => e.voucherNo ?? '—', mono: true },
    { key: 'desc', header: 'Nội dung', render: (e) => <div><div>{e.description ?? '—'}</div>{e.lineName && <div className="muted" style={{ fontSize: 11 }}>{e.lineName}</div>}</div> },
    { key: 'amount', header: 'Số tiền', render: (e) => currency(e.amount), align: 'right', mono: true },
    { key: 'act', header: '', align: 'right', render: (e) => canManage && editable ? <button className="btn btn-sm btn-ghost" onClick={() => delExp.mutate(e.id)}><Icon name="logout" size={13} /></button> : null },
  ];

  return (
    <>
      <button className="btn btn-ghost btn-sm" onClick={() => nav('/budgets')} style={{ marginBottom: 8 }}>
        <Icon name="chevron" size={14} className="rot180" /> Danh sách dự toán
      </button>
      <PageHeader
        eyebrow={`${d.code} · Niên độ ${d.fiscalYear} · ${FUNDING_LABEL[d.fundingSource ?? ''] ?? ''}`}
        title={d.name}
        description={`${d.orgName ?? ''} · Cập nhật ${dateTime(d.updatedAt)}`}
        actions={
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <BudgetStatusChip status={d.status} />
            <button className="btn" onClick={() => setDocs(true)}><Icon name="file" size={16} /> Chứng từ</button>
            {canManage && editable && <button className="btn" onClick={() => nav(`/budgets/${id}/edit`)}><Icon name="edit" size={16} /> Sửa</button>}
            {canManage && d.status === 'DRAFT' && <button className="btn btn-primary" disabled={act.isPending} onClick={() => act.mutate('approve')}><Icon name="check" size={16} /> Chốt dự toán</button>}
            {canManage && d.status === 'APPROVED' && <button className="btn btn-primary" disabled={act.isPending} onClick={() => { if (confirm('Quyết toán và khóa dự toán này?')) act.mutate('close'); }}><Icon name="lock" size={16} /> Quyết toán</button>}
          </div>
        }
      />

      {overSpent && <Banner tone="danger">Thực chi ({currency(d.spent)}) vượt tổng dự toán ({currency(planned)}).</Banner>}
      {!overSpent && overAllocated && <Banner tone="warn">Tổng phân bổ ({currency(d.allocated)}) vượt tổng dự toán ({currency(planned)}).</Banner>}
      {actionError && <Banner tone="danger">{actionError}</Banner>}

      {/* Đối chiếu */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12, marginBottom: 16 }}>
        <Kpi label="Tổng dự toán" value={currency(planned)} />
        <Kpi label="Đã phân bổ" value={currency(d.allocated)} tone={overAllocated ? 'warn' : undefined} />
        <Kpi label="Đã giải ngân" value={currency(d.spent)} tone={overSpent ? 'danger' : 'ok'} />
        <Kpi label="Còn lại (dự toán - chi)" value={currency(d.remaining)} tone={d.remaining < 0 ? 'danger' : undefined} />
      </div>

      <div style={{ display: 'flex', gap: 2, borderBottom: '2px solid var(--color-neutral-300)', marginBottom: 18 }}>
        {TABS.map((t) => <button key={t} onClick={() => setTab(t)} style={{ all: 'unset', cursor: 'pointer', padding: '10px 14px', fontSize: 13.5, fontWeight: tab === t ? 700 : 500, color: tab === t ? 'var(--color-accent-700)' : 'var(--color-neutral-600)', borderBottom: tab === t ? '2px solid var(--color-accent-600)' : '2px solid transparent', marginBottom: -2 }}>{t}</button>)}
      </div>

      {tab === 'Phân bổ hạn mức' && (
        <>
          {canManage && editable && <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}><button className="btn btn-sm btn-primary" onClick={() => setLineOpen(true)}><Icon name="plus" size={14} /> Thêm khoản mục</button></div>}
          <DataTable columns={lineCols} rows={d.lines} rowKey={(l) => l.id} emptyTitle="Chưa phân bổ hạn mức" emptyHint="Thêm khoản mục để phân bổ dự toán cho công trình/nhiệm vụ." />
        </>
      )}

      {tab === 'Giải ngân & chứng từ' && (
        <>
          {canManage && editable && <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}><button className="btn btn-sm btn-primary" onClick={() => setExpOpen(true)}><Icon name="plus" size={14} /> Ghi chứng từ</button></div>}
          <DataTable columns={expCols} rows={expenses.data} loading={expenses.isLoading} rowKey={(e) => e.id} emptyTitle="Chưa có chứng từ" emptyHint="Ghi nhận giải ngân/thanh toán theo chứng từ." />
        </>
      )}

      {docs && <EvidenceDrawer entityType="budget_plan" entityId={id!} title={`Chứng từ dự toán · ${d.code}`} onClose={() => setDocs(false)} />}
      {lineOpen && <AddLineModal planId={id!} onClose={() => setLineOpen(false)} onDone={() => { setLineOpen(false); refresh(); }} />}
      {expOpen && <AddExpenseModal planId={id!} lines={d.lines} onClose={() => setExpOpen(false)} onDone={() => { setExpOpen(false); refresh(); qc.invalidateQueries({ queryKey: ['budget', id, 'expenses'] }); }} />}
    </>
  );
}

function AddLineModal({ planId, onClose, onDone }: { planId: string; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ name: '', category: 'CONSTRUCTION', allocatedAmount: '', projectId: '', note: '' });
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: async () => api.post(`/budgets/${planId}/lines`, { name: f.name.trim(), category: f.category, allocatedAmount: Number(f.allocatedAmount) || 0, projectId: f.projectId || undefined, note: f.note || undefined }),
    onSuccess: onDone, onError: (e) => setError(toProblem(e).title),
  });
  return (
    <Modal open title="Thêm khoản mục / hạn mức" onClose={onClose} width={520}>
      {error && <div style={{ marginBottom: 12, color: 'var(--danger-fg)', display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="alert" size={15} /> {error}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div><label className="field-label">Tên khoản mục</label><input className="input" value={f.name} onChange={(e) => setF((s) => ({ ...s, name: e.target.value }))} /></div>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><label className="field-label">Loại chi</label><select className="input" value={f.category} onChange={(e) => setF((s) => ({ ...s, category: e.target.value }))}>{LINE_CATEGORY_OPTIONS.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}</select></div>
          <div style={{ flex: 1 }}><label className="field-label">Hạn mức (VND)</label><input className="input num" type="number" min={0} value={f.allocatedAmount} onChange={(e) => setF((s) => ({ ...s, allocatedAmount: e.target.value }))} /></div>
        </div>
        <div><label className="field-label">Liên kết dự án (M13)</label><AsyncPicker endpoint="/projects" value={f.projectId} onChange={(v) => setF((s) => ({ ...s, projectId: v }))} placeholder="Tìm dự án…" /></div>
        <div><label className="field-label">Ghi chú</label><input className="input" value={f.note} onChange={(e) => setF((s) => ({ ...s, note: e.target.value }))} /></div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}><button className="btn" onClick={onClose}>Hủy</button><button className="btn btn-primary" disabled={f.name.trim().length < 2 || save.isPending} onClick={() => save.mutate()}>Lưu khoản mục</button></div>
      </div>
    </Modal>
  );
}

function AddExpenseModal({ planId, lines, onClose, onDone }: { planId: string; lines: Line[]; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ expenseDate: new Date().toISOString().slice(0, 10), amount: '', voucherNo: '', description: '', budgetLineId: '' });
  const [error, setError] = useState<string | null>(null);
  const save = useMutation({
    mutationFn: async () => api.post(`/budgets/${planId}/expenses`, { expenseDate: f.expenseDate, amount: Number(f.amount) || 0, voucherNo: f.voucherNo || undefined, description: f.description || undefined, budgetLineId: f.budgetLineId || undefined }),
    onSuccess: onDone, onError: (e) => setError(toProblem(e).title),
  });
  return (
    <Modal open title="Ghi chứng từ / giải ngân" onClose={onClose} width={520}>
      {error && <div style={{ marginBottom: 12, color: 'var(--danger-fg)', display: 'flex', gap: 6, alignItems: 'center' }}><Icon name="alert" size={15} /> {error}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <div style={{ flex: 1 }}><label className="field-label">Ngày</label><input className="input" type="date" value={f.expenseDate} onChange={(e) => setF((s) => ({ ...s, expenseDate: e.target.value }))} /></div>
          <div style={{ flex: 1 }}><label className="field-label">Số tiền (VND)</label><input className="input num" type="number" min={0} value={f.amount} onChange={(e) => setF((s) => ({ ...s, amount: e.target.value }))} /></div>
        </div>
        <div><label className="field-label">Khoản mục (hạn mức)</label><select className="input" value={f.budgetLineId} onChange={(e) => setF((s) => ({ ...s, budgetLineId: e.target.value }))}><option value="">— Không gắn khoản mục —</option>{lines.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select></div>
        <div><label className="field-label">Số chứng từ</label><input className="input num" value={f.voucherNo} onChange={(e) => setF((s) => ({ ...s, voucherNo: e.target.value }))} /></div>
        <div><label className="field-label">Nội dung</label><input className="input" value={f.description} onChange={(e) => setF((s) => ({ ...s, description: e.target.value }))} /></div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}><button className="btn" onClick={onClose}>Hủy</button><button className="btn btn-primary" disabled={!f.amount || save.isPending} onClick={() => save.mutate()}>Lưu chứng từ</button></div>
      </div>
    </Modal>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string; tone?: 'ok' | 'warn' | 'danger' }) {
  const color = tone === 'danger' ? 'var(--danger-fg)' : tone === 'warn' ? 'var(--warn-fg)' : tone === 'ok' ? 'var(--ok-fg)' : 'var(--color-text)';
  return (<div className="card" style={{ padding: 14 }}><div className="eyebrow" style={{ marginBottom: 6 }}>{label}</div><div className="num" style={{ fontSize: 17, fontWeight: 800, color }}>{value}</div></div>);
}
function Banner({ tone, children }: { tone: 'warn' | 'danger'; children: React.ReactNode }) {
  const c = tone === 'danger' ? { fg: 'var(--danger-fg)', bg: 'var(--danger-bg)', bd: 'var(--danger-bd)' } : { fg: 'var(--warn-fg)', bg: 'var(--warn-bg)', bd: 'var(--warn-bd)' };
  return <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 8, border: `1px solid ${c.bd}`, background: c.bg, color: c.fg, display: 'flex', gap: 8, alignItems: 'center', fontWeight: 600, fontSize: 13 }}><Icon name="alert" size={18} /> {children}</div>;
}
