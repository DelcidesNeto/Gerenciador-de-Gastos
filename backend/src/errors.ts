export class HttpError extends Error {
  status: number;
  details?: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.details = details;
  }
}

export class ConflictError extends HttpError {
  constructor(message = 'Conflito de versão — tente novamente') {
    super(409, message);
    this.name = 'ConflictError';
  }
}
