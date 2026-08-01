import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, setAccessToken, setUnauthorizedHandler } from './api';
// ROLE_LABEL nay là nguồn tập trung trong lib/roles.ts; re-export để giữ tương thích
// các import cũ (`import { ROLE_LABEL } from '../lib/auth'`).
export { ROLE_LABEL } from './roles';

export interface Profile {
  id: string;
  username: string;
  fullName: string;
  roles: string[];
  organizationId: string | null;
  // Phạm vi dữ liệu được gán (type: 'AREA' | 'ORGANIZATION'). Chỉ để hiển thị chỉ báo;
  // việc lọc dữ liệu thực thi ở tầng server (backend common/data-scope.ts).
  dataScopes?: Array<{ type: string; refId: string }>;
}

const REFRESH_KEY = 'csdl.refreshToken';
const VIEW_AS_KEY = 'csdl.viewAsRole';

interface AuthState {
  profile: Profile | null;
  ready: boolean;
  login: (username: string, password: string, otp?: string) => Promise<void>;
  logout: () => void;
  // Kiểm tra vai trò THẬT của tài khoản (không đổi khi "xem như").
  hasRole: (...roles: string[]) => boolean;
  // Tài khoản có phải quản trị (superuser) không.
  isAdmin: boolean;
  // Gating nút hành động: admin luôn được phép (để test toàn hệ thống), ngoài ra theo vai trò.
  can: (...roles: string[]) => boolean;
  // "Xem như vai trò" (chỉ admin): đổi HIỂN THỊ (nav/workspace/màu) mà không đổi quyền gọi API.
  viewAsRole: string | null;
  setViewAsRole: (role: string | null) => void;
  // Vai trò hiệu lực cho hiển thị = [viewAsRole] nếu admin đang xem-như, ngược lại là roles thật.
  effectiveRoles: string[];
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);
  const [viewAsRole, setViewAsRoleState] = useState<string | null>(
    () => sessionStorage.getItem(VIEW_AS_KEY),
  );

  function applySession(data: {
    accessToken: string;
    refreshToken: string;
    profile: Profile;
  }) {
    setAccessToken(data.accessToken);
    localStorage.setItem(REFRESH_KEY, data.refreshToken);
    setProfile(data.profile);
  }

  function clear() {
    setAccessToken(null);
    localStorage.removeItem(REFRESH_KEY);
    sessionStorage.removeItem(VIEW_AS_KEY);
    setViewAsRoleState(null);
    setProfile(null);
  }

  // Khôi phục phiên khi tải lại: dùng refresh token để lấy access token mới.
  useEffect(() => {
    setUnauthorizedHandler(() => clear());
    const rt = localStorage.getItem(REFRESH_KEY);
    if (!rt) {
      setReady(true);
      return;
    }
    api
      .post('/auth/refresh', { refreshToken: rt })
      .then((res) => applySession(res.data))
      .catch(() => clear())
      .finally(() => setReady(true));
  }, []);

  const isAdmin = !!profile && profile.roles.includes('SYS_ADMIN');

  // Chỉ admin mới được "xem như"; nếu tài khoản không phải admin thì luôn bỏ override.
  const effectiveRoles =
    isAdmin && viewAsRole ? [viewAsRole] : profile?.roles ?? [];

  const setViewAsRole = (role: string | null) => {
    if (role) sessionStorage.setItem(VIEW_AS_KEY, role);
    else sessionStorage.removeItem(VIEW_AS_KEY);
    setViewAsRoleState(role);
  };

  const value = useMemo<AuthState>(
    () => ({
      profile,
      ready,
      login: async (username, password, otp) => {
        const res = await api.post('/auth/login', { username, password, otp: otp || undefined });
        applySession(res.data);
      },
      logout: () => {
        api.post('/auth/logout').catch(() => undefined);
        clear();
      },
      hasRole: (...roles) =>
        !!profile && roles.some((r) => profile.roles.includes(r)),
      isAdmin,
      can: (...roles) =>
        !!profile && (isAdmin || roles.some((r) => profile.roles.includes(r))),
      viewAsRole: isAdmin ? viewAsRole : null,
      setViewAsRole,
      effectiveRoles,
    }),
    [profile, ready, isAdmin, viewAsRole, effectiveRoles],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth phải nằm trong AuthProvider');
  return ctx;
}
