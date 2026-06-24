# aco -- Notes for Claude Code

## Documentation style: README vs. CLAUDE.md

`README.md` is for **users** and is **usage-first**. Keep it concise: lead with
runnable commands and short, scannable examples. Each section should be mostly
code blocks with brief one-line framing. Avoid long prose paragraphs that
explain *how* or *why* a feature works internally (auth wiring, capability
merge order, resolution fallbacks, process lifecycle, etc.) -- prefer an inline
`# comment` in the example or a single short sentence. If you find yourself
writing a multi-sentence paragraph of mechanics, it belongs here in `CLAUDE.md`,
not in the README. When you add behavior, document the *rationale and internals*
in `CLAUDE.md` and only the *how-to-use* in the README.

`aco` is a CLI on top of Appium. Two command classes:

1. `aco session start` -- spawns the user's `appium` (from `PATH`) and creates a
   W3C session against an AUT. Runs in the foreground by default
   (Ctrl-C tears it down); pass `--detach` to fork it into the background.
   Targets simulators/emulators and **real devices**: with no `--udid`/`--avd`
   it prefers a connected real device, falling back to auto-booting the first
   Android AVD. iOS real devices take code-signing flags (`--xcode-org-id`,
   `--xcode-signing-id`, `--allow-provisioning-device-registration`,
   `--updated-wda-bundle-id`) that map to the corresponding `appium:*` caps.
   Pass `--server-url <url>` to attach to an **already-running remote Appium
   server** (a device-farm grid such as TestMu/LambdaTest, BrowserStack, or
   Sauce Labs) instead of spawning a local one -- in that mode no local `appium`
   is launched, the local-server flags are ignored, the record stores `pid: 0`,
   and the command exits immediately (like `--detach`) since there is no local
   process to own. BASIC auth (`--username`/`--password`, the `--auth user:pass`
   shorthand, or `ACO_REMOTE_USERNAME`/`ACO_REMOTE_PASSWORD`) is forwarded via
   WebdriverIO's `user`/`key`, which attaches `Authorization: Basic` **only to
   the `POST /session` request** -- matching the verified device-farm contract
   that only session creation needs auth -- and is never written to the session
   record. For farms whose capability shape aco's per-flag caps can't express
   (LambdaTest's `lt:options`, BrowserStack's `bstack:options`, ...), pass the
   entire W3C capabilities object verbatim with `--caps-json '<json>'` (or
   `--caps-json @file`): it bypasses `buildCapabilities` entirely (the per-device
   flags and the device auto-detection step are skipped), with any `--cap`
   entries shallow-merged on top. `aco session list` and `aco session stop`
   inspect/tear down stored sessions (a remote `pid: 0` record is torn down by
   `deleteSession` alone).
2. Everything else (`aco source`, `aco screenshot`, `aco element ...`,
   `aco tap`, `aco swipe`, `aco context ...`, `aco ios ...`, `aco android ...`,
   `aco mobile call`) -- attaches to
   an existing session. `--session <id>`, `--server-url <url>`, and
   `--platform <ios|android>` are all optional: by default they are resolved
   from the latest live record under `~/.aco/sessions/`. Explicit flags
   always win. When no session has been started and no flags are passed, the
   resolver errors out cleanly.

We do **not** redistribute the Appium server or its drivers inside the `aco`
package. We assume the user has installed Appium themselves (`npm i -g appium`)
and added the drivers they need (`appium driver install xcuitest`, etc.). `aco
session start` spawns `appium` by name from `PATH`; driver discovery is left to
the user's `APPIUM_HOME`. This rule covers the server and the driver packages
only — smaller utility libraries from the Appium ecosystem (e.g. `appium-adb`,
`appium-ios-device`) are fine to take as direct deps; see "Device discovery"
below.

`~/.aco/sessions/<sessionId>.json` is a **convenience layer for default
resolution**, not a registry the subcommands depend on. With explicit
`--session`/`--server-url`/`--platform` flags, subcommands remain fully
stateless and can still attach to any running Appium session (one created by
raw `appium`, one on a remote grid, etc.). `aco session start` writes the
record on success and unlinks it on graceful teardown; crash exits intentionally
leave the file so `session list --prune` can surface it. The other on-disk
artifact `aco` produces is `~/.aco/logs/appium-<port>.log` written by
`session start` for postmortem debugging.

## Node 26+ forbidden request headers (`UND_ERR_INVALID_ARG`)

