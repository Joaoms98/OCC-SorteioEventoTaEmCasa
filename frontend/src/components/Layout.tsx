import { Globe } from 'lucide-react';
import { Link, Outlet } from 'react-router';
import { useAuth } from '../auth/AuthContext';
import { adminPaths, publicPaths } from '../routes';

export function Layout() {
  const { logout } = useAuth();
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to={adminPaths.home} className="brand">
          <img src="/brand/occ-box.webp" alt="OCC" width={66} height={32} />
          <span>Sorteio de Brindes</span>
        </Link>
        <div className="topbar-actions">
          <Link to={publicPaths.home} className="btn btn-ghost btn-sm" aria-label="Ver a página pública">
            <Globe size={16} aria-hidden="true" />
            <span className="topbar-label">Página pública</span>
          </Link>
          <button type="button" className="btn btn-ghost btn-sm" onClick={logout}>
            Sair
          </button>
        </div>
      </header>
      <main className="container">
        <Outlet />
      </main>
    </div>
  );
}
