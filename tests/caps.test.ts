import { describe, expect, it } from 'vitest';
import { buildCapabilities } from '../src/lib/caps.js';

describe('buildCapabilities -- iOS code-signing flags', () => {
  it('maps signing flags to appium:* caps (note WDA uppercase)', () => {
    const caps = buildCapabilities({
      platform: 'ios',
      xcodeOrgId: 'ABCDE12345',
      xcodeSigningId: 'iPhone Developer',
      allowProvisioningDeviceRegistration: true,
      updatedWdaBundleId: 'com.example.WebDriverAgentRunner',
    });
    expect(caps['appium:xcodeOrgId']).toBe('ABCDE12345');
    expect(caps['appium:xcodeSigningId']).toBe('iPhone Developer');
    expect(caps['appium:allowProvisioningDeviceRegistration']).toBe(true);
    expect(caps['appium:updatedWDABundleId']).toBe(
      'com.example.WebDriverAgentRunner',
    );
  });

  it('omits signing caps when not provided', () => {
    const caps = buildCapabilities({ platform: 'ios' });
    expect(caps).not.toHaveProperty('appium:xcodeOrgId');
    expect(caps).not.toHaveProperty(
      'appium:allowProvisioningDeviceRegistration',
    );
  });

  it('throws when a signing flag is set on Android', () => {
    expect(() =>
      buildCapabilities({ platform: 'android', xcodeOrgId: 'ABCDE12345' }),
    ).toThrow(/only valid for --platform ios/);
  });
});

describe('buildCapabilities -- --headless', () => {
  it('maps headless to appium:isHeadless on both platforms', () => {
    expect(
      buildCapabilities({ platform: 'ios', headless: true })[
        'appium:isHeadless'
      ],
    ).toBe(true);
    expect(
      buildCapabilities({ platform: 'android', headless: true })[
        'appium:isHeadless'
      ],
    ).toBe(true);
  });

  it('omits the cap when not requested', () => {
    expect(buildCapabilities({ platform: 'ios' })).not.toHaveProperty(
      'appium:isHeadless',
    );
    expect(
      buildCapabilities({ platform: 'ios', headless: false }),
    ).not.toHaveProperty('appium:isHeadless');
  });
});
