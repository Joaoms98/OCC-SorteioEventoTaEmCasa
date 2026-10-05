import type { ReactNode } from 'react';

type Tone = 'error' | 'success' | 'info';

export function Alert({ tone = 'error', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <div className={`alert alert-${tone}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}
