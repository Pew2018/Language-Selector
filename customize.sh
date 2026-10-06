#!/system/bin/sh
# KernelSU/Magisk-compatible module installer hook.
# Configuration is stored outside MODPATH so upgrades cannot overwrite it.
SKIPUNZIP=0
DATA_DIR=/data/adb/language_selector_ksu_data
umask 077
[ "$(id -u)" = 0 ] || abort "Root installation context required"
[ ! -L "$DATA_DIR" ] || abort "Unsafe persistent directory link"
mkdir -p "$DATA_DIR" || abort "Cannot create persistent data directory"
[ "$(stat -c '%u' "$DATA_DIR")" = 0 ] || abort "Unsafe persistent directory owner"
chmod 0700 "$DATA_DIR" || abort "Cannot secure persistent data directory"
ui_print "- Language Selector KSU foundation"
ui_print "- Persistent settings: $DATA_DIR"
ui_print "- Android 13+ (API 33+) is required"
