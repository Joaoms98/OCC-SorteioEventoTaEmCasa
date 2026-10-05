import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Particles } from './Particles';
import './prize.css';

/** Call-to-action with a shifting gradient; sparks fly out on hover. */
export function GlowingButton({ children, className = '', ...button }: ButtonHTMLAttributes<HTMLButtonElement> & { children: ReactNode }) {
  return (
    <button type="button" className={`glowing-button ${className}`} {...button}>
      <span>{children}</span>
      <Particles />
    </button>
  );
}
