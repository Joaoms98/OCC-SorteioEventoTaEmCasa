let counter = 0;

/** Unique, valid mobile numbers for test participants: 11910000001, 11910000002, ... */
export const nextPhone = (): string => {
  counter += 1;
  return `119${String(10_000_000 + counter).slice(-8)}`;
};
