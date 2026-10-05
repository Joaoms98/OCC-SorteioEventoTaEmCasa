export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
}

export const consoleLogger: Logger = {
  info: (message, meta) => console.info(message, meta ?? ''),
  error: (message, meta) => console.error(message, meta ?? ''),
};
