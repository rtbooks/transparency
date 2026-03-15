/**
 * ServiceError — thrown by service-layer functions for expected business logic violations.
 * Carries an HTTP status code, user-facing title, and description so API routes can
 * return a proper response without string-matching error messages.
 */
export class ServiceError extends Error {
  constructor(
    public readonly title: string,
    public readonly description: string,
    public readonly statusCode: number = 400
  ) {
    super(description);
    this.name = 'ServiceError';
  }
}
