export class ApiError extends Error {
  statusCode: number;
  errors?: unknown;

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

  static forbidden(message: string = 'Forbidden') {
    return new ApiError(403, message);
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
}
