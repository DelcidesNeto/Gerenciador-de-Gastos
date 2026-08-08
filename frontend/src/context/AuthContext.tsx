import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { getToken, setToken } from '../services/apiClient';
import * as authApi from '../services/authService';
import type { User } from '../services/authService';

type AuthContextValue = {
  user: User | null;
  loading: boolean;
  isAdmin: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  setUser: (user: User | null) => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const sessionId = useRef(0);

  const applySession = useCallback((nextUser: User | null, token: string | null) => {
    sessionId.current += 1;
    setToken(token);
    setUser(nextUser);
    return sessionId.current;
  }, []);

  const refreshUser = useCallback(async () => {
    const res = await authApi.getMe();
    setUser(res.user);
  }, []);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      setLoading(false);
      return;
    }

    const bootSession = sessionId.current;
    let cancelled = false;

    authApi
      .getMe()
      .then((res) => {
        // Ignora se o usuário já saiu, entrou ou cadastrou outra conta enquanto isso carregava
        if (cancelled || sessionId.current !== bootSession || getToken() !== token) return;
        setUser(res.user);
      })
      .catch(() => {
        if (cancelled || sessionId.current !== bootSession) return;
        if (getToken() === token) setToken(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await authApi.login({ email, password });
      applySession(res.user, res.token);
      setLoading(false);
    },
    [applySession],
  );

  const register = useCallback(
    async (name: string, email: string, password: string) => {
      const res = await authApi.register({ name, email, password });
      applySession(res.user, res.token);
      setLoading(false);
    },
    [applySession],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } catch {
      /* token pode já estar inválido */
    }
    applySession(null, null);
    setLoading(false);
  }, [applySession]);

  const value = useMemo(
    () => ({
      user,
      loading,
      isAdmin: user?.role === 'admin',
      login,
      register,
      logout,
      refreshUser,
      setUser,
    }),
    [user, loading, login, register, logout, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth deve ser usado dentro de AuthProvider');
  return ctx;
}
