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
  { key: 'cards', path: publicPaths.cardsIdea, name: 'Baralho' },
  { key: 'revolver', path: publicPaths.revolverIdea, name: 'Roleta-russa' },
];

/** Fake stock the prototypes hand out. The real draw modes get the prizes from the server. */
export const MOCK_PRIZES = ['Camiseta OCC', 'Boné OCC', 'Kit de cabelo', 'Caneca OCC', 'Cartela de adesivos'];

/** One mocked prize, drawn in the browser just to make the prototypes playable. */
export function mockPrize(): string {
  return MOCK_PRIZES[Math.floor(Math.random() * MOCK_PRIZES.length)] ?? MOCK_PRIZES[0] ?? 'Brinde OCC';
}

/** The next prototype to show, wrapping around so the last one leads back to the first. */
export function nextIdea(key: string): Idea {
  const at = IDEAS.findIndex((idea) => idea.key === key);
  return IDEAS[(at + 1) % IDEAS.length] ?? IDEAS[0];
}
