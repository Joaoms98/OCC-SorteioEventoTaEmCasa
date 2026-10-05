import { Gift } from 'lucide-react';
import { useEffect, useId, useState, type ChangeEvent, type FormEvent } from 'react';
import { ApiError, errorMessage } from '../../api/ApiError';
import { prizesApi } from '../../api/endpoints';
import { assetUrl } from '../../api/httpClient';
import { Alert } from '../../components/Alert';
import { useConfirm } from '../../components/confirm/ConfirmProvider';
import { EmptyState } from '../../components/EmptyState';
import { TextAreaField, TextField } from '../../components/Field';
import { Modal } from '../../components/Modal';
import { Spinner } from '../../components/Spinner';
import { useAsyncData } from '../../hooks/useAsyncData';
import type { Prize, PrizeInput } from '../../types/api';
import { preparePrizeImage } from '../../utils/prepareImage';

/** What to do with the prize photo when the form is saved. */
type ImageChange = { kind: 'keep' } | { kind: 'replace'; image: Blob } | { kind: 'remove' };

export function PrizesTab({ eventId, onChange }: { eventId: string; onChange(): void }) {
  const { data: prizes, error, loading, reload } = useAsyncData(() => prizesApi.list(eventId), [eventId]);
  const [editing, setEditing] = useState<Prize | 'new' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const confirm = useConfirm();

  function refresh() {
    setActionError(null);
    reload();
    onChange();
  }

  async function remove(prize: Prize) {
    const confirmed = await confirm({
      title: 'Remover brinde',
      message: (
        <>
          Remover o brinde <strong>{prize.name}</strong> e a foto dele?
        </>
      ),
      confirmLabel: 'Remover brinde',
      tone: 'danger',
    });
    if (!confirmed) return;
    try {
      await prizesApi.remove(eventId, prize.id);
      refresh();
    } catch (caught) {
      setActionError(errorMessage(caught));
    }
  }

  async function save(input: PrizeInput, imageChange: ImageChange) {
    const saved = editing === 'new' || !editing ? await prizesApi.create(eventId, input) : await prizesApi.update(eventId, editing.id, input);
    // From now on the form edits this prize, so retrying a failed upload never creates a duplicate.
    setEditing(saved);
    refresh();
    if (imageChange.kind === 'replace') await prizesApi.uploadImage(eventId, saved.id, imageChange.image);
    if (imageChange.kind === 'remove') await prizesApi.removeImage(eventId, saved.id);
    refresh();
  }

  return (
    <section className="stack">
      <div className="toolbar">
        <p className="muted">Cada unidade de um brinde é sorteada separadamente.</p>
        <button type="button" className="btn btn-primary" onClick={() => setEditing('new')}>
          + Brinde
        </button>
      </div>

      {actionError && <Alert>{actionError}</Alert>}
      {error ? <Alert>{errorMessage(error)}</Alert> : null}
      {loading && !prizes && <Spinner />}
      {prizes?.length === 0 && <EmptyState title="Nenhum brinde cadastrado." />}

      {prizes && prizes.length > 0 && (
        <div className="table-wrap">
          <table className="responsive-table">
            <thead>
              <tr>
                <th>Brinde</th>
                <th className="num">Quantidade</th>
                <th className="num">Sorteados</th>
                <th className="num">Restantes</th>
                <th aria-label="Ações" />
              </tr>
            </thead>
            <tbody>
              {prizes.map((prize) => (
                <tr key={prize.id}>
                  <td className="cell-title">
                    <div className="prize-cell">
                      <PrizeThumbnail prize={prize} />
                      <div>
                        <strong>{prize.name}</strong>
                        {prize.description && <div className="muted small user-text">{prize.description}</div>}
                      </div>
                    </div>
                  </td>
                  <td className="num" data-label="Quantidade">{prize.quantity}</td>
                  <td className="num" data-label="Sorteados">{prize.drawnUnits}</td>
                  <td className="num" data-label="Restantes">
                    <span className={`badge ${prize.remainingUnits > 0 ? 'badge-success' : 'badge-muted'}`}>
                      {prize.remainingUnits}
                    </span>
                  </td>
                  <td className="cell-actions">
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditing(prize)}>
                      Editar
                    </button>
                    <button type="button" className="btn btn-ghost btn-sm btn-danger-text" onClick={() => remove(prize)}>
                      Remover
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <PrizeFormModal
          prize={editing === 'new' ? undefined : editing}
          onClose={() => setEditing(null)}
          onSubmit={save}
        />
      )}
    </section>
  );
}

function PrizeThumbnail({ prize }: { prize: Prize }) {
  return prize.imageUrl ? (
    <img className="prize-thumb" src={assetUrl(prize.imageUrl)} alt="" width={48} height={48} loading="lazy" />
  ) : (
    <span className="prize-thumb prize-thumb-empty" aria-hidden="true">
      <Gift size={22} />
    </span>
  );
}

function PrizeFormModal({
  prize,
  onClose,
  onSubmit,
}: {
  prize?: Prize;
  onClose(): void;
  onSubmit(input: PrizeInput, imageChange: ImageChange): Promise<void>;
}) {
  const [name, setName] = useState(prize?.name ?? '');
  const [quantity, setQuantity] = useState(String(prize?.quantity ?? 1));
  const [description, setDescription] = useState(prize?.description ?? '');
  const [imageChange, setImageChange] = useState<ImageChange>({ kind: 'keep' });
  const [preview, setPreview] = useState<string | null>(null);
  const [imageError, setImageError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputId = useId();
  const fieldErrors = error instanceof ApiError ? error.fieldErrors : {};

  // Object URLs keep the selected file in memory until revoked.
  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const currentImage =
    imageChange.kind === 'replace' ? preview : imageChange.kind === 'remove' || !prize?.imageUrl ? null : assetUrl(prize.imageUrl);

  async function selectImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setProcessing(true);
    setImageError(null);
    try {
      const image = await preparePrizeImage(file);
      setImageChange({ kind: 'replace', image });
      setPreview(URL.createObjectURL(image));
    } catch (caught) {
      setImageError(errorMessage(caught));
    } finally {
      setProcessing(false);
    }
  }

  function removeImage() {
    setImageChange(prize?.imageUrl ? { kind: 'remove' } : { kind: 'keep' });
    setPreview(null);
    setImageError(null);
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({ name, quantity: Number(quantity), description: description || null }, imageChange);
      onClose();
    } catch (caught) {
      setError(caught);
      setSubmitting(false);
    }
  }

  return (
    <Modal title={prize ? 'Editar brinde' : 'Novo brinde'} onClose={onClose}>
      <form className="stack" noValidate onSubmit={handleSubmit}>
        {error ? <Alert>{errorMessage(error)}</Alert> : null}

        <div className="field">
          <label htmlFor={fileInputId}>Foto do brinde (opcional)</label>
          <div className="image-picker">
            <div className="image-picker-preview">
              {processing ? (
                <span className="spinner" aria-label="Processando foto" />
              ) : currentImage ? (
                <img src={currentImage} alt="Foto do brinde" />
              ) : (
                <Gift size={36} aria-hidden="true" />
              )}
            </div>
            <div className="stack-sm">
              <div className="actions-left">
                <label htmlFor={fileInputId} className="btn btn-secondary btn-sm">
                  {currentImage ? 'Trocar foto' : 'Escolher foto'}
                </label>
                {currentImage && (
                  <button type="button" className="btn btn-ghost btn-sm btn-danger-text" onClick={removeImage}>
                    Remover foto
                  </button>
                )}
              </div>
              <small className={imageError ? 'field-error' : 'field-hint'}>
                {imageError ?? 'JPG, PNG ou WebP. A foto é reduzida automaticamente antes do envio.'}
              </small>
            </div>
            <input id={fileInputId} type="file" accept="image/*" className="visually-hidden" onChange={selectImage} />
          </div>
        </div>

        <TextField label="Nome do brinde" value={name} onChange={(e) => setName(e.target.value)} required autoFocus maxLength={120} error={fieldErrors.name} />
        <TextField
          label="Quantidade"
          type="number"
          min={prize ? Math.max(prize.drawnUnits, 1) : 1}
          max={10000}
          step={1}
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          required
          error={fieldErrors.quantity}
          hint={prize && prize.drawnUnits > 0 ? `${prize.drawnUnits} já sorteado(s).` : undefined}
        />
        <TextAreaField label="Descrição (opcional)" value={description} onChange={(e) => setDescription(e.target.value)} rows={3} maxLength={500} error={fieldErrors.description} />
        <div className="actions">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={submitting || processing}>
            {submitting ? 'Salvando…' : 'Salvar'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
