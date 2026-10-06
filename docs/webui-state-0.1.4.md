# WebUI 0.1.4: progress, compact details and restore action

Scope: feature/app-language-priority only. No configuration schema, shell execution, journal/recovery strategy, permissions, core parser or bridge changes.

## Loading
The real completed/total count is separate from an indeterminate 4 CSS px square-ended track. It never controls animation geometry. Unknown totals hide the count. Four transform-only animations reproduce the MDC Web v14.0.0 two-bar 2-second geometry and per-keyframe easing; source and MIT notice accompany the package. No runtime CDN or framework.

Progress is active only while package metadata or language reads are underway. Completion/read failure hides the bar and count immediately; the summary reports unreadable settings. A superseding refresh increments the existing generation so old workers cannot overwrite new progress. There is no new cancel command. CSS pauses animations off the applications page and on document visibility/pagehide, resuming against the real task state. Reduced motion uses a static short segment and loading text, without a numerical progress value. Count changes are aria-hidden and never update the polite loading announcement.

## Detail states
Current + configured identical: one current language block and “✓ 与配置一致”.
Different: both blocks and “当前设置与配置不一致”.
Reading/error: keep saved target, hide an unverified current value, and show truthful status.
No saved configuration: show independently read override or explicit follow-system; unknown never implies follow-system.
The existing schema supports one BCP-47 code per app. Android read-back may contain multiple ordered overrides: the front-end retains all validated tags and marks every current option. One saved code does not count as consistent with an extra-language override list. No schema or execute strategy is expanded.

## Restore
Text button, no border/fill/shadow at rest; 48 CSS px touch height, theme ink, pressed layer, keyboard outline, existing cancel-safe ripple. Explanatory text precedes right-aligned action. During execution it reads “正在恢复…” and duplicate writes are blocked. A confirmed empty override replaces the button with noninteractive “当前跟随系统”. Unknown reads/config/journal restrictions remain disabled by the existing safety conditions. Saved @system entries retain their existing semantics and are excluded from the dedicated-language configured group as before.

## QA evidence and limitations
GitHub Actions runs unit/security tests and Playwright. It records browser video plus a 2.2-second requestAnimationFrame observation of computed translate/scale transforms, completion, known/unknown totals, superseded reads, off-page and simulated pagehide/pageshow lifecycle, reduced motion, read failures, compact state variants, ordered overrides, restore busy/success/failure and cancellation feedback. These demonstrate browser execution, not frame pacing on a phone.

Still requires KernelSU Next device testing: native root/locale interfaces, actual restore results, system keyboard scroll/focus, WebView scaling and dp touch size, system insets, app adoption of the chosen language, and long-list performance. A screenshot does not establish animation smoothness.
