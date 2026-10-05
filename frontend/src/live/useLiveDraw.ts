import { useCallback, useEffect, useReducer } from 'react';
import { liveStreamUrl } from '../api/endpoints';
import type { Draw, DrawResult, DrawWheel } from '../types/api';
import { initialLiveState, liveReducer } from './liveReducer';
import type { LivePrizeRef, LiveSnapshot } from './types';

const RECONNECT_DELAY_MS = 5000;

/** Subscribes to the live draw of an event (Server-Sent Events) and keeps the stage state. */
export function useLiveDraw(eventId: string) {
  const [state, dispatch] = useReducer(liveReducer, initialLiveState);

  useEffect(() => {
    let source: EventSource | null = null;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    let stopped = false;

    const connect = () => {
      source = new EventSource(liveStreamUrl(eventId));
      const on = <T,>(name: string, handle: (data: T) => void) =>
        source?.addEventListener(name, (event) => handle(JSON.parse((event as MessageEvent<string>).data) as T));

      source.onopen = () => dispatch({ type: 'status', status: 'live' });
      source.onerror = () => {
        if (stopped) return;
        dispatch({ type: 'status', status: 'reconnecting' });
        // The browser retries by itself unless the server answered with an error.
        if (source?.readyState === EventSource.CLOSED) {
          source.close();
          retryTimer = setTimeout(connect, RECONNECT_DELAY_MS);
        }
      };

      on<LiveSnapshot>('snapshot', (snapshot) => dispatch({ type: 'snapshot', snapshot, now: Date.now() }));
      on<{ drawId: string; prize: LivePrizeRef; landingInMs: number; revealInMs: number; wheelNames: string[] | null }>(
        'draw_started',
        ({ wheelNames, ...data }) =>
          dispatch({ type: 'started', ...data, wheel: wheelNames ? { names: wheelNames, slot: null } : null, now: Date.now() }),
      );
      on<{ drawId: string; slot: number }>('draw_landing', (data) => dispatch({ type: 'landing', ...data }));
      on<{ drawId: string; prize: LivePrizeRef; winnerName: string; wheel: DrawWheel | null }>('draw_revealed', (data) =>
        dispatch({ type: 'revealed', ...data, now: Date.now() }),
      );
      on<{ drawId: string; prize: LivePrizeRef; winnerName: string }>('draw_voided', (data) =>
        dispatch({ type: 'voided', ...data, now: Date.now() }),
      );
      on<{ drawId: string; prize: LivePrizeRef; winnerName: string }>('draw_claimed', (data) =>
        dispatch({ type: 'claimed', ...data, now: Date.now() }),
      );
      on<{ count: number }>('viewers', ({ count }) => dispatch({ type: 'viewers', count }));
      on('closed', () => {
        stopped = true;
        source?.close();
        dispatch({ type: 'status', status: 'closed' });
      });
    };

    connect();
    return () => {
      stopped = true;
      source?.close();
      clearTimeout(retryTimer);
    };
  }, [eventId]);

  // The organizer's screen already knows the winner: reveal it locally at the same instant as everyone.
  const { current } = state;
  useEffect(() => {
    if (current?.phase !== 'drawing' || !current.winnerName) return;
    const timer = setTimeout(
      () => dispatch({ type: 'revealDue', drawId: current.drawId }),
      Math.max(current.revealAt - Date.now(), 0),
    );
    return () => clearTimeout(timer);
  }, [current]);

  const announceDraw = useCallback(
    (result: DrawResult) =>
      dispatch({
        type: 'started',
        drawId: result.id,
        prize: result.prize,
        landingInMs: result.landingInMs,
        revealInMs: result.revealInMs,
        wheel: result.wheel,
        winnerName: result.participant.name,
        now: Date.now(),
      }),
    [],
  );

  const announceVoid = useCallback(
    (draw: Draw) =>
      dispatch({ type: 'voided', drawId: draw.id, prize: draw.prize, winnerName: draw.participant.name, now: Date.now() }),
    [],
  );

  const announceClaim = useCallback(
    (draw: Draw) =>
      dispatch({ type: 'claimed', drawId: draw.id, prize: draw.prize, winnerName: draw.participant.name, now: Date.now() }),
    [],
  );

  return { ...state, announceDraw, announceVoid, announceClaim };
}
