import { useEffect, useState } from 'react';

interface RollingNameProps {
  names: string[];
  /** Local timestamp of the reveal: the roll slows down as it approaches. */
  revealAt: number;
}

/** Visual effect only: the winner is chosen by the server, never by this animation. */
export function RollingName({ names, revealAt }: RollingNameProps) {
  const [name, setName] = useState(() => pick(names));

  useEffect(() => {
    const startedAt = Date.now();
    const total = Math.max(revealAt - startedAt, 1);
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      setName(pick(names));
      const progress = Math.min((Date.now() - startedAt) / total, 1);
      timer = setTimeout(tick, 60 + progress * progress * 260);
    };
    tick();
    return () => clearTimeout(timer);
  }, [names, revealAt]);

  return <>{name}</>;
}

const pick = (names: string[]): string => names[Math.floor(Math.random() * names.length)] ?? '???';
