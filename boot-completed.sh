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
invalid_config() {
  SUMMARY="Invalid configuration: $1"
  FINISHED=$(now)
  write_status
  exit 0
}
valid_package() {
  case "$1" in ''|.*|*.|*..*|*[!A-Za-z0-9_.]*) return 1 ;; esac
  case "$1" in *.*) return 0 ;; *) return 1 ;; esac
}
valid_locale() {
  value=$1
  case "$value" in ''|-*|*-|*--*|*[!A-Za-z0-9-]*) return 1 ;; esac
  language=${value%%-*}
  case "$language" in *[!A-Za-z]*|'') return 1 ;; esac
  [ "${#language}" -ge 2 ] && [ "${#language}" -le 8 ] || return 1
  rest=${value#*-}
  while [ "$rest" != "$value" ]; do
    subtag=${rest%%-*}
    [ "${#subtag}" -ge 1 ] && [ "${#subtag}" -le 8 ] || return 1
    case "$subtag" in *[!A-Za-z0-9]*) return 1 ;; esac
    if [ "$rest" = "$subtag" ]; then break; fi
    value=$rest
    rest=${rest#*-}
  done
  return 0
}
STARTED=$(now); FINISHED=; SUCCESS=0; FAILED=0; SUMMARY=""
mkdir -p "$DATA_DIR" 2>/dev/null || exit 0
if ! mkdir "$LOCK" 2>/dev/null; then exit 0; fi
trap 'rmdir "$LOCK" 2>/dev/null; rm -f "$TMP" "$SEEN"' EXIT
if [ ! -r "$CONFIG" ]; then exit 0; fi
SCHEMA_COUNT=0; AUTO_COUNT=0; SCHEMA=""; AUTO=""; APP_COUNT=0
SEEN="$DATA_DIR/.boot-packages.$$"
: > "$SEEN" || exit 0
# Validate the entire line format before running any locale command.
while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in
    schema=*)
      SCHEMA_COUNT=$((SCHEMA_COUNT + 1)); SCHEMA=${line#schema=}
      [ "$SCHEMA" = "1" ] || invalid_config "unsupported schema"
      ;;
    auto=*)
      AUTO_COUNT=$((AUTO_COUNT + 1)); AUTO=${line#auto=}
      case "$AUTO" in 0|1) ;; *) invalid_config "invalid auto flag" ;; esac
      ;;
    app=*)
      entry=${line#app=}
      case "$entry" in *'|'*) ;; *) invalid_config "malformed app entry" ;; esac
      pkg=${entry%%|*}; locale=${entry#*|}
      case "$locale" in *'|'*|'') invalid_config "malformed app locale" ;; esac
      valid_package "$pkg" || invalid_config "invalid package name"
      if [ "$locale" != "@system" ]; then valid_locale "$locale" || invalid_config "invalid Locale tag"; fi
      if grep -F -x -q "$pkg" "$SEEN"; then invalid_config "duplicate package entry"; fi
      printf '%s\n' "$pkg" >> "$SEEN"
      APP_COUNT=$((APP_COUNT + 1))
      ;;
    *) invalid_config "unknown or empty config line" ;;
  esac
done < "$CONFIG"
[ "$SCHEMA_COUNT" -eq 1 ] || invalid_config "missing or duplicate schema"
[ "$AUTO_COUNT" -eq 1 ] || invalid_config "missing or duplicate auto flag"
if [ "$AUTO" != "1" ]; then
  SUMMARY="boot apply disabled"
  FINISHED=$(now); write_status
  exit 0
fi
SDK=$(getprop ro.build.version.sdk)
case "$SDK" in ''|*[!0-9]*) SUMMARY="invalid Android API level"; FINISHED=$(now); write_status; exit 0 ;; esac
if [ "$SDK" -lt 33 ]; then SUMMARY="Android 13+ required"; FINISHED=$(now); write_status; exit 0; fi
# Wait at most 60 seconds for boot completion and the Locale shell service.
READY=0
i=0
while [ "$i" -lt 30 ]; do
  if [ "$(getprop sys.boot_completed)" = "1" ] && command -v cmd >/dev/null 2>&1; then
    HELP=$(cmd locale help 2>&1)
    case "$HELP" in *get-app-locales*set-app-locales*) READY=1; break ;; esac
  fi
  i=$((i + 1)); sleep 2
done
if [ "$READY" -ne 1 ]; then SUMMARY="Locale service not ready after bounded wait"; FINISHED=$(now); write_status; exit 0; fi
USER_ID=$(am get-current-user 2>/dev/null)
case "$USER_ID" in ''|*[!0-9]*) SUMMARY="current Android user unavailable"; FINISHED=$(now); write_status; exit 0 ;; esac
while IFS= read -r line || [ -n "$line" ]; do
  case "$line" in app=*)
    entry=${line#app=}; pkg=${entry%%|*}; locale=${entry#*|}
    if [ "$locale" = "@system" ]; then
      if cmd locale set-app-locales "$pkg" --user "$USER_ID" >/dev/null 2>&1; then
        actual=$(cmd locale get-app-locales "$pkg" --user "$USER_ID" 2>&1)
        case "$actual" in *"are []"*) SUCCESS=$((SUCCESS + 1));; *) FAILED=$((FAILED + 1)); SUMMARY="default verification failed for $pkg";; esac
      else
        FAILED=$((FAILED + 1)); SUMMARY="default reset failed for $pkg"
      fi
    elif cmd locale set-app-locales "$pkg" --user "$USER_ID" --locales "$locale" >/dev/null 2>&1; then
      actual=$(cmd locale get-app-locales "$pkg" --user "$USER_ID" 2>&1)
      case "$actual" in *"are [$locale]"*) SUCCESS=$((SUCCESS + 1));; *) FAILED=$((FAILED + 1)); SUMMARY="verification failed for $pkg";; esac
    else
      FAILED=$((FAILED + 1)); SUMMARY="set failed for $pkg"
    fi
    ;;
  esac
done < "$CONFIG"
FINISHED=$(now)
[ -n "$SUMMARY" ] || SUMMARY="completed"
write_status
