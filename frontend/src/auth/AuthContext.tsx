import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authApi } from '../api/endpoints';
import { onUnauthorized } from '../api/httpClient';
import { tokenStorage } from './tokenStorage';

interface AuthContextValue {
  isAuthenticated: boolean;
  login(password: string): Promise<void>;
  logout(): void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setAuthenticated] = useState(() => tokenStorage.get() !== null);

  const logout = useCallback(() => {
    tokenStorage.clear();
    setAuthenticated(false);
  }, []);

  const login = useCallback(async (password: string) => {
    const { token, expiresIn } = await authApi.login(password);
    tokenStorage.save(token, expiresIn);
    setAuthenticated(true);
  }, []);

  useEffect(() => {
    onUnauthorized(logout);
    return () => onUnauthorized(null);
  }, [logout]);

  const value = useMemo(() => ({ isAuthenticated, login, logout }), [isAuthenticated, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
