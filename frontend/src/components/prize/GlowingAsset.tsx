import type { ReactNode } from 'react';
import { Particles } from './Particles';
import './prize.css';

/** Artwork with a pulsing brand-colored glow behind it and sparks floating up. */
export function GlowingAsset({ children, size = 'md' }: { children: ReactNode; size?: 'sm' | 'md' }) {
  return (
    <div className={`glowing-asset glowing-asset-${size}`}>
      {children}
      <Particles />
    </div>
  );
}
