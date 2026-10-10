/** Organizer area: everything behind the login lives under /admin; "/" is the public home page. */
export const adminPaths = {
  home: '/admin',
  login: '/admin/login',
  event: (eventId: string) => `/admin/events/${eventId}`,
  draw: (eventId: string) => `/admin/events/${eventId}/draw`,
};

export const publicPaths = {
  home: '/',
  /** Registration; on the interactive roulette the participant also spins the wheel here. */
  register: (eventId: string) => `/register/${eventId}`,
  live: (eventId: string) => `/live/${eventId}`,
};
