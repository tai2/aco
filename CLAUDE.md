# aco -- Notes for Claude Code

`aco` is a CLI on top of Appium. Two command classes:

1. `aco session start` -- spawns the user's `appium` (from `PATH`) and creates a
   W3C session against an AUT. Runs in the foreground by default
   (Ctrl-C tears it down); pass `--detach` to fork it into the background.
   `aco session list` and `aco session stop` inspect/tear down stored sessions.
2. Everything else (`aco source`, `aco screenshot`, `aco element ...`,
   `aco tap`, `aco swipe`, `aco context ...`, `aco mobile call`) -- attaches to
   an existing session. `--session <id>`, `--server-url <url>`, and
   `--platform <ios|android>` are all optional: by default they are resolved
   from the latest live record under `~/.aco/sessions/`. Explicit flags
   always win. When no session has been started and no flags are passed, the
   resolver errors out cleanly.

We do **not** redistribute Appium or its drivers inside the `aco` package. We
assume the user has installed Appium themselves (`npm i -g appium`) and added
the drivers they need (`appium driver install xcuitest`, etc.). `aco session
start` spawns `appium` by name from `PATH`; driver discovery is left to the
user's `APPIUM_HOME`.

`~/.aco/sessions/<sessionId>.json` is a **convenience layer for default
resolution**, not a registry the subcommands depend on. With explicit
`--session`/`--server-url`/`--platform` flags, subcommands remain fully
stateless and can still attach to any running Appium session (one created by
raw `appium`, one on a remote grid, etc.). `aco session start` writes the
record on success and unlinks it on graceful teardown; crash exits intentionally
leave the file so `session list --prune` can surface it. The other on-disk
artifact `aco` produces is `~/.aco/logs/appium-<port>.log` written by
`session start` for postmortem debugging.

## Background: the three kinds of Appium command

There are three families of commands an Appium server accepts, and `aco`
exposes wrappers from all three. Knowing which family a wrapper belongs to is
useful when you add a new one:

1. **W3C WebDriver commands** -- the cross-platform protocol baseline:
   `GET /source`, `GET /screenshot`, `POST /element`, `POST /element/:id/click`,
   `GET/POST /context`, etc. These work on _any_ driver. `aco source`,
   `aco screenshot`, `aco element ...`, and `aco context ...` are wrappers over
   this layer.
2. **Legacy Appium endpoints** under `/session/:id/appium/...` (e.g.
   `/appium/device/lock`). Almost all of these have been superseded by the
   modern `mobile:` extensions below and we intentionally do **not** wrap them
   directly. If a user needs one, they can `curl` the server themselves or
   call the modern equivalent via `aco mobile call`.
3. **Modern `mobile:` extensions** -- driver-specific commands invoked via the
   W3C `POST /execute/sync` endpoint with a `script` of `mobile: <name>` (e.g.
   `mobile: tap`, `mobile: swipeGesture`, `mobile: shell`). The set of names
   and their `{ required, optional }` parameters is defined by each driver in
   its `build/lib/execute-method-map.js` export. `aco tap`, `aco swipe`, and
   the generic `aco mobile call` escape hatch are wrappers over this layer.

**Device discovery.** `aco device list` enumerates iOS Simulators (via
`xcrun simctl list -j devices`) and Android AVDs (via the
`$ANDROID_AVD_HOME`/`$ANDROID_EMULATOR_HOME`/`~/.android/avd` fallback chain
that `appium-adb`'s `listEmulators()` uses). We do **not** depend on
`node-simctl` or `appium-adb` at runtime — both are transitive devDeps from
the driver packages. The same "snapshot at build time, don't share fate with
driver releases" principle that governs `src/data/method-map-*.json` applies
here: discovery is a thin in-process wrapper around `xcrun` / the AVD
directory, not a runtime import of the community packages.

## How we stay in sync with Appium

Even though we don't ship the drivers at runtime, we still need to know what
`mobile:` extensions each driver advertises so `aco mobile list` / `aco mobile
call` can validate calls before sending them. We solve that by _pinning_ exact
driver versions in `devDependencies` and **snapshotting the relevant
interfaces at build time**.

- `appium-xcuitest-driver` exports `build/lib/execute-method-map.js`
  (~103 `mobile:` entries on the pinned 11.9.0). Each entry has
  `{ command, params: { required?, optional? } }`.
- `appium-uiautomator2-driver` exports `build/lib/execute-method-map.js`
  which spreads `appium-android-driver/build/lib/execute-method-map.js`
  (~72 entries) into 32 own entries.

`scripts/generate-method-map.ts` reads those modules from the local
`node_modules` and writes the contents to `src/data/method-map-ios.json` and
`src/data/method-map-android.json`. Each snapshot is written as an envelope
`{ drivers: [{ package, version }, ...], methods: { ... } }` so the bundled
CLI carries provenance for which driver release the extension list was
generated from. Users can surface this with `aco mobile list --platform <p>
--versions`. Those JSON files are committed and imported by
`src/lib/method-map.ts`. The runtime CLI never touches the driver packages.

When adding a new `mobile:` wrapper (`aco tap`, `aco swipe`, ...):

1. Open both driver maps (or the committed JSON snapshots under `src/data/`)
   and find the corresponding `mobile: ...` entry.
2. Decide whether the new command needs a `--platform`-aware shim (because
   the iOS and Android entries take different params) or whether one path
   exists on both drivers with identical shape.
3. Map CLI flags 1:1 to the entry's `required` + `optional` keys. Do not
   invent extra keys -- Appium's base-driver silently drops unknown ones,
   so a typo in an arg name becomes a silently ignored call rather than a
   loud error.
4. If the command does not yet appear in the pinned snapshot, bail out with
   a helpful "unknown extension" error rather than sending to Appium and
   letting it return W3C 405.

If the _connected_ Appium server happens to expose a different driver version
than the one we snapshot-pinned, the W3C error is surfaced verbatim
(`unknown command (script)`). We do **not** silently fall back to the legacy
`/appium/...` endpoints; if WebdriverIO does so internally for its own
high-level methods (e.g. `getContexts`), we let it -- but `aco mobile call`
does not invent alternate encodings on the user's behalf. Surfacing Appium's
own error keeps the failure mode legible and lets the user choose how to
route around it.

## Updating the pinned drivers

```sh
pnpm up appium-xcuitest-driver appium-uiautomator2-driver
pnpm gen:method-map      # rewrites src/data/method-map-*.json from the new devDeps
git diff src/data/       # eyeball what changed
# After bumping, audit each --platform-aware command in src/commands/
# for params that may have been renamed or removed.
```
