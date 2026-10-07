import { Gift, Hand, Users } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import { ApiError, errorMessage } from '../api/ApiError';
import { Alert } from '../components/Alert';
import { TextAreaField, TextField } from '../components/Field';
import { Modal } from '../components/Modal';
import type { DrawMode, EventInput, RaffleEvent } from '../types/api';
import { DateTimePicker } from '../components/datetime/DateTimePicker';

const DRAW_MODES = [
  {
    value: 'PRIZES',
    title: 'Roleta de brindes',
    description: 'A roleta sorteia o brinde e o nome do ganhador aparece no final.',
    Icon: Gift,
  },
  {
    value: 'PARTICIPANTS',
    title: 'Roleta de participantes',
    description: 'Você escolhe o brinde e a roleta gira com os nomes. Ideal para um brinde só.',
    Icon: Users,
  },
  {
    value: 'INTERACTIVE',
    title: 'Roleta interativa',
    description: 'Cada pessoa se inscreve e gira a roleta no próprio celular. Todo inscrito ganha um brinde, enquanto houver.',
    Icon: Hand,
  },
] as const;

interface EventFormModalProps {
  event?: RaffleEvent;
  onSubmit(input: EventInput): Promise<void>;
  onClose(): void;
}

export function EventFormModal({ event, onSubmit, onClose }: EventFormModalProps) {
  const [name, setName] = useState(event?.name ?? '');
  const [description, setDescription] = useState(event?.description ?? '');
  const [eventDate, setEventDate] = useState<string | null>(event?.eventDate ?? null);
  const [registrationOpen, setRegistrationOpen] = useState(event?.registrationOpen ?? false);
  const [drawMode, setDrawMode] = useState<DrawMode>(event?.drawMode ?? 'PRIZES');
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);
  const fieldErrors = error instanceof ApiError ? error.fieldErrors : {};

  async function handleSubmit(formEvent: FormEvent) {
    formEvent.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ name, description: description || null, eventDate, registrationOpen, drawMode });
      onClose();
    } catch (caught) {
      setError(caught);
      setSubmitting(false);
    }
  }

  return (
    <Modal title={event ? 'Editar evento' : 'Novo evento'} onClose={onClose}>
      <form className="stack" noValidate onSubmit={handleSubmit}>
        {error ? <Alert>{errorMessage(error)}</Alert> : null}
        <TextField
          label="Nome do evento"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={120}
          required
          autoFocus
          error={fieldErrors.name}
        />
        <DateTimePicker
          label="Data e hora do sorteio"
          value={eventDate}
          onChange={setEventDate}
          error={fieldErrors.eventDate}
        />
        <TextAreaField
          label="Descrição"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={500}
          rows={3}
          error={fieldErrors.description}
        />
        <fieldset className="choice-group">
          <legend>Tipo de roleta</legend>
          <div className="choice-cards">
            {DRAW_MODES.map(({ value, title, description: hint, Icon }) => (
              <label key={value} className={`choice-card ${drawMode === value ? 'choice-card-active' : ''}`}>
                <input
                  type="radio"
                  name="drawMode"
                  className="visually-hidden"
                  value={value}
                  checked={drawMode === value}
                  onChange={() => setDrawMode(value)}
                />
                <Icon size={22} aria-hidden="true" />
                <strong>{title}</strong>
                <small>{hint}</small>
              </label>
            ))}
          </div>
          {fieldErrors.drawMode && <small className="field-error">{fieldErrors.drawMode}</small>}
        </fieldset>
        <label className="checkbox">
          <input type="checkbox" checked={registrationOpen} onChange={(e) => setRegistrationOpen(e.target.checked)} />
          Inscrições públicas abertas
        </label>
        <div className="actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
