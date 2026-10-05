import { useState } from 'react';
import { errorMessage } from '../../api/ApiError';
import { drawsApi } from '../../api/endpoints';
import { Alert } from '../../components/Alert';
import { useConfirm } from '../../components/confirm/ConfirmProvider';
import { EmptyState } from '../../components/EmptyState';
import { Spinner } from '../../components/Spinner';
import { useAsyncData } from '../../hooks/useAsyncData';
import type { Draw } from '../../types/api';
import { downloadCsv } from '../../utils/csv';
import { formatDateTime, formatPhone, formatTime } from '../../utils/format';

type WinnerSituation = 'awaiting' | 'claimed' | 'voided';

const situationOf = (draw: Draw): WinnerSituation =>
  draw.status === 'VOIDED' ? 'voided' : draw.claimedAt ? 'claimed' : 'awaiting';

const SITUATION: Record<WinnerSituation, { label: string; badge: string }> = {
  awaiting: { label: 'Aguardando retirada', badge: 'badge-muted' },
  claimed: { label: 'Entregue', badge: 'badge-success' },
  voided: { label: 'Anulado', badge: 'badge-danger' },
};

export function WinnersTab({ eventId, eventName, onChange }: { eventId: string; eventName: string; onChange(): void }) {
  const { data: draws, error, loading, reload } = useAsyncData(() => drawsApi.list(eventId), [eventId]);
  const [actionError, setActionError] = useState<string | null>(null);
  const confirm = useConfirm();

  async function claimDraw(draw: Draw) {
    const confirmed = await confirm({
      title: 'Confirmar entrega',
      message: (
        <>
          Registrar que <strong>{draw.participant.name}</strong> recebeu o brinde <strong>{draw.prize.name}</strong>?
        </>
      ),
      confirmLabel: 'Confirmar entrega',
    });
    if (!confirmed) return;
    try {
      await drawsApi.claim(eventId, draw.id);
      setActionError(null);
      reload();
      onChange();
    } catch (caught) {
      setActionError(errorMessage(caught));
    }
  }

  async function voidDraw(draw: Draw) {
    const confirmed = await confirm({
      title: 'Anular sorteio',
      message: (
        <>
          O brinde <strong>{draw.prize.name}</strong> volta a ficar disponível e <strong>{draw.participant.name}</strong> não
          poderá ser sorteado(a) novamente neste evento.
        </>
      ),
      confirmLabel: 'Anular sorteio',
      tone: 'danger',
    });
    if (!confirmed) return;
    try {
      await drawsApi.void(eventId, draw.id);
      setActionError(null);
      reload();
      onChange();
    } catch (caught) {
      setActionError(errorMessage(caught));
    }
  }

  function exportCsv() {
    if (!draws) return;
    downloadCsv(
      `ganhadores-${eventName.toLowerCase().replace(/[^a-z0-9]+/gi, '-')}.csv`,
      ['Brinde', 'Ganhador(a)', 'Telefone', 'E-mail', 'Sorteado em', 'Situação', 'Entregue em'],
      draws.map((draw) => [
        draw.prize.name,
        draw.participant.name,
        formatPhone(draw.participant.phone),
        draw.participant.email ?? '',
        formatDateTime(draw.drawnAt),
        SITUATION[situationOf(draw)].label,
        draw.claimedAt ? formatDateTime(draw.claimedAt) : '',
      ]),
    );
  }

  return (
    <section className="stack">
      <div className="toolbar">
        <p className="muted">
          Marque a entrega quando o ganhador retirar o brinde, ou anule o sorteio se ele não estiver presente.
        </p>
        <button type="button" className="btn btn-secondary" onClick={exportCsv} disabled={!draws?.length}>
          Exportar CSV
        </button>
      </div>

      {actionError && <Alert>{actionError}</Alert>}
      {error ? <Alert>{errorMessage(error)}</Alert> : null}
      {loading && !draws && <Spinner />}
      {draws?.length === 0 && <EmptyState title="Nenhum sorteio realizado ainda." />}

      {draws && draws.length > 0 && (
        <div className="table-wrap">
          <table className="responsive-table">
            <thead>
              <tr>
                <th>Horário</th>
                <th>Brinde</th>
                <th>Ganhador(a)</th>
                <th>Contato</th>
                <th>Situação</th>
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {draws.map((draw) => (
                <tr key={draw.id} className={draw.status === 'VOIDED' ? 'row-voided' : undefined}>
                  <td data-label="Horário">{formatTime(draw.drawnAt)}</td>
                  <td data-label="Brinde">{draw.prize.name}</td>
                  <td className="cell-title">
                    <strong>{draw.participant.name}</strong>
                  </td>
                  <td className="small" data-label="Contato">
                    {draw.participant.phone && <div>{formatPhone(draw.participant.phone)}</div>}
                    {draw.participant.email && <div className="muted">{draw.participant.email}</div>}
                    {!draw.participant.phone && !draw.participant.email && '—'}
                  </td>
                  <td data-label="Situação">
                    <span className={`badge ${SITUATION[situationOf(draw)].badge}`}>{SITUATION[situationOf(draw)].label}</span>
                    {draw.claimedAt && <div className="muted small">às {formatTime(draw.claimedAt)}</div>}
                  </td>
                  <td className="cell-actions">
                    {situationOf(draw) === 'awaiting' && (
                      <>
                        <button type="button" className="btn btn-secondary btn-sm" onClick={() => claimDraw(draw)}>
                          Entregar
                        </button>
                        <button type="button" className="btn btn-ghost btn-sm btn-danger-text" onClick={() => voidDraw(draw)}>
                          Anular
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
