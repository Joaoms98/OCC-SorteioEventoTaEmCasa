import { CalendarDays, CircleCheck, Gift, Hand, Radio, Ticket } from 'lucide-react';
import { useEffect } from 'react';
import { Link } from 'react-router';
import { errorMessage } from '../api/ApiError';
import { publicApi } from '../api/endpoints';
import { Alert } from '../components/Alert';
import { Spinner } from '../components/Spinner';
import { useAsyncData } from '../hooks/useAsyncData';
import { ParallaxBackground } from '../live/ParallaxBackground';
import { registeredNameFor } from '../registration/registrationStorage';
import { publicPaths } from '../routes';
import type { ActiveEvent } from '../types/api';
import { formatDateTime, pluralize } from '../utils/format';

/** Public home: every active raffle, to register for and to watch live. */
export function HomePage() {
  const { data: events, error, loading, reload } = useAsyncData(() => publicApi.listActiveEvents(), []);

  // Coming back to the tab shows the current list (registrations may have opened meanwhile).
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') reload();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [reload]);

  return (
    <div className="home public-page">
      <ParallaxBackground image="/brand/stage-pattern.webp" />

      <header className="home-hero">
        <img src="/brand/occ-round.webp" alt="Os Crema Culture" width={136} height={136} className="home-logo" />
        <h1>Sorteios OCC</h1>
        <p>Escolha um sorteio, faça sua inscrição e acompanhe tudo ao vivo.</p>
      </header>

      <main className="home-main">
        {loading && !events && <Spinner label="Carregando sorteios…" />}
        {error && !events ? (
          <div className="card home-empty">
            <Alert>{errorMessage(error)}</Alert>
            <button type="button" className="btn btn-primary" onClick={reload}>
              Tentar de novo
            </button>
          </div>
        ) : null}
        {events?.length === 0 && (
          <div className="card home-empty">
            <h2>Nenhum sorteio aberto no momento</h2>
            <p className="muted">Volte em breve: os próximos sorteios aparecem aqui.</p>
          </div>
        )}
        {events && events.length > 0 && (
          <ul className="home-events">
            {events.map((event) => (
              <li key={event.id}>
                <ActiveEventCard event={event} />
              </li>
            ))}
          </ul>
        )}
      </main>

      <footer className="home-footer">Os Crema Culture · conectando pessoas, cultura e liberdade</footer>
    </div>
  );
}

function ActiveEventCard({ event }: { event: ActiveEvent }) {
  // Interactive roulette: registering is spinning, so it ends when the prizes do.
  const interactive = event.drawMode === 'INTERACTIVE';
  // Registrations made on this phone: no need to offer the form again. The interactive roulette
  // serves one person after another on the same screen, so it never remembers anyone.
  const registeredName = interactive ? null : registeredNameFor(event.id);
  const exhausted = interactive && event.remainingUnits === 0;
  const canRegister = event.registrationOpen && !registeredName && !exhausted;

  return (
    <article className="card home-event">
      <span className={`badge ${event.registrationOpen && !exhausted ? 'badge-success' : 'badge-muted'}`}>
        {exhausted ? 'Brindes esgotados' : event.registrationOpen ? 'Inscrições abertas' : 'Inscrições encerradas'}
      </span>
      <h2>{event.name}</h2>

      <p className="home-event-meta">
        <CalendarDays size={18} aria-hidden="true" /> {formatDateTime(event.eventDate)}
      </p>
      {event.remainingUnits > 0 && (
        <p className="home-event-meta">
          <Gift size={18} aria-hidden="true" />{' '}
          {interactive
            ? pluralize(event.remainingUnits, 'brinde na roleta', 'brindes na roleta')
            : pluralize(event.remainingUnits, 'brinde para sortear', 'brindes para sortear')}
        </p>
      )}
      {event.description && <p className="home-event-description user-text">{event.description}</p>}

      {registeredName && (
        <p className="home-event-registered">
          <CircleCheck size={18} aria-hidden="true" /> {registeredName.split(' ')[0]}, sua inscrição está confirmada.
        </p>
      )}

      <div className="home-event-actions">
        {canRegister && (
          <Link to={publicPaths.register(event.id)} className="btn btn-primary btn-block">
            {interactive ? <Hand size={18} aria-hidden="true" /> : <Ticket size={18} aria-hidden="true" />}
            {interactive ? 'Participar e girar a roleta' : 'Quero participar'}
          </Link>
        )}
        <Link to={publicPaths.live(event.id)} className={`btn ${canRegister ? 'btn-secondary' : 'btn-primary'} btn-block`}>
          <Radio size={18} aria-hidden="true" /> Assistir ao vivo
        </Link>
      </div>
    </article>
  );
}
