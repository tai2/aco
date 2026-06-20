# aco -- Appium Command-line Operator

[![ci](https://github.com/tai2/aco/actions/workflows/ci.yml/badge.svg)](https://github.com/tai2/aco/actions/workflows/ci.yml)

Drive an Appium session from the shell. Boot a sidecar Appium server, create a
session against an AUT, then send single Appium commands as individual shell
invocations -- no client-script scaffolding required.

`aco` assumes you have already installed Appium and the drivers you need
(`npm i -g appium`, `appium driver install xcuitest`, etc.). It spawns the
`appium` binary from your `PATH`; it does not redistribute Appium itself.

## Install

```sh
npm i -g aco
```

Or run without installing:

```sh
npx aco --help
```

## Usage

The CLI has two command classes: a session starter, and a family of single-shot
client wrappers that attach to an already-running session.

### 0. Discover what you can target

Before starting a session, list every iOS Simulator and Android AVD on your
machine. `aco` looks at `xcrun simctl list devices -j` for iOS and the AVDs
under `$ANDROID_AVD_HOME` (falling back to `$ANDROID_EMULATOR_HOME` and
`~/.android/avd`) for Android. Pipe the row's `NAME` into
`session start --device-name` (iOS) or `--avd` (Android), or its `ID` into
`--udid` (iOS).

```sh
aco device list                          # both platforms, only "available" rows
aco device list --platform ios           # iOS Simulators only
aco device list --state all --json       # everything, machine-readable
```

### 1. Start a session (foreground)

```sh
# iOS simulator
aco session start --platform ios --app /tmp/MyApp.app --device-name "iPhone 15"
# {"sessionId":"00000000-0000-0000-19E2-000000000000","serverUrl":"http://127.0.0.1:4723","platform":"ios","pid":54231}
# session ready -- press Ctrl-C to stop

# Android emulator
aco session start --platform android --app com.example.app --app-activity .MainActivity --avd Pixel_8_API_34

# Forward extra Appium server flags (debug logging, activate a plugin, etc.)
aco session start --platform android --log-level debug --use-plugins images
```

`session start` forwards a curated subset of Appium's server flags to the
spawned sidecar -- `--base-path`, `--log-level`, `--address`, `--relaxed-security`,
`--allow-cors`, `--allow-insecure` / `--deny-insecure`, `--use-drivers` /
`--use-plugins`, and the `--keep-alive-timeout` / `--request-timeout` /
`--shutdown-timeout` knobs. See `aco session start --help` for the full list and
defaults.

`session start` blocks on the TTY. Ctrl-C (or SIGTERM / SIGHUP) tears down the
W3C session and stops the Appium child cleanly. Pass `--log` to also stream the
Appium server log to stdout (it interleaves with the JSON line -- omit `--log`
in scripts).

On success, `aco` writes a small per-session record to
`~/.aco/sessions/<sessionId>.json` so subcommands can default to that session.
The record is removed when the foreground process exits cleanly.

### 1b. Start a session in the background

```sh
aco session start --detach --platform ios --app /tmp/MyApp.app
# {"sessionId":"...","serverUrl":"http://127.0.0.1:4723","platform":"ios","pid":54231}
# session detached -- pid 70011, stop with `aco session stop`
```

`--detach` re-spawns `aco` in the background, prints the session envelope, and
exits. Tear it down with `aco session stop` (see below). Detached output is
captured at `~/.aco/logs/aco-detach-<parent-pid>.log` for postmortem debugging.

### 2. Drive the session from a second shell

```sh
# With a live local session, all three flags are optional -- they're resolved
# from the latest record under ~/.aco/sessions/.
aco source
aco screenshot --out ./shot.png
aco tap        --x 100 --y 200
aco swipe      --direction up
aco element find  --using "accessibility id" --value "Login"
aco element click --element <element-id>
aco context list

# You can still be explicit (required for remote/grid sessions):
aco source     --session <sid> --platform ios
aco source     --session <sid> --server-url http://10.0.0.5:4799 --platform ios
```

### 3. Inspect / call any `mobile:` extension

```sh
aco mobile list --platform ios
aco mobile list --platform ios --versions    # show the pinned driver versions
aco mobile call --name "mobile: swipe" --args '{"direction":"up"}'
```

### 4. Inspect / stop stored sessions

```sh
aco session list                    # table: startedAt, platform, pid, alive, url, sessionId
aco session list --json             # machine-readable, with liveness annotations
aco session list --prune            # delete records for dead servers / crashed children

aco session stop                    # stop the latest live session
aco session stop --session <sid>    # stop a specific one
aco session stop --all              # stop every stored session
```

`session stop` calls `deleteSession` on the W3C server, SIGTERMs the recorded
Appium child pid, and unlinks the record.

## Troubleshooting

- **`Insecure feature 'adb_shell' not enabled`** when calling `mobile: shell`
  on Android: start the session with
  `--cap appium:allowInsecure='["adb_shell"]'`.
- **`appium not found on PATH`** when running `aco session start`: install
  Appium first (`npm i -g appium`) and verify `which appium` resolves.
- **`unknown command (script)`** from `aco mobile call`: the connected Appium
  server runs a driver version that does not expose that `mobile:` extension.
  Compare `aco mobile list --platform <p> --versions` against the server's
  driver version.

## Development

Tool versions (Node, pnpm) are pinned in `mise.toml` — install [mise](https://mise.jdx.dev) and run `mise install` to match.

```sh
pnpm install
pnpm dev --help                 # one-shot run via tsx
pnpm dev:watch --help           # same, but rerun on file changes
pnpm typecheck                  # tsc --noEmit
pnpm test                       # vitest run
pnpm gen:method-map             # regenerate src/data/method-map-*.json
pnpm build                      # produce dist/cli.js via tsup
```

See `CLAUDE.md` for the driver-snapshot workflow and the rules for adding new
`mobile:` wrappers.

## Testing

An example Expo-based AUT (App Under Test) lives under [`aut/`](./aut/).
It exposes one screen per `aco` command family and is what the
forthcoming e2e suite drives.

```sh
pnpm aut:install                # install AUT deps (~200MB, one-time)
pnpm aut:prebuild               # generate aut/ios and aut/android
pnpm aut:build:ios              # build .app for the iOS Simulator
pnpm aut:build:android          # build .apk for an Android emulator
```

See [`aut/README.md`](./aut/README.md) for the screen-to-command map.

## License

MIT
