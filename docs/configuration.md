# Configuration format

The persistent state lives in `/data/adb/language_selector_ksu_data/`, outside the replaceable module directory.

`config.v1` is a deliberately simple, validated line format (not shell code):

```
schema=1
auto=0
app=com.example.reader|en-US
app=com.example.chat|@system
```

- `auto` is `0` or `1`.
- Package names are restricted to ASCII package identifier characters.
- Locale values are validated BCP-47 tags; `@system` means follow the system default.
- Unknown, malformed, and future schema data fails closed. The startup script never sources or evaluates the file.
- JSON import/export uses schemaVersion 1 and contains only the auto-apply flag and package locale choices.
- Save uses a temporary file, restrictive permissions, and atomic rename. The module installer does not remove this directory.

## WebUI requirements

The WebUI uses KernelSU Next WebUI-Next global `ksu` APIs documented in the KernelSU-Next repository: `listAllPackages`, `getPackagesInfo`, `getPackagesIcons`, and asynchronous `exec(command, callbackName)`. Minimum requirement: a KernelSU Next Manager exposing these APIs (including icon API); no older Manager version number is documented by upstream, so a numeric minimum cannot be responsibly claimed. If APIs are absent the UI reports that requirement and does not silently substitute a different manager bridge.

Language calls use Android 13+ `cmd locale get-app-locales` and `set-app-locales`, current foreground Android user, and shell-quoted validated arguments. To restore system default, `--locales` is omitted: AOSP documents an unspecified locale list as empty. Per-app language commands and API syntax were checked against AOSP Android 13 LocaleManagerShellCommand.

## Offline language catalog

The picker first calls Android's local `cmd locale list-device-locales` command and uses its one-tag-per-line BCP-47 output, de-duplicated and validated, when available. On Android 13+ builds that do not expose this command or return a usable list, it falls back to a bundled curated set of commonly used language and region tags. No network request is made. Labels are generated locally with the browser's built-in `Intl.DisplayNames` when available, with the tag as fallback. Device-supported locales do not guarantee support by every app; Android/app language support varies by package.
