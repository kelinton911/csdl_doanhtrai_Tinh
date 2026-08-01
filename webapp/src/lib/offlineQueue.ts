import { openDB, type IDBPDatabase } from 'idb';
import { useEffect, useState } from 'react';
import { api } from './api';

// M26 — Hàng đợi thay đổi ngoại tuyến. Tổ khảo sát sửa hồ sơ doanh trại/công trình khi
// mất mạng; thay đổi được ghi vào IndexedDB rồi đẩy lên qua POST /sync/batches khi có mạng
// (idempotent theo batchKey; xung đột phiên bản KHÔNG ghi đè — trả về để người dùng hòa giải).

export type QueueEntityType = 'barracks' | 'facility';
export type QueueStatus = 'pending' | 'conflict' | 'failed';

export interface QueueItem {
  localId: string;
  entityType: QueueEntityType;
  targetId: string;
  baseVersion: number;
  payload: Record<string, unknown>;
  label: string; // mô tả cho người dùng (vd tên doanh trại)
  createdAt: string;
  status: QueueStatus;
  message?: string;
  serverVersion?: number;
  server?: Record<string, unknown>;
}

const DB_NAME = 'csdl-offline';
const STORE = 'mutations';
const CHANGED_EVENT = 'offline-queue-changed';

let dbp: Promise<IDBPDatabase> | null = null;
function db() {
  if (!dbp) {
    dbp = openDB(DB_NAME, 1, {
      upgrade(d) {
        if (!d.objectStoreNames.contains(STORE)) {
          d.createObjectStore(STORE, { keyPath: 'localId' });
        }
      },
    });
  }
  return dbp;
}

function uuid(): string {
  return (
    (globalThis.crypto?.randomUUID?.() as string | undefined) ??
    `l-${Date.now()}-${Math.random().toString(16).slice(2)}`
  );
}

function notifyChanged() {
  window.dispatchEvent(new CustomEvent(CHANGED_EVENT));
}

// Xếp một thay đổi vào hàng đợi (dùng khi lưu chỉnh sửa hiện trường).
export async function enqueue(op: {
  entityType: QueueEntityType;
  targetId: string;
  baseVersion: number;
  payload: Record<string, unknown>;
  label: string;
}): Promise<QueueItem> {
  const item: QueueItem = {
    localId: uuid(),
    ...op,
    createdAt: new Date().toISOString(),
    status: 'pending',
  };
  const d = await db();
  await d.put(STORE, item);
  notifyChanged();
  return item;
}

export async function allItems(): Promise<QueueItem[]> {
  const d = await db();
  return (await d.getAll(STORE)) as QueueItem[];
}

export async function removeItem(localId: string): Promise<void> {
  const d = await db();
  await d.delete(STORE, localId);
  notifyChanged();
}

// Thử lại một mục lỗi: đưa về 'pending' để lần đồng bộ sau gửi lại.
export async function retryItem(localId: string): Promise<void> {
  const d = await db();
  const it = (await d.get(STORE, localId)) as QueueItem | undefined;
  if (!it) return;
  await d.put(STORE, { ...it, status: 'pending', message: undefined });
  notifyChanged();
}

// Hòa giải xung đột theo hướng "giữ bản của tôi": ghi đè lên phiên bản mới của máy chủ
// (đặt baseVersion = serverVersion để lần gửi sau khớp và áp dụng).
export async function resolveKeepMine(localId: string): Promise<void> {
  const d = await db();
  const it = (await d.get(STORE, localId)) as QueueItem | undefined;
  if (!it || it.serverVersion == null) return;
  await d.put(STORE, { ...it, baseVersion: it.serverVersion, status: 'pending', message: undefined });
  notifyChanged();
}

export async function counts(): Promise<{ total: number; pending: number; conflict: number; failed: number }> {
  const items = await allItems();
  return {
    total: items.length,
    pending: items.filter((i) => i.status === 'pending').length,
    conflict: items.filter((i) => i.status === 'conflict').length,
    failed: items.filter((i) => i.status === 'failed').length,
  };
}

interface SyncResult {
  localId: string;
  status: 'applied' | 'conflict' | 'failed';
  serverVersion?: number;
  server?: Record<string, unknown>;
  message?: string;
}

// Đẩy các mục 'pending' lên máy chủ. No-op nếu đang offline hoặc chưa đăng nhập.
// Trả tổng kết; cập nhật trạng thái từng mục (applied→xóa; conflict/failed→giữ lại để xử lý).
export async function flushQueue(): Promise<{ skipped: boolean; applied: number; conflict: number; failed: number }> {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { skipped: true, applied: 0, conflict: 0, failed: 0 };
  }
  const items = (await allItems()).filter((i) => i.status === 'pending');
  if (items.length === 0) return { skipped: false, applied: 0, conflict: 0, failed: 0 };

  const batchKey = uuid();
  let data: { results?: SyncResult[] };
  try {
    const res = await api.post('/sync/batches', {
      batchKey,
      clientId: 'webapp-pwa',
      items: items.map((i) => ({
        localId: i.localId,
        entityType: i.entityType,
        targetId: i.targetId,
        baseVersion: i.baseVersion,
        payload: i.payload,
      })),
    });
    data = res.data;
  } catch {
    // Mất mạng giữa chừng / chưa đăng nhập — giữ nguyên hàng đợi, thử lại lần sau.
    return { skipped: true, applied: 0, conflict: 0, failed: 0 };
  }

  const resultBy = new Map((data.results ?? []).map((r) => [r.localId, r]));
  const d = await db();
  let applied = 0;
  let conflict = 0;
  let failed = 0;
  for (const it of items) {
    const r = resultBy.get(it.localId);
    if (!r || r.status === 'applied') {
      await d.delete(STORE, it.localId);
      applied++;
    } else if (r.status === 'conflict') {
      await d.put(STORE, { ...it, status: 'conflict', serverVersion: r.serverVersion, server: r.server });
      conflict++;
    } else {
      await d.put(STORE, { ...it, status: 'failed', message: r.message });
      failed++;
    }
  }
  notifyChanged();
  return { skipped: false, applied, conflict, failed };
}

// Hook UI: theo dõi số mục trong hàng đợi + trạng thái online, tự cập nhật khi có thay đổi.
export function useOfflineQueue() {
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [c, setC] = useState({ total: 0, pending: 0, conflict: 0, failed: 0 });

  useEffect(() => {
    let alive = true;
    const refresh = () => counts().then((v) => alive && setC(v)).catch(() => undefined);
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    refresh();
    window.addEventListener('offline-queue-changed', refresh);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      alive = false;
      window.removeEventListener('offline-queue-changed', refresh);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return { online, counts: c, flush: flushQueue };
}
