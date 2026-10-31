import { readinessDatabaseUrl } from '../../src/services/readiness-db';

describe('readiness database url', () => {
  it('pins a one-connection pool without dropping the schema', () => {
    expect(
      readinessDatabaseUrl('postgresql://tixmo:secret@127.0.0.1:5432/tixmo?schema=public')
    ).toBe('postgresql://tixmo:secret@127.0.0.1:5432/tixmo?schema=public&connection_limit=1');
  });

  it('replaces an existing connection limit', () => {
    expect(readinessDatabaseUrl('postgresql://tixmo@127.0.0.1/tixmo?connection_limit=20')).toBe(
      'postgresql://tixmo@127.0.0.1/tixmo?connection_limit=1'
    );
  });
});
