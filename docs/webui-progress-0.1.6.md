# Main-page refresh progress 0.1.6

Confirmed gap: the application's main-page refresh handler awaited loadConfig (current Android user, SDK, configuration and pending-operation state) before loadApps enabled progress. Thus real refresh work could occur without a main-page indicator. This gap is fixed: pressing refresh immediately shows the indeterminate component with “正在检查配置…” and no unknown-total count. Subsequent package/metadata/locale phases retain their own truthful labels and counts.

Before the new check, the existing generation token invalidates old background readers so they cannot hide or update the new progress. Browsing and searching remain available; list summaries cannot overwrite preparation text. Completion/error stop progress, without artificial delays or retaining an idle animation. Leaving/returning still pauses/resumes according to page and document visibility.

Settings/About and runtime status now identify WebUI 0.1.6. Runtime status also reports the locally computed animation stylesheet and the browser's reduced-motion preference. It does not infer whether a hidden indicator was visible to the user, validate device frame pacing, or override an accessibility preference. No new native/root commands are used for these checks.

Platform source reviewed: KernelSU Next dev WebUIActivity.kt delegates requests to WebViewAssetLoader and SuFilePathHandler.java serves assets within webroot. No demonstrated query-string compatibility failure was found; no claim that resource URLs caused the device report is made.

Actions browser QA verifies the indicator synchronously at the start of a delayed configuration check (before any mock response), search while preparing, completion, then the existing visible painted frames, counters, cycle boundaries, themes, reduced motion, detail and restore regression. An additional versioned app.js URL identifies this front-end change.

Device report remains unresolved until tested with this artifact in the user's KernelSU Next WebView. A useful follow-up is the installed WebUI version, loading-animation detection, and a screenshot taken while refresh is underway. Native language commands, config schema, execution strategy, security and boot behavior remain unchanged.
