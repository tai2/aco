import androidMap from '../data/method-map-android.json' with { type: 'json' };
import iosMap from '../data/method-map-ios.json' with { type: 'json' };

export interface MethodSpec {
  command: string;
  params?: { required?: string[]; optional?: string[] };
}
export type MethodMap = Record<string, MethodSpec>;

export interface DriverRef {
  package: string;
  version: string;
}

export interface MethodMapSnapshot {
  drivers: DriverRef[];
  methods: MethodMap;
}

export function loadMethodMap(platform: 'ios' | 'android'): MethodMap {
  return loadSnapshot(platform).methods;
}

export function loadSnapshot(platform: 'ios' | 'android'): MethodMapSnapshot {
  if (platform === 'ios') {
    return iosMap as MethodMapSnapshot;
  }
  return androidMap as MethodMapSnapshot;
}
