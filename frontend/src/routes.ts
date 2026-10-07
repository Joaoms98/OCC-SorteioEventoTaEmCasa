/** Organizer area: everything behind the login lives under /admin; "/" is the public home page. */
export const adminPaths = {
  home: '/admin',
  login: '/admin/login',
  event: (eventId: string) => `/admin/events/${eventId}`,
  draw: (eventId: string) => `/admin/events/${eventId}/draw`,
};

export const publicPaths = {
  home: '/',
  register: (eventId: string) => `/register/${eventId}`,
  live: (eventId: string) => `/live/${eventId}`,
  /** Interactive roulette: where a registered participant spins and sees the prize. */
  spin: (eventId: string) => `/spin/${eventId}`,
};
