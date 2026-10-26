import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { formatNewfoundlandDateTime } from '../../src/utils/eventTime';

describe('Newfoundland event times', () => {
  it('labels daylight and standard time from the event instant', () => {
    expect(formatNewfoundlandDateTime(new Date('2026-10-31T22:30:00.000Z'))).toBe(
      'October 31, 2026 at 8:00 p.m. NDT'
    );
    expect(formatNewfoundlandDateTime(new Date('2026-11-09T22:30:00.000Z'))).toBe(
      'November 9, 2026 at 7:00 p.m. NST'
    );
  });

  it('renders a 9:30 p.m. NST event on a UTC server as November 9, not the next UTC day', () => {
    const root = path.resolve(__dirname, '../..');
    const result = spawnSync(
      process.execPath,
      [
        '-r',
        'ts-node/register/transpile-only',
        '-e',
        `const { formatNewfoundlandDateTime } = require('./src/utils/eventTime.ts');
         const instant = new Date('2026-11-10T01:00:00.000Z');
         console.log(JSON.stringify({
           formatted: formatNewfoundlandDateTime(instant),
           serverDate: instant.toLocaleDateString('en-US'),
         }));`,
      ],
      {
        cwd: root,
        env: { ...process.env, TZ: 'UTC', NODE_ENV: 'test' },
        encoding: 'utf8',
      }
    );
    expect(result.status).toBe(0);
    const output = JSON.parse(result.stdout.trim());
    expect(output.serverDate).toBe('11/10/2026');
    expect(output.formatted).toBe('November 9, 2026 at 9:30 p.m. NST');
  });
});
