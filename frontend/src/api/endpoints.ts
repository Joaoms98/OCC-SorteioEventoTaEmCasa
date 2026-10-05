import type {
  ActiveEvent,
  Draw,
  DrawResult,
  EventInput,
  EventOverview,
  ImportResult,
  Page,
  Participant,
  ParticipantInput,
  Prize,
  PrizeInput,
  PublicEvent,
  RaffleEvent,
  RegistrationVerification,
} from '../types/api';
import { apiUrl, request } from './httpClient';

export const authApi = {
  login: (password: string) =>
    request<{ token: string; expiresIn: number }>('/auth/login', {
      method: 'POST',
      body: { password },
      authenticated: false,
    }),
};

export const eventsApi = {
  list: () => request<RaffleEvent[]>('/events'),
  get: (eventId: string) => request<EventOverview>(`/events/${eventId}`),
  create: (input: EventInput) => request<RaffleEvent>('/events', { method: 'POST', body: input }),
  update: (eventId: string, changes: Partial<EventInput>) =>
    request<RaffleEvent>(`/events/${eventId}`, { method: 'PATCH', body: changes }),
  remove: (eventId: string) => request<void>(`/events/${eventId}`, { method: 'DELETE' }),
};

export const participantsApi = {
  list: (eventId: string, query: { search?: string; page?: number; pageSize?: number }) =>
    request<Page<Participant>>(`/events/${eventId}/participants`, { query }),
  create: (eventId: string, input: ParticipantInput) =>
    request<Participant>(`/events/${eventId}/participants`, { method: 'POST', body: input }),
  import: (eventId: string, participants: ParticipantInput[]) =>
    request<ImportResult>(`/events/${eventId}/participants/import`, { method: 'POST', body: { participants } }),
  remove: (eventId: string, participantId: string) =>
    request<void>(`/events/${eventId}/participants/${participantId}`, { method: 'DELETE' }),
};

export const prizesApi = {
  list: (eventId: string) => request<Prize[]>(`/events/${eventId}/prizes`),
  create: (eventId: string, input: PrizeInput) =>
    request<Prize>(`/events/${eventId}/prizes`, { method: 'POST', body: input }),
  update: (eventId: string, prizeId: string, changes: Partial<PrizeInput>) =>
    request<Prize>(`/events/${eventId}/prizes/${prizeId}`, { method: 'PATCH', body: changes }),
  remove: (eventId: string, prizeId: string) =>
    request<void>(`/events/${eventId}/prizes/${prizeId}`, { method: 'DELETE' }),
  uploadImage: (eventId: string, prizeId: string, image: Blob) =>
    request<Prize>(`/events/${eventId}/prizes/${prizeId}/image`, { method: 'PUT', body: image }),
  removeImage: (eventId: string, prizeId: string) =>
    request<Prize>(`/events/${eventId}/prizes/${prizeId}/image`, { method: 'DELETE' }),
};

export const drawsApi = {
  list: (eventId: string) => request<Draw[]>(`/events/${eventId}/draws`),
  /** Without prizeId the roulette draws the prize too. */
  draw: (eventId: string, prizeId?: string) =>
    request<DrawResult>(`/events/${eventId}/draws`, { method: 'POST', body: prizeId ? { prizeId } : {} }),
  void: (eventId: string, drawId: string) =>
    request<Draw>(`/events/${eventId}/draws/${drawId}/void`, { method: 'POST' }),
  claim: (eventId: string, drawId: string) =>
    request<Draw>(`/events/${eventId}/draws/${drawId}/claim`, { method: 'POST' }),
};

export const publicApi = {
  /** Home page: events open for registration or with prizes still to draw. */
  listActiveEvents: () => request<ActiveEvent[]>('/public/events', { authenticated: false }),
  getEvent: (eventId: string) => request<PublicEvent>(`/public/events/${eventId}`, { authenticated: false }),
  /** Step 1: sends the code by e-mail (nobody is registered yet). */
  startRegistration: (eventId: string, input: Required<ParticipantInput>) =>
    request<RegistrationVerification>(`/public/events/${eventId}/registrations`, {
      method: 'POST',
      body: input,
      authenticated: false,
    }),
  /** Step 2: the right code creates the participant. */
  confirmRegistration: (eventId: string, verificationId: string, code: string) =>
    request<{ id: string; name: string }>(`/public/events/${eventId}/registrations/${verificationId}/confirm`, {
      method: 'POST',
      body: { code },
      authenticated: false,
    }),
  resendRegistrationCode: (eventId: string, verificationId: string) =>
    request<RegistrationVerification>(`/public/events/${eventId}/registrations/${verificationId}/resend`, {
      method: 'POST',
      authenticated: false,
    }),
};

/** Server-Sent Events stream of the live draw (public). */
export const liveStreamUrl = (eventId: string): string => apiUrl(`/public/events/${eventId}/live`);
