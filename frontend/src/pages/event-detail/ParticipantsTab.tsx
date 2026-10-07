import { useEffect, useState, type FormEvent } from 'react';
import { ApiError, errorMessage } from '../../api/ApiError';
import { participantsApi } from '../../api/endpoints';
import { Alert } from '../../components/Alert';
import { useConfirm } from '../../components/confirm/ConfirmProvider';
import { EmptyState } from '../../components/EmptyState';
import { TextAreaField, TextField } from '../../components/Field';
import { Modal } from '../../components/Modal';
import { Pagination } from '../../components/Pagination';
import { Spinner } from '../../components/Spinner';
import { useAsyncData } from '../../hooks/useAsyncData';
import type { ImportResult } from '../../types/api';
import { formatPhone, maskPhone, pluralize } from '../../utils/format';
import { parseParticipantList } from '../../utils/parseParticipantList';

const PAGE_SIZE = 20;
const SEARCH_DEBOUNCE_MS = 300;

interface ParticipantsTabProps {
  eventId: string;
  /** Interactive roulette: people register themselves (and spin), so there is no manual registration. */
  selfService: boolean;
  onChange(): void;
}

export function ParticipantsTab({ eventId, selfService, onChange }: ParticipantsTabProps) {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [importing, setImporting] = useState(false);
  const confirm = useConfirm();

  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const { data, error, loading, reload } = useAsyncData(
    () => participantsApi.list(eventId, { search, page, pageSize: PAGE_SIZE }),
    [eventId, search, page],
  );

  function refresh(message?: string) {
    setFeedback(message ?? null);
    setActionError(null);
    reload();
    onChange();
  }

  async function remove(participantId: string, name: string) {
    const confirmed = await confirm({
      title: 'Remover participante',
      message: (
        <>
          Remover <strong>{name}</strong> da lista de participantes?
        </>
      ),
      confirmLabel: 'Remover',
      tone: 'danger',
    });
    if (!confirmed) return;
    try {
      await participantsApi.remove(eventId, participantId);
      refresh(`${name} foi removido(a).`);
    } catch (caught) {
      setActionError(errorMessage(caught));
    }
  }

  return (
    <section className="stack">
      <div className="toolbar">
        <input
          type="search"
          className="search"
          placeholder="Buscar por nome, telefone ou e-mail"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
          aria-label="Buscar participantes"
        />
        {selfService ? (
          <p className="muted small">Na roleta interativa cada pessoa se inscreve pelo link do evento e gira a roleta.</p>
        ) : (
          <div className="actions-left">
            <button type="button" className="btn btn-secondary" onClick={() => setImporting(true)}>
              Importar lista
            </button>
            <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
              + Participante
            </button>
          </div>
        )}
      </div>

      {feedback && <Alert tone="success">{feedback}</Alert>}
      {actionError && <Alert>{actionError}</Alert>}
      {error ? <Alert>{errorMessage(error)}</Alert> : null}
      {loading && !data && <Spinner />}

      {data && data.total === 0 && (
        <EmptyState title={search ? 'Nenhum participante encontrado para esta busca.' : 'Nenhum participante cadastrado.'}>
          {!search && 'Adicione manualmente, importe uma lista ou abra as inscrições pelo QR Code.'}
        </EmptyState>
      )}

      {data && data.total > 0 && (
        <>
          <p className="muted small">{pluralize(data.total, 'participante', 'participantes')}</p>
          <div className="table-wrap">
            <table className="responsive-table">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Telefone</th>
                  <th>E-mail</th>
                  <th aria-label="Ações" />
                </tr>
              </thead>
              <tbody>
                {data.items.map((participant) => (
                  <tr key={participant.id}>
                    <td className="cell-title">{participant.name}</td>
                    <td data-label="Telefone">{formatPhone(participant.phone)}</td>
                    <td data-label="E-mail">{participant.email ?? '—'}</td>
                    <td className="cell-actions">
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm btn-danger-text"
                        onClick={() => remove(participant.id, participant.name)}
                      >
                        Remover
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={data.page} totalPages={data.totalPages} onChange={setPage} />
        </>
      )}

      {adding && (
        <AddParticipantModal
          eventId={eventId}
          onClose={() => setAdding(false)}
          onAdded={(name) => refresh(`${name} foi adicionado(a).`)}
        />
      )}
      {importing && (
        <ImportParticipantsModal
          eventId={eventId}
          onClose={() => setImporting(false)}
          onImported={(created) => refresh(`${pluralize(created, 'participante importado', 'participantes importados')}.`)}
        />
      )}
    </section>
  );
}

function AddParticipantModal({
  eventId,
  onClose,
  onAdded,
}: {
  eventId: string;
  onClose(): void;
  onAdded(name: string): void;
}) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);
  const fieldErrors = error instanceof ApiError ? error.fieldErrors : {};

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const participant = await participantsApi.create(eventId, { name, phone, email });
      onAdded(participant.name);
      onClose();
    } catch (caught) {
      setError(caught);
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Adicionar participante" onClose={onClose}>
      <form className="stack" noValidate onSubmit={handleSubmit}>
        {error ? <Alert>{errorMessage(error)}</Alert> : null}
        <TextField label="Nome" value={name} onChange={(e) => setName(e.target.value)} required autoFocus maxLength={120} error={fieldErrors.name} />
        <TextField label="Telefone (com DDD)" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} placeholder="(11) 98765-4321" error={fieldErrors.phone} />
        <TextField label="E-mail (opcional)" type="email" value={email} onChange={(e) => setEmail(e.target.value)} error={fieldErrors.email} />
        <div className="actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting}>
            {submitting ? 'Salvando…' : 'Adicionar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function ImportParticipantsModal({
  eventId,
  onClose,
  onImported,
}: {
  eventId: string;
  onClose(): void;
  onImported(created: number): void;
}) {
  const [text, setText] = useState('');
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);
  const entries = parseParticipantList(text);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const imported = await participantsApi.import(eventId, entries);
      setResult(imported);
      if (imported.created > 0) onImported(imported.created);
      if (imported.rejected.length === 0) onClose();
    } catch (caught) {
      setError(caught);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Modal title="Importar participantes" onClose={onClose} wide>
      <form className="stack" noValidate onSubmit={handleSubmit}>
        {error ? <Alert>{errorMessage(error)}</Alert> : null}
        {result && result.rejected.length > 0 && (
          <Alert tone="info">
            <strong>
              {pluralize(result.created, 'importado', 'importados')}, {pluralize(result.rejected.length, 'linha ignorada', 'linhas ignoradas')}:
            </strong>
            <ul className="rejected-list">
              {result.rejected.map((entry) => (
                <li key={entry.line}>
                  Linha {entry.line} ({entry.name || 'sem nome'}): {entry.message}
                </li>
              ))}
            </ul>
          </Alert>
        )}
        <TextAreaField
          label="Um participante por linha"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setResult(null);
          }}
          rows={10}
          placeholder={'Maria Silva; (11) 98765-4321; maria@email.com\nJoão Souza; 21999990000\nAna Lima; 31988887777'}
          hint="Formato: Nome; telefone; e-mail — o telefone é obrigatório (identifica cada pessoa) e o e-mail é opcional. Também é possível colar colunas de uma planilha."
        />
        <div className="actions">
          <span className="muted small">{pluralize(entries.length, 'linha', 'linhas')}</span>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Fechar
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting || entries.length === 0}>
            {submitting ? 'Importando…' : 'Importar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
