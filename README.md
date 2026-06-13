# aco -- Appium Command-line Operator

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

### 1. Start a session (foreground)

```sh
# iOS simulator
aco session start --platform ios --app /tmp/MyApp.app --device-name "iPhone 15"
# {"sessionId":"00000000-0000-0000-19E2-000000000000","serverUrl":"http://127.0.0.1:4723","platform":"ios","pid":54231}
# session ready -- press Ctrl-C to stop

# Android emulator
aco session start --platform android --app com.example.app --app-activity .MainActivity --avd Pixel_8_API_34
```

`session start` blocks on the TTY. Ctrl-C (or SIGTERM / SIGHUP) tears down the
W3C session and stops the Appium child cleanly. Pass `--log` to also stream the
Appium server log to stdout (it interleaves with the JSON line -- omit `--log`
in scripts).

### 2. Drive the session from a second shell

```sh
# Subcommands take --session and --platform; --server-url defaults to http://127.0.0.1:4723.
aco source     --session <sid> --platform ios
aco screenshot --session <sid> --platform ios --out ./shot.png
aco tap        --session <sid> --platform ios --x 100 --y 200
aco swipe      --session <sid> --platform ios --direction up
aco element find  --session <sid> --platform ios --using "accessibility id" --value "Login"
aco element click --session <sid> --platform ios --element <element-id>
aco context list  --session <sid> --platform ios
```

### 3. Inspect / call any `mobile:` extension

```sh
aco mobile list --platform ios
aco mobile list --platform ios --versions    # show the pinned driver versions
aco mobile call --session <sid> --platform ios --name "mobile: swipe" --args '{"direction":"up"}'
```

### Remote / non-default endpoints

```sh
aco source --session <sid> --server-url http://10.0.0.5:4799 --platform ios
```

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

## License

MIT
