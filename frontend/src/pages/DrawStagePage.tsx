import { ArrowLeft, Gift, Maximize, Radio } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link, useParams } from 'react-router';
import { errorMessage } from '../api/ApiError';
import { useConfirm } from '../components/confirm/ConfirmProvider';
import { GlowingButton } from '../components/prize/GlowingButton';
import { drawsApi } from '../api/endpoints';
import { assetUrl } from '../api/httpClient';
import { LiveEventGate } from '../live/LiveEventGate';
import { LiveStage } from '../live/LiveStage';
import type { LivePrize, LiveState } from '../live/types';
import { useLiveDraw } from '../live/useLiveDraw';
import { adminPaths, publicPaths } from '../routes';

/**
 * Organizer's projector screen. It renders the same live stage as the public page and adds the
 * controls; the winner is chosen by the server and revealed here together with every viewer.
 */
export function DrawStagePage() {
  const { eventId = '' } = useParams();
  return (
    <LiveEventGate eventId={eventId}>
      <OrganizerStage eventId={eventId} />
    </LiveEventGate>
  );
}

function OrganizerStage({ eventId }: { eventId: string }) {
  const live = useLiveDraw(eventId);
  const { snapshot, current, announceDraw, announceVoid, announceClaim } = live;
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  const [sharing, setSharing] = useState(false);
  const [chosenPrizeId, setChosenPrizeId] = useState<string | null>(null);
  const confirm = useConfirm();
  // Guards against double draws (held key, double click) before React re-renders.
  const inFlight = useRef(false);

  const drawing = current?.phase === 'drawing';
  // Interactive roulette: each participant spins on their own phone; the stage only invites and shows winners.
  const interactive = snapshot?.event.drawMode === 'INTERACTIVE';
  const blocker = drawBlocker(live);
  const canDraw = !interactive && !submitting && !drawing && blocker === null;
  // A participant roulette plays for one prize at a time: the organizer's pick, or the first one left.
  const availablePrizes = (snapshot?.prizes ?? []).filter((prize) => prize.remainingUnits > 0);
  const prizeAtStake =
    snapshot?.event.drawMode === 'PARTICIPANTS'
      ? (availablePrizes.find((prize) => prize.id === chosenPrizeId) ?? availablePrizes[0] ?? null)
      : null;
  const prizeAtStakeId = prizeAtStake?.id;

  const runDraw = useCallback(async () => {
    if (!canDraw || inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    setMessage(null);
    try {
      // Prize roulette: no prize given, the server draws the prize and the winner.
      announceDraw(await drawsApi.draw(eventId, prizeAtStakeId));
    } catch (error) {
      setMessage({ tone: 'error', text: errorMessage(error) });
    } finally {
      inFlight.current = false;
      setSubmitting(false);
    }
  }, [canDraw, eventId, prizeAtStakeId, announceDraw]);

  async function claimCurrent() {
    if (current?.phase !== 'revealed') return;
    try {
      announceClaim(await drawsApi.claim(eventId, current.drawId));
      setMessage(null);
    } catch (error) {
      setMessage({ tone: 'error', text: errorMessage(error) });
    }
  }

  async function voidCurrent() {
    if (current?.phase !== 'revealed') return;
    const confirmed = await confirm({
      title: 'Ganhador ausente',
      message: (
        <>
          Anular o sorteio de <strong>{current.winnerName}</strong>? O brinde volta para um novo sorteio.
        </>
      ),
      confirmLabel: 'Anular sorteio',
      tone: 'danger',
    });
    if (!confirmed) return;
    try {
      announceVoid(await drawsApi.void(eventId, current.drawId));
      setMessage(null);
    } catch (error) {
      setMessage({ tone: 'error', text: errorMessage(error) });
    }
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || event.target !== document.body || (event.key !== 'Enter' && event.key !== ' ')) return;
      event.preventDefault();
      void runDraw();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [runDraw]);

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen().catch(() => undefined);
  }

  const liveUrl = `${window.location.origin}${publicPaths.live(eventId)}`;
  // iPhone Safari has no fullscreen API for pages.
  const fullscreenSupported = typeof document !== 'undefined' && document.fullscreenEnabled;

  return (
    <>
      <LiveStage
        live={live}
        audience="organizer"
        idleText={interactive ? 'Escaneie e gire a roleta!' : 'Quem será?'}
        message={message}
        highlightPrizeId={prizeAtStakeId}
        headerStart={
          <Link to={adminPaths.event(eventId)} className="stage-link" aria-label="Voltar ao evento">
            <ArrowLeft size={16} aria-hidden="true" />
            <span className="stage-link-label">Voltar</span>
          </Link>
        }
        headerEnd={
          <>
            <button type="button" className="stage-link" onClick={() => setSharing(true)} aria-label="Transmissão ao vivo">
              <Radio size={16} aria-hidden="true" />
              <span className="stage-link-label">Transmissão</span>
            </button>
            {fullscreenSupported && (
              <button type="button" className="stage-link" onClick={toggleFullscreen} aria-label="Tela cheia">
                <Maximize size={16} aria-hidden="true" />
                <span className="stage-link-label">Tela cheia</span>
              </button>
            )}
          </>
        }
        controls={
          interactive ? (
            <SelfServiceInvite
              eventId={eventId}
              registrationOpen={snapshot?.event.registrationOpen ?? false}
              prizesLeft={availablePrizes.length > 0}
            />
          ) : current?.phase === 'revealed' || current?.phase === 'claimed' ? (
            <>
              {prizeAtStake && (
                <PrizePicker prizes={availablePrizes} selectedId={prizeAtStake.id} onSelect={setChosenPrizeId} disabled={!canDraw} />
              )}
              {current.phase === 'revealed' && (
                <GlowingButton onClick={() => void claimCurrent()}>
                  <Gift size={20} aria-hidden="true" /> Resgatar brinde
                </GlowingButton>
              )}
              <button
                type="button"
                className={current.phase === 'claimed' ? 'btn btn-stage' : 'btn btn-stage-secondary'}
                disabled={!canDraw}
                onClick={() => void runDraw()}
              >
                {submitting ? 'Girando…' : 'Girar de novo'}
              </button>
              {current.phase === 'revealed' && (
                <button type="button" className="stage-text-button" onClick={voidCurrent}>
                  Ganhador ausente — anular
                </button>
              )}
            </>
          ) : (
            <>
              {prizeAtStake && (
                <PrizePicker prizes={availablePrizes} selectedId={prizeAtStake.id} onSelect={setChosenPrizeId} disabled={!canDraw} />
              )}
              <div className="stage-actions">
                <button type="button" className="btn btn-stage" disabled={!canDraw} onClick={() => void runDraw()}>
                  {drawing || submitting ? 'Girando…' : 'Girar roleta'}
                </button>
              </div>
              {blocker ? (
                <DrawBlockerHint blocker={blocker} eventId={eventId} />
              ) : (
                <p className="stage-hint">Pressione Enter ou Espaço para girar</p>
              )}
            </>
          )
        }
      />

      {sharing && (
        <div className="share-overlay" role="dialog" aria-modal="true" aria-label="Assistir ao vivo" onClick={() => setSharing(false)}>
          <div className="share-card">
            <h2>Assista ao sorteio ao vivo</h2>
            <QRCodeSVG className="qr-code" value={liveUrl} size={280} marginSize={2} title="QR Code da transmissão ao vivo" />
            <code className="link-box">{liveUrl}</code>
            <p className="muted small">Toque em qualquer lugar para fechar</p>
          </div>
        </div>
      )}
    </>
  );
}

