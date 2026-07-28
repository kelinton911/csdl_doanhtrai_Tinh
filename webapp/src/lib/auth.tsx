import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, setAccessToken, setUnauthorizedHandler } from './api';

export interface Profile {
  id: string;
  username: string;
  fullName: string;
  roles: string[];
  organizationId: string | null;
}

export const ROLE_LABEL: Record<string, string> = {
  SYS_ADMIN: 'Quản trị hệ thống',
  PROVINCIAL_COMMAND: 'Chỉ huy cấp tỉnh',
  BARRACKS_OFFICER: 'Cán bộ ngành doanh trại',
  COMMUNE_USER: 'Cán bộ Ban CHQS xã',
  REVIEWER: 'Kiểm duyệt viên',
  REPORT_VIEWER: 'Người xem báo cáo',
  AUDITOR: 'Cán bộ kiểm tra',
  INTEGRATION_CLIENT: 'Hệ thống tích hợp',
};

const REFRESH_KEY = 'csdl.refreshToken';

interface AuthState {
  profile: Profile | null;
  ready: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  hasRole: (...roles: string[]) => boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);

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

  const value = useMemo<AuthState>(
    () => ({
      profile,
      ready,
      login: async (username, password) => {
        const res = await api.post('/auth/login', { username, password });
        applySession(res.data);
      },
      logout: () => {
        api.post('/auth/logout').catch(() => undefined);
        clear();
      },
      hasRole: (...roles) =>
        !!profile && roles.some((r) => profile.roles.includes(r)),
    }),
    [profile, ready],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth phải nằm trong AuthProvider');
  return ctx;
}
