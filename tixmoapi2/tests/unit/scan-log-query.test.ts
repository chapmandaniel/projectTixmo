import { getScanLogsSchema } from '../../src/api/scanners/validation';

describe('scan log success query', () => {
  it('parses the success=false string as false', () => {
    expect(getScanLogsSchema.parse({ query: { success: 'false' } }).query.success).toBe(false);
    expect(getScanLogsSchema.parse({ query: { success: 'true' } }).query.success).toBe(true);
    expect(getScanLogsSchema.parse({ query: { success: 'FALSE' } }).query.success).toBe(false);
    expect(getScanLogsSchema.parse({ query: {} }).query.success).toBeUndefined();
  });
});
