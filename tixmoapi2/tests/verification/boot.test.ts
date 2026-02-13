
import app from '../../src/app';

describe('App Boot Verification', () => {
  it('should export an express app', () => {
    expect(app).toBeDefined();
    expect(typeof app.use).toBe('function');
  });
});
