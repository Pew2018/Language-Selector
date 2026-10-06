#!/system/bin/sh
# Shared trusted-storage primitives. Test overrides require the same root context.
umask 077
DATA_DIR=${LS_DATA_DIR:-/data/adb/language_selector_ksu_data}
MOD_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
fail() { printf '%s\n' "$*" >&2; exit 1; }
valid_user() { case "$1" in ''|*[!0-9]*|0[0-9]*) return 1;; esac; [ "${#1}" -le 9 ]; }
valid_package() {
  [ "${#1}" -le 255 ] || return 1
  case "$1" in ''|.*|*.|*..*|*[!A-Za-z0-9_.]*) return 1;; esac
  case "$1" in *.*) return 0;; *) return 1;; esac
}
valid_locale() {
  [ "${#1}" -le 63 ] || return 1
  case "$1" in *-[A-Za-z0-9]) return 1;; esac
  printf '%s\n' "$1" | grep -E -q '^[A-Za-z]{2,8}(-[A-Za-z0-9]{1,8})*$'
}
safe_dir() {
  [ ! -L "$1" ] || fail "Unsafe directory link"
  if [ ! -e "$1" ]; then mkdir "$1" || fail "Cannot create private directory"; fi
  [ -d "$1" ] && [ "$(stat -c '%u:%a' "$1")" = "0:700" ] || fail "Unsafe directory owner or permissions"
}
safe_file() {
  [ ! -L "$1" ] && [ -f "$1" ] && [ "$(stat -c '%u:%a:%h' "$1")" = "0:600:1" ] || fail "Unsafe file type, owner or permissions"
}
init_storage() {
  [ "$(id -u)" = 0 ] || fail "Root context required"
  safe_dir "$DATA_DIR"
  LOCK="$DATA_DIR/state.lock"
  [ ! -L "$LOCK" ] || fail "Unsafe lock link"
  if [ ! -e "$LOCK" ]; then (set -C; : > "$LOCK") 2>/dev/null || :; fi
  safe_file "$LOCK"
  exec 9<>"$LOCK" || fail "Cannot open state lock"
  # flock -n is supported by Android toybox and KernelSU's BusyBox.
  command -v flock >/dev/null 2>&1 || fail "File locking unavailable"
  n=0
  until flock -n 9; do n=$((n + 1)); [ "$n" -lt 30 ] || fail "Another module operation is active"; sleep 0.1; done
  WORK=$(mktemp -d "$DATA_DIR/.operation.XXXXXX") || fail "Cannot create operation workspace"
  trap 'rm -rf "$WORK"' EXIT
  trap 'exit 1' HUP INT TERM
  SNAP="$WORK/config"
}
user_storage() {
  valid_user "$1" || fail "Invalid Android user"
  USER_ID=$1
  if [ "$USER_ID" = 0 ]; then USER_DIR=$DATA_DIR; else
    safe_dir "$DATA_DIR/users"; safe_dir "$DATA_DIR/users/$USER_ID"; USER_DIR="$DATA_DIR/users/$USER_ID"
  fi
  CONFIG="$USER_DIR/config.v1"; PENDING="$USER_DIR/pending.v1"; STATUS="$USER_DIR/boot-status.txt"
}
bounded() {
  command -v timeout >/dev/null 2>&1 || fail "Command timeout unavailable"
  timeout -k 1 5 "$@"
}
current_user() {
  u=$(bounded am get-current-user) || fail "Cannot read Android user"
  valid_user "$u" || fail "Invalid foreground user"
  printf '%s\n' "$u"
}
assert_user() { [ "$(current_user)" = "$USER_ID" ] || fail "Android user changed; refresh before continuing"; }
assert_platform() {
  sdk=$(bounded getprop ro.build.version.sdk) || fail "Cannot read Android version"
  case "$sdk" in ''|*[!0-9]*) fail "Invalid Android version";; esac
  [ "$sdk" -ge 33 ] || fail "Android 13+ required"
}
validate_config() {
  [ "$(wc -c < "$1")" -le 131072 ] || fail "Configuration too large"
  schemas=0; autos=0; count=0; AUTO=0; : > "$WORK/seen"
  while IFS= read -r v_line || [ -n "$v_line" ]; do
    case "$v_line" in
      schema=1) schemas=$((schemas + 1));;
      auto=0|auto=1) autos=$((autos + 1)); AUTO=${v_line#auto=};;
      app=*)
        v_entry=${v_line#app=}; v_pkg=${v_entry%%|*}; v_tag=${v_entry#*|}
        [ "$v_entry" != "$v_tag" ] && valid_package "$v_pkg" || fail "Invalid package entry"
        [ "$v_tag" = @system ] || valid_locale "$v_tag" || fail "Invalid locale entry"
        grep -F -x -q "$v_pkg" "$WORK/seen" && fail "Duplicate package"
        printf '%s\n' "$v_pkg" >> "$WORK/seen"
        count=$((count + 1)); [ "$count" -le 1000 ] || fail "Too many configured apps";;
      *) fail "Invalid configuration line";;
    esac
  done < "$1"
  [ "$schemas" = 1 ] && [ "$autos" = 1 ] || fail "Invalid configuration headers"
  [ "$(head -n 1 "$1")" = schema=1 ] || fail "Invalid configuration version"
}
load_snapshot() {
  [ ! -L "$CONFIG" ] || fail "Unsafe configuration link"
  if [ -e "$CONFIG" ]; then safe_file "$CONFIG"; cat "$CONFIG" > "$SNAP" || fail "Cannot read configuration"
  else printf 'schema=1\nauto=0\n' > "$SNAP"; fi
  validate_config "$SNAP"
}
save_snapshot() {
  validate_config "$SNAP"
  if [ -e "$CONFIG" ] || [ -L "$CONFIG" ]; then safe_file "$CONFIG"; fi
  new=$(mktemp "$USER_DIR/.config.XXXXXX") || fail "Cannot create configuration file"
  cat "$SNAP" > "$new" && chmod 0600 "$new" && mv -f "$new" "$CONFIG" || { rm -f "$new"; fail "Cannot save configuration"; }
}
replace_entry() {
  printf 'schema=1\nauto=%s\n' "$AUTO" > "$WORK/next"
  while IFS= read -r line || [ -n "$line" ]; do
    case "$line" in app=*) entry=${line#app=}; [ "${entry%%|*}" = "$1" ] || printf '%s\n' "$line" >> "$WORK/next";; esac
  done < "$SNAP"
  printf 'app=%s|%s\n' "$1" "$2" >> "$WORK/next"
  mv "$WORK/next" "$SNAP"
}
read_actual() {
  actual=$(bounded cmd locale get-app-locales "$1" --user "$USER_ID") || return 1
  prefix="Locales for $1 for user $USER_ID are ["
  case "$actual" in "$prefix"*']') ACTUAL=${actual#"$prefix"}; ACTUAL=${ACTUAL%']'};; *) return 1;; esac
  if [ -z "$ACTUAL" ]; then ACTUAL=@system; else valid_locale "$ACTUAL" || return 1; fi
}
locale_key() {
  lower=$(printf '%s' "$1" | tr '[:upper:]' '[:lower:]')
  case "$lower" in zh-cn|zh-hans-cn|zh-hans) printf zh-cn;; zh-tw|zh-hant-tw|zh-hant) printf zh-tw;; zh-hk|zh-hant-hk) printf zh-hk;; *) printf '%s' "$lower";; esac
}
mark_pending() {
  [ ! -e "$PENDING" ] && [ ! -L "$PENDING" ] || fail "An unfinished operation requires reconciliation"
  printf 'schema=1\nauto=0\napp=%s|%s\n' "$1" "$2" > "$WORK/pending"
  mv "$WORK/pending" "$PENDING" || fail "Cannot record operation intent"
}
require_ready() { [ ! -e "$PENDING" ] && [ ! -L "$PENDING" ] || fail "Unfinished operation: reconcile current language first"; }
