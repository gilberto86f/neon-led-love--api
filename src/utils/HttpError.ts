export class HttpError extends Error {
  status: number;
  /**
   * Optional machine-readable payload sent alongside the message, surfaced by
   * `errorHandler` as the envelope's `details` field. Use it when the frontend
   * needs to *act* on the failure rather than just display it — e.g. the list of
   * cart issues that blocked a checkout. `message` stays the human-readable
   * string it has always been.
   */
  details?: unknown;
  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.status = status;
    this.details = details;
  }
}
