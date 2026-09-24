import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const here = dirname(fileURLToPath(import.meta.url));
const dataDir = join(here, '..', 'src', 'data');

type ParamKind = 'number' | 'boolean' | 'string';

interface ParamSpec {
  name: string;
  required: boolean;
  kind: ParamKind;
}
interface ExtensionSpec {
  command: string;
  params: ParamSpec[];
}
type Manifest = Record<string, ExtensionSpec>;

interface DriverRef {
  package: string;
  version: string;
}

interface ExecuteMethodEntry {
  command: string;
  params?: { required?: readonly string[]; optional?: readonly string[] };
}
interface ExecuteMethodMapShape {
  executeMethodMap: Record<string, ExecuteMethodEntry>;
}

interface PackageJsonShape {
  version: string;
}

function readPkgVersion(pkgJsonPath: string): string {
  return (JSON.parse(readFileSync(pkgJsonPath, 'utf8')) as PackageJsonShape)
    .version;
}

// The driver packages are ESM-only with a restricted `exports` map that
// publishes only "." and "./package.json" -- a deep `import
// '<pkg>/build/lib/execute-method-map.js'` now fails with
// ERR_PACKAGE_PATH_NOT_EXPORTED. `exports` gates *specifier* resolution, not
// file access, so we anchor on the one exported subpath (package.json), then
// import the map by absolute file:// URL. This is a build-time source reader
// (never shipped, never on the CLI startup path), the same posture as the
// dtsFiles() walk below, which was never exports-mediated either.
async function loadExecuteMethodMap(
  libDir: string,
): Promise<Record<string, ExecuteMethodEntry>> {
  const url = pathToFileURL(join(libDir, 'execute-method-map.js')).href;
  const mod = (await import(url)) as ExecuteMethodMapShape;
  if (!mod.executeMethodMap || typeof mod.executeMethodMap !== 'object') {
    throw new Error(
      `${url} did not export an executeMethodMap -- the driver's build layout changed.`,
    );
  }
  return mod.executeMethodMap;
}

// Reduce a TypeScript parameter type node to one of the three coercion kinds the
// CLI understands. Anything we cannot confidently reduce (element IDs, unions,
// arrays/objects, unresolved generics) falls back to a raw string.
function reduceTypeNode(
  typeNode: ts.TypeNode | undefined,
  checker: ts.TypeChecker,
): ParamKind {
  if (!typeNode) return 'string';
  switch (typeNode.kind) {
    case ts.SyntaxKind.NumberKeyword:
      return 'number';
    case ts.SyntaxKind.BooleanKeyword:
      return 'boolean';
    case ts.SyntaxKind.StringKeyword:
      return 'string';
  }
  const t = checker.getTypeFromTypeNode(typeNode);
  const reduceType = (type: ts.Type): ParamKind | undefined => {
    if (type.flags & ts.TypeFlags.BooleanLike) return 'boolean';
    if (type.flags & ts.TypeFlags.NumberLike) return 'number';
    if (type.flags & ts.TypeFlags.StringLike) return 'string';
    return undefined;
  };
  const direct = reduceType(t);
  if (direct) return direct;
  if (t.isTypeParameter()) {
    const constraint = checker.getBaseConstraintOfType(t);
    if (constraint) {
      const reduced = reduceType(constraint);
      if (reduced) return reduced;
    }
  }
  return 'string';
}

// Walk a set of driver .d.ts files, returning command-function name ->
// (param name -> coercion kind).
function buildTypeIndex(files: string[]): {
  index: Map<string, Map<string, ParamKind>>;
} {
  const program = ts.createProgram(files, {
    target: ts.ScriptTarget.ES2022,
    module: ts.ModuleKind.NodeNext,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    skipLibCheck: true,
    noResolve: false,
    allowJs: false,
  });
  const checker = program.getTypeChecker();
  const index = new Map<string, Map<string, ParamKind>>();

  for (const sf of program.getSourceFiles()) {
    if (sf.isDeclarationFile && !files.includes(sf.fileName)) continue;
    ts.forEachChild(sf, (node) => {
      if (!ts.isFunctionDeclaration(node) || !node.name) return;
      const fnName = node.name.text;
      const params = new Map<string, ParamKind>();
      for (const p of node.parameters) {
        if (!ts.isIdentifier(p.name)) continue;
        const pname = p.name.text;
        if (pname === 'this') continue;
        params.set(pname, reduceTypeNode(p.type, checker));
      }
      index.set(fnName, params);
    });
  }
  return { index };
}

