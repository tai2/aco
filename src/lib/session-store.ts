import {
  mkdirSync,
  readFileSync,
  readdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Platform } from './connection.js';

export interface SessionRecord {
  sessionId: string;
  serverUrl: string;
  platform: Platform;
  pid: number;
  startedAt: string;
  deviceName?: string;
  app?: string;
}

function storeDir(): string {
  return join(homedir(), '.aco', 'sessions');
}

function ensureDir(): void {
  mkdirSync(storeDir(), { recursive: true, mode: 0o700 });
}

function fileFor(id: string): string {
  return join(storeDir(), `${encodeURIComponent(id)}.json`);
}

export function saveSession(rec: SessionRecord): void {
  ensureDir();
  writeFileSync(fileFor(rec.sessionId), `${JSON.stringify(rec, null, 2)}\n`, {
    encoding: 'utf8',
    mode: 0o600,
  });
}

export function removeSession(id: string): void {
  try {
    unlinkSync(fileFor(id));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== 'ENOENT') throw err;
  }
}

export function readSession(id: string): SessionRecord | null {
  try {
    const txt = readFileSync(fileFor(id), 'utf8');
    return JSON.parse(txt) as SessionRecord;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw err;
  }
}

export function listSessions(): SessionRecord[] {
  ensureDir();
  const dir = storeDir();
  const out: SessionRecord[] = [];
  for (const f of readdirSync(dir)) {
    if (!f.endsWith('.json')) continue;
    try {
      const txt = readFileSync(join(dir, f), 'utf8');
      out.push(JSON.parse(txt) as SessionRecord);
    } catch {
      /* skip malformed records */
    }
  }
  out.sort((a, b) => (a.startedAt < b.startedAt ? 1 : -1));
  return out;
}

export function isLocalHost(serverUrl: string): boolean {
  try {
    const h = new URL(serverUrl).hostname;
    return h === '127.0.0.1' || h === 'localhost' || h === '::1';
  } catch {
    return false;
  }
}

export function isPidAlive(pid: number): boolean {
  if (!pid) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch (err) {
    return (err as NodeJS.ErrnoException).code !== 'ESRCH';
  }
}

export async function probeServerStatus(
  serverUrl: string,
  timeoutMs: number,
): Promise<boolean | null> {
  let statusUrl: string;
  try {
    statusUrl = new URL(
      'status',
      serverUrl.endsWith('/') ? serverUrl : `${serverUrl}/`,
    ).toString();
  } catch {
    return null;
  }
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await fetch(statusUrl, { signal: ac.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export function latestLiveSession(): SessionRecord | null {
  for (const rec of listSessions()) {
    if (!isLocalHost(rec.serverUrl) || isPidAlive(rec.pid)) return rec;
  }
  return null;
}