`src/lib/wd-client.ts` passes a `transformRequest` hook (`stripForbiddenHeaders`)
to **both** `remote()` (session creation) and `attach()` (every subcommand).
`webdriver@9`'s transport sets two Fetch-spec **forbidden request headers** by
hand: `Connection: keep-alive` (its `DEFAULT_HEADERS`) and a `Content-Length` it
computes for any request with a body. Node `<=25` silently dropped them; Node
`>=26` enforces the spec and rejects the request, so **every** WebDriver call
fails with `WebDriverError: Request failed with error code UND_ERR_INVALID_ARG`
(only the body-bearing POSTs strictly need `Content-Length` stripped, but we drop
both to match the upstream root cause). This is why a published `aco` running
under a Homebrew/system Node 26 fails while `pnpm dev` -- pinned to the project's
Node `<=25` toolchain -- works with identical args. The hook deletes both
headers before the request is built; the Fetch layer recomputes `Content-Length`
from the body and manages connection reuse itself, and on Node `<=25` deleting
absent headers is a harmless no-op. Tracking webdriverio#15265; remove the hook
once that ships an upstream fix.

## Background: the three kinds of Appium command

There are three families of commands an Appium server accepts, and `aco`
exposes wrappers from all three. Knowing which family a wrapper belongs to is
useful when you add a new one:

1. **W3C WebDriver commands** -- the cross-platform protocol baseline:
   `GET /source`, `GET /screenshot`, `POST /element`, `POST /element/:id/click`,
   `GET/POST /context`, `POST /actions`, etc. These work on _any_ driver.
   `aco source`, `aco screenshot`, `aco element ...`, `aco context ...`,
   `aco actions`, `aco tap`, and `aco swipe` are wrappers over this layer.
   (`aco tap` issues a real W3C pointer gesture via `POST /actions` so the touch
   bubbles up the native view hierarchy, rather than dispatching a `mobile:`
   extension. `aco swipe` calls WebdriverIO's cross-platform `swipe`, which is
   likewise a W3C pointer gesture under the hood -- not a `mobile:` extension.)
2. **Legacy Appium endpoints** under `/session/:id/appium/...` (e.g.
   `/appium/device/lock`). Almost all of these have been superseded by the
   modern `mobile:` extensions below and we intentionally do **not** wrap them
   directly. If a user needs one, they can `curl` the server themselves or
   call the modern equivalent via `aco mobile call`.
3. **Modern `mobile:` extensions** -- driver-specific commands invoked via the
   W3C `POST /execute/sync` endpoint with a `script` of `mobile: <name>` (e.g.
   `mobile: tap`, `mobile: swipeGesture`, `mobile: shell`). The set of names
   and their `{ required, optional }` parameters is defined by each driver in
   its `build/lib/execute-method-map.js` export. **Every** such extension is a
   generated first-class command under `aco ios <name>` / `aco android <name>`
   (see "How we stay in sync with Appium"); and `aco mobile call` is the
   generic unvalidated escape hatch. (`aco tap` and `aco swipe` used to be
   `mobile:` shims but are now W3C pointer wrappers -- `aco tap` over `POST
   /actions` and `aco swipe` over WebdriverIO's cross-platform `swipe` -- see
   family 1 above.)

**Device discovery.** `aco device list` enumerates four kinds of target:
iOS Simulators (via `xcrun simctl list -j devices`, in `src/lib/devices/ios.ts`),
**connected iOS real devices** (via `appium-ios-device`'s
`utilities.getConnectedDevices`/`getDeviceName`/`getOSVersion`, in
`ios-real.ts`), Android AVD *definitions* (via the
`$ANDROID_AVD_HOME`/`$ANDROID_EMULATOR_HOME`/`~/.android/avd` fallback chain, in
`android.ts`), and **connected Android devices + running emulators** (via
`appium-adb`'s `ADB.createADB().getConnectedDevices({ verbose: true })`, in
`android-real.ts`). `src/lib/devices/index.ts` fans out to all four and
reconciles: a running emulator surfaces by its `adb` serial and the matching AVD
`.ini` definition row is collapsed into it (keyed on the `model:` AVD name from
the `adb devices -l` long format). Each lister returns `{ devices, notes }` and
**never throws** — every failure (no `adb`, no `usbmuxd`, locked/untrusted
device) degrades to a friendly note so the rest of the list still renders.

