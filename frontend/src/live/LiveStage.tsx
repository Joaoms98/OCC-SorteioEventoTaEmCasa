import { Check } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { assetUrl } from '../api/httpClient';
import { ClaimPrizeModal } from '../components/prize/ClaimPrizeModal';
import { PrizeUnlockedCard } from '../components/prize/PrizeUnlockedCard';
import { ParallaxBackground } from './ParallaxBackground';
import { RollingName } from './RollingName';
import { RouletteWheel } from './RouletteWheel';
import type { LiveState } from './types';
import { useConfetti } from './useConfetti';

interface LiveStageProps {
  live: LiveState;
  /** The organizer's projector shows actions; the public page shows the waiting messages. */
  audience: 'organizer' | 'public';
  headerStart?: ReactNode;
  headerEnd?: ReactNode;
  controls?: ReactNode;
  message?: { tone: 'error' | 'info'; text: string } | null;
  idleText: string;
  /** Prize highlighted while no draw is on stage (the organizer's pick on a participant roulette). */
  highlightPrizeId?: string | null;
  /** Extra content below the stage (e.g. the registration call to action). */
  aside?: ReactNode;
  footer?: ReactNode;
}

/** The draw as everyone sees it: the projector and every phone watching live render this. */
export function LiveStage(props: LiveStageProps) {
  const { live, audience, headerStart, headerEnd, controls, message, idleText, highlightPrizeId = null, aside, footer } = props;
  const { snapshot, current, status } = live;
  const { canvasRef, celebrate } = useConfetti();
  const celebrated = useRef<string | null>(null);
  const [dismissedClaim, setDismissedClaim] = useState<string | null>(null);

  useEffect(() => {
    if (current?.phase !== 'revealed' && current?.phase !== 'claimed') return;
    const key = `${current.drawId}:${current.phase}`;
    if (celebrated.current !== key) {
      celebrated.current = key;
      celebrate();
    }
  }, [current, celebrate]);

  const closeClaim = useCallback(() => setDismissedClaim(current?.drawId ?? null), [current?.drawId]);

  const prizes = snapshot?.prizes ?? [];
  const drawMode = snapshot?.event.drawMode ?? 'PRIZES';
  const allDrawn = prizes.length > 0 && prizes.every((prize) => prize.remainingUnits === 0);
  // A prize roulette decides the prize: highlight it only once the wheel has stopped. A participant
  // roulette plays for a known prize.
  const spotlightPrizeId = current
    ? current.phase !== 'drawing' || current.wheel
      ? current.prize.id
      : null
    : highlightPrizeId;
  const imageOf = (prizeId: string | undefined): string | null => {
    const path = prizes.find((prize) => prize.id === prizeId)?.imageUrl;
    return path ? assetUrl(path) : null;
  };

  return (
    <div className="stage stage-with-pattern">
      <ParallaxBackground image="/brand/stage-pattern.webp" />
      <canvas ref={canvasRef} className="confetti-canvas" aria-hidden="true" />

      <header className="stage-header">
        <div className="stage-header-side">{headerStart}</div>
        <div className="stage-title">
          <img src="/brand/occ-round.webp" alt="Os Crema Culture" width={64} height={64} />
          <div>
            <h1>{snapshot?.event.name ?? 'Sorteio OCC'}</h1>
            <LiveBadge status={status} viewers={snapshot?.viewers ?? 0} />
          </div>
        </div>
        <div className="stage-header-side stage-header-end">{headerEnd}</div>
      </header>

      {prizes.length > 0 && (
        <ul className="stage-prizes" aria-label="Brindes e unidades restantes">
          {prizes.map((prize) => (
            <li
              key={prize.id}
              className={`prize-chip ${prize.id === spotlightPrizeId ? 'prize-chip-active' : ''} ${prize.remainingUnits === 0 ? 'prize-chip-empty' : ''}`}
            >
              {prize.imageUrl && <img className="prize-chip-image" src={assetUrl(prize.imageUrl)} alt="" />}
              {prize.name}
              <span className="prize-chip-count" aria-label={`${prize.remainingUnits} restantes`}>
                {prize.remainingUnits}
              </span>
            </li>
          ))}
        </ul>
      )}

      <main className="stage-main stage-arena">
        <div className="stage-arena-wheel">
          <RouletteWheel mode={drawMode} prizes={prizes} idleNames={snapshot?.rollNames ?? []} current={current} />
        </div>

        <div className="stage-arena-status">
          {(current?.phase === 'revealed' || current?.phase === 'claimed') && current.winnerName ? (
            <PrizeUnlockedCard
              title={current.phase === 'claimed' ? 'Brinde entregue' : 'Prêmio desbloqueado'}
              imageUrl={imageOf(current.prize.id)}
              actions={controls}
            >
              <div className="stage-name stage-name-revealed stage-name-card" aria-live="polite">
                {current.winnerName}
              </div>
              <p className="stage-prize-name">
                ganhou <strong>{current.prize.name}</strong>
              </p>
              <p className="prize-status">
                {current.phase === 'claimed' && <Check size={18} aria-hidden="true" />}
                {current.phase === 'claimed'
                  ? `Brinde entregue a ${firstName(current.winnerName)}`
                  : audience === 'public'
                    ? `Parabéns! Aguardando ${firstName(current.winnerName)} retirar o brinde…`
                    : 'Parabéns! Entregue o brinde e clique em Resgatar.'}
              </p>
            </PrizeUnlockedCard>
          ) : (
            <>
              {current?.phase === 'drawing' && current.wheel ? (
                // Participant roulette: the names are on the wheel, the prize at stake is shown here.
                <>
                  <p className="stage-prize-name">Valendo</p>
                  {imageOf(current.prize.id) && <img className="stage-prize-image" src={imageOf(current.prize.id)!} alt="" />}
                  <div className="stage-name stage-name-drawing stage-name-prize">{current.prize.name}</div>
                  <p className="stage-congrats">Girando a roleta…</p>
                </>
              ) : (
                <>
                  {current?.phase === 'drawing' && <p className="stage-prize-name">Girando a roleta…</p>}
                  {current?.phase === 'voided' && <p className="stage-prize-name">{current.prize.name}</p>}

                  <div className={`stage-name stage-name-${current?.phase ?? 'idle'}`} aria-live="polite">
                    {!current && (allDrawn ? (drawMode === 'INTERACTIVE' ? 'Todos os brindes já saíram!' : 'Todos os brindes foram sorteados!') : idleText)}
                    {current?.phase === 'drawing' && (
                      <RollingName names={snapshot?.rollNames ?? []} revealAt={current.revealAt} />
                    )}
                    {current?.phase === 'voided' && current.winnerName}
                  </div>

                  {current?.phase === 'drawing' && <p className="stage-congrats">Sorteando o ganhador…</p>}
                  {current?.phase === 'voided' && (
                    <p className="stage-message stage-message-info">
                      Sorteio anulado: ganhador(a) ausente. O brinde volta para a roleta.
                    </p>
                  )}
                </>
              )}
              {controls}
            </>
          )}

          {message && <p className={`stage-message stage-message-${message.tone}`}>{message.text}</p>}

          {snapshot && (
            <p className="stage-hint">
              {drawMode === 'INTERACTIVE'
                ? `${snapshot.stats.participants.toLocaleString('pt-BR')} ${snapshot.stats.participants === 1 ? 'pessoa já girou' : 'pessoas já giraram'} a roleta`
                : `${snapshot.stats.eligibleParticipants.toLocaleString('pt-BR')} ${snapshot.stats.eligibleParticipants === 1 ? 'participante concorrendo' : 'participantes concorrendo'}`}
            </p>
          )}
          {aside}
        </div>
      </main>

      {snapshot && snapshot.recentWinners.length > 0 && (
        <section className="stage-winners" aria-label="Últimos ganhadores">
          <h2>Últimos ganhadores</h2>
          <ul>
            {snapshot.recentWinners.map((winner) => (
              <li key={winner.drawId}>
                <strong>{winner.winnerName}</strong>
                <span>
                  {winner.prize.name}
                  {winner.claimedAt && ' · entregue'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {footer}

      {current?.phase === 'claimed' && current.winnerName && dismissedClaim !== current.drawId && (
        <ClaimPrizeModal
          prizeName={current.prize.name}
          imageUrl={imageOf(current.prize.id)}
          winnerName={current.winnerName}
          message={`${current.winnerName} recebeu o brinde ${current.prize.name}. Obrigado por fazer parte do ${snapshot?.event.name ?? 'evento'}!`}
          actionLabel={audience === 'organizer' ? 'Continuar' : 'Fechar'}
          onClose={closeClaim}
        />
      )}
    </div>
  );
}

const firstName = (name: string): string => name.split(' ')[0] ?? name;

function LiveBadge({ status, viewers }: { status: LiveState['status']; viewers: number }) {
  if (status === 'closed') return <span className="live-badge live-badge-off">Transmissão encerrada</span>;
  if (status !== 'live') return <span className="live-badge live-badge-off">Conectando…</span>;
  return (
    <span className="live-badge">
      <span className="live-dot" aria-hidden="true" /> AO VIVO
      {viewers > 0 && <span className="live-viewers">· {viewers.toLocaleString('pt-BR')} assistindo</span>}
    </span>
  );
}
