import { ArrowLeft, MonitorPlay } from 'lucide-react';
import { useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router';
import { errorMessage } from '../../api/ApiError';
import { eventsApi } from '../../api/endpoints';
import { Alert } from '../../components/Alert';
import { useConfirm } from '../../components/confirm/ConfirmProvider';
import { Spinner } from '../../components/Spinner';
import { useAsyncData } from '../../hooks/useAsyncData';
import { adminPaths } from '../../routes';
import { formatDateTime } from '../../utils/format';
import { EventFormModal } from '../EventFormModal';
import { ParticipantsTab } from './ParticipantsTab';
import { PrizesTab } from './PrizesTab';
import { PublicLinksCard } from './PublicLinksCard';
import { WinnersTab } from './WinnersTab';

const TABS = [
  { id: 'participants', label: 'Participantes' },
  { id: 'prizes', label: 'Brindes' },
  { id: 'winners', label: 'Ganhadores' },
] as const;

type TabId = (typeof TABS)[number]['id'];

export function EventDetailPage() {
  const { eventId = '' } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: TabId = TABS.find((item) => item.id === searchParams.get('tab'))?.id ?? 'participants';
  const { data: event, error, loading, reload } = useAsyncData(() => eventsApi.get(eventId), [eventId]);
  const [editing, setEditing] = useState(false);
  const confirm = useConfirm();
  const [actionError, setActionError] = useState<string | null>(null);

  if (loading && !event) return <Spinner />;
  if (!event) {
    return (
      <div className="stack">
        <Alert>{errorMessage(error)}</Alert>
        <Link to={adminPaths.home} className="back-link">
          <ArrowLeft size={16} aria-hidden="true" /> Voltar para eventos
        </Link>
      </div>
    );
  }

  async function toggleRegistration() {
    if (!event) return;
    try {
      await eventsApi.update(event.id, { registrationOpen: !event.registrationOpen });
      setActionError(null);
      reload();
    } catch (caught) {
      setActionError(errorMessage(caught));
    }
  }

  async function removeEvent() {
    if (!event) return;
    const confirmed = await confirm({
      title: 'Excluir evento',
      message: 'Esta ação apaga o evento com todos os participantes, brindes, fotos e sorteios. Não é possível desfazer.',
      confirmLabel: 'Excluir evento',
      tone: 'danger',
      requireText: event.name,
    });
    if (!confirmed) return;
    try {
      await eventsApi.remove(event.id);
      navigate(adminPaths.home, { replace: true });
    } catch (caught) {
      setActionError(errorMessage(caught));
    }
  }

  const { stats } = event;

  return (
    <div className="stack-lg">
      <Link to={adminPaths.home} className="back-link">
        <ArrowLeft size={16} aria-hidden="true" /> Eventos
      </Link>

      <div className="page-header">
        <div>
          <h1>{event.name}</h1>
          <p className="muted">{formatDateTime(event.eventDate)}</p>
          {event.description && <p className="user-text">{event.description}</p>}
        </div>
        <div className="actions-left">
          <button type="button" className="btn btn-secondary" onClick={() => setEditing(true)}>
            Editar
          </button>
          <Link to={adminPaths.draw(event.id)} className="btn btn-primary btn-lg">
            <MonitorPlay size={20} aria-hidden="true" /> Abrir telão de sorteio
          </Link>
        </div>
      </div>

      {actionError && <Alert>{actionError}</Alert>}

      <div className="stats">
        <Stat label="Participantes" value={stats.participants} />
        <Stat label="Aptos a sortear" value={stats.eligibleParticipants} />
        <Stat label="Brindes (unidades)" value={stats.prizeUnits} />
        <Stat label="Sorteados" value={`${stats.drawnUnits} / ${stats.prizeUnits}`} />
      </div>

      <div className="registration-row">
        <label className="switch">
          <input type="checkbox" checked={event.registrationOpen} onChange={toggleRegistration} />
          <span className="switch-track" aria-hidden="true" />
          <span>{event.registrationOpen ? 'Inscrições públicas abertas' : 'Inscrições públicas fechadas'}</span>
        </label>
      </div>
      <PublicLinksCard eventId={event.id} registrationOpen={event.registrationOpen} />

      <nav className="tabs" role="tablist">
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`tab ${tab === item.id ? 'tab-active' : ''}`}
            onClick={() => setSearchParams({ tab: item.id }, { replace: true })}
          >
            {item.label}
          </button>
        ))}
      </nav>

      {tab === 'participants' && <ParticipantsTab eventId={event.id} selfService={event.drawMode === 'INTERACTIVE'} onChange={reload} />}
      {tab === 'prizes' && <PrizesTab eventId={event.id} onChange={reload} />}
      {tab === 'winners' && <WinnersTab eventId={event.id} eventName={event.name} onChange={reload} />}

      <div className="danger-zone">
        <button type="button" className="btn btn-ghost btn-danger-text btn-sm" onClick={removeEvent}>
          Excluir evento
        </button>
      </div>

      {editing && (
        <EventFormModal
          event={event}
          onClose={() => setEditing(false)}
          onSubmit={async (input) => {
            await eventsApi.update(event.id, input);
            reload();
          }}
        />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="stat">
      <span className="stat-value">{typeof value === 'number' ? value.toLocaleString('pt-BR') : value}</span>
      <span className="stat-label">{label}</span>
    </div>
  );
}
