import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from '../lib/toast';
import { Modal } from './Modal';
import { Icon } from './Icon';

// Bật/tắt OTP (TOTP) cho tài khoản hiện tại (BE-3). Hiển thị bí mật + URI để nạp
// vào ứng dụng Authenticator (Google/Microsoft Authenticator).
export function MfaEnrollModal({ onClose }: { onClose: () => void }) {
  const [result, setResult] = useState<{ secret: string; otpauthUrl: string } | null>(null);

  const enroll = useMutation({
    mutationFn: async () => (await api.post('/auth/mfa/enroll', {})).data as { secret: string; otpauthUrl: string },
    onSuccess: (d) => { setResult(d); toast.success('Đã bật OTP. Quét/nhập bí mật vào ứng dụng Authenticator.'); },
    onError: (e) => toast.problem(e, 'Không bật được OTP'),
  });
  const disable = useMutation({
    mutationFn: async () => api.post('/auth/mfa/disable', {}),
    onSuccess: () => { setResult(null); toast.success('Đã tắt OTP cho tài khoản.'); onClose(); },
    onError: (e) => toast.problem(e, 'Không tắt được OTP'),
  });

  return (
    <Modal open title="Bảo mật OTP (xác thực 2 lớp)" onClose={onClose} width={480}>
      {!result ? (
        <>
          <p style={{ marginTop: 0, fontSize: 13 }}>
            Bật OTP để yêu cầu mã 6 số từ ứng dụng Authenticator mỗi lần đăng nhập. Bí mật chỉ hiển thị một lần khi bật.
          </p>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
            <button className="btn btn-danger btn-sm" disabled={disable.isPending} onClick={() => disable.mutate()}>Tắt OTP</button>
            <button className="btn btn-primary" disabled={enroll.isPending} onClick={() => enroll.mutate()}>
              <Icon name="lock" size={15} /> {enroll.isPending ? 'Đang bật…' : 'Bật OTP'}
            </button>
          </div>
        </>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ padding: 12, borderRadius: 8, background: 'var(--warn-bg)', border: '1px solid var(--warn-bd)', color: 'var(--warn-fg)', fontSize: 13 }}>
            <Icon name="alert" size={15} /> Lưu bí mật này ngay — sẽ không hiển thị lại.
          </div>
          <div>
            <label className="field-label">Bí mật (nhập thủ công vào Authenticator)</label>
            <div className="num" style={{ padding: '10px 12px', background: 'var(--color-neutral-100)', borderRadius: 8, wordBreak: 'break-all', fontWeight: 700 }}>{result.secret}</div>
          </div>
          <div>
            <label className="field-label">Chuỗi otpauth (nếu app hỗ trợ dán URI)</label>
            <div className="num muted" style={{ padding: '8px 12px', background: 'var(--color-neutral-100)', borderRadius: 8, wordBreak: 'break-all', fontSize: 11 }}>{result.otpauthUrl}</div>
          </div>
          <button className="btn btn-primary" onClick={onClose} style={{ justifyContent: 'center' }}>Đã lưu, đóng</button>
        </div>
      )}
    </Modal>
  );
}
