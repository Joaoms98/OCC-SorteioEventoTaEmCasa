import { useEffect, useId, useRef } from 'react';
import { RewardBurst } from './RewardBurst';
import { SpinningCoin } from './SpinningCoin';
import './prize.css';

interface ClaimPrizeModalProps {
  prizeName: string;
  /** Photo of the prize; the spinning OCC coin is shown when there is none. */
  imageUrl?: string | null;
  winnerName: string;
  message: string;
  actionLabel: string;
  onClose(): void;
}

/** Celebration shown to everyone when the winner receives the prize. */
export function ClaimPrizeModal({ prizeName, imageUrl, winnerName, message, actionLabel, onClose }: ClaimPrizeModalProps) {
  const titleId = useId();
  const actionRef = useRef<HTMLButtonElement>(null);
  const firstName = winnerName.split(' ')[0] ?? winnerName;

  useEffect(() => {
    actionRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <section className="claim-modal" role="dialog" aria-modal="true" aria-labelledby={titleId}>
      <div className="claim-modal-content">
        <RewardBurst />
        <div className="claim-rewards">
          <div className="claim-reward-card">
            <div>
              {imageUrl ? (
                <div className="claim-reward-image">
                  <img src={imageUrl} alt="" />
                </div>
              ) : (
                <SpinningCoin />
              )}
              <div className="claim-reward-text">{prizeName}</div>
            </div>
          </div>
          <div className="claim-comments">
            <h2 id={titleId}>Parabéns, {firstName}!</h2>
            <p>{message}</p>
            <button ref={actionRef} type="button" className="glowing-button claim-action" onClick={onClose}>
              <span>{actionLabel}</span>
            </button>
          </div>
        </div>
        <div className="claim-glow claim-glow-1" />
        <div className="claim-glow claim-glow-2" />
      </div>
    </section>
  );
}
