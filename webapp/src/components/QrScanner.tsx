import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import { Icon } from './Icon';

// M10 — Máy quét QR/mã vạch dùng camera thiết bị. Trả về nội dung giải mã (text) rồi tự đóng.
export function QrScanner({
  onResult,
  onClose,
  title = 'Quét mã QR',
}: {
  onResult: (text: string) => void;
  onClose: () => void;
  title?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const reader = new BrowserMultiFormatReader();
    let controls: IScannerControls | undefined;
    let done = false;
    (async () => {
      try {
        controls = await reader.decodeFromVideoDevice(undefined, videoRef.current!, (result) => {
          if (result && !done) {
            done = true;
            controls?.stop();
            onResult(result.getText());
          }
        });
      } catch {
        setError('Không truy cập được camera. Hãy cấp quyền camera cho trình duyệt và dùng HTTPS/localhost.');
      }
    })();
    return () => {
      try {
        controls?.stop();
      } catch {
        /* ignore */
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      role="dialog"
      aria-modal="true"
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.85)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#fff', marginBottom: 12, fontWeight: 700 }}>
        <Icon name="search" size={18} /> {title}
      </div>
      {error ? (
        <div className="card" style={{ padding: 20, maxWidth: 380, textAlign: 'center' }}>
          <div style={{ color: 'var(--danger-fg)', fontWeight: 700, marginBottom: 8 }}>Lỗi camera</div>
          <div className="muted" style={{ fontSize: 13 }}>{error}</div>
        </div>
      ) : (
        <div style={{ position: 'relative', width: 'min(92vw, 420px)', aspectRatio: '1 / 1', borderRadius: 12, overflow: 'hidden', background: '#000' }}>
          <video ref={videoRef} style={{ width: '100%', height: '100%', objectFit: 'cover' }} muted playsInline />
          <div style={{ position: 'absolute', inset: '14%', border: '3px solid rgba(255,255,255,0.85)', borderRadius: 12, boxShadow: '0 0 0 100vmax rgba(0,0,0,0.25)' }} />
        </div>
      )}
      <button className="btn" style={{ marginTop: 16 }} onClick={onClose}>
        Đóng
      </button>
      <div style={{ color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 10, maxWidth: 360, textAlign: 'center' }}>
        Đưa mã QR tem vật chất/kho trạm/doanh trại vào khung để tra cứu nhanh.
      </div>
    </div>
  );
}

// Bóc tách deep-link "/scan/<type>/<code>" từ nội dung QR (URL đầy đủ hoặc đường dẫn tương đối).
export function parseScanPayload(text: string): { type: string; code: string } | null {
  const idx = text.indexOf('/scan/');
  if (idx < 0) return null;
  const rest = text.slice(idx + '/scan/'.length);
  const [type, ...codeParts] = rest.split('/');
  const code = decodeURIComponent(codeParts.join('/') || '').trim();
  if (!type || !code) return null;
  return { type: type.trim(), code };
}
