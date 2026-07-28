import axios, { AxiosError } from 'axios';

// Gọi qua proxy Vite '/api' → backend. Không hard-code cổng ở client.
export const api = axios.create({ baseURL: '/api/v1' });

// Access token giữ trong bộ nhớ (không lưu localStorage — yêu cầu bảo mật §11).
let accessToken: string | null = null;
export function setAccessToken(token: string | null) {
  accessToken = token;
}
export function getAccessToken() {
  return accessToken;
}

// Sinh correlation id để truy nguyên xuyên suốt request/job.
function correlationId(): string {
  return (
    (globalThis.crypto?.randomUUID?.() as string | undefined) ??
    `c-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

api.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  config.headers['X-Correlation-ID'] = correlationId();
  return config;
});

// Chuẩn hóa lỗi từ application/problem+json (Backend §8).
export interface ProblemError {
  status: number;
  code: string;
  title: string;
  correlationId?: string | null;
  errors?: Array<{ field?: string; message: string }>;
}

export function toProblem(err: unknown): ProblemError {
  const ax = err as AxiosError<Record<string, unknown>>;
  const data = ax.response?.data;
  if (data && typeof data === 'object' && 'code' in data) {
    return {
      status: (data.status as number) ?? ax.response?.status ?? 0,
      code: (data.code as string) ?? 'SYS-001',
      title: (data.title as string) ?? 'Lỗi hệ thống',
      correlationId: (data.correlationId as string) ?? null,
      errors: data.errors as ProblemError['errors'],
    };
  }
  return {
    status: ax.response?.status ?? 0,
    code: ax.code === 'ERR_NETWORK' ? 'NET-000' : 'SYS-001',
    title:
      ax.code === 'ERR_NETWORK'
        ? 'Mất kết nối máy chủ'
        : ax.message ?? 'Lỗi không xác định',
  };
}

// Đăng ký callback khi gặp 401 (phiên hết hạn) để đưa về đăng nhập.
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) {
  onUnauthorized = fn;
}
api.interceptors.response.use(
  (res) => res,
  (err: AxiosError) => {
    if (err.response?.status === 401 && onUnauthorized) onUnauthorized();
    return Promise.reject(err);
  },
);
