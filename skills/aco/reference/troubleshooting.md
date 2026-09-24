# Troubleshooting & session resolution

## Default session resolution

Session-attached commands resolve `--session/--server-url/--platform` from
`~/.aco/sessions/`:

- All three flags present → used as-is.
- `--session` only → the rest are read from that record (warns + falls back to
  `http://127.0.0.1:4723` if no record exists).
- Nothing → the latest live session is used (newest record whose server is
  remote **or** whose pid is alive).

Explicit flags always win. If nothing is live, the command errors cleanly —
start a session first with `aco session start --detach ...`.

## Common failures

- **`appium not found on PATH`** (running `aco session start`) → tell the user to
  `npm i -g appium` and verify `which appium` resolves.
- **`Insecure feature 'adb_shell' not enabled`** (Android `mobile: shell`) →
  restart the session with `--cap appium:allowInsecure='["adb_shell"]'` (or
  `--allow-insecure adb_shell`).
- **`unknown command (script)`** from `aco ios/android` or `aco mobile call` →
  the connected driver version doesn't expose that extension. Run `aco mobile
  list` to see what it actually advertises; aco surfaces the server's error
  verbatim rather than guessing an alternate encoding.
- **`--detach` fails / exits 2** → only happens under the `tsx` dev runtime
  (`pnpm dev`), which re-execs the built `dist/cli.js`. This affects aco
  developers, not installed-CLI users — the published binary detaches fine.

## Xcode 27 / iOS 27

All of these are the user's Appium install, not `aco`. The fix is almost always
`appium driver update xcuitest`.

- **Session start fails building WebDriverAgent** (`Supported Deployment Target
  Versions is 15.0 to 27.0`, or `Simulator.app` / `.../Contents/Developer/
  Applications` not found) → their `appium-xcuitest-driver` predates Xcode 27
  support. Need **11.10.0+**; `appium driver update xcuitest`.
- **`aco ios lock` / `unlock` / `is-locked` silently do nothing on iOS 27** →
  needs `appium-xcuitest-driver` **11.17.5+**.
- **A new simulator window opens on every `session start`** → Xcode 27 replaced
  `Simulator.app` with Device Hub, and `appium-ios-simulator` before **10.1.1**
  opens a fresh one per boot. Pass `--headless` to `aco session start`, or update
  the driver.
- **`aco send-keys` on a *real* iOS 27 device drops characters / the keyboard
  collapses mid-input** → upstream XCTest/iOS behaviour (WebDriverAgent#1258,
  closed as not-planned). No fix; prefer setting the value via the app or retry
  per character. Simulators are unaffected.
- **A device paired only over the network doesn't appear in `aco device list`** →
  `aco` enumerates real devices over USB (usbmuxd) only. Connect by cable, or
  pass its `--udid` explicitly.
- **`unknown command (script)` for a VoiceOver, hand-gesture or digital-crown
  command** → the specific case of the general failure above: these are
  `appium-xcuitest-driver` **12.x** additions, and the connected driver is older
  than the manifest `aco` was built against.
