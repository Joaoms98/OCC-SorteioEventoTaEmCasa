import { Link, useParams } from 'react-router';
import { LiveEventGate } from '../live/LiveEventGate';
import { LiveStage } from '../live/LiveStage';
import { useLiveDraw } from '../live/useLiveDraw';
import { publicPaths } from '../routes';

/** Public page: anyone with the link watches the draws in real time. */
export function LivePage() {
  const { eventId = '' } = useParams();
  return (
    <LiveEventGate eventId={eventId}>
      <LiveAudience eventId={eventId} />
    </LiveEventGate>
  );
}

function LiveAudience({ eventId }: { eventId: string }) {
  const live = useLiveDraw(eventId);
  const registrationOpen = live.snapshot?.event.registrationOpen ?? false;
  // Interactive roulette: nobody waits for a draw; whoever registers spins on their own phone.
  const interactive = live.snapshot?.event.drawMode === 'INTERACTIVE';
  const prizesLeft = live.snapshot?.prizes.some((prize) => prize.remainingUnits > 0) ?? false;
  const canJoin = registrationOpen && (!interactive || prizesLeft);

  return (
    <LiveStage
      live={live}
      audience="public"
      idleText={interactive ? 'Inscreva-se e gire a roleta!' : 'Aguardando o próximo sorteio…'}
      aside={
        canJoin ? (
          <Link to={publicPaths.register(eventId)} className="btn btn-stage-secondary">
            {interactive ? 'Participar e girar a roleta' : 'Ainda não se inscreveu? Participe!'}
          </Link>
        ) : null
      }
      footer={
        <footer className="stage-footer">
          Os Crema Culture · conectando pessoas, cultura e liberdade
        </footer>
      }
    />
  );
}
