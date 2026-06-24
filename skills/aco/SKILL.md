---
name: aco
description: Drive a live Appium session from the shell with the aco CLI. Use when the user wants to interact with a running mobile app on an iOS simulator, Android emulator, or connected real device — tap, swipe, type, screenshot, read the screen/page source, find UI elements, switch to a WebView context, or call iOS/Android mobile: extensions. Triggers on "tap/screenshot/automate the app", "the simulator/emulator", "drive the iOS/Android app", "Appium session".
allowed-tools: Bash(aco:*), Read
---

# Driving Appium with `aco`

`aco` issues one Appium WebDriver command per shell invocation against a live
session. Prerequisite: the user has `aco` (`npm i -g @tai2/aco`) and `appium`
installed. If `aco --help` fails, stop and tell the user to install it.

## Core loop

1. **Discover a target** (only when starting fresh):
   `aco device list` (add `--platform ios|android`, `--state all`, `--json`).
2. **Start a session** — foreground blocks the shell, so ALWAYS pass `--detach`
   so control returns:
   `aco session start --detach --platform ios --app <path-or-bundleId> --device-name "<name>"`
   Android needs `--app-activity` when `--app` is an appPackage id, and `--avd`
   (or a plugged-in device) to choose the target.
   `session start` has **no `--json` flag** — it always emits the JSON envelope
   on stdout. Do not append `--json` (it errors); for verbatim W3C caps use
   `--caps-json '<json>'` instead.
   **Do NOT unzip the build first.** Pass the archive straight to `--app`: the
   driver extracts it itself. iOS accepts a `.zip`/`.app.zip`/`.ipa` (or an
   unzipped `.app`); Android accepts an `.apk`/`.apks`. Unzipping a `.app.zip`
   to a bare `.app` is unnecessary and a common mistake.
3. **Inspect before acting** — never guess coordinates:
   - `aco elements` → labelled elements + ready-to-paste tap selectors
     (use `--json` to parse).
   - `aco screenshot --out shot.png`, then Read `shot.png` to see the screen.
   - `aco source` (optionally `--xpath '<expr>'`) for the full tree.
4. **Act** — `--session/--server-url/--platform` default to the latest live
   session, so omit them after `session start`:
   - `aco tap --selector 'accessibility id:login.button'`  (or `--label`, or
     `--x/--y`).
   - `aco swipe --direction up`  (within the default scroll view).
   - `aco send-keys --selector '<sel>' --text 'alice'`  (clears first;
     `--no-clear` appends).
   - `aco scroll-into-view '<selector>' --direction up`.
   - `aco element find --using "accessibility id" --value "Login"` then
     `aco element click --element <id>`.
5. **Verify** the effect with another `aco screenshot` / `aco elements`.
6. **Stop** when done: `aco session stop` (latest), `--all`, or
   `--session <id>`.

## Selectors

Prefer `--label <accessibilityLabel>` (shorthand for `accessibility id:<label>`)
or a full `--selector 'strategy:value'`. Get exact values from
`aco elements --json` rather than inventing them.

## Reading output

`session start` **always** prints a JSON envelope (no `--json` flag — passing
one errors). Only `device list`, `elements`, `session list`, and `mobile list`
*accept* `--json`. Parse JSON; don't scrape the human-readable tables.

## When you need a flag or command not listed here

Read `reference/commands.md` (full catalog) — e.g. context switching,
`aco web ...`, orientation/timeouts/settings, or the generated
`aco ios <cmd>` / `aco android <cmd>` platform extensions. For platform
extensions you can also discover live: `aco mobile list --json`, then
`aco ios <cmd> --help`.

## When a command fails

Read `reference/troubleshooting.md` (appium-not-found, insecure-feature errors,
`unknown command (script)`, and how default session resolution works).
