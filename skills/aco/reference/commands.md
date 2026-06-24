# aco command catalog

Full flag reference. Session-attached commands (everything except
`session start/list/stop`, `status`, and `device list`) share three connection
flags — `-s, --session <id>`, `-S, --server-url <url>`, `-p, --platform
<ios|android>` — which all default-resolve from the session store; explicit
flags always win. See `troubleshooting.md` for the resolution rules.

## Session lifecycle

### `aco session start`
Spawns a local `appium` (or attaches to a remote one) and creates a W3C session.
Foreground by default (Ctrl-C tears down). **From an agent, ALWAYS pass
`--detach`** — foreground blocks the shell until Ctrl-C.

| Flag | Notes |
|---|---|
| `-p, --platform <ios\|android>` | **required** |
| `-a, --app <path-or-id>` | AUT build path (pass the archive as-is — see below), or bundleId/appPackage |
| `-A, --app-activity <activity>` | Android only; required when `--app` is an appPackage id |
| `-d, --device-name <name>` | `appium:deviceName` |
| `-V, --platform-version <ver>` | `appium:platformVersion` |
| `-u, --udid <udid>` | `appium:udid` |
| `--avd <name>` | Android only; AVD to boot |
| `--xcode-org-id <id>` | iOS real device — WDA signing (Team ID) |
| `--xcode-signing-id <id>` | iOS real device |
| `--allow-provisioning-device-registration` | iOS real device |
| `--updated-wda-bundle-id <id>` | iOS real device |
| `--port <port>` | default 4723 (auto-bumped if busy) |
| `-S, --server-url <url>` | attach to remote Appium; local-server flags ignored; stores `pid: 0`; exits immediately |
| `--username <user>` / `--password <pass>` | BASIC auth (remote, session-create only) |
| `--auth <user:pass>` | shorthand; can't combine with `--username/--password` |
| `--cap <key=value...>` | extra W3C capability, repeatable, JSON-parsed per value |
| `--caps-json <json>` | verbatim W3C caps object (or `@file`); bypasses `buildCapabilities` and auto device-detection |
| `--allow-insecure <feature...>` | Appium `--allow-insecure` |
| `--deny-insecure <feature...>` | Appium `--deny-insecure` (deny wins) |
| `--relaxed-security` | Appium `--relaxed-security` |
| `--allow-cors` | Appium `--allow-cors` |
| `--base-path <path>` | URL prefix for WebDriver routes |
| `--log-level <level>` | Appium server log level |
| `--use-drivers <name...>` / `--use-plugins <name...>` | restrict drivers / enable plugins |
| `--address <host>` | bind interface (default 127.0.0.1) |
| `--keep-alive-timeout <s>` / `--request-timeout <s>` / `--shutdown-timeout <ms>` | server timeouts |
| `--session-timeout <s>` | session-create wait (default 300s) |
| `--log` | tee Appium log to stdout |
| `--detach` | background (no-op with `--server-url`) |

Credentials also fall back to `ACO_REMOTE_USERNAME` / `ACO_REMOTE_PASSWORD`.
`session start` **always** prints a JSON envelope `{sessionId, serverUrl,
platform, pid, ...}` on stdout — there is **no `--json` flag**, and passing one
errors. (For verbatim W3C caps use `--caps-json`, listed above.)

**`--app` takes the build archive as-is — do NOT unzip it first.** The Appium
driver handles extraction. iOS (XCUITest) accepts a `.zip`/`.app.zip`/`.ipa` (or
an unzipped `.app` directory); Android (UiAutomator2) accepts an `.apk`/`.apks`.
Manually unzipping a `.app.zip` down to a bare `.app` just to pass it is a
common mistake — hand the original archive to `--app` directly.

### `aco session list [--json] [--prune]`
Lists records in `~/.aco/sessions`, annotating each with liveness. `--prune`
deletes records whose `alive === false`.

### `aco session stop [-s, --session <id>] [--all]`
`deleteSession` + SIGTERM the Appium child (when `pid !== 0`) + remove record.
Default target is the latest live session.

