import { Icon } from './Icon';

// Phân trang page/size đơn giản, khớp meta backend.
export function Pagination({
  page,
  size,
  total,
  onPage,
}: {
  page: number;
  size: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / size));
  const from = total === 0 ? 0 : (page - 1) * size + 1;
  const to = Math.min(page * size, total);
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, fontSize: 13 }}>
      <span className="muted">
        Hiển thị <span className="num">{from}</span>–<span className="num">{to}</span> / <span className="num">{total}</span>
      </span>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <button className="btn btn-sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          <Icon name="chevron" size={14} className="rot180" /> Trước
        </button>
        <span className="num" style={{ minWidth: 60, textAlign: 'center' }}>{page} / {pages}</span>
        <button className="btn btn-sm" disabled={page >= pages} onClick={() => onPage(page + 1)}>
          Sau <Icon name="chevron" size={14} />
        </button>
      </div>
    </div>
  );
}
