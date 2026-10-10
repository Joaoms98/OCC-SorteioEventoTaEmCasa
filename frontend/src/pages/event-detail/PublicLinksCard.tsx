import { QRCodeSVG } from 'qrcode.react';
import { Check, Copy } from 'lucide-react';
import { useRef, useState } from 'react';
import { publicPaths } from '../../routes';
import type { DrawMode } from '../../types/api';

interface PublicLink {
  title: string;
  description: string;
  url: string;
}

interface PublicLinksCardProps {
  eventId: string;
  registrationOpen: boolean;
  drawMode: DrawMode;
}

/**
 * Links participants use from their phones: self-registration and the live draw. The interactive
 * roulette also gets the booth link, for a shared tablet.
 */
export function PublicLinksCard({ eventId, registrationOpen, drawMode }: PublicLinksCardProps) {
  const origin = window.location.origin;
  const links: PublicLink[] = [
    {
      title: 'Inscrição pelo celular',
      description: registrationOpen
        ? 'Projete o QR Code para os participantes se inscreverem.'
        : 'Inscrições fechadas: o link mostra uma mensagem de encerramento.',
      url: `${origin}${publicPaths.register(eventId)}`,
    },
    {
      title: 'Sorteio ao vivo',
      description: 'Qualquer pessoa com o link acompanha os sorteios em tempo real.',
      url: `${origin}${publicPaths.live(eventId)}`,
    },
  ];
  if (drawMode === 'INTERACTIVE') {
    links.push({
      title: 'Modo estande (tablet)',
      description:
        'Abra no tablet do estande: cada pessoa se inscreve, gira a roleta e a tela volta sozinha para a próxima, sem guardar nada no aparelho.',
      url: `${origin}${publicPaths.kiosk(eventId)}`,
    });
  }

  return (
    <div className="public-links">
      {links.map((link) => (
        <PublicLinkCard key={link.url} {...link} />
      ))}
    </div>
  );
}

function PublicLinkCard({ title, description, url }: PublicLink) {
  const [status, setStatus] = useState<'idle' | 'copied' | 'manual'>('idle');
  const linkRef = useRef<HTMLElement>(null);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setStatus('copied');
      setTimeout(() => setStatus('idle'), 2000);
    } catch {
      // Clipboard blocked (e.g. plain http): select the link so it can be copied with Ctrl+C.
      const selection = window.getSelection();
      if (linkRef.current && selection) {
        const range = document.createRange();
        range.selectNodeContents(linkRef.current);
        selection.removeAllRanges();
        selection.addRange(range);
      }
      setStatus('manual');
    }
  }

  return (
    <section className="card public-link-card">
      <QRCodeSVG className="qr-code" value={url} size={116} marginSize={2} title={`QR Code: ${title}`} />
      <div className="stack-sm">
        <h3>{title}</h3>
        <p className="muted small">{description}</p>
        <code ref={linkRef} className="link-box">
          {url}
        </code>
        {status === 'manual' && <p className="small muted">Link selecionado: copie com Ctrl+C.</p>}
        <div className="actions-left">
          <button type="button" className="btn btn-secondary btn-sm" onClick={copy}>
            {status === 'copied' ? (
              <>
                <Check size={15} aria-hidden="true" /> Copiado
              </>
            ) : (
              <>
                <Copy size={15} aria-hidden="true" /> Copiar link
              </>
            )}
          </button>
          <a className="btn btn-ghost btn-sm" href={url} target="_blank" rel="noreferrer">
            Abrir
          </a>
        </div>
      </div>
    </section>
  );
}
