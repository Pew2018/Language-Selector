# Language Selector Classic WebUI

This independent module follows TurboIMS-Classic-WebUI-Design-Spec-v1.0, not its IMS backend.

## Presentation

- 56 px toolbar/navigation, 620 px maximum content width, flat groups or 2 px corner cards.
- Primary tabs: 应用语言 / 设置. Application languages and appearance are child pages.
- System/light/dark themes; OnePlus Classic and Material seeds; immediate custom HEX preference.
- Separate semantic OKLab-derived color roles, readable text and normal/pressed button surfaces.
- Independent toolbar, section and return-icon coloring. Default theme follows system, seed #42A5F5; cards and extended coloring off.
- 112 × 48 px primary/tonal buttons; stable labels; fine switch tracks and 16 px thumbs.
- Confirmed-tap ripple: per-control passive handlers, pointer cancellation, movement and scroll checks, 360 ms animation/500 ms cleanup. Reduced motion creates no ripple.
- Centered custom dialogs with radio semantics, focus trap/return, Escape/back cancellation and short transitions.
- Real History API: primary tabs replace; child pages and temporary dialogs push; scroll restored without rerunning answered confirmations.

## Boundaries

The internal config.v1 format and boot scripts are unchanged. Appearance uses separate `ls.*` browser preferences and never writes root configuration. Locale writes are explicit, serialized and read back for the same Android user. The bridge prefers asynchronous spawn and retains callback-based exec for older hosts. Timeout does not cancel a root operation; uncertain results block further mutations until reload.

`colors.js` and `feedback.js` adapt the reference implementation from Pew2018/TurboIMS; `ui.js` contains independent routing and dialogs. Native status/navigation icon mode, keyboard and manager back gestures require physical-device validation.

## Verification

Run `node --test tests/*.test.js` for existing boot/config regression plus palette and asset checks. Palette samples include all presets, extreme seeds and 512 deterministic RGB values in both modes.

With Playwright/Chromium installed, run `node tests/browser.cjs`. It uses a mocked KernelSU host, never real root commands. CI additionally generates 320/360/412/760 px screenshots. Browser verification is not Android device verification.

## Search and saved-language feedback

- App and locale search use 56 px filled containers, persistent 12 px labels, 16 px input, leading search icons and 48 px clear controls. Focus uses a single accented bottom indicator instead of an additional input outline. Keyboard focus remains visible; IME input filters after composition commits.
- Module-configured apps lead the list and show an accented checkmark and readable language name. Actual Android state remains separate, including discrepancies and read failures.
- Diagnostics summarize boot results in readable text; raw output remains in the expandable section. Locale-command availability checks both help entries regardless of their order.

References: [Material Design text fields](https://m2.material.io/design/components/text-fields.html), [Material touch targets](https://m1.material.io/usability/accessibility.html). Assets and styling remain local; no runtime dependency is added.
