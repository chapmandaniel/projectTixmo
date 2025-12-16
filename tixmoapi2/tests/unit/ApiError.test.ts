import { ApiError } from '../../src/utils/ApiError';

describe('ApiError', () => {
  it('should create a basic error', () => {
    const error = new ApiError(400, 'Bad Request');

    expect(error.statusCode).toBe(400);
    expect(error.message).toBe('Bad Request');
    expect(error.name).toBe('ApiError');
  });

  it('should create a badRequest error', () => {
    const error = ApiError.badRequest('Invalid input');

    expect(error.statusCode).toBe(400);
    expect(error.message).toBe('Invalid input');
  });

  it('should create an unauthorized error', () => {
    const error = ApiError.unauthorized();

    expect(error.statusCode).toBe(401);
    expect(error.message).toBe('Unauthorized');
  });

  it('should create a notFound error', () => {
    const error = ApiError.notFound('Resource not found');

    expect(error.statusCode).toBe(404);
    expect(error.message).toBe('Resource not found');
  });

  it('should include additional errors', () => {
    const validationErrors = { email: 'Invalid email format' };
    const error = ApiError.badRequest('Validation failed', validationErrors);

    expect(error.errors).toEqual(validationErrors);
  });
});