The two real-device listers load `appium-adb`/`appium-ios-device` via a
**guarded dynamic `import()`**, not a static top-level import. This is
deliberate: those packages pull in `@appium/support` → `read-pkg` (ESM-only) →
`unicorn-magic`, whose subpath exports the `tsx` dev runtime (`pnpm dev`) cannot
resolve (`ERR_PACKAGE_PATH_NOT_EXPORTED`); a static import would crash the whole
CLI at startup there. With the dynamic import, a resolution failure degrades to
an "unavailable in this runtime" note, so `pnpm dev` still lists simulators/AVDs
while the built `node dist` runtime (Node's native resolver) is fully
functional. It also keeps these libraries off the CLI startup path.

The constraint here is about **redistribution, not dependency**: we don't ship
the Appium server or the heavyweight driver packages (see above), but small,
focused utility packages — `appium-adb` and `appium-ios-device` — are direct
runtime `dependencies` of `aco` (they are what `ios-real.ts`/`android-real.ts`
import) precisely because they're the right tool for enumerating connected real
devices over USB. Prefer them over hand-rolling `adb`/`xcrun`/protocol plumbing.
This differs from `src/data/extensions-*.json`, which we snapshot at build
time precisely to avoid sharing release-fate with the *driver* packages; that
"snapshot, don't import" rule applies to the drivers, not to standalone
utility libraries like these. (`appium-ios-device` ships no types, so
`src/types/appium-ios-device.d.ts` is an ambient shim for the `utilities` we
use.) We also depend on `@appium/logger` (a small, clean utility package) so
`src/lib/devices/appium-log.ts` can lower the process-global appium log level to
`warn` — without it, `appium-ios-device`/`appium-adb` spew debug-level
`usbmuxd`/`adb` stack traces to stderr on every `aco device list` with no real
device attached. We do **not** depend on `@appium/support` for this (it drags in
the same `read-pkg`/`unicorn-magic` chain noted above).

## How we stay in sync with Appium

Every `mobile:` extension is a **generated first-class command**
(`aco ios <name>` / `aco android <name>`). To generate good commands we need not
just each extension's param *names* but their *types and optionality* — which
the execute-method-map alone does not carry. So we _pin_ exact driver versions
in `devDependencies` and **derive a typed manifest from the driver source at
build time**.

Two source artifacts per driver feed the generator:

- `build/lib/execute-method-map.js` — the name→command mapping and the
  `{ required?, optional? }` param-name lists. `appium-xcuitest-driver` exports
  ~103 entries (pinned 11.9.0). `appium-uiautomator2-driver` spreads
  `appium-android-driver`'s map into its own for ~104 entries total.
- `build/lib/commands/*.d.ts` — each `mobile:` entry's `command` field names the
  implementing function (e.g. `mobile: scroll` → `mobileScroll`), whose shipped
  TypeScript signature carries the real parameter types (`Direction`, `boolean`,
  `number`, `Element | string`, …) and which are optional.

`scripts/generate-extensions.ts` reads both, resolving each `command` to its
declaring function, and reduces every param's source type to one of three
coercion kinds: `number`, `boolean`, or `string` (the fallback for element ids,
unions, arrays/objects, and anything else we cannot confidently reduce). It
writes `src/data/extensions-ios.json` and `src/data/extensions-android.json` as
envelopes `{ drivers: [{ package, version }, ...], extensions: { "mobile: x":
{ command, params: [{ name, required, kind }] } } }` — provenance plus a typed
manifest. Those JSON files are committed and imported by `src/lib/manifest.ts`
(`loadManifest(platform)`); `src/commands/platform-extensions.ts` iterates the
manifest at CLI-registration time to register every `aco ios`/`aco android`
command, mapping each param to a `--<param>` flag that coerces by `kind`. The
runtime CLI never touches the driver packages.

Promotion is **generated** — there is no hand-written file per extension. There
are currently **no** hand-written `mobile:` shims: the cross-platform ergonomic
commands `aco tap` and `aco swipe` both ride the W3C pointer layer instead
(`aco tap` over `POST /actions`, `aco swipe` over WebdriverIO's cross-platform
`swipe`), so neither reads the live session's platform to pick a `mobile:` name.
Should you ever need to add a genuine `mobile:` shim (an ergonomic wrapper whose
iOS and Android entries take different params):

1. Find the corresponding `mobile: ...` entries in both committed manifests
   under `src/data/` (or the driver maps).
2. Decide whether it needs a `--platform`-aware shim (the iOS and Android
   entries take different params) — otherwise the generated `aco ios`/`aco
   android` command already covers it and no shim is needed.
3. Map CLI flags 1:1 to the entry's params. Do not invent extra keys —
   Appium's base-driver silently drops unknown ones, so a typo in an arg name
   becomes a silently ignored call rather than a loud error.

`aco mobile list` is a **live query** against the connected server
(`GET /session/:id/appium/extensions`), not a snapshot read: it reports what the
running driver actually advertises, which may be newer or older than our pinned
manifest. `aco mobile call` is an **unvalidated** escape hatch — it forwards the
name and JSON args verbatim with no local schema check (the server validates and
silently drops unknown keys). If the connected server exposes a different driver
version than the one we pinned, the W3C error is surfaced verbatim
(`unknown command (script)`) — we do **not** invent alternate encodings or fall
back to the legacy `/appium/...` endpoints. Surfacing Appium's own error keeps
the failure mode legible.

## Updating the pinned drivers

```sh
pnpm up appium-xcuitest-driver appium-uiautomator2-driver
pnpm gen:extensions      # rederives src/data/extensions-*.json (types + provenance) from the new devDeps
git diff src/data/       # eyeball what changed (new/removed commands, changed param types/optionality)
# The generated aco ios/android commands track the manifests automatically.
# aco tap/swipe ride the W3C pointer layer (not mobile:), so a driver bump
# does not affect their params.
```

## Example AUT

`aut/` is an Expo app used as the target for e2e testing. It is **not**
shipped with `aco` (the root `files: ["dist"]` in `package.json` keeps
the `aco` npm package lean). The AUT has its own `package.json` and
its own lockfile; root `pnpm install` does **not** pull in its deps.

Every instrumented element in the AUT uses both `testID` *and*
`accessibilityLabel` (set to the same string) via the helper
components in `aut/src/components/Probe.tsx`. The string constants
live in `aut/src/testids.ts`, which is the single source of truth that
the e2e suite will import. Do not inline testID strings anywhere
else.

`aut/src/testids.ts` **must stay import-free** — pure string constants
and helper functions with no React Native (or any runtime) imports. The
`e2e/` suite imports it directly across the `aut/` boundary
(`e2e/tsconfig.json` relaxes `verbatimModuleSyntax` so the CJS-detected
file type-checks); adding an RN import there would break the e2e
typecheck/transform.

To extend coverage for a new `aco` command:

1. Add the testID constant to `aut/src/testids.ts`.
2. Add a screen file under `aut/app/` (or amend an existing one).
3. Add a `<Link>` from `aut/app/index.tsx` to the new screen.
4. Update `aut/README.md`'s screen-to-command table.

## Claude Code skill / plugin

`skills/aco/SKILL.md` (+ `reference/`) is an Agent Skill that teaches Claude
Code to drive a live session through the installed `aco` binary; it shells out,
it does not import any source. `.claude-plugin/plugin.json` packages it as a
plugin and `.claude-plugin/marketplace.json` lists it so users can
`claude plugin marketplace add tai2/aco` + `claude plugin install aco@aco`. The
plugin root is the repo root (`"source": "."` in the marketplace), so the
component dir `skills/` sits at the repo root alongside `.claude-plugin/`.

Progressive disclosure: `SKILL.md` is the lean playbook; the full flag catalog
lives in `reference/commands.md` and failure modes in
`reference/troubleshooting.md`, loaded by Claude on demand. The skill is scoped
`allowed-tools: Bash(aco:*), Read` — auto-approve `aco` invocations and read the
screenshots it writes, nothing more.

The single most important behavioral instruction in the skill is **always pass
`--detach`**: `aco session start` is foreground by default and blocks until
Ctrl-C, so an agent's Bash call would otherwise hang.

This is a separate distribution channel from the npm package. `package.json`
keeps `files: ["dist"]`, so `skills/` and `.claude-plugin/` are deliberately
**not** in the tarball — `npm i -g @tai2/aco` gets the binary, `claude plugin
install` gets the skill.

When the CLI surface changes (a new top-level command, a renamed flag, or a
driver bump that adds/removes `aco ios`/`aco android` extensions), update
`reference/commands.md` to match. The generated platform extensions are
discoverable at runtime (`aco mobile list`, `aco ios --help`), so the skill
points there rather than enumerating all ~207 — only the hand-written command
families need to be kept in sync by hand.

Bump `.claude-plugin/plugin.json`'s `version` when you want installed users to
pick up skill changes — pushing commits alone does not update them. This version
is intentionally independent of `package.json`'s CLI version.
