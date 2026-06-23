# aco -- Appium Command-line Operator

[![ci](https://github.com/tai2/aco/actions/workflows/ci.yml/badge.svg)](https://github.com/tai2/aco/actions/workflows/ci.yml)

Drive an Appium session from the shell. Start a session against an app, then
send each Appium command as a single shell invocation -- no client-script
scaffolding required.

## Prerequisites

Install Appium and at least one driver first; `aco` spawns the `appium` binary
from your `PATH`. See the [Appium install guide](https://appium.io/docs/en/latest/quickstart/install/)
for details.

```sh
npm i -g appium                     # needs Node.js LTS and npm >=10
which appium                        # confirm it's on PATH

appium driver install xcuitest      # iOS (requires Xcode + command line tools)
appium driver install uiautomator2  # Android (requires Android SDK + JDK)

appium driver doctor xcuitest       # verify a driver's toolchain
```

## Install

```sh
npm i -g aco
# or run without installing:
npx aco --help
```

## Usage

### Discover devices

List the iOS Simulators, Android AVDs, **and connected real devices** you can
target. Pass a row's `NAME` to `session start --device-name` (iOS) or `--avd`
(Android emulator), or its `ID` to `--udid` (real device or iOS simulator).
Connected iPhones/iPads (over USB) and `adb`-visible Android handsets show up as
`KIND = real`; running emulators show up by their `adb` serial.

```sh
aco device list                          # both platforms, only "available" rows
aco device list --platform ios           # iOS Simulators + connected iPhones/iPads
aco device list --state all --json       # everything, machine-readable
```

### Start a session

```sh
# iOS simulator (foreground; Ctrl-C tears it down)
aco session start --platform ios --app /tmp/MyApp.app --device-name "iPhone 15"

# Android emulator
aco session start --platform android --app com.example.app --app-activity .MainActivity --avd Pixel_8_API_34

# iOS real device (requires code signing for the on-device WebDriverAgent build)
aco session start --platform ios --udid <40-char-udid> \
  --app /tmp/MyApp.ipa --xcode-org-id ABCDE12345

# Android real device (auto-selected when one is plugged in and no --avd given)
aco session start --platform android --app com.example.app --app-activity .MainActivity

# Background instead of foreground
aco session start --detach --platform ios --app /tmp/MyApp.app

# Forward extra Appium server flags
aco session start --platform android --log-level debug --use-plugins images

# Remote server / device farm (no local Appium is spawned; BASIC auth is sent
# only on session creation). Credentials may also come from
# ACO_REMOTE_USERNAME/ACO_REMOTE_PASSWORD.
aco session start --platform android --server-url https://grid.example.com/wd/hub \
  --auth user:accessKey --cap deviceName="Pixel 8"

# Device farm with vendor-specific nested caps (e.g. LambdaTest's "lt:options"):
# feed the whole W3C capabilities object verbatim with --caps-json (or @file).
aco session start --platform android \
  --server-url https://mobile-hub.lambdatest.com/wd/hub --auth user:accessKey \
  --caps-json '{"platformName":"android","lt:options":{"isRealMobile":true,"platformVersion":"13","deviceName":"Pixel 8","app":"lt://APP_ID"}}'
```

When you pass neither `--udid` nor `--avd`, `session start` prefers a connected
real device if one is present (announcing which device it picked on stderr), and
only otherwise falls back to auto-booting the first Android AVD. Explicit
`--udid`/`--avd` always win. iOS real devices additionally need code signing for
the on-device WebDriverAgent build -- pass `--xcode-org-id` (and optionally
`--xcode-signing-id`, `--allow-provisioning-device-registration`,
`--updated-wda-bundle-id`).

`session start` forwards a curated subset of Appium's server flags
(`--base-path`, `--log-level`, `--address`, `--relaxed-security`,
`--allow-cors`, `--allow-insecure`/`--deny-insecure`,
`--use-drivers`/`--use-plugins`, the `*-timeout` knobs). Run
`aco session start --help` for the full list. Pass `--log` to stream the Appium
server log to stdout (omit it in scripts).

Pass `--server-url <url>` to attach to an **already-running remote Appium
server** (a device-farm grid such as LambdaTest/TestMu, BrowserStack, Sauce
Labs, or a self-hosted server behind a reverse proxy) instead of spawning a
local `appium`. In this mode `aco` does not launch a local server, returns
immediately after the session is created (the session is reaped later by
`aco session stop`), and the local-server flags above are ignored. Supply BASIC
auth with `--username`/`--password`, the `--auth user:pass` shorthand, or the
`ACO_REMOTE_USERNAME`/`ACO_REMOTE_PASSWORD` env vars — credentials are sent
**only on session creation** (`POST /session`), never on subsequent commands,
and are never written to the session record (which stores only the URL). The
consumer commands then attach with the stored `--server-url` and need no auth.

When a farm needs a vendor-specific capability shape that aco's per-flag caps
can't express (LambdaTest's `lt:options`, BrowserStack's `bstack:options`,
etc.), pass the entire W3C capabilities object verbatim with
`--caps-json '<json>'` (or `--caps-json @caps.json` to read from a file). It
replaces the aco-built capabilities entirely, so the per-device flags (`--app`,
`--device-name`, `--udid`, ...) are ignored (aco warns if you pass them); any
`--cap key=value` entries still shallow-merge on top. `--platform` is still
required — it is recorded for the consumer commands' `mobile:` dispatch, not
sent as a capability.

### Drive the session

`--session`, `--server-url`, and `--platform` are optional with a live local
session; pass them explicitly for remote/grid sessions.

```sh
aco source                                                    # full page source
aco source --xpath '//XCUIElementTypeButton[@name="Login"]'   # filter locally
aco elements                                                  # labelled elements + tap selectors
aco elements --json | jq -r '.[].selector'                    # just the selectors
aco screenshot --out ./shot.png
aco tap        --x 100 --y 200
aco tap        --selector 'accessibility id:login.button'
aco swipe      --direction up                                 # within the default scroll view
aco swipe      --direction left --label home.carousel         # within a labelled element
aco send-keys  --selector 'accessibility id:login.username' --text 'alice'   # clears, then types
aco send-keys  --label login.username --text '!' --no-clear                  # append instead
aco scroll-into-view "accessibility id:gestures.row.29" --direction up       # swipe until visible
aco actions    --gesture "move 200 600 0, down, move 200 200 300, up"        # raw W3C pointer
aco actions    --type "hello"                                                # raw W3C key
aco element find  --using "accessibility id" --value "Login"
aco element click --element <element-id>
aco context list
aco context switch --name WEBVIEW_com.example   # enter the web context, then:
aco web url https://example.com                 # navigate the active WebView

# Explicit targeting (remote/grid):
aco source --session <sid> --server-url http://10.0.0.5:4799 --platform ios
```

### Platform `mobile:` extensions

Every `mobile:` extension the drivers advertise is a first-class command under a
platform namespace. Flags map 1:1 to the driver's params and coerce to the
declared type.

```sh
aco ios --help                 # all XCUITest mobile: extensions
aco android --help             # all UiAutomator2 / Android extensions
aco ios swipe --direction up
aco ios scroll --toVisible true --distance 0.5
aco android shell --command "getprop ro.product.model"
aco ios <cmd> --help           # see each param's type
```

`mobile:` names are snake-cased to subcommands (`mobile: doubleTap` →
`aco ios double-tap`); `--<param>` flags keep the driver's camelCase names.

```sh
aco mobile list                # what the connected driver actually advertises
aco mobile call --name "mobile: swipe" --args '{"direction":"up"}'   # unvalidated escape hatch
```

### Inspect / stop sessions

```sh
aco session list                    # startedAt, platform, pid, alive, url, sessionId
aco session list --json
aco session list --prune            # delete records for dead servers / crashed children

aco session stop                    # stop the latest live session
aco session stop --session <sid>    # stop a specific one
aco session stop --all              # stop every stored session
```

## Troubleshooting

- **`Insecure feature 'adb_shell' not enabled`** when calling `mobile: shell` on
  Android: start the session with `--cap appium:allowInsecure='["adb_shell"]'`.
- **`appium not found on PATH`** when running `aco session start`: install Appium
  (`npm i -g appium`) and verify `which appium` resolves.
- **`unknown command (script)`** from `aco mobile call` or a generated
  `aco ios`/`aco android` command: the connected server runs a driver version
  that does not expose that extension. Run `aco mobile list` to see what it
  advertises.

## Development

Tool versions are pinned in `mise.toml` -- install [mise](https://mise.jdx.dev)
and run `mise install` to match.

```sh
pnpm install
pnpm dev --help                 # one-shot run via tsx
pnpm dev:watch --help           # rerun on file changes
pnpm typecheck                  # tsc --noEmit
pnpm test                       # vitest run
pnpm gen:extensions             # regenerate src/data/extensions-*.json from driver source
pnpm build                      # produce dist/cli.js via tsup
```

See `CLAUDE.md` for the driver-snapshot workflow and the rules for adding new
`mobile:` wrappers.

## Testing

An example Expo-based AUT (App Under Test) lives under [`aut/`](./aut/), with one
screen per `aco` command family.

```sh
pnpm aut:install                # install AUT deps (~200MB, one-time)
pnpm aut:prebuild               # generate aut/ios and aut/android
pnpm aut:build:ios              # build .app for the iOS Simulator
pnpm aut:build:android          # build .apk for an Android emulator
```

See [`aut/README.md`](./aut/README.md) for the screen-to-command map.

## License

MIT
