import { readFileSync } from 'node:fs';

export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: 'ok' | 'retry' | 'fail';
  lastError: string | null;
  firstTime: string;
  lastTime: string;
};

export type NightDigest = {
  rows: DigestRow[];
  malformedLines: number;
};

type RunEvent = {
  at: string;
  job: string;
  status: 'ok' | 'retry' | 'fail';
  owner: string | null;
  error?: string;
};

const validStatuses: Record<RunEvent['status'], true> = {
  ok: true,
  retry: true,
  fail: true,
};

function parseEvent(line: string): RunEvent | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  if (
    typeof record.at !== 'string' ||
    typeof record.job !== 'string' ||
    typeof record.status !== 'string' ||
    !Object.hasOwn(validStatuses, record.status) ||
    !(typeof record.owner === 'string' || record.owner === null) ||
    (record.error !== undefined && typeof record.error !== 'string')
  ) return null;

  return {
    at: record.at,
    job: record.job,
    status: record.status as RunEvent['status'],
    owner: record.owner,
    ...(typeof record.error === 'string' ? { error: record.error } : {}),
  };
}

export function readNight(runsDir: string, night: string): NightDigest {
  const content = readFileSync(`${runsDir}/${night}.jsonl`, 'utf8');
  const rowsByJob = new Map<string, DigestRow>();
  let malformedLines = 0;

  for (const line of content.split(/\r?\n/)) {
    if (line.length === 0) continue;
    const event = parseEvent(line);
    if (event === null) {
      malformedLines += 1;
      continue;
    }

    const row = rowsByJob.get(event.job);
    if (row === undefined) {
      rowsByJob.set(event.job, {
        job: event.job,
        owner: event.owner,
        runs: 1,
        retries: event.status === 'retry' ? 1 : 0,
        lastStatus: event.status,
        lastError: event.error ?? null,
        firstTime: event.at,
        lastTime: event.at,
      });
      continue;
    }

    row.runs += 1;
    if (event.status === 'retry') row.retries += 1;
    row.lastStatus = event.status;
    row.lastError = event.error ?? null;
    row.lastTime = event.at;
  }

  return { rows: [...rowsByJob.values()], malformedLines };
}


