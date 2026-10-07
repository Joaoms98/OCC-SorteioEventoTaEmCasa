import type { InteractiveSpin } from '../types/api';

/** Browser storage of the public registration (per event). */
export const pendingKey = (eventId: string) => `occ-raffle.registration.${eventId}`;
export const registeredKey = (eventId: string) => `occ-raffle.registered.${eventId}`;
const spinKey = (eventId: string) => `occ-raffle.spin.${eventId}`;

/** Interactive roulette: the spin of whoever registered on this device. */
export interface StoredSpin extends InteractiveSpin {
  eventName: string;
  participantName: string;
  /** The wheel was already spun and stopped on the prize. */
  landed: boolean;
}

export const storage = {
  read<T>(key: string): T | null {
    try {
      const raw = sessionStorage.getItem(key) ?? localStorage.getItem(key);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },
  write(area: 'session' | 'local', key: string, value: unknown): void {
    try {
      (area === 'session' ? sessionStorage : localStorage).setItem(key, JSON.stringify(value));
    } catch {
      // Storage blocked: the flow still works, it just does not survive a reload.
    }
  },
  remove(key: string): void {
    try {
      sessionStorage.removeItem(key);
      localStorage.removeItem(key);
    } catch {
      // ignore
    }
  },
};

/** Name used in the registration made on this device, if any. */
export const registeredNameFor = (eventId: string): string | null => storage.read<string>(registeredKey(eventId));

export const readSpin = (eventId: string): StoredSpin | null => storage.read<StoredSpin>(spinKey(eventId));
export const saveSpin = (eventId: string, spin: StoredSpin): void => storage.write('local', spinKey(eventId), spin);
