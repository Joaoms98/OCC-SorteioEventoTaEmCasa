import { Radio } from 'lucide-react';
import { useState } from 'react';
import { Link, Navigate, useParams } from 'react-router';
import { SpinStage } from '../live/SpinStage';
import { readSpin, saveSpin, type StoredSpin } from '../registration/registrationStorage';
import { publicPaths } from '../routes';

/**
 * Interactive roulette on the participant's own device: right after registering they spin the
 * wheel, and reopening the page shows the prize again (it is kept in the browser storage).
 */
export function SpinPage() {
  const { eventId = '' } = useParams();
  const [spin, setSpin] = useState<StoredSpin | null>(() => readSpin(eventId));

  // Nothing to spin on this device: registering is the way in.
  if (!spin) return <Navigate to={publicPaths.register(eventId)} replace />;

  function markLanded(current: StoredSpin) {
    const landed = { ...current, landed: true };
    saveSpin(eventId, landed);
    setSpin(landed);
  }

  return (
    <SpinStage
      eventName={spin.eventName}
      participantName={spin.participantName}
      spin={spin}
      alreadyLanded={spin.landed}
      onLanded={() => markLanded(spin)}
      pickupNote="Mostre esta tela para a organização e retire o seu brinde."
      resultActions={
        <nav className="spin-links" aria-label="Outras páginas">
          <Link to={publicPaths.live(eventId)} className="stage-link">
            <Radio size={16} aria-hidden="true" /> Acompanhar ao vivo
          </Link>
          <Link to={publicPaths.home} className="stage-link">
            Ver todos os sorteios
          </Link>
        </nav>
      }
    />
  );
}
