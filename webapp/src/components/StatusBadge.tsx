import { Icon, type IconName } from './Icon';

// Trạng thái LUÔN thể hiện bằng màu + icon + chữ (Frontend §5, không dùng màu đơn độc).
type Tone = 'ok' | 'warn' | 'danger' | 'info' | 'neutral';

const TONE: Record<Tone, { fg: string; bg: string; bd: string }> = {
  ok: { fg: 'var(--ok-fg)', bg: 'var(--ok-bg)', bd: 'var(--ok-bd)' },
  warn: { fg: 'var(--warn-fg)', bg: 'var(--warn-bg)', bd: 'var(--warn-bd)' },
  danger: { fg: 'var(--danger-fg)', bg: 'var(--danger-bg)', bd: 'var(--danger-bd)' },
  info: { fg: 'var(--info-fg)', bg: 'var(--info-bg)', bd: 'var(--info-bd)' },
  neutral: {
    fg: 'var(--color-neutral-700)',
    bg: 'var(--color-neutral-200)',
    bd: 'var(--color-neutral-400)',
  },
};

// Bản đồ mã trạng thái → (nhãn tiếng Việt, tông màu, icon).
const MAP: Record<string, { label: string; tone: Tone; icon: IconName }> = {
  DRAFT: { label: 'Nháp', tone: 'neutral', icon: 'file' },
  PENDING_REVIEW: { label: 'Chờ duyệt', tone: 'warn', icon: 'clock' },
  SUBMITTED: { label: 'Đã gửi', tone: 'info', icon: 'upload' },
  UNDER_REVIEW: { label: 'Đang duyệt', tone: 'warn', icon: 'clock' },
  CHANGES_REQUESTED: { label: 'Yêu cầu bổ sung', tone: 'warn', icon: 'alert' },
  NEEDS_REVISION: { label: 'Yêu cầu bổ sung', tone: 'warn', icon: 'alert' },
  APPROVED: { label: 'Đã duyệt', tone: 'ok', icon: 'check' },
  REJECTED: { label: 'Từ chối', tone: 'danger', icon: 'alert' },
  LOCKED: { label: 'Đã khóa', tone: 'info', icon: 'lock' },
  ARCHIVED: { label: 'Lưu trữ', tone: 'neutral', icon: 'file' },
  // Kiểm kê
  PLANNED: { label: 'Đã lập', tone: 'neutral', icon: 'clipboard' },
  OPEN: { label: 'Đang mở', tone: 'info', icon: 'clipboard' },
  IN_PROGRESS: { label: 'Đang thực hiện', tone: 'warn', icon: 'clock' },
  RECONCILED: { label: 'Đã đối chiếu', tone: 'ok', icon: 'check' },
  CLOSED: { label: 'Đã đóng', tone: 'neutral', icon: 'lock' },
  // Cơ sở/công trình
  IN_USE: { label: 'Đang khai thác', tone: 'ok', icon: 'check' },
  DECOMMISSIONED: { label: 'Ngừng khai thác', tone: 'neutral', icon: 'lock' },
  // Sửa chữa
  PROPOSED: { label: 'Đề xuất', tone: 'info', icon: 'upload' },
  ACCEPTED: { label: 'Đã nghiệm thu', tone: 'ok', icon: 'check' },
  // Tình huống
  CALCULATED: { label: 'Đã tính', tone: 'info', icon: 'target' },
  REVIEWED: { label: 'Đã rà soát', tone: 'warn', icon: 'clock' },
  SUPERSEDED: { label: 'Đã thay thế', tone: 'neutral', icon: 'refresh' },
  // Cảnh báo
  ACKNOWLEDGED: { label: 'Đã ghi nhận', tone: 'info', icon: 'check' },
  ASSIGNED: { label: 'Đã giao', tone: 'warn', icon: 'user' },
  SNOOZED: { label: 'Tạm hoãn', tone: 'neutral', icon: 'clock' },
  // Chung
  ACTIVE: { label: 'Hiệu lực', tone: 'ok', icon: 'check' },
  LOCKED_ACCOUNT: { label: 'Đã khóa', tone: 'danger', icon: 'lock' },
  EXPIRED: { label: 'Hết hạn', tone: 'danger', icon: 'alert' },
  PUBLISHED: { label: 'Đã phát hành', tone: 'ok', icon: 'check' },
};

export function StatusBadge({ status }: { status: string | null | undefined }) {
  const key = status ?? 'DRAFT';
  const m = MAP[key] ?? { label: key, tone: 'neutral' as Tone, icon: 'file' as IconName };
  const t = TONE[m.tone];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 5,
        color: t.fg,
        background: t.bg,
        border: `1px solid ${t.bd}`,
        borderRadius: 6,
        padding: '2px 8px',
        fontSize: 12,
        fontWeight: 600,
        whiteSpace: 'nowrap',
      }}
    >
      <Icon name={m.icon} size={13} />
      {m.label}
    </span>
  );
}
