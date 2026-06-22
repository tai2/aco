import type { Platform } from './connection.js';

export interface StartCapsInput {
  platform: Platform;
  app?: string;
  appActivity?: string;
  deviceName?: string;
  platformVersion?: string;
  udid?: string;
  avd?: string;
  // iOS real-device code signing (XCUITest builds/installs WDA on-device):
  xcodeOrgId?: string;
  xcodeSigningId?: string;
  allowProvisioningDeviceRegistration?: boolean;
  updatedWdaBundleId?: string;
  extraCaps?: Record<string, unknown>;
}

export function buildCapabilities(
  input: StartCapsInput,
): Record<string, unknown> {
  const automationName = input.platform === 'ios' ? 'XCUITest' : 'UiAutomator2';
  const platformName = input.platform === 'ios' ? 'iOS' : 'Android';
  const base: Record<string, unknown> = {
    platformName,
    'appium:automationName': automationName,
    // aco is an interactive operator CLI: a user typing subcommands across
    // separate shell invocations can easily exceed Appium's 60s default
    // newCommandTimeout, which would silently terminate the session between
    // shots. Disable it by default; users can re-enable via
    // `--cap appium:newCommandTimeout=<seconds>`.
    'appium:newCommandTimeout': 0,
  };

  if (input.deviceName) base['appium:deviceName'] = input.deviceName;
  if (input.platformVersion)
    base['appium:platformVersion'] = input.platformVersion;
  if (input.udid) base['appium:udid'] = input.udid;
  if (input.avd) {
    if (input.platform !== 'android') {
      throw new Error(
        '--avd is only valid for --platform android (iOS uses --udid / --device-name).',
      );
    }
    base['appium:avd'] = input.avd;
  }

  const signingProvided =
    input.xcodeOrgId ||
    input.xcodeSigningId ||
    input.allowProvisioningDeviceRegistration ||
    input.updatedWdaBundleId;
  if (signingProvided && input.platform !== 'ios') {
    throw new Error(
      'Code-signing flags (--xcode-org-id, --xcode-signing-id, ' +
        '--allow-provisioning-device-registration, --updated-wda-bundle-id) ' +
        'are only valid for --platform ios.',
    );
  }
  if (input.xcodeOrgId) base['appium:xcodeOrgId'] = input.xcodeOrgId;
  if (input.xcodeSigningId)
    base['appium:xcodeSigningId'] = input.xcodeSigningId;
  if (input.allowProvisioningDeviceRegistration)
    base['appium:allowProvisioningDeviceRegistration'] = true;
  if (input.updatedWdaBundleId)
    base['appium:updatedWDABundleId'] = input.updatedWdaBundleId;

  if (input.app) {
    const looksLikePath =
      /^[./~]|^[A-Za-z]:\\/.test(input.app) ||
      /\.(app|apk|aab|ipa|zip)$/i.test(input.app);
    if (looksLikePath) {
      base['appium:app'] = input.app;
    } else if (input.platform === 'ios') {
      base['appium:bundleId'] = input.app;
    } else {
      if (!input.appActivity) {
        throw new Error(
          'Android `--app <package>` also requires `--app-activity <activity>` ' +
            '(UIAutomator2 needs appium:appPackage + appium:appActivity to launch an installed app).',
        );
      }
      base['appium:appPackage'] = input.app;
      base['appium:appActivity'] = input.appActivity;
    }
  }

  return { ...base, ...(input.extraCaps ?? {}) };
}
