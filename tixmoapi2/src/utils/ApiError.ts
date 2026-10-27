export class ApiError extends Error {
  statusCode: number;
  errors?: unknown;
  data?: unknown;
  code?: string;
  retryAfter?: number;

  constructor(statusCode: number, message: string, errors?: unknown) {
    super(message);
    this.statusCode = statusCode;
    this.errors = errors;
    this.name = 'ApiError';

    // Maintains proper stack trace for where our error was thrown
    Error.captureStackTrace(this, this.constructor);
  }

  static badRequest(message: string, errors?: unknown) {
    return new ApiError(400, message, errors);
  }

  static unauthorized(message: string = 'Unauthorized') {
    return new ApiError(401, message);
  }

  static forbidden(message: string = 'Forbidden', data?: unknown) {
    const error = new ApiError(403, message);
    if (data !== undefined) error.data = data;
    return error;
  }

  static notFound(message: string = 'Not Found') {
    return new ApiError(404, message);
  }

  static conflict(message: string, errors?: unknown) {
    return new ApiError(409, message, errors);
  }

  static internal(message: string = 'Internal Server Error') {
    return new ApiError(500, message);
  }

  static busy(message: string, code: string, retryAfter = 2) {
    const error = new ApiError(503, message, { code });
    error.code = code;
    error.retryAfter = retryAfter;
    return error;
  }
}
