# aco AUT (App Under Test)

A small Expo app that the `aco` e2e suite drives via a real Appium
session on iOS Simulator and Android Emulator.

## Quick start

```sh
# from the repo root
pnpm aut:install               # one-time, ~200MB into aut/node_modules
pnpm aut:start                 # dev mode (Metro on :8081), connect a sim
```

## Build a release artefact

```sh
pnpm aut:prebuild              # materialise aut/ios and aut/android
pnpm aut:build:ios             # → aut/ios/build/Build/Products/Release-iphonesimulator/acoAUT.app
pnpm aut:build:android         # → aut/android/app/build/outputs/apk/release/app-release.apk
```

## Screens and which `aco` commands they cover

| Screen | Path | aco commands |
|---|---|---|
| Home | `/` | `source`, `screenshot`, `element find` smoke |
| Elements | `/elements` | `element find` (every strategy), `click`, `text`, `attribute` |
| Keyboard | `/keyboard` | `element send-keys`, `send-keys` (round-trip with echo) |
| Gestures | `/gestures` | `tap`, `swipe`, `actions` (W3C pointer/key), `mobile call mobile: tap / mobile: swipe` |
| WebView | `/webview` | `context list/current/switch`, `web url/back/forward/refresh` |

Future screens (not yet implemented; nav links disabled on Home):

| Screen | Path | aco commands it would cover |
|---|---|---|
| Permissions | `/permissions` | `mobile call mobile: getPermissions / setPermissions` |
| Orientation | `/orientation` | `mobile call mobile: deviceScreenOrientation / setOrientation` |

## testID convention

Every instrumented element uses `MarkedView`, `MarkedText`,
`MarkedPressable`, or `MarkedTextInput` from
[`src/components/Probe.tsx`](./src/components/Probe.tsx), which sets
both `testID` and `accessibilityLabel` to the same constant from
[`src/testids.ts`](./src/testids.ts). This is the only way to make
`aco element find --using "accessibility id"` resolve identically
under XCUITest and UiAutomator2.

## Why not the Appium sample apps?

See `plan.md` §2.9 in the repo root. Short answer: coverage shape,
drift, extensibility.
