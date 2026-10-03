#!/system/bin/sh
# KernelSU Next late_start service hook. Runs one bounded boot application pass.
MODDIR=${0%/*}
exec "$MODDIR/boot-completed.sh"
