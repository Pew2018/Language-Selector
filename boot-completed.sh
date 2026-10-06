#!/system/bin/sh
# One-shot hook; all mutation shares the same kernel lock as WebUI.
MOD_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
. "$MOD_DIR/security.sh"
init_storage
user_storage "$(current_user)"
STARTED=$(date '+%Y-%m-%dT%H:%M:%S%z'); SUCCESS=0; FAILED=0; SUMMARY=
write_status() {
  if [ -e "$STATUS" ] || [ -L "$STATUS" ]; then
    [ ! -L "$STATUS" ] && [ -f "$STATUS" ] && [ "$(stat -c '%u:%a:%h' "$STATUS")" = "0:600:1" ] || return 1
  fi
  printf 'started=%s\nfinished=%s\nsuccess=%s\nfailed=%s\nsummary=%s\n' "$STARTED" "$(date '+%Y-%m-%dT%H:%M:%S%z')" "$SUCCESS" "$FAILED" "$SUMMARY" > "$WORK/status"
  mv -f "$WORK/status" "$STATUS"
}
fail() { SUMMARY="Invalid configuration: $*"; printf '%s\n' "$SUMMARY" >&2; write_status; exit 0; }
load_snapshot
require_ready
if [ "$AUTO" != 1 ]; then SUMMARY="boot apply disabled"; write_status; exit 0; fi
assert_platform
READY=0; deadline=$(($(date +%s) + 60)); attempts=0
while [ "$attempts" -lt 30 ] && [ "$(date +%s)" -lt "$deadline" ]; do
  if [ "$(bounded getprop sys.boot_completed)" = 1 ]; then
    HELP=$(bounded cmd locale help 2>&1)
    case "$HELP" in *get-app-locales*) case "$HELP" in *set-app-locales*) READY=1; break;; esac;; esac
  fi
  attempts=$((attempts + 1)); sleep 2
done
if [ "$READY" != 1 ]; then SUMMARY="Locale service not ready after bounded wait"; write_status; exit 0; fi
deadline=$(($(date +%s) + 120))
while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in app=*)
    [ "$(date +%s)" -lt "$deadline" ] || { SUMMARY="Boot apply deadline reached"; break; }
    assert_user
    entry=${line#app=}; pkg=${entry%%|*}; tag=${entry#*|}
    mark_pending "$pkg" "$tag"
    if [ "$tag" = @system ]; then bounded cmd locale set-app-locales "$pkg" --user "$USER_ID" >/dev/null 2>&1; result=$?
    else bounded cmd locale set-app-locales "$pkg" --user "$USER_ID" --locales "$tag" >/dev/null 2>&1; result=$?; fi
    if [ "$result" = 0 ] && read_actual "$pkg" && [ "$(locale_key "$ACTUAL")" = "$(locale_key "$tag")" ]; then
      SUCCESS=$((SUCCESS + 1)); rm -f "$PENDING"
    else
      FAILED=$((FAILED + 1)); SUMMARY="Unfinished locale operation for $pkg; reconcile in WebUI"; break
    fi;;
  esac
done < "$SNAP"
[ -n "$SUMMARY" ] || SUMMARY=completed
write_status