/** Participant roulette: which prize the next spin plays for. */
function PrizePicker({
  prizes,
  selectedId,
  onSelect,
  disabled,
}: {
  prizes: LivePrize[];
  selectedId: string;
  onSelect(prizeId: string): void;
  disabled: boolean;
}) {
  const labelId = useId();
  return (
    <div className="prize-picker">
      <span className="prize-picker-label" id={labelId}>
        Valendo
      </span>
      <div className="prize-picker-options" role="radiogroup" aria-labelledby={labelId}>
        {prizes.map((prize) => {
          const selected = prize.id === selectedId;
          return (
            <button
              key={prize.id}
              type="button"
              role="radio"
              aria-checked={selected}
              className={`prize-chip ${selected ? 'prize-chip-active' : ''}`}
              disabled={disabled && !selected}
              onClick={() => onSelect(prize.id)}
            >
              {prize.imageUrl && <img className="prize-chip-image" src={assetUrl(prize.imageUrl)} alt="" />}
              {prize.name}
              <span className="prize-chip-count" aria-label={`${prize.remainingUnits} restantes`}>
                {prize.remainingUnits}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Interactive roulette: the projector shows how to take part instead of a draw button. */
function SelfServiceInvite({
  eventId,
  registrationOpen,
  prizesLeft,
}: {
  eventId: string;
  registrationOpen: boolean;
  prizesLeft: boolean;
}) {
  // Without prizes nobody can register any more: the stage already says they are all gone.
  if (!prizesLeft) {
    return (
      <p className="stage-hint stage-hint-warning">
        Para continuar, <Link to={`${adminPaths.event(eventId)}?tab=prizes`}>cadastre mais brindes</Link>.
      </p>
    );
  }
  if (!registrationOpen) {
    return (
      <p className="stage-hint stage-hint-warning">
        As inscrições estão fechadas. <Link to={adminPaths.event(eventId)}>Abra as inscrições</Link> para o público girar a roleta.
      </p>
    );
  }
  const registerUrl = `${window.location.origin}${publicPaths.register(eventId)}`;
  return (
    <div className="stage-invite">
      <QRCodeSVG className="qr-code" value={registerUrl} size={220} marginSize={2} title="QR Code para se inscrever e girar a roleta" />
      <p className="stage-hint">Aponte a câmera, inscreva-se e gire a roleta no seu celular.</p>
    </div>
  );
}

type DrawBlocker = 'connecting' | 'noPrizes' | 'allDrawn' | 'noParticipants';

/** Why "Sortear" is disabled, so the organizer knows what to fix (null when a draw can start). */
function drawBlocker({ snapshot }: LiveState): DrawBlocker | null {
  if (!snapshot) return 'connecting';
  if (snapshot.prizes.length === 0) return 'noPrizes';
  if (snapshot.prizes.every((prize) => prize.remainingUnits === 0)) return 'allDrawn';
  if (snapshot.stats.eligibleParticipants === 0) return 'noParticipants';
  return null;
}

function DrawBlockerHint({ blocker, eventId }: { blocker: DrawBlocker; eventId: string }) {
  switch (blocker) {
    case 'connecting':
      return <p className="stage-hint">Conectando à transmissão…</p>;
    case 'noPrizes':
      return (
        <p className="stage-hint stage-hint-warning">
          Nenhum brinde cadastrado.{' '}
          <Link to={`${adminPaths.event(eventId)}?tab=prizes`}>Cadastre os brindes</Link> para começar o sorteio.
        </p>
      );
    case 'allDrawn':
      return <p className="stage-hint stage-hint-warning">Todos os brindes já foram sorteados.</p>;
    case 'noParticipants':
      return (
        <p className="stage-hint stage-hint-warning">
          Não há participantes aptos.{' '}
          <Link to={`${adminPaths.event(eventId)}?tab=participants`}>Cadastre participantes</Link> ou abra as inscrições.
        </p>
      );
  }
}
