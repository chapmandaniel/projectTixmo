import { successResponse } from '../../src/utils/response';

describe('successResponse', () => {
  it('should create a basic success response', () => {
    const response = successResponse();

    expect(response.success).toBe(true);
    expect(response.data).toBeUndefined();
    expect(response.message).toBeUndefined();
  });

  it('should include data when provided', () => {
    const data = { id: 1, name: 'Test' };
    const response = successResponse(data);

    expect(response.success).toBe(true);
    expect(response.data).toEqual(data);
  });

  it('should include message when provided', () => {
    const response = successResponse(null, 'Operation successful');

    expect(response.success).toBe(true);
    expect(response.message).toBe('Operation successful');
  });

  it('should include meta when provided', () => {
    const meta = { page: 1, limit: 10, total: 100, totalPages: 10 };
    const response = successResponse([], 'Success', meta);

    expect(response.success).toBe(true);
    expect(response.meta).toEqual(meta);
  });
});
