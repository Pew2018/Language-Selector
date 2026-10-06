#!/system/bin/sh
MOD_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
. "$MOD_DIR/security.sh"
action=$1; shift
case "$action:$#" in read:1|state:1|status:1|recover:1|auto:2|locale:3) ;; *) fail "Unsupported operation or arguments";; esac
init_storage
user_storage "$1"; shift
assert_user
case "$action" in
  read) load_snapshot; cat "$SNAP";;
  status) if [ -e "$STATUS" ] || [ -L "$STATUS" ]; then safe_file "$STATUS"; cat "$STATUS"; else printf 'No boot apply has been recorded.'; fi;;
  state)
    if [ -e "$PENDING" ] || [ -L "$PENDING" ]; then safe_file "$PENDING"; validate_config "$PENDING"; [ "$count" = 1 ] || fail "Invalid operation journal"; printf pending; else printf ready; fi;;
  auto)
    require_ready; case "$1" in 0|1) ;; *) fail "Invalid auto flag";; esac
    load_snapshot; sed "s/^auto=[01]$/auto=$1/" "$SNAP" > "$WORK/next"; mv "$WORK/next" "$SNAP"
    save_snapshot; cat "$SNAP";;
  locale)
    require_ready; assert_platform; valid_package "$1" || fail "Invalid package"
    pkg=$1; tag=$2; [ "$tag" = @system ] || valid_locale "$tag" || fail "Invalid locale"
    load_snapshot; mark_pending "$pkg" "$tag"; assert_user
    if [ "$tag" = @system ]; then bounded cmd locale set-app-locales "$pkg" --user "$USER_ID" || fail "Locale write failed; reconcile current state"
    else bounded cmd locale set-app-locales "$pkg" --user "$USER_ID" --locales "$tag" || fail "Locale write failed; reconcile current state"; fi
    read_actual "$pkg" || fail "Locale read-back failed; reconcile current state"
    [ "$(locale_key "$ACTUAL")" = "$(locale_key "$tag")" ] || fail "Locale verification mismatch; reconcile current state"
    replace_entry "$pkg" "$tag"; save_snapshot
    rm -f "$PENDING" || fail "Cannot complete operation journal"
    cat "$SNAP";;
  recover)
    assert_platform; safe_file "$PENDING"; validate_config "$PENDING"
    [ "$count" = 1 ] || fail "Invalid operation journal"
    entry=$(grep '^app=' "$PENDING"); entry=${entry#app=}; pkg=${entry%%'|'*}; valid_package "$pkg" || fail "Invalid operation journal"
    read_actual "$pkg" || fail "Cannot reconcile actual language"
    tag=$ACTUAL; load_snapshot; replace_entry "$pkg" "$tag"; save_snapshot
    rm -f "$PENDING" || fail "Cannot complete reconciliation"
    cat "$SNAP";;
esac
