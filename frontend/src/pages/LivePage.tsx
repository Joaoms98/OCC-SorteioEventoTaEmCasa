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

  return (
    <LiveStage
      live={live}
      audience="public"
      idleText="Aguardando o próximo sorteio…"
      aside={
        registrationOpen ? (
          <Link to={publicPaths.register(eventId)} className="btn btn-stage-secondary">
            Ainda não se inscreveu? Participe!
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
