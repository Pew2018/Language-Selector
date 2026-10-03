#!/system/bin/sh
# KernelSU/Magisk-compatible module installer hook.
# Configuration is stored outside MODPATH so upgrades cannot overwrite it.
SKIPUNZIP=0
DATA_DIR=/data/adb/language_selector_ksu_data
mkdir -p "$DATA_DIR" || abort "Cannot create persistent data directory"
chmod 0700 "$DATA_DIR"
ui_print "- Language Selector KSU foundation"
ui_print "- Persistent settings: $DATA_DIR"
ui_print "- Android 13+ (API 33+) is required"
