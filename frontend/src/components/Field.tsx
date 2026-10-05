import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from 'react';

interface FieldProps {
  label: string;
  error?: string;
  hint?: ReactNode;
}

export function TextField({ label, error, hint, ...input }: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <input id={id} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} {...input} />
      {hint && !error && <small className="field-hint">{hint}</small>}
      {error && (
        <small id={`${id}-error`} className="field-error">
          {error}
        </small>
      )}
    </div>
  );
}

export function TextAreaField({
  label,
  error,
  hint,
  ...textarea
}: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <textarea id={id} aria-invalid={Boolean(error)} {...textarea} />
      {hint && !error && <small className="field-hint">{hint}</small>}
      {error && <small className="field-error">{error}</small>}
    </div>
  );
}
