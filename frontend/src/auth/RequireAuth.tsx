import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { adminPaths } from '../routes';
import { useAuth } from './AuthContext';

export function RequireAuth({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) return <Navigate to={adminPaths.login} replace state={{ from: location.pathname }} />;
  return children;
}
