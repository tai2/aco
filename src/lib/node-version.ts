export function assertSupportedNodeVersion(minimum: string): void {
  const current = process.versions.node;
  if (compareSemver(current, minimum) < 0) {
    console.error(
      `aco requires Node.js >= ${minimum}, but is running on ${current}.\n` +
        `Please upgrade Node.js: https://nodejs.org/`,
    );
    process.exit(1);
  }
}

function compareSemver(a: string, b: string): number {
  const pa = a.split('.').map((n) => Number.parseInt(n, 10));
  const pb = b.split('.').map((n) => Number.parseInt(n, 10));
  for (let i = 0; i < 3; i++) {
    const ai = pa[i] ?? 0;
    const bi = pb[i] ?? 0;
    if (ai !== bi) return ai - bi;
  }
  return 0;
}
