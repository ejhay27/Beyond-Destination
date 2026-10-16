# Cross-platform verification · 2026-10-16

## Baseline first, before source edits

- HEAD `4ccb7d6a456fe599b33ea7e95f6abe29337eb099`; clean working tree; recovery tag `checkpoint/pre-cross-platform-4ccb7d6`.
- `npm ci`: passed, **0 vulnerabilities**.
- `npm test`: **12/12 passed**.
- `npm run build`: passed, **578.77 kB JS / 147.98 kB gzip**, **14.58 kB CSS / 4.14 kB gzip**. The existing warning limit was 700 kB, so there was no current warning to hide.
- Reported milestone `c75a399` was not present; GitHub returned HTTP 422. No previous browser QA report was counted as current evidence. Full source/tooling audit: [AUDIT_2026-10-16.md](AUDIT_2026-10-16.md).

## Incremental gates actually run

| Phase | Verification |
| --- | --- |
| Action contract/adapters | **18/18** unit tests + production build passed before proceeding. |
| Responsive UI/shared runtime + persistence integration | Existing/action **18/18** tests and production build passed; initial live WebGL browser smoke. |
| Geometry/instancing + migration/storage/Back checks | **32/32** unit tests + production build passed. Original world tests retained collision/cutaway checks and gained explicit resource/instancing assertions instead of relying on unbatched object counts. |
| Android config/resources + disposal/failure guards | **36**, then **37**, then final **38/38** unit tests; build and Capacitor sync passed. |
| Browser regression | Final complete Playwright run: **7/7 passed**. Production web smoke also passed. |
| Native build preflight | `npm run android:debug` successfully built/synced web assets, then deliberately **exited 1** because JDK/SDK prerequisites are absent. No Gradle compile/lint or APK verification was possible locally. |

Exploratory browser runs exposed QA timing assumptions: reading a hidden stale prompt, checking an action before the next render frame, and variable timed pier alignment. The harness now waits for visible proximity/dialogue and polls processed actions. Its ordinary route stays within the shared pier corridor. These failed exploratory runs are not counted as successful QA; the final full suite passed after fixes.

## Final automated checks

- `npm test` — **38/38 passing**, including all original gameplay assertions. Covers quest/reward uniqueness, economy rejection, clock/rest, save validation/recovery, schema-1 migration, portable round-trip, active-slot safety, malformed/future/unsupported data protection, primary readback failure, native queue/restart/retry mocks, Back priority, normalized/mixed input, resource disposal, collision/cutaway, native config and actual generated icon dimensions.
- `npm run build` — **passed**, 32 transformed modules. Required game chunk **602.25 kB / 156.41 kB gzip**, CSS **21.02 kB / 5.21 kB gzip**, small boot and lazy Capacitor/plugin chunks. No warning; original threshold unchanged. Three.js is essential on first world load, not split just to conceal its size.
- `npx cap sync android` — **passed** with App, Preferences, Filesystem and Share native plugins.
- `node --check` for all `src/*.js` and `scripts/*.mjs` — **passed**.
- `npm audit` — **0 vulnerabilities**. Core/Android/CLI pinned at 8.4.3; a newer CLI's unnecessary vulnerable transitive dependency was avoided rather than forced into the runtime.
- `git diff --check` — **passed**.
- `npm run android:icons` — produced real launcher resources from the existing mark; tests check PNG headers/dimensions and vector source paths. It does not build an APK.

## Browser QA actually completed

**Environment:** Linux sandbox, Node 22.22.3, Chromium **153.0.8010.0** supplied as an npm development-only headless binary, ANGLE/SwiftShader WebGL 2. No physical input/GPU or Android OS is being emulated by Playwright's viewport/input settings.

`npm run test:browser` — final **7 passing** tests, about 1.7 minutes, no skipped tests:

