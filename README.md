# Language Selector — KernelSU Next foundation

An independent KernelSU Next module port for Android 13+ per-app languages. The original Shizuku/Compose app is not bundled or modified. TurboIMS is not a dependency and is not modified.

## Scope

- Installed package names, labels, system-app status, and icons from KSU Next WebUI-Next package APIs.
- Search/filter, optional system-app display, actual locale reads, explicit locale set and restore-to-system-default.
- Persistent per-package configuration, schemaVersion 1 JSON import/export by copy/paste, and explicit replace/merge choices.
- Optional one-pass boot application after bounded service readiness checks.
- Light/dark/system theme and classic Android system utility layout.
- No tile, no external requests, no system partition writes, overlays, sepolicy rules, or SELinux changes.

## Install and use

1. Install the Actions artifact ZIP from KernelSU Next Manager.
2. Open the module WebUI. The Manager must expose KernelSU Next WebUI-Next APIs: package list/info/icon and asynchronous root-shell APIs. Upstream documents these functions but does not publish an API-to-Manager-version mapping, so the required API set is stated rather than inventing a version number.
3. Choose an app and set a language, or explicitly choose “Follow system default”. Confirm that operation results are verified by reading the actual locale again.
4. Settings can export/import JSON in the WebView clipboard text area; import always shows a summary and asks for Replace or Merge before writing.

The language list and interface are local. App labels/icons and root shell commands are provided by the installed KernelSU Next Manager, not a network service.

## Startup behavior

KernelSU Next invokes `boot-completed.sh` after boot completion. The script exits without action if auto-apply is off, rejects invalid configuration, waits up to 60 seconds for `cmd locale`, then applies configured locales one by one for the current Android user. `service.sh` is an inert compatibility stub and is excluded from the install ZIP. Each failure is isolated; the script records a compact status and exits. No resident process or periodic polling is used. It does not reset per-app locales on install, update, or uninstall.

## Build and tests

GitHub Actions runs Node's built-in tests, `sh -n` syntax checks, assembles a root-level KernelSU module ZIP, and uploads it as an Actions artifact. No local build is required.

See [docs/configuration.md](docs/configuration.md) for state format, APIs, AOSP command semantics, and the local device locale catalog with offline fallback.
