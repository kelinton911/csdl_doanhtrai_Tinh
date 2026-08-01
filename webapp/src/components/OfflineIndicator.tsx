import { useNavigate } from 'react-router-dom';
import { useOfflineQueue } from '../lib/offlineQueue';
import { toast } from '../lib/toast';
import { Icon } from './Icon';

// M26 — Chỉ báo kết nối + hàng đợi đồng bộ ngoại tuyến trên thanh trên cùng.
// Trực tuyến & hàng đợi rỗng → chấm xanh "Trực tuyến". Có mục chờ → hiện số & cho đồng bộ.
export function OfflineIndicator() {
  const { online, counts, flush } = useOfflineQueue();
  const navigate = useNavigate();
  const queued = counts.pending + counts.conflict + counts.failed;

  async function doFlush() {
    const r = await flush();
    if (r.skipped) {
      toast.warn('Chưa thể đồng bộ (ngoại tuyến hoặc phiên hết hạn).');
      return;
    }
    const parts = [`${r.applied} đã cập nhật`];
    if (r.conflict) parts.push(`${r.conflict} xung đột`);
    if (r.failed) parts.push(`${r.failed} lỗi`);
    toast.success(`Đồng bộ hoàn tất: ${parts.join(', ')}.`);
  }

  if (online && queued === 0) {
    return (
      <span
        className="hide-sm"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ok-fg)', background: 'var(--ok-bg)', border: '1px solid var(--ok-bd)', padding: '4px 8px', borderRadius: 6 }}
        title="Kết nối máy chủ nội bộ ổn định"
      >
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--ok-fg)' }} />
        Trực tuyến
      </span>
    );
  }

  const offlineStyle = {
    display: 'inline-flex' as const,
    alignItems: 'center' as const,
    gap: 6,
    fontSize: 12,
    color: online ? 'var(--warn-fg)' : 'var(--danger-fg)',
    background: online ? 'var(--warn-bg)' : 'var(--danger-bg)',
    border: `1px solid ${online ? 'var(--warn-bd)' : 'var(--danger-bd)'}`,
    padding: '3px 6px',
    borderRadius: 6,
  };

  return (
    <span style={offlineStyle} title={online ? 'Có thay đổi chờ đồng bộ' : 'Đang ngoại tuyến — thay đổi được lưu tạm trên máy'}>
      <Icon name={online ? 'refresh' : 'alert'} size={13} />
      {online ? 'Trực tuyến' : 'Ngoại tuyến'}
      {queued > 0 && (
        <>
          <span
            style={{ minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8, background: 'var(--danger)', color: '#fff', fontSize: 10, fontWeight: 700, display: 'grid', placeItems: 'center' }}
            title={`Chờ: ${counts.pending} · Xung đột: ${counts.conflict} · Lỗi: ${counts.failed}`}
          >
            {queued > 99 ? '99+' : queued}
          </span>
          {online && (
            <button className="btn btn-ghost btn-sm" style={{ padding: '0 6px', height: 20 }} onClick={doFlush} title="Đồng bộ ngay">
              Đồng bộ
            </button>
          )}
          {counts.conflict + counts.failed > 0 && (
            <button className="btn btn-ghost btn-sm" style={{ padding: '0 6px', height: 20 }} onClick={() => navigate('/field')} title="Xem chi tiết hàng đợi">
              Xem
            </button>
          )}
        </>
      )}
    </span>
  );
}
