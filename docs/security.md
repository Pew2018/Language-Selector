# Security model and recovery

The module trusts the installed KernelSU Next Manager, its root bridge, the Android framework, and the root-owned module/data directories. The bridge can execute arbitrary root commands: our validated backend is an application boundary, not a sandbox against malicious JavaScript or another root-capable module. The WebUI loads only local assets, uses textContent for app labels, permits only bounded PNG bridge icons, and blocks frames, objects, workers, forms, external connections and base-URL changes through CSP. External pages must never be opened inside a root-enabled WebView.

## Trusted storage

security.sh requires uid 0; directories must be root-owned mode 0700. Configuration, status, journal and lock files must be regular, root-owned mode 0600, have one hard link, and not be symbolic links. An unsafe existing directory/file fails closed. Installer checks directory ownership and secures its mode. It does not change webroot permissions or SELinux policy.

All backend reads and writes share state.lock with a kernel flock on fd 9. Acquisition retries for roughly three seconds. The lock file is never unlinked; process exit releases the kernel lock, including after abrupt termination. Old boot.lock directories are unused. Each operation uses an exclusively created private workspace and a unique replacement file. The complete configuration is validated before use: schema 1, one auto flag, unique validated package identifiers, bounded locale syntax, 128 KiB maximum and 1000 entries maximum. Configuration is never evaluated as shell code.

The backend merges one requested change into the latest locked snapshot instead of accepting a stale entire file from WebUI. Boot validates and applies the same snapshot while holding the lock. A failed/unknown configuration is never replaced with an empty one.

## Android users

The existing config.v1 remains bound to Android user 0; no automatic migration to a different user occurs. Other users have users/<id>/config.v1 and independent journals/status. Foreground user is checked before every backend operation and again immediately before WebUI locale writes. Commands explicitly target the bound user. A user switch requires refresh. Boot applies only the foreground user's own configuration and stops if that user changes.

## Interrupted operations

Before a locale write, pending.v1 records the intended package and locale. Success requires a zero command exit, a strict read-back for the exact package/user, language agreement and successful configuration persistence. Only then is the journal removed.

Each backend Android command is bounded by timeout -k 1 5. The WebUI's 30-second deadline only bounds waiting; it is not proof that the underlying Android operation was cancelled. Boot additionally bounds readiness polling and stops starting new app operations after a 120-second application deadline. An interrupted or failed write retains the journal, including after WebUI reload, and blocks subsequent writes.

In Diagnostics, “核对未完成操作” asks for confirmation, acquires the shared lock, reads the current Android language, merges that actual value into configuration, and completes the journal. It never repeats set-app-locales. If the Android service cannot read the package (including an uninstalled package), reconciliation stays blocked; restore package availability or inspect the private files manually as root. Corrupt/unsafe configurations need deliberate repair; there is no silent reset or backup/export feature.

The kernel lock and journal cannot defend against hostile uid-0 code deliberately tampering with storage. There remains a tiny unavoidable race between checking foreground user and an Android user switch; explicit --user prevents retargeting the command to a different user.

## Verification and builds

Run sudo node --test tests/*.test.js for root-context isolated storage/command fixtures. Tests never invoke Android device commands or modify /data/adb. Bridge tests cover spawn argument quoting, stream events, nonzero/malformed exits, overflow, timeout and late callbacks. Browser QA exercises the preferred spawn route, persistent unfinished-operation gating and damaged-configuration read-only behavior.

CI also runs security tests under BusyBox ash. This validates shell compatibility, not the exact BusyBox build, WebView or Manager installed on a device. Confirm availability of flock, timeout, mktemp and stat on supported Manager/device combinations; missing required primitives fail closed.

Actions are pinned to verified upstream commit SHAs; npm ci uses the committed lockfile with integrity hashes and install scripts disabled. QA dependencies are excluded from the install module. The integrity artifact contains module-check.zip, its SHA-256 and the source commit. A checksum from the same build detects accidental corruption; it is not an independent digital signature or a guarantee against a compromised GitHub account/runner.

References: [KernelSU module environment](https://kernelsu.org/guide/module.html), [Android native bridge security](https://developer.android.com/privacy-and-security/risks/insecure-webview-native-bridges), [GitHub secure Actions use](https://docs.github.com/en/actions/reference/security/secure-use).
