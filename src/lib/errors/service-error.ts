/**
 * ServiceError — thrown by service-layer functions for expected business logic violations.
 * Carries an HTTP status code and user-friendly message so API routes can
 * return a proper response without string-matching error messages.
 */
export class ServiceError extends Error {
  constructor(
    message: string,
    public readonly statusCode: number = 400
  ) {
    super(message);
    this.name = 'ServiceError';
  }
}
