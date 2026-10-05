import { Link } from 'react-router';

export function NotFoundPage() {
  return (
    <div className="centered-page">
      <div className="card auth-card">
        <h1>Página não encontrada</h1>
        <p className="muted">O endereço acessado não existe ou foi removido.</p>
        <Link to="/" className="btn btn-primary btn-block">
          Voltar ao início
        </Link>
      </div>
    </div>
  );
}
