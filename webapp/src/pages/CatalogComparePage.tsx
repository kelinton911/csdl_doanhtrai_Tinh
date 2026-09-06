import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useCatalogVersions, useCompareVersions } from '../lib/catalog';
import { PageHeader } from '../components/PageHeader';
import { ErrorState, Skeleton, EmptyState } from '../components/States';
import { Icon } from '../components/Icon';

// SCR-DT01-03 — So sánh 2 phiên bản: thêm / bỏ / đổi tên / đổi ĐVT / đổi cha.
// Lọc theo loại thay đổi (UC-DT01-07, TC-DT01-007).
type Filter = 'all' | 'added' | 'removed' | 'renamed' | 'unit' | 'parent';

export function CatalogComparePage() {
  const versions = useCatalogVersions();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [filter, setFilter] = useState<Filter>('all');

  useEffect(() => {
    const list = versions.data?.data ?? [];
    if (list.length >= 2 && !from && !to) {
      setFrom(list[1].id); // cũ hơn
      setTo(list[0].id); // mới hơn
    }
  }, [versions.data, from, to]);

  const diff = useCompareVersions(from || undefined, to || undefined);

  const counts = useMemo(() => {
    const d = diff.data;
    return {
      added: d?.added.length ?? 0,
      removed: d?.removed.length ?? 0,
      renamed: d?.renamed.length ?? 0,
      unit: d?.unitChanged.length ?? 0,
      parent: d?.parentChanged.length ?? 0,
    };
  }, [diff.data]);

  const chips: Array<{ key: Filter; label: string; n: number; tone: string }> = [
    { key: 'all', label: 'Tất cả', n: counts.added + counts.removed + counts.renamed + counts.unit + counts.parent, tone: 'var(--color-neutral-600)' },
    { key: 'added', label: 'Mã mới', n: counts.added, tone: 'var(--ok-fg)' },
    { key: 'removed', label: 'Bị bỏ', n: counts.removed, tone: 'var(--danger-fg)' },
    { key: 'renamed', label: 'Đổi tên', n: counts.renamed, tone: 'var(--warn-fg)' },
    { key: 'unit', label: 'Đổi ĐVT', n: counts.unit, tone: 'var(--info-fg)' },
    { key: 'parent', label: 'Đổi cha', n: counts.parent, tone: '#5b3fb8' },
  ];

  return (
    <div>
      <PageHeader
        eyebrow="DT-01 · So sánh phiên bản"
        title="So sánh 2 phiên bản danh mục"
        description="Phát hiện mã mới, mã bị bỏ (dữ liệu lịch sử vẫn giữ), đổi tên, đổi ĐVT, đổi cấu trúc cha-con."
        actions={<Link className="btn btn-ghost btn-sm" to="/catalog"><Icon name="chevron" size={15} /> Về danh mục</Link>}
      />

      <div className="panel" style={{ padding: 12, marginBottom: 14, display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap' }}>
        <VersionSelect label="Phiên bản gốc" value={from} onChange={setFrom} options={versions.data?.data ?? []} />
        <Icon name="refresh" size={18} />
        <VersionSelect label="Phiên bản mới" value={to} onChange={setTo} options={versions.data?.data ?? []} />
      </div>

      {versions.isLoading ? (
        <Skeleton rows={6} />
      ) : (versions.data?.data.length ?? 0) < 2 ? (
        <EmptyState icon="file" title="Cần ít nhất 2 phiên bản để so sánh" />
      ) : from === to ? (
        <EmptyState icon="refresh" title="Chọn 2 phiên bản khác nhau" />
      ) : diff.isLoading ? (
        <Skeleton rows={6} />
      ) : diff.isError ? (
        <ErrorState error={diff.error} />
      ) : (
        <>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            {chips.map((c) => (
              <button key={c.key} onClick={() => setFilter(c.key)}
                className={filter === c.key ? 'btn btn-primary btn-sm' : 'btn btn-ghost btn-sm'}>
                {c.label} <b style={{ color: filter === c.key ? '#fff' : c.tone }}>{c.n}</b>
              </button>
            ))}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {(filter === 'all' || filter === 'added') && counts.added > 0 && (
              <Section title="Mã mới" tone="ok" items={diff.data!.added.map((c) => ({ key: c, code: c }))} />
            )}
            {(filter === 'all' || filter === 'removed') && counts.removed > 0 && (
              <Section title="Mã bị bỏ (lịch sử vẫn giữ)" tone="danger" items={diff.data!.removed.map((c) => ({ key: c, code: c }))} />
            )}
            {(filter === 'all' || filter === 'renamed') && counts.renamed > 0 && (
              <Section title="Đổi tên" tone="warn" items={diff.data!.renamed.map((r) => ({ key: r.code, code: r.code, detail: `${r.from} → ${r.to}` }))} />
            )}
            {(filter === 'all' || filter === 'unit') && counts.unit > 0 && (
              <Section title="Đổi đơn vị tính" tone="info" items={diff.data!.unitChanged.map((r) => ({ key: r.code, code: r.code, detail: `${r.from ?? '—'} → ${r.to ?? '—'}` }))} />
            )}
            {(filter === 'all' || filter === 'parent') && counts.parent > 0 && (
              <Section title="Đổi cấu trúc cha-con" tone="info" items={diff.data!.parentChanged.map((r) => ({ key: r.code, code: r.code, detail: `${r.from ?? '(gốc)'} → ${r.to ?? '(gốc)'}` }))} />
            )}
            {chips.find((c) => c.key === 'all')!.n === 0 && (
              <EmptyState icon="check" title="Hai phiên bản giống nhau" hint="Không có thay đổi." />
            )}
          </div>
        </>
      )}
    </div>
  );
}

function VersionSelect({ label, value, onChange, options }: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: Array<{ id: string; versionCode: string; versionName: string }>;
}) {
  return (
    <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 13 }}>
      <span className="muted">{label}:</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ minWidth: 220 }}>
        <option value="">— chọn —</option>
        {options.map((v) => <option key={v.id} value={v.id}>{v.versionCode}</option>)}
      </select>
    </label>
  );
}

function Section({ title, tone, items }: {
  title: string;
  tone: 'ok' | 'danger' | 'warn' | 'info';
  items: Array<{ key: string; code: string; detail?: string }>;
}) {
  const map = {
    ok: { fg: 'var(--ok-fg)', bg: 'var(--ok-bg)', bd: 'var(--ok-bd)' },
    danger: { fg: 'var(--danger-fg)', bg: 'var(--danger-bg)', bd: 'var(--danger-bd)' },
    warn: { fg: 'var(--warn-fg)', bg: 'var(--warn-bg)', bd: 'var(--warn-bd)' },
    info: { fg: 'var(--info-fg)', bg: 'var(--info-bg)', bd: 'var(--info-bd)' },
  }[tone];
  return (
    <div className="panel" style={{ padding: 0, overflow: 'hidden' }}>
      <div style={{ padding: '8px 14px', background: map.bg, color: map.fg, fontWeight: 700, borderBottom: `1px solid ${map.bd}` }}>
        {title} ({items.length})
      </div>
      <ul style={{ listStyle: 'none', margin: 0, padding: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
        {items.map((it) => (
          <li key={it.key} style={{ display: 'flex', gap: 12, padding: '4px 8px', fontSize: 13.5 }}>
            <span className="num" style={{ minWidth: 90, color: 'var(--color-neutral-700)' }}>{it.code}</span>
            {it.detail && <span className="muted">{it.detail}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}
