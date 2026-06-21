import androidManifest from '../data/extensions-android.json' with {
  type: 'json',
};
import iosManifest from '../data/extensions-ios.json' with { type: 'json' };

export type ParamKind = 'number' | 'boolean' | 'string';

export interface ParamSpec {
  name: string;
  required: boolean;
  kind: ParamKind;
}

export interface ExtensionSpec {
  command: string;
  params: ParamSpec[];
}

export type Manifest = Record<string, ExtensionSpec>;

export interface DriverRef {
  package: string;
  version: string;
}

export interface ManifestSnapshot {
  drivers: DriverRef[];
  extensions: Manifest;
}

export function loadManifest(platform: 'ios' | 'android'): Manifest {
  const snapshot = (
    platform === 'ios' ? iosManifest : androidManifest
  ) as ManifestSnapshot;
  return snapshot.extensions;
}
