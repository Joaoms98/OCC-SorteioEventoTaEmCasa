import { ArrowLeft, ArrowRight } from 'lucide-react';
import { Link } from 'react-router';
import { publicPaths } from '../../routes';
import { nextIdea } from './ideas';
import './idea-nav.css';

/** Footer of every prototype: on to the next idea, or back to the real raffles. */
export function IdeaNav({ current }: { current: string }) {
  const next = nextIdea(current);
  return (
    <footer className="idea-nav">
      <Link to={publicPaths.home} className="btn btn-secondary">
        <ArrowLeft size={18} aria-hidden="true" /> Ver todos os sorteios
      </Link>
      <Link to={next.path} className="btn btn-primary">
        Próxima ideia: {next.name} <ArrowRight size={18} aria-hidden="true" />
      </Link>
    </footer>
  );
}
