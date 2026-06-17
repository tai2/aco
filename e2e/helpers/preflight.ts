import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { cliEntry } from './aco.js';
import { appArtefact, isIOS } from './platform.js';

function onPath(bin: string): boolean {
  const r = spawnSync('which', [bin], { encoding: 'utf8' });
  return r.status === 0 && r.stdout.trim().length > 0;
}

function driverInstalled(driver: string): boolean {
  const r = spawnSync('appium', ['driver', 'list', '--installed'], {
    encoding: 'utf8',
    timeout: 30_000,
  });
  // `appium driver list` writes its table to stderr.
  return `${r.stdout}${r.stderr}`.includes(driver);
}

// Fail fast with one actionable message rather than letting a 300s
// session-create timeout obscure a missing prerequisite (§2.5).
export function preflight(): void {
  const driver = isIOS ? 'xcuitest' : 'uiautomator2';
  const problems: string[] = [];

  if (!existsSync(cliEntry)) {
    problems.push(
      `built CLI not found at ${cliEntry} -- run \`pnpm run build\``,
    );
  }
  if (!onPath('appium')) {
    problems.push(
      '`appium` is not on PATH -- install it with `npm i -g appium`',
    );
  } else if (!driverInstalled(driver)) {
    problems.push(
      `the ${driver} driver is not installed -- run \`appium driver install ${driver}\``,
    );
  }
  try {
    appArtefact();
  } catch (err) {
    problems.push(err instanceof Error ? err.message : String(err));
  }

  if (problems.length > 0) {
    throw new Error(`e2e preflight failed:\n  - ${problems.join('\n  - ')}`);
  }
}
