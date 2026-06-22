import { log } from '@appium/logger';

let quieted = false;

// `appium-ios-device` and `appium-adb` log routine probe failures (e.g. "usbmuxd
// socket missing", "no adb devices") at debug level through @appium/support's
// shared logger, whose first `getLogger` call (made when those libraries are
// imported) forces the process-global @appium/logger level to "verbose". Left
// alone, every `aco device list` on a machine with no real device spews a
// usbmuxd/adb stack trace to stderr. We lower that shared global level to "warn"
// so genuine warnings/errors still surface but the expected no-device-connected
// probes stay quiet; we report real failures as our own friendly notes instead.
//
// This must run *after* the appium libraries are imported (which it does -- it
// is called from inside the listers, well after their top-level imports), so the
// libraries' own "default to verbose" initialization does not clobber it.
export function quietAppiumLog(): void {
  if (quieted) return;
  log.level = 'warn';
  quieted = true;
}
