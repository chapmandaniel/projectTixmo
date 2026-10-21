// Setup-free: environment module has no service imports; dotenv is disabled in test.
describe('checkout admission configuration', () => {
  const original = process.env.WAITING_ROOM_MAX_CONCURRENT_REQUESTS;
  beforeEach(() => { jest.resetModules(); process.env.NODE_ENV = 'test'; });
  afterEach(() => {
    if (original === undefined) delete process.env.WAITING_ROOM_MAX_CONCURRENT_REQUESTS;
    else process.env.WAITING_ROOM_MAX_CONCURRENT_REQUESTS = original;
  });
  const load = () => require('../../src/config/environment').config.waitingRoomMaxConcurrentRequests;
  it('retains absent compatibility default without certifying capacity', () => {
    delete process.env.WAITING_ROOM_MAX_CONCURRENT_REQUESTS;
    expect(load()).toBe(5000);
  });
  it.each(['1', '17', '9007199254740991'])('accepts %s', value => {
    process.env.WAITING_ROOM_MAX_CONCURRENT_REQUESTS = value;
    expect(load()).toBe(Number(value));
  });
  it.each(['', ' ', '0', '-1', '1.5', '2junk', 'Infinity', 'NaN', '9007199254740992', '1e3', '+2', ' 2 '])('rejects explicit %p', value => {
    process.env.WAITING_ROOM_MAX_CONCURRENT_REQUESTS = value;
    expect(load).toThrow('WAITING_ROOM_MAX_CONCURRENT_REQUESTS');
  });
});
