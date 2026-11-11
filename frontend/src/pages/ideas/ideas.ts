import { publicPaths } from '../../routes';

/** Prototypes of draw types the crew is voting on. None of them talks to the API. */
export interface Idea {
  key: string;
  path: string;
  name: string;
}

/** Typed as non-empty so the wrap-around below always lands on a real idea. */
export const IDEAS: readonly [Idea, ...Idea[]] = [
  { key: 'dice', path: publicPaths.diceIdea, name: 'Sorteio no dado' },
  { key: 'scratch', path: publicPaths.scratchIdea, name: 'Raspadinha' },
];

/** The next prototype to show, wrapping around so the last one leads back to the first. */
export function nextIdea(key: string): Idea {
  const at = IDEAS.findIndex((idea) => idea.key === key);
  return IDEAS[(at + 1) % IDEAS.length] ?? IDEAS[0];
}
