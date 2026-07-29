import { useAuth } from '../lib/auth';
import { Modal } from './Modal';
import { Icon } from './Icon';
import { dateTime } from '../lib/format';

interface PrintPreviewProps {
  open: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: React.ReactNode;
}

export function PrintPreviewModal({ open, title, subtitle = 'Bản in chính thức', onClose, children }: PrintPreviewProps) {
  const { profile } = useAuth();
  const userName = profile?.fullName ?? 'Cán bộ hệ thống';
  const timeStr = dateTime(new Date().toISOString());

  function handlePrint() {
    window.print();
  }

  if (!open) return null;

  return (
    <Modal open={open} title={`Xem trước bản in · ${title}`} onClose={onClose} width={880}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <span className="muted" style={{ fontSize: 13 }}>Khổ giấy A4 (Dọc) · Watermark đóng dấu theo định danh cán bộ</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-primary" onClick={handlePrint}>
            <Icon name="download" size={16} /> Thực hiện In / Xuất PDF
          </button>
        </div>
      </div>

      <div
        className="scrl"
        style={{
          maxHeight: '70vh',
          overflowY: 'auto',
          background: 'var(--color-neutral-200)',
          padding: 20,
          borderRadius: 8,
          display: 'flex',
          justifyContent: 'center',
        }}
      >
        {/* Khung khổ A4 giả lập */}
        <div
          id="print-area"
          style={{
            width: '210mm',
            minHeight: '297mm',
            background: '#ffffff',
            color: '#0f172a',
            padding: '20mm 15mm',
            boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
            position: 'relative',
            fontFamily: "'Archivo', 'Times New Roman', serif",
            overflow: 'hidden',
          }}
        >
          {/* Layer Watermark Chéo */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              pointerEvents: 'none',
              transform: 'rotate(-32deg)',
              opacity: 0.08,
              fontSize: 32,
              fontWeight: 800,
              letterSpacing: 4,
              color: '#dc2626',
              whiteSpace: 'nowrap',
              userSelect: 'none',
            }}
          >
            BẢO MẬT NỘI BỘ — {userName.toUpperCase()} — {timeStr}
          </div>

          {/* Quốc hiệu & Tiêu ngữ */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20, borderBottom: '2px solid #0f172a', paddingBottom: 12 }}>
            <div>
              <div style={{ fontWeight: 700, fontSize: 13, textTransform: 'uppercase' }}>BỘ QUỐC PHÒNG</div>
              <div style={{ fontWeight: 700, fontSize: 13, textTransform: 'uppercase' }}>BỘ CHQS TỈNH</div>
              <div style={{ fontSize: 12, marginTop: 4 }}>Số: ....... /BC-CSDLDT</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: 13.5, textTransform: 'uppercase' }}>CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
              <div style={{ fontWeight: 700, fontSize: 13 }}>Độc lập - Tự do - Hạnh phúc</div>
              <div style={{ fontSize: 12, marginTop: 4, fontStyle: 'italic' }}>Ngày {new Date().getDate()} tháng {new Date().getMonth() + 1} năm {new Date().getFullYear()}</div>
            </div>
          </div>

          {/* Tiêu đề Báo cáo */}
          <div style={{ textAlign: 'center', margin: '20px 0 24px' }}>
            <h2 style={{ fontSize: 18, fontWeight: 800, textTransform: 'uppercase', margin: 0, color: '#1e3a8a' }}>{title}</h2>
            <div style={{ fontSize: 13, fontStyle: 'italic', marginTop: 4, color: '#475569' }}>{subtitle}</div>
          </div>

          {/* Nội dung báo cáo */}
          <div style={{ fontSize: 13, lineHeight: 1.6 }}>{children}</div>

          {/* Chữ ký & Phê duyệt */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 40, pageBreakInside: 'avoid' }}>
            <div style={{ textAlign: 'center', width: 200 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>NGƯỜI LẬP BÁO CÁO</div>
              <div style={{ fontSize: 12, fontStyle: 'italic' }}>(Ký, ghi rõ họ tên)</div>
              <div style={{ height: 60 }} />
              <div style={{ fontWeight: 600, fontSize: 13 }}>{userName}</div>
            </div>
            <div style={{ textAlign: 'center', width: 220 }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>CHỈ HUY PHE DUYỆT</div>
              <div style={{ fontSize: 12, fontStyle: 'italic' }}>(Ký tên, đóng dấu)</div>
              <div style={{ height: 60 }} />
              <div style={{ fontWeight: 600, fontSize: 13 }}>Đại tá Nguyễn Văn A</div>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
