import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { PageHeader } from '../components/PageHeader';
import { Skeleton, ErrorState, EmptyState } from '../components/States';
import { Icon } from '../components/Icon';
import { QrScanner, parseScanPayload } from '../components/QrScanner';
import { toast } from '../lib/toast';

interface Resolved {
  type: string;
  code: string;
  found: boolean;
  id: string | null;
  name: string | null;
  route: string | null;
}

const TYPE_LABEL: Record<string, string> = {
  barracks: 'Doanh trại',
  storage: 'Kho / trạm',
  asset: 'Loại tài sản (danh mục)',
};

// M10 — Quét & tra cứu nhanh: /scan mở camera; /scan/:type/:code hiển thị đối tượng.
export function ScanPage() {
  const { type, code } = useParams<{ type?: string; code?: string }>();
  const navigate = useNavigate();
  const [scanning, setScanning] = useState(false);

  const q = useQuery({
    queryKey: ['scan', type, code],
    queryFn: async () =>
      (await api.get(`/scan/${type}/${encodeURIComponent(code!)}`)).data as Resolved,
    enabled: !!type && !!code,
  });

  function handleResult(text: string) {
    setScanning(false);
    const parsed = parseScanPayload(text);
    if (!parsed) {
      toast.error('Mã QR không thuộc hệ thống CSDL doanh trại.');
      return;
    }
    navigate(`/scan/${parsed.type}/${encodeURIComponent(parsed.code)}`);
  }

  return (
    <>
      <PageHeader
        eyebrow="Hiện trường"
        title="Quét & tra cứu QR"
        description="Quét tem QR vật chất, kho/trạm hoặc doanh trại để mở nhanh hồ sơ tương ứng."
        actions={
          <button className="btn btn-primary" onClick={() => setScanning(true)}>
            <Icon name="search" size={16} /> Quét mã QR
          </button>
        }
      />

      {type && code ? (
        q.isLoading ? (
          <div className="panel" style={{ padding: 16 }}><Skeleton rows={3} /></div>
        ) : q.error ? (
          <ErrorState error={q.error} />
        ) : q.data && q.data.found ? (
          <div className="card" style={{ padding: 20, maxWidth: 520 }}>
            <div className="eyebrow" style={{ marginBottom: 4 }}>{TYPE_LABEL[q.data.type] ?? q.data.type}</div>
            <div style={{ fontSize: 18, fontWeight: 800 }}>{q.data.name}</div>
            <div className="num muted" style={{ fontSize: 13, marginTop: 2 }}>{q.data.code}</div>
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              {q.data.route && (
                <button className="btn btn-primary" onClick={() => navigate(q.data!.route!)}>
                  <Icon name="chevron" size={16} /> Mở hồ sơ
                </button>
              )}
              <button className="btn" onClick={() => navigate('/scan')}>
                <Icon name="search" size={16} /> Quét mã khác
              </button>
            </div>
          </div>
        ) : (
          <EmptyState
            icon="alert"
            title="Không tìm thấy đối tượng"
            hint={`Không có ${TYPE_LABEL[type] ?? type} với mã "${code}". Kiểm tra lại tem hoặc dữ liệu đã đồng bộ.`}
            action={<button className="btn btn-primary" onClick={() => navigate('/scan')}>Quét mã khác</button>}
          />
        )
      ) : (
        <EmptyState
          icon="search"
          title="Chưa có mã nào được quét"
          hint="Nhấn “Quét mã QR” và đưa tem vào khung camera. Cần dùng HTTPS hoặc localhost để trình duyệt cho phép camera."
          action={<button className="btn btn-primary" onClick={() => setScanning(true)}><Icon name="search" size={16} /> Quét mã QR</button>}
        />
      )}

      {scanning && <QrScanner onResult={handleResult} onClose={() => setScanning(false)} />}
    </>
  );
}
