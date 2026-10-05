import { useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { errorMessage } from '../api/ApiError';
import { eventsApi } from '../api/endpoints';
import { Alert } from '../components/Alert';
import { EmptyState } from '../components/EmptyState';
import { Spinner } from '../components/Spinner';
import { useAsyncData } from '../hooks/useAsyncData';
import { adminPaths } from '../routes';
import { formatDateTime } from '../utils/format';
import { EventFormModal } from './EventFormModal';

export function EventsPage() {
  const navigate = useNavigate();
  const { data: events, error, loading } = useAsyncData(() => eventsApi.list(), []);
  const [creating, setCreating] = useState(false);

  return (
    <>
      <div className="page-header">
        <div>
          <h1>Eventos</h1>
          <p className="muted">Crie um evento, cadastre participantes e brindes e faça o sorteio ao vivo.</p>
        </div>
        <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
          + Novo evento
        </button>
      </div>

      {error ? <Alert>{errorMessage(error)}</Alert> : null}
      {loading && !events && <Spinner />}
      {events?.length === 0 && (
        <EmptyState title="Nenhum evento cadastrado ainda.">
          <button type="button" className="btn btn-primary" onClick={() => setCreating(true)}>
            Criar o primeiro evento
          </button>
        </EmptyState>
      )}

      <div className="event-grid">
        {events?.map((event) => (
          <Link key={event.id} to={adminPaths.event(event.id)} className="card event-card">
            <div className="event-card-top">
              <h2>{event.name}</h2>
              <span className={`badge ${event.registrationOpen ? 'badge-success' : 'badge-muted'}`}>
                {event.registrationOpen ? 'Inscrições abertas' : 'Inscrições fechadas'}
              </span>
            </div>
            <p className="muted">{formatDateTime(event.eventDate)}</p>
            {event.description && <p className="event-card-description user-text">{event.description}</p>}
          </Link>
        ))}
      </div>

      {creating && (
        <EventFormModal
          onClose={() => setCreating(false)}
          onSubmit={async (input) => {
            const event = await eventsApi.create(input);
            navigate(adminPaths.event(event.id));
          }}
        />
      )}
    </>
  );
}
