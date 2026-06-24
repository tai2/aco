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
