# aco e2e suite

End-to-end tests that drive the **built** `aco` CLI (`dist/cli.js`) as a
subprocess against a **live, detached** Appium session targeting the
checked-in [`aut/`](../aut) app. Locators are imported directly from
[`aut/src/testids.ts`](../aut/src/testids.ts) so they can never drift from
the app.

The suite is parameterised by environment variables and runs serially in a
single fork (one simulator/emulator, one session) via
[`vitest.e2e.config.ts`](../vitest.e2e.config.ts).

## Environment variables

| Var                   | When            | Meaning                                              |
| --------------------- | --------------- | ---------------------------------------------------- |
| `ACO_E2E_PLATFORM`    | always          | `ios` or `android` (no default -- fails loud)        |
| `ACO_AUT_IOS_APP`     | iOS             | absolute/relative path to the built `acoAUT.app`     |
| `ACO_AUT_ANDROID_APK` | Android         | path to the built `app-release.apk`                  |
| `ACO_E2E_DEVICE_NAME` | iOS (optional)  | simulator label, e.g. `"iPhone 15"`                  |
| `ACO_E2E_AVD`         | Android (opt.)  | AVD name (omit to let `aco` auto-pick the first AVD) |

## Prerequisites

- Xcode + an iOS Simulator (iOS) or Android Studio + an AVD (Android).
- `appium` on `PATH` (`npm i -g appium`) plus the driver:
  `appium driver install xcuitest` / `appium driver install uiautomator2`.
- A built AUT artefact (see below).

The suite runs a preflight check ([`helpers/preflight.ts`](./helpers/preflight.ts))
that fails fast with one actionable message if any prerequisite is missing.

## iOS (local)

```sh
pnpm aut:install
pnpm aut:prebuild
pnpm aut:build:ios   # → aut/ios/build/Build/Products/Release-iphonesimulator/acoAUT.app
appium driver install xcuitest
# boot a simulator (Xcode or `xcrun simctl boot <udid>`), then:
pnpm run e2e:ios     # builds dist/ first, then runs the iOS suite
```

`e2e:ios` reads `ACO_AUT_IOS_APP` from your shell; point it at the built
`.app` if it is not on the default path:

```sh
ACO_AUT_IOS_APP=aut/ios/build/Build/Products/Release-iphonesimulator/acoAUT.app \
  pnpm run e2e:ios
```

## Android (local only -- not in CI)

Android emulators on hosted CI runners are slow/flaky and KVM-gated, so
Android runs locally only.

```sh
pnpm aut:install
pnpm aut:prebuild
pnpm aut:build:android   # → aut/android/app/build/outputs/apk/release/app-release.apk
appium driver install uiautomator2
# boot an AVD (Android Studio or `emulator -avd <name>`), then:
ACO_E2E_PLATFORM=android \
  ACO_AUT_ANDROID_APK=aut/android/app/build/outputs/apk/release/app-release.apk \
  pnpm run e2e:android
```

`aco session start --platform android` auto-picks the first AVD if `--avd`
is omitted, so `ACO_E2E_AVD` is optional.

## The `pnpm run build` caveat

`aco session start --detach` refuses to run under tsx and requires the
built `dist/cli.js`, so the suite always drives the build output. The
`e2e:ios` / `e2e:android` scripts run `pnpm run build` first. If you invoke
`pnpm run test:e2e` directly you **skip the rebuild** and test whatever is
already in `dist/` -- rebuild manually (or use `e2e:ios`/`e2e:android`)
after changing `src/`.