## W3C wrappers (session-attached; connection flags default-resolve)

- `aco source [-x, --xpath <expr>]` — page source; `--xpath` filters **locally**
  (client-side `xpath`/`@xmldom/xmldom`), not server-side.
- `aco elements [--json] [--limit <n>]` — lists on-screen elements that carry
  text + a ready-to-paste tap selector.
- `aco screenshot [-o, --out <path>]` — writes PNG to `--out`, else base64 to
  stdout.
- `aco tap` — real W3C pointer via `POST /actions`. Target by `--selector` |
  `-l, --label` (→ `accessibility id:<label>`) | `-e, --element`, or absolute
  `-x/-y`. `-d, --duration <ms>` (default 100).
- `aco swipe` — WebdriverIO cross-platform `swipe`. Container via
  `--selector`/`-l, --label`/`-e, --element`; `-d, --direction` (default up),
  `--duration` (1500), `--percent` (0.95), `--from`/`--to` absolute coords.
- `aco send-keys` — type into an element. Target via selector/label/element;
  `-t, --text` **required**; `--no-clear` to append (default clears first).
- `aco scroll-into-view <selector>` — positional selector; `-d, --direction`,
  `--max-scrolls`, `--duration`, `--percent`, `--scrollable <selector>`.
- `aco actions` — raw W3C pointer/key. `-g, --gesture <steps>` (repeatable
  parallel chains), `-t, --type <text>`, `-j, --json <array>` (mutually
  exclusive with gesture/type), `--pointer-type` (touch/mouse/pen),
  `--no-release`, `--release-only`.
- `aco status` — `GET /status`, no session required.
- `aco wait` — poll for an element state. `-u, --using` + `-v, --value`
  **required**; `--for displayed|enabled|exists` (default displayed),
  `--timeout` (10000), `--interval` (250).

## Element group

`aco element <leaf>` (`src/commands/element/*`). Element ids are unwrapped from
the W3C `element-6066-11e4-...` key automatically.

- `find -u, --using <strategy> -v, --value <value> [--all]`
- `active`
- `click -e, --element <id>`
- `text -e <id>`
- `send-keys -e <id> -t, --text <text>`
- `attribute -e <id> -n, --name <name>`
- `property -e <id> -n, --name <name>`
- `displayed -e <id>`
- `enabled -e <id>`
- `selected -e <id>`
- `rect -e <id>`
- `clear -e <id>`

## Context / web

- `aco context list`
- `aco context current`
- `aco context switch -n, --name <ctx>`
- `aco web url [url]` (get/set), `aco web back`, `aco web forward`,
  `aco web refresh`

## Inspection / config

- `aco settings get`
- `aco settings set --set key=value... [-j, --json]` (at least one `--set`/JSON)
- `aco window rect`
- `aco orientation get` / `aco orientation set <PORTRAIT|LANDSCAPE>`
- `aco timeouts get` / `aco timeouts set` (`--implicit`/`--page-load`/`--script`,
  at least one)
- `aco device list [-p, --platform <ios|android>] [--state available|booted|all] [--json]`
  (default state `available`)

## Platform `mobile:` extensions

- `aco ios <cmd>` / `aco android <cmd>` — **generated** from the pinned driver
  manifests (~103 iOS / ~104 Android). `mobile: doubleTap` → `aco ios
  double-tap`; each param becomes a `--<camelCaseName> <value>` flag
  (`requiredOption` vs `option` per the manifest, coerced to number/boolean/
  string). The set tracks the pinned driver version, so **discover live**:
  `aco mobile list --json`, then `aco ios <cmd> --help` for that command's flags.
- `aco mobile list [--json]` — live `GET /appium/extensions`; what the connected
  driver actually advertises (may differ from the pinned manifest).
- `aco mobile call -n, --name "mobile: x" -a, --args '<json>'` — **unvalidated**
  escape hatch; forwards name + JSON args verbatim (the server validates and
  silently drops unknown keys).
