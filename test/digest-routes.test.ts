import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const night = '2026-10-30';
const events = [
  JSON.stringify({ at: '2026-10-30T02:00:00Z', job: 'zeta/task', status: 'ok', owner: 'rook' }),
  JSON.stringify({ at: '2026-10-30T01:00:00Z', job: 'alpha/task', status: 'retry', owner: 'rook' }),
].join('\n');

let runsDir: string;

function writeNight(contents: string): void {
  writeFileSync(join(runsDir, `${night}.jsonl`), contents);
}

async function request(path: string): Promise<Response> {
  return createApp({
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  }).request(path);
}

beforeEach(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'rig-digest-routes-'));
});

afterEach(() => {
  rmSync(runsDir, { recursive: true, force: true });
});

describe('digest page route', () => {
  it('renders a populated night with status 200', async () => {
    writeNight(events);

    const response = await request(`/digest/${night}`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('alpha/task');
    expect(html).toContain('zeta/task');
  });

  it('returns 404 when the night file is missing', async () => {
    const response = await request(`/digest/${night}`);

    expect(response.status).toBe(404);
  });

  it('renders an empty file as nothing ran', async () => {
    writeNight('');

    const response = await request(`/digest/${night}`);

    expect(response.status).toBe(200);
    expect(await response.text()).toContain('nothing ran');
  });

  it('renders valid jobs when the night contains a malformed line', async () => {
    writeNight(`${events}\nnot-json`);

    const response = await request(`/digest/${night}`);
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).toContain('alpha/task');
    expect(html).toContain('zeta/task');
  });
});

describe('digest JSON route', () => {
  it('returns a populated night with status 200', async () => {
    writeNight(events);

    const response = await request(`/api/digest/${night}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toHaveLength(2);
  });

  it('returns 404 when the night file is missing', async () => {
    const response = await request(`/api/digest/${night}`);

    expect(response.status).toBe(404);
  });

  it('returns an empty array for an empty file', async () => {
    writeNight('');

    const response = await request(`/api/digest/${night}`);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([]);
  });

  it('returns valid jobs when the night contains a malformed line', async () => {
    writeNight(`${events}\nnot-json`);

    const response = await request(`/api/digest/${night}`);

    expect(response.status).toBe(200);
    expect((await response.json()).map((row: { job: string }) => row.job)).toEqual([
      'alpha/task',
      'zeta/task',
    ]);
  });

  it('returns the same jobs in the same order as the HTML page', async () => {
    writeNight(events);

    const [htmlResponse, jsonResponse] = await Promise.all([
      request(`/digest/${night}`),
      request(`/api/digest/${night}`),
    ]);
    const html = await htmlResponse.text();
    const jobs = (await jsonResponse.json()).map((row: { job: string }) => row.job);

    expect(htmlResponse.status).toBe(200);
    expect(jsonResponse.status).toBe(200);
    expect(jobs).toEqual(['alpha/task', 'zeta/task']);
    expect(html.indexOf('alpha/task')).toBeLessThan(html.indexOf('zeta/task'));
  });
});