1. **Ordinary desktop errand without `?qa=1`, developer teleportation or gameplay helpers.** Real keys walk from spawn to Mira, accept dialogue, traverse the pier, collect, return and deliver once. Credits become 120; save with F5, close the tab and reopen the same origin with the completed quest and empty parcel inventory restored. Reading the resulting save is an assertion, not a state-changing helper.
2. Desktop walking/running/jump, V repeat suppression, mouse drag look, mouse-wheel zoom, menu/focused-input isolation, paused-render checks, window resize, graphics preset, inventory/journal and Escape. Mouse UI buttons exercised; writing generated QA HTML is verified not to trigger a Vite reload. Generated Android/QA folders are excluded from the development watcher.
3. Active-vs-selected slot protection, quest autosave remaining in its active slot, F9 unsaved-load cancellation/confirmation, and refusing to overwrite a newer save without explicit consent.
4. **Chromium CDP multi-touch events** drive independent joystick and camera fingers plus a third-finger Jump. Run toggles, movement is cancelled on menu entry, return has no held motion, touch View switches once, and Back priority is simulated through the platform callback route.
5. Targeted touch interactions with Mira/parcel/bed, dialogue Back cancellation, actual carried-item inventory, one-time reward, day progression, slot save/reload, real JSON download, invalid import rejection, valid schema-1 import cancellation/confirmation. This targeted test uses the existing development placement helper to reach each integration point; unlike test 1 it is not an ordinary playthrough.
6. Resize/rotation across **320×568, 360×640, 393×851, 768×1024, 1024×768, 844×390, 568×320**; important HUD/control bounds and no overlap, independent panel scroll/resume, no page horizontal overflow, simulated safe-area insets.
7. Browser blur/focus lifecycle events flush a valid save, stop RAF, return paused and clear held movement; reload restores the saved position. These are browser events, **not physical screen-lock/phone-call tests**.

`npm run test:production` against `npm run preview -- --port 4173 --strictPort` — **passed**:

- Built (not Vite development) desktop and 844×390 touch game boot/render.
- Production exposes **no `__BD_QA__`** even with `?qa=1`.
- Actual fullscreen button entered **and exited** fullscreen in Chromium.
- A real schema-2 local save, phone journal and resume work.
- **0 page/console errors, 0 runtime requests outside the game's own origin.**

Dev/preview servers bind `0.0.0.0`, permit preview hosts and have no host/iframe rejection warnings. QA hooks are development-only and opt-in; production does not ship them.

Screenshots, JSON reports, traces and temporary Chromium libraries are under ignored `.artifacts/`. Regenerate them with the scripts instead of committing large diagnostic artifacts. On non-Linux-x64, install Playwright's browser or supply `BROWSER_PATH`; the fallback is test infrastructure only.

## Measured rendering observations, not target hardware promises

At **1280×720 / DPR 1**, initial balanced view, shadows off:

- Before extra static batching/geometry sharing, a live browser observation reported **110 draw calls, 92 uploaded geometries, 2 textures**.
- After optimization the diagnostic script observed **95 draw calls, 30 uploaded geometries, 2 textures**. Counts vary with view/culling; they are not a universal draw-call budget.
- A 5-second headless sample measured **12.6 FPS Balanced** and **10.0 FPS Low** (Low DPR cap 0.85). The fact that Low was not faster in this noisy software run is a reason **not** to extrapolate or claim a controlled speedup. These are sandbox observations only.
- Chrome's coarse `performance.memory` estimate was **20.5 MB JS heap** in both samples; this is not total RAM/GPU/native process memory.
- **0 additional rendered frames over a 1.2-second paused interval.** The browser regression suite separately checks stopped movement and paused rendering.

Driver: `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)`. No Intel N100/8 GB PC, Android phone/tablet GPU, emulator frame rate, 15-minute thermal profile or total native memory measurement is available. Profile on those devices before promising any FPS.

## Native Android: not performed

- No JDK, Android SDK/adb/emulator, system Gradle or real device is installed/attached. The committed wrapper removes the need for system Gradle **once JDK/SDK and distribution access exist**.
- `android:doctor` / `android:debug` report missing **JDK 21, API 36, build tools 36.0.0, platform-tools, command-line tools**. The latter stops before Gradle.
- **No APK file exists**, no emulator was launched, no physical app restart/Back/share-sheet/file-picker/rotation test occurred, and no native CI run was claimed. The manual workflow is configuration, not a completed remote build.
- Native Preferences has mocked restart/order/failure tests only. Native App lifecycle has browser/pure-priority simulation only. Context recovery is implemented but Android GPU-driver behavior is not verified.
- [ANDROID.md](ANDROID.md) gives exact toolchain/build/signature/hash/install steps and a device QA gate.

## Gameplay that cannot be regression-tested here

The supplied checkpoint contains no shop purchases, café applications/interviews/shifts/wages, Bayview rentals/renewals, construction/furniture edits or appearance personalization. They are **not working features or passed tests** in this milestone. Do not read this report as certifying them.

## Hands-on follow-up gate

On Windows (especially N100/8 GB), confirm physical pointer-lock feel, wheel/drag, high-DPI/windowed/fullscreen, all shortcut focus contexts and accessibility/display scaling. On Android perform the complete [native device checklist](ANDROID.md#required-emulator-and-physical-device-qa-not-yet-performed), including airplane-mode launch, real native Back, lifecycle interruptions, save force-stop/restart and PC ↔ Android file transfer. Only then expand/reconcile the missing gameplay milestone.
