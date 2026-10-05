import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { ConfirmDialog, type ConfirmOptions } from './ConfirmDialog';

type Confirm = (options: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<Confirm | null>(null);

/** Replaces window.confirm/prompt with the app's own dialog: `if (await confirm({...})) ...`. */
export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [options, setOptions] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((confirmed: boolean) => void) | null>(null);

  const confirm = useCallback<Confirm>((next) => {
    resolver.current?.(false);
    setOptions(next);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);

  const close = useCallback((confirmed: boolean) => {
    resolver.current?.(confirmed);
    resolver.current = null;
    setOptions(null);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {options && <ConfirmDialog {...options} onClose={close} />}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): Confirm {
  const confirm = useContext(ConfirmContext);
  if (!confirm) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return confirm;
}
