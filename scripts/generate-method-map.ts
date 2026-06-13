import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, '..', 'src', 'data');

interface ExecuteMethodMapShape {
  executeMethodMap: Record<string, unknown>;
}

const iosMod = (await import(
  'appium-xcuitest-driver/build/lib/execute-method-map.js'
)) as ExecuteMethodMapShape;
const androidMod = (await import(
  'appium-uiautomator2-driver/build/lib/execute-method-map.js'
)) as ExecuteMethodMapShape;

const ios = iosMod.executeMethodMap;
const android = androidMod.executeMethodMap;

const uiautomator2PkgPath = require.resolve(
  'appium-uiautomator2-driver/package.json',
);
const androidDriverPkgPath = require.resolve(
  'appium-android-driver/package.json',
  { paths: [dirname(uiautomator2PkgPath)] },
);

interface PackageJsonShape {
  version: string;
}

function readPkgVersion(pkgJsonPath: string): string {
  return (JSON.parse(readFileSync(pkgJsonPath, 'utf8')) as PackageJsonShape).version;
}

const iosSnapshot = {
  drivers: [
    {
      package: 'appium-xcuitest-driver',
      version: readPkgVersion(
        require.resolve('appium-xcuitest-driver/package.json'),
      ),
    },
  ],
  methods: ios,
};

const androidSnapshot = {
  drivers: [
    {
      package: 'appium-uiautomator2-driver',
      version: readPkgVersion(uiautomator2PkgPath),
    },
    {
      package: 'appium-android-driver',
      version: readPkgVersion(androidDriverPkgPath),
    },
  ],
  methods: android,
};

writeFileSync(
  join(dataDir, 'method-map-ios.json'),
  JSON.stringify(iosSnapshot, null, 2) + '\n',
);
writeFileSync(
  join(dataDir, 'method-map-android.json'),
  JSON.stringify(androidSnapshot, null, 2) + '\n',
);

const summary = (
  label: string,
  count: number,
  drivers: { package: string; version: string }[],
) =>
  `${label}: ${count} entries (${drivers.map((d) => `${d.package}@${d.version}`).join(', ')})`;

console.log(summary('iOS', Object.keys(ios).length, iosSnapshot.drivers));
console.log(
  summary('Android', Object.keys(android).length, androidSnapshot.drivers),
);
