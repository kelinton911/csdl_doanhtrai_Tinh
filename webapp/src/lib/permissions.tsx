import { useQuery } from '@tanstack/react-query';
import { api } from './api';
import { useAuth } from './auth';

// Quyền hiệu lực của phiên hiện tại (đọc từ backend /me/permissions).
// Server vẫn là nơi thực thi thật; hook này chỉ để ẩn/hiện UI theo chức năng.
export interface MyPermission {
  functionCode: string;
  scope: 'SELF' | 'UNIT' | 'PROVINCE' | 'ALL';
  source: 'POSITION' | 'GRANT';
}

interface MyPermissionsResponse {
  userId: string;
  roles: string[];
  permissions: MyPermission[];
}

export function useMyPermissions() {
  const { profile } = useAuth();
  return useQuery({
    queryKey: ['my-permissions', profile?.id],
    enabled: !!profile,
    staleTime: 60_000,
    queryFn: async () =>
      (await api.get('/me/permissions')).data as MyPermissionsResponse,
  });
}

// Trả về hàm can(functionCode) để gating nút/menu. SYS_ADMIN luôn true (cửa cứu hộ, khớp backend).
export function useCan(): (functionCode: string) => boolean {
  const { isAdmin } = useAuth();
  const { data } = useMyPermissions();
  const set = new Set((data?.permissions ?? []).map((p) => p.functionCode));
  return (functionCode: string) => isAdmin || set.has(functionCode);
}
