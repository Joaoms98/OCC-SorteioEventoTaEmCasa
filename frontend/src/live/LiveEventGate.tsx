import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { errorMessage } from '../api/ApiError';
import { publicApi } from '../api/endpoints';
import { Spinner } from '../components/Spinner';
import { useAsyncData } from '../hooks/useAsyncData';

/** Confirms the event exists before opening the live stream (EventSource cannot read error bodies). */
export function LiveEventGate({ eventId, children }: { eventId: string; children: ReactNode }) {
  const { data, error, loading } = useAsyncData(() => publicApi.getEvent(eventId), [eventId]);

  if (loading && !data) {
    return (
      <div className="stage">
        <Spinner label="Entrando na transmissão…" />
      </div>
    );
  }
  if (!data) {
    return (
      <div className="stage stage-centered">
        <img src="/brand/occ-round.webp" alt="Os Crema Culture" width={120} height={120} className="round-logo" />
        <p className="stage-message stage-message-error">{errorMessage(error)}</p>
        <Link to="/" className="stage-link">
          Voltar ao início
        </Link>
      </div>
    );
  }
  return children;
}
