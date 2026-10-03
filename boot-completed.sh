#!/system/bin/sh
# One-shot late_start hook. No post-fs-data, daemon, system overlay, or SELinux changes.
DATA_DIR=${LS_DATA_DIR:-/data/adb/language_selector_ksu_data}
CONFIG="$DATA_DIR/config.v1"
STATUS="$DATA_DIR/boot-status.txt"
LOCK="$DATA_DIR/boot.lock"
TMP="$STATUS.tmp.$$"
now() { date '+%Y-%m-%dT%H:%M:%S%z' 2>/dev/null || date; }
write_status() {
  printf 'started=%s\nfinished=%s\nsuccess=%s\nfailed=%s\nsummary=%s\n' "$STARTED" "$FINISHED" "$SUCCESS" "$FAILED" "$SUMMARY" > "$TMP" &&
    chmod 0600 "$TMP" && mv -f "$TMP" "$STATUS"
}
STARTED=$(now); FINISHED=; SUCCESS=0; FAILED=0; SUMMARY=""; mkdir -p "$DATA_DIR"
if ! mkdir "$LOCK" 2>/dev/null; then exit 0; fi
trap 'rmdir "$LOCK" 2>/dev/null; rm -f "$TMP"' EXIT
if [ ! -r "$CONFIG" ]; then exit 0; fi
SCHEMA=; AUTO=0
while IFS= read -r line; do
  case "$line" in
    schema=*) SCHEMA=${line#schema=} ;;
    auto=*) AUTO=${line#auto=} ;;
  esac
done < "$CONFIG"
[ "$SCHEMA" = "1" ] && [ "$AUTO" = "1" ] || exit 0
SDK=$(getprop ro.build.version.sdk)
case "$SDK" in ''|*[!0-9]*) SUMMARY="invalid Android API level"; FINISHED=$(now); write_status; exit 0 ;; esac
if [ "$SDK" -lt 33 ]; then SUMMARY="Android 13+ required"; FINISHED=$(now); write_status; exit 0; fi
# Wait at most 60 seconds for boot completion and the Locale shell service.
READY=0
i=0
while [ "$i" -lt 30 ]; do
  if [ "$(getprop sys.boot_completed)" = "1" ] && command -v cmd >/dev/null 2>&1 &&
      cmd locale help >/dev/null 2>&1; then READY=1; break; fi
  i=$((i + 1)); sleep 2
done
if [ "$READY" -ne 1 ]; then SUMMARY="Locale service not ready after bounded wait"; FINISHED=$(now); write_status; exit 0; fi
USER_ID=$(am get-current-user 2>/dev/null)
case "$USER_ID" in ''|*[!0-9]*) USER_ID=0 ;; esac
# Config grammar is deliberately restrictive; never eval or source config content.
while IFS= read -r line; do
  case "$line" in app=*)
    entry=${line#app=}; pkg=${entry%%|*}; locale=${entry#*|}
    [ "$pkg" != "$entry" ] || continue
    case "$pkg" in ''|*[!A-Za-z0-9_.]*) continue ;; esac
    case "$locale" in
      @system)\n        if cmd locale set-app-locales "$pkg" --user "$USER_ID" >/dev/null 2>&1; then\n          actual=$(cmd locale get-app-locales "$pkg" --user "$USER_ID" 2>&1)\n          case "$actual" in *"are []"*) SUCCESS=$((SUCCESS + 1));; *) FAILED=$((FAILED + 1)); SUMMARY="default verification failed for $pkg";; esac\n        else\n          FAILED=$((FAILED + 1)); SUMMARY="default reset failed for $pkg"\n        fi\n        continue ;;
      ''|*[!A-Za-z0-9-]*) continue ;;
    esac
    case "$locale" in [A-Za-z][A-Za-z]*) ;; *) continue ;; esac
    if cmd locale set-app-locales "$pkg" --user "$USER_ID" --locales "$locale" >/dev/null 2>&1; then
      actual=$(cmd locale get-app-locales "$pkg" --user "$USER_ID" 2>&1)
      case "$actual" in *"[$locale]"*) SUCCESS=$((SUCCESS + 1));;
        *) FAILED=$((FAILED + 1)); SUMMARY="verification failed for $pkg";;
      esac
    else
      FAILED=$((FAILED + 1)); SUMMARY="set failed for $pkg"
    fi
    ;;
  esac
done < "$CONFIG"
FINISHED=$(now)
[ -n "$SUMMARY" ] || SUMMARY="completed"
write_status
