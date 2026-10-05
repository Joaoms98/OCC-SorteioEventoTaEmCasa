import { useState, type FormEvent } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router';
import { errorMessage } from '../api/ApiError';
import { useAuth } from '../auth/AuthContext';
import { Alert } from '../components/Alert';
import { TextField } from '../components/Field';
import { adminPaths } from '../routes';

export function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const redirectTo = (location.state as { from?: string } | null)?.from ?? adminPaths.home;
  if (isAuthenticated) return <Navigate to={redirectTo} replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await login(password);
      navigate(redirectTo, { replace: true });
    } catch (caught) {
      setError(errorMessage(caught));
      setSubmitting(false);
    }
  }

  return (
    <div className="centered-page">
      <form className="card auth-card" noValidate onSubmit={handleSubmit}>
        <img src="/brand/occ-round.webp" alt="Os Crema Culture" width={112} height={112} className="auth-logo" />
        <h1>Sorteio de Brindes</h1>
        <p className="muted">Área da organização</p>
        {error && <Alert>{error}</Alert>}
        <TextField
          label="Senha"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
          autoFocus
        />
        <button type="submit" className="btn btn-primary btn-block" disabled={submitting || !password}>
          {submitting ? 'Entrando…' : 'Entrar'}
        </button>
        {submitting && <p className="muted small">Se o servidor estava inativo, o primeiro acesso pode levar até 1 minuto.</p>}
      </form>
    </div>
  );
}
