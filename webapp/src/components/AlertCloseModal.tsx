import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { toast } from '../lib/toast';
import { Modal } from './Modal';

// Đóng cảnh báo bắt buộc ghi kết quả (Backend UC-18). Dùng chung cho trang Cảnh báo
// và ngăn thông báo nhanh ở AppShell — thay cho prompt() cụt.
export function AlertCloseModal({
  alert,
  onClose,
}: {
  alert: { id: string; title: string } | null;
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const [resolution, setResolution] = useState('');

  const close = useMutation({
    mutationFn: async () => api.post(`/alerts/${alert!.id}/close`, { resolution: resolution.trim() }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['alerts'] });
      qc.invalidateQueries({ queryKey: ['alert-summary'] });
      toast.success('Đã đóng cảnh báo và ghi kết quả xử lý.');
      setResolution('');
      onClose();
    },
    onError: (e) => toast.problem(e, 'Không đóng được cảnh báo'),
  });

  return (
    <Modal open={!!alert} title="Đóng cảnh báo" onClose={onClose} width={460}>
      {alert && (
        <>
          <p style={{ marginTop: 0, fontSize: 13 }}>
            Cảnh báo: <strong>{alert.title}</strong>
          </p>
          <label className="field-label" htmlFor="alert-resolution">
            Kết quả xử lý (bắt buộc)
          </label>
          <textarea
            id="alert-resolution"
            className="input"
            rows={4}
            style={{ marginTop: 6, resize: 'vertical' }}
            placeholder="Mô tả biện pháp đã thực hiện, kết quả, ghi chú bàn giao…"
            value={resolution}
            onChange={(e) => setResolution(e.target.value)}
            autoFocus
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
            <button className="btn" onClick={onClose}>
              Hủy
            </button>
            <button
              className="btn btn-primary"
              disabled={resolution.trim().length < 3 || close.isPending}
              onClick={() => close.mutate()}
            >
              {close.isPending ? 'Đang đóng…' : 'Xác nhận đóng'}
            </button>
          </div>
        </>
      )}
    </Modal>
  );
}
