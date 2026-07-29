import { useSyncExternalStore } from 'react';
import { toProblem } from './api';

// Toast tối giản, không phụ thuộc thư viện — dùng external store để gọi được cả
// ngoài React (trong onSuccess/onError của mutation). Frontend §9: phản hồi hành động.
export type ToastKind = 'success' | 'error' | 'info' | 'warn';
export interface ToastItem {
  id: number;
  kind: ToastKind;
  title?: string;
  message: string;
}

let items: ToastItem[] = [];
const listeners = new Set<() => void>();
let seq = 1;

function emit() {
  for (const l of listeners) l();
}

function push(kind: ToastKind, message: string, title?: string): number {
  const id = seq++;
  items = [...items, { id, kind, title, message }];
  emit();
  const ttl = kind === 'error' ? 7000 : 4000;
  window.setTimeout(() => dismiss(id), ttl);
  return id;
}

export function dismiss(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

export const toast = {
  success: (message: string, title?: string) => push('success', message, title),
  error: (message: string, title?: string) => push('error', message, title),
  info: (message: string, title?: string) => push('info', message, title),
  warn: (message: string, title?: string) => push('warn', message, title),
  /** Chuẩn hóa lỗi problem+json thành toast lỗi (kèm mã lỗi backend). */
  problem: (err: unknown, fallbackTitle = 'Thao tác thất bại') => {
    const p = toProblem(err);
    // 409: dữ liệu đã bị thay đổi bởi người khác → nhắc tải lại.
    if (p.status === 409) {
      return push('warn', `${p.code} — ${p.title}. Dữ liệu có thể đã thay đổi, hãy tải lại.`, 'Xung đột dữ liệu');
    }
    return push('error', `${p.code} — ${p.title}`, fallbackTitle);
  },
};

export function useToasts(): ToastItem[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => items,
    () => items,
  );
}
