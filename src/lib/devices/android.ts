import { readFileSync, readdirSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { Device, ListResult } from './types.js';

interface ResolvedAvdDir {
  dir: string;
  notes: string[];
}

function resolveAvdDir(): ResolvedAvdDir | null {
  const notes: string[] = [];
  const candidates: Array<{ path: string | undefined; suffix?: string }> = [
    { path: process.env.ANDROID_AVD_HOME },
    { path: process.env.ANDROID_EMULATOR_HOME, suffix: 'avd' },
    { path: join(homedir(), '.android'), suffix: 'avd' },
  ];
  for (const c of candidates) {
    if (!c.path) continue;
    const full = c.suffix ? join(c.path, c.suffix) : c.path;
    try {
      if (statSync(full).isDirectory()) {
        return { dir: full, notes };
      }
      notes.push(`Android: ${full} exists but is not a directory; skipping.`);
    } catch {
      // ENOENT — try next candidate
    }
  }
  return null;
}

interface AvdIniMeta {
  target?: string;
  apiLevel?: string;
  path?: string;
}

function parseAvdIni(iniPath: string): AvdIniMeta {
  let raw: string;
  try {
    raw = readFileSync(iniPath, 'utf8');
  } catch {
    return {};
  }
  const m: AvdIniMeta = {};
  for (const line of raw.split('\n')) {
    const eq = line.indexOf('=');
    if (eq < 0) continue;
    const k = line.slice(0, eq).trim();
    const v = line.slice(eq + 1).trim();
    if (k === 'target') m.target = v;
    if (k === 'path') m.path = v;
  }
  if (m.target) {
    const apiMatch = /^android-(\d+)$/.exec(m.target);
    if (apiMatch) m.apiLevel = apiMatch[1];
  }
  return m;
}

export async function listAndroidAvds(): Promise<ListResult> {
  const resolved = resolveAvdDir();
  if (!resolved) {
    return {
      devices: [],
      notes: [
        'Android skipped: no AVD directory found. ' +
          'Set $ANDROID_AVD_HOME, $ANDROID_EMULATOR_HOME, or create ' +
          '~/.android/avd (Android Studio does this on first AVD).',
      ],
    };
  }

  const entries = readdirSync(resolved.dir);
  const out: Device[] = [];
  for (const f of entries) {
    if (!f.endsWith('.ini')) continue;
    const name = f.slice(0, -'.ini'.length);
    const iniPath = join(resolved.dir, f);
    const meta = parseAvdIni(iniPath);
    out.push({
      id: name,
      name,
      platform: 'android',
      kind: 'emulator',
      state: 'unknown',
      platformVersion: meta.apiLevel,
      runtime: meta.target,
    });
  }
  return { devices: out, notes: resolved.notes };
}
