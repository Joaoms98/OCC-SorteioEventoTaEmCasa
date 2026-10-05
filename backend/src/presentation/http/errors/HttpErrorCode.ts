/** Error codes produced by the HTTP layer itself (not by the domain). */
export const HttpErrorCode = {
  ValidationError: 'VALIDATION_ERROR',
  InvalidJson: 'INVALID_JSON',
  PayloadTooLarge: 'PAYLOAD_TOO_LARGE',
  RouteNotFound: 'ROUTE_NOT_FOUND',
  ResourceNotFound: 'RESOURCE_NOT_FOUND',
  Unauthorized: 'UNAUTHORIZED',
  TooManyRequests: 'TOO_MANY_REQUESTS',
  InternalError: 'INTERNAL_ERROR',
} as const;

export type HttpErrorCode = (typeof HttpErrorCode)[keyof typeof HttpErrorCode];
