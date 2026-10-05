import type { ReactNode } from 'react';
import { GiftIcon } from './GiftIcon';
import { GlowingAsset } from './GlowingAsset';
import './prize.css';

interface PrizeUnlockedCardProps {
  title?: string;
  /** Photo of the prize; a drawn gift box is shown when there is none. */
  imageUrl?: string | null;
  children: ReactNode;
  actions?: ReactNode;
}

/** "Prêmio desbloqueado": shown when a winner is revealed, until the prize is claimed. */
export function PrizeUnlockedCard({ title = 'Prêmio desbloqueado', imageUrl, children, actions }: PrizeUnlockedCardProps) {
  return (
    <div className="prize-card">
      <div className="prize-card-inner">
        <h3 className="prize-card-title">{title}</h3>
        <GlowingAsset size="sm">
          {imageUrl ? <img className="prize-card-image" src={imageUrl} alt="" /> : <GiftIcon size={120} />}
        </GlowingAsset>
        {children}
        {actions && <div className="prize-card-actions">{actions}</div>}
      </div>
    </div>
  );
}
