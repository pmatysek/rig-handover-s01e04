import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/types.js';

const night = readNight('runs', '2026-10-28');

describe('run log reader', () => {
  it('aggregates five jobs and counts the malformed fixture line', () => {
    expect(night.rows).toHaveLength(5);
    expect(night.malformedLines).toBe(1);
  });

  it('aggregates attempts, retries, last status, error, and source timestamps', () => {
    const sync = night.rows.find((row) => row.job === 'lane/sync');
    expect(sync).toEqual({
      job: 'lane/sync',
      owner: 'rook',
      runs: 8,
      retries: 1,
      lastStatus: 'ok',
      lastError: null,
      firstTime: '2026-10-28T23:00:06+01:00',
      lastTime: '2026-10-29T05:00:04+01:00',
    });

    const refresh = night.rows.find((row) => row.job === 'fixtures/refresh');
    expect(refresh).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: null,
      firstTime: '2026-10-29T01:30:00+01:00',
      lastTime: '2026-10-29T01:37:00+01:00',
    });
  });

  it('keeps jobs with null owners and retains terminal errors', () => {
    expect(night.rows.find((row) => row.job === 'digest/render')).toEqual({
      job: 'digest/render',
      owner: null,
      runs: 1,
      retries: 0,
      lastStatus: 'ok',
      lastError: null,
      firstTime: '2026-10-29T05:41:09+01:00',
      lastTime: '2026-10-29T05:41:09+01:00',
    });
    expect(night.rows.find((row) => row.job === 'notes/backup')?.lastError).toBe('quota exceeded');
  });
});
