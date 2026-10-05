import { X } from 'lucide-react';
import { useEffect, useId, type ReactNode } from 'react';

interface ModalProps {
  title: string;
  onClose(): void;
  children: ReactNode;
  wide?: boolean;
}

export function Modal({ title, onClose, children, wide = false }: ModalProps) {
  const titleId = useId();

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-labelledby={titleId}>
        <header className="modal-header">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="btn btn-ghost btn-icon" onClick={onClose} aria-label="Fechar">
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        {children}
      </div>
    </div>
  );
}
