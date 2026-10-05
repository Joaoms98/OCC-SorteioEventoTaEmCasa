import { TriangleAlert } from 'lucide-react';
import { useEffect, useId, useRef, useState, type FormEvent, type ReactNode } from 'react';

export interface ConfirmOptions {
  title: string;
  message: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Destructive actions get a red confirm button and focus on "cancel". */
  tone?: 'default' | 'danger';
  /** The user must type this exact text to enable the confirm button. */
  requireText?: string;
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  tone = 'default',
  requireText,
  onClose,
}: ConfirmOptions & { onClose(confirmed: boolean): void }) {
  const titleId = useId();
  const messageId = useId();
  const inputId = useId();
  const [typed, setTyped] = useState('');
  const cancelRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const canConfirm = !requireText || typed.trim() === requireText.trim();

  useEffect(() => {
    if (requireText) inputRef.current?.focus();
    else if (tone === 'danger') cancelRef.current?.focus();
    else confirmRef.current?.focus();

    const onKeyDown = (event: KeyboardEvent) => event.key === 'Escape' && onClose(false);
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose, requireText, tone]);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (canConfirm) onClose(true);
  }

  return (
    <div className="modal-backdrop confirm-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose(false)}>
      <form
        className={`modal confirm-dialog confirm-${tone}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={messageId}
        onSubmit={handleSubmit}
      >
        <div className="confirm-header">
          {tone === 'danger' && <TriangleAlert className="confirm-icon" aria-hidden="true" />}
          <h2 id={titleId}>{title}</h2>
        </div>
        <div id={messageId} className="confirm-message">
          {message}
        </div>
        {requireText && (
          <div className="field">
            <label htmlFor={inputId}>
              Digite <strong>{requireText}</strong> para confirmar
            </label>
            <input
              ref={inputRef}
              id={inputId}
              value={typed}
              onChange={(event) => setTyped(event.target.value)}
              autoComplete="off"
              spellCheck={false}
            />
          </div>
        )}
        <div className="actions">
          <button ref={cancelRef} type="button" className="btn btn-secondary" onClick={() => onClose(false)}>
            {cancelLabel}
          </button>
          <button
            ref={confirmRef}
            type="submit"
            className={`btn ${tone === 'danger' ? 'btn-danger' : 'btn-primary'}`}
            disabled={!canConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </form>
    </div>
  );
}