function dtsFiles(...roots: string[]): string[] {
  const out: string[] = [];
  const walk = (dir: string): void => {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.name.endsWith('.d.ts')) out.push(full);
    }
  };
  for (const root of roots) walk(root);
  return out;
}

function buildManifest(
  map: Record<string, ExecuteMethodEntry>,
  typeIndex: Map<string, Map<string, ParamKind>>,
): Manifest {
  const manifest: Manifest = {};
  for (const [mobileName, entry] of Object.entries(map)) {
    const typesForCmd = typeIndex.get(entry.command) ?? new Map();
    const required = entry.params?.required ?? [];
    const optional = entry.params?.optional ?? [];
    const params: ParamSpec[] = [
      ...required.map((name) => ({
        name,
        required: true,
        kind: typesForCmd.get(name) ?? 'string',
      })),
      ...optional.map((name) => ({
        name,
        required: false,
        kind: typesForCmd.get(name) ?? 'string',
      })),
    ];
    manifest[mobileName] = { command: entry.command, params };
  }
  return manifest;
}

function writeManifest(
  filename: string,
  drivers: DriverRef[],
  extensions: Manifest,
): void {
  writeFileSync(
    join(dataDir, filename),
    `${JSON.stringify({ drivers, extensions }, null, 2)}\n`,
  );
}

// --- iOS (XCUITest) ---
const iosLibDir = join(
  dirname(require.resolve('appium-xcuitest-driver/package.json')),
  'build',
  'lib',
);
const iosExecuteMethodMap = await loadExecuteMethodMap(iosLibDir);
const { index: iosTypeIndex } = buildTypeIndex(dtsFiles(iosLibDir));
const iosManifest = buildManifest(iosExecuteMethodMap, iosTypeIndex);
const iosDrivers: DriverRef[] = [
  {
    package: 'appium-xcuitest-driver',
    version: readPkgVersion(
      require.resolve('appium-xcuitest-driver/package.json'),
    ),
  },
];
writeManifest('extensions-ios.json', iosDrivers, iosManifest);

// --- Android (UiAutomator2 + Android driver base) ---
const uiautomator2PkgPath = require.resolve(
  'appium-uiautomator2-driver/package.json',
);
const androidDriverPkgPath = require.resolve(
  'appium-android-driver/package.json',
  {
    paths: [dirname(uiautomator2PkgPath)],
  },
);
const uiautomator2LibDir = join(dirname(uiautomator2PkgPath), 'build', 'lib');
const androidDriverLibDir = join(dirname(androidDriverPkgPath), 'build', 'lib');
const androidExecuteMethodMap = await loadExecuteMethodMap(uiautomator2LibDir);
const { index: androidTypeIndex } = buildTypeIndex(
  dtsFiles(uiautomator2LibDir, androidDriverLibDir),
);
const androidManifest = buildManifest(
  androidExecuteMethodMap,
  androidTypeIndex,
);
const androidDrivers: DriverRef[] = [
  {
    package: 'appium-uiautomator2-driver',
    version: readPkgVersion(uiautomator2PkgPath),
  },
  {
    package: 'appium-android-driver',
    version: readPkgVersion(androidDriverPkgPath),
  },
];
writeManifest('extensions-android.json', androidDrivers, androidManifest);

const summary = (label: string, count: number, drivers: DriverRef[]) =>
  `${label}: ${count} entries (${drivers
    .map((d) => `${d.package}@${d.version}`)
    .join(', ')})`;

console.log(summary('iOS', Object.keys(iosManifest).length, iosDrivers));
console.log(
  summary('Android', Object.keys(androidManifest).length, androidDrivers),
);
