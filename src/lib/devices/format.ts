import type { Device } from './types.js';

const STATE_RANK: Record<Device['state'], number> = {
  booted: 0,
  available: 1,
  unknown: 2,
  unavailable: 3,
};

export function sortDevices(devices: Device[]): Device[] {
  return [...devices].sort((a, b) => {
    if (a.platform !== b.platform) return a.platform < b.platform ? -1 : 1;
    if (a.state !== b.state) return STATE_RANK[a.state] - STATE_RANK[b.state];
    return a.name.localeCompare(b.name);
  });
}

export function renderTable(devices: Device[]): string {
  if (devices.length === 0) return '';
  const cols = sortDevices(devices).map((d) => ({
    platform: d.platform,
    kind: d.kind,
    state: d.state,
    version: d.platformVersion ?? '',
    name: d.name,
    id: d.id,
  }));
  const widths = {
    platform: Math.max(8, ...cols.map((c) => c.platform.length)),
    kind: Math.max(9, ...cols.map((c) => c.kind.length)),
    state: Math.max(11, ...cols.map((c) => c.state.length)),
    version: Math.max(7, ...cols.map((c) => c.version.length)),
    name: Math.max(4, ...cols.map((c) => c.name.length)),
  };
  const header =
    [
      'PLATFORM'.padEnd(widths.platform),
      'KIND'.padEnd(widths.kind),
      'STATE'.padEnd(widths.state),
      'VERSION'.padEnd(widths.version),
      'NAME'.padEnd(widths.name),
      'ID',
    ].join('  ') + '\n';
  const body = cols
    .map((c) =>
      [
        c.platform.padEnd(widths.platform),
        c.kind.padEnd(widths.kind),
        c.state.padEnd(widths.state),
        c.version.padEnd(widths.version),
        c.name.padEnd(widths.name),
        c.id,
      ].join('  '),
    )
    .join('\n');
  return header + body + '\n';
}
