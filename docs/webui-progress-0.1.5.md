# WebUI loading repair 0.1.5

The prior list implementation contained the MDC dual-bar animation, but the startup loading screen still used a static 64px by 2px CSS pseudo-element while hiding the list. That was an incomplete integration. Its preview also reset animations to an empty cycle boundary immediately before capturing, so its screenshot did not show the moving foreground segments.

Both visible startup loading and the application-list reading region now use the same local progress.css component. It preserves the MDC v14 2-second keyframes, per-keyframe easing, initial offsets and center-origin inner scaling. The MIT license is packaged. Isolated component class names avoid ordinary button/list rules. Versioned loading CSS/startup URLs prevent reuse of the previous resource URLs.

The startup track remains within the existing content-width loading region, replacing the static pseudo-element. Unknown total has no count. Initialization failure hides the bar and retains the existing reload action; completion stops/hides it. Application-list counts, generation cancellation, completion/error summary, reduced-motion fallback, theme and visibility lifecycle remain as previously implemented. No artificial delay or extra root requests are added to production.

Browser QA now checks visible clipped foreground geometry and distinct PNG frames of startup/list loading, in addition to the runtime motion sampling and off-track cycle-boundary checks. Preview captures a visible in-cycle frame, not the reset point. Video records real browser execution. This is stronger evidence than computed transforms alone, but still does not establish behavior of KernelSU Next's actual Android WebView.

No detail layout, restore behavior, configuration format, platform commands, bridge, security validation or boot policy is changed in this repair. main remains unchanged.

Device checks remain necessary: actual Manager interfaces, WebView lifecycle and cache behavior, prefers-reduced-motion as reported by Android, system keyboard/insets/scaling, and physical-device animation/long-list frame pacing.
