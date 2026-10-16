# Beyond Destination

**One world. Your own journey.** A local-first coastal life-simulation RPG built with Three.js and Vite, with **one gameplay foundation and one responsive UI** for Windows browsers, Android browsers and a Capacitor Android shell.

## This milestone · 0.2.0

Morrow Bay remains a small playable neighborhood: walk/run/jump, collide with the environment, use first- or third-person cameras, help Mira Calder deliver a parcel for 35 credits, carry quest items, rest in the cabin, advance the day, and save your life in three slots.

New: shared action input, simultaneous touch movement/look/jump, responsive field kit/dialogue/inventory/phone journal, graphics presets, pause/resume/Back handling, schema-1 migration and portable save transfer. The Android project and launcher icons are checked in; **no APK has been built in this environment**. See [Android setup and verification](docs/ANDROID.md).

**Important audit finding:** the supplied checkout was `4ccb7d6`, not reported milestone `c75a399` (GitHub could not find it). There are **no existing café careers, shop transactions, Bayview rentals, or furniture/construction systems** in that checkpoint. They were not discarded, recreated, or claimed as working. [Baseline evidence](docs/AUDIT_2026-10-16.md) · [Feature status](docs/FEATURE_STATUS.md).

## Play on Windows or mobile web

Requirements: **Node.js 22.17+** and npm. No game server, account, remote fonts or runtime CDN is needed.

```bash
npm ci
npm run dev
```

Open the URL printed by Vite. On Windows, `launch-windows.bat` starts the same game after installation. To test from a phone on the same network, open the computer's reachable LAN address and Vite port, not the phone's `localhost`. Arena's live preview also exposes the same responsive game.

```bash
npm run build
npm run preview
```

The self-contained web build is in `dist/`. Serve it over HTTP/HTTPS (not `file://`). A locally served build works without internet; a remotely hosted web page still needs its host on a fresh load. There is no service-worker/PWA installation or automatic cloud sync in this milestone. The Android shell packages these same local assets for offline startup. This is not a native Windows `.exe`.

## Windows controls

| Input | Action |
| --- | --- |
| WASD / Shift / Space | Walk / run / jump |
| Click world / mouse drag | Capture the mouse, or drag to orbit if pointer lock is unavailable |
| Mouse wheel / V | Third-person zoom / first- or third-person camera |
| E / contextual on-screen button | Talk, collect, or use the nearby bed |
| Enter | Choose the focused dialogue response |
| Escape | Close the top UI, or open/close the field kit |
| I / P | Inventory / offline phone journal (also mouse-accessible) |
| F5 / F9 | Save / load the selected slot during world play |
| Field kit | Settings, save/load, import/export and fullscreen when permitted |

C/construction was **not implemented in the audited baseline**; no non-working construction shortcut or catalog has been added.

## Android and hybrid controls

- Lower-left analog joystick; drag the **right side of the world** to look at the same time.
- **Run** toggles running; **Jump** works with a third finger while moving/looking.
- **View**, **+ / −**, **Bag**, **Journal**, nearby interaction and field-kit buttons operate shared actions.
- Touch controls are capability-detected, not user-agent-detected. Choose Automatic / Always show / Hide in settings. Keyboard and mouse continue to work on hybrid devices.
- Opening UI, rotating, cancelling a pointer or leaving the app clears held controls. Touch controls never scroll the world page; panels scroll independently.
- Native Back closes a confirmation/dialogue/detail panel first, otherwise opens pause; Back from pause offers save-and-exit. A failed save requires explicit consent before discarding progress.

The field kit becomes a full-width phone panel and a desktop/tablet side panel. Short landscapes use a compact objective; the journal always contains the full objective and route. Safe-area insets and 44px minimum button targets are shared.

## Saves and transfer

- Autosave stays with the **active journey**, not a different slot merely selected in the dropdown. It runs on quest/rest actions, after 30 active seconds and on lifecycle interruptions.
- Explicit Save activates the selected slot; replacing another journey asks for consent. Load/import warns before discarding unsaved changes. Export preserves the current state without replacing a slot.
- Browser saves remain in the same original localStorage keys, per browser/profile/origin. Schema **1 → 2** migration adds only presentation settings and preserves all original gameplay fields.
- Android uses native **Preferences** storage with ordered staged/backup writes and an awaited flush. Preferences adapter restart/failure handling has unit tests, **not a native device test**.
- Export a `.beyond.json` in the field kit, copy/share it between PC and Android, and import it into the chosen slot. Android export uses its share sheet. Unknown/newer and malformed saves are protected from automatic replacement; import is validated before changing state.
- Clearing app/browser data or uninstalling the Android app removes local saves. Keep exported backups. OS termination during a write may recover the previous committed copy, not the last frame.

## Graphics and performance

Low / Balanced / High set rendering resolution caps, draw distance and shadow defaults. Render-resolution and shadows can be adjusted separately, without changing gameplay rules or save compatibility. New touch-only/Android journeys default to Low; existing saves retain their settings. Rendering stops behind menus and while backgrounded, and resumes paused with neutral input.

Geometry/material reuse and static instancing reduce GPU resources; [testing notes](docs/TESTING.md) report actual software-renderer observations. **Neither Intel N100 / 8 GB nor a physical Android device has been benchmarked. No target FPS is promised.**

## Development and verification

```bash
npm test                  # State, migration/storage, input, scene/collision and Android config
npm run test:browser      # Playwright: desktop and touch browser emulation, including ordinary errand
npm run profile:browser   # Running dev server: software-renderer diagnostics, not a device benchmark
npm run android:sync      # Build web assets and sync the native project (does not build an APK)
npm run android:doctor    # Verify local JDK/SDK prerequisites; fails clearly when absent
npm run android:debug     # Sync, preflight, Gradle assemble/lint, then verify an actual debug APK
```

Browser tests use a bundled npm Chromium fallback on Linux x64; it is a **development-only dependency**, not part of the game bundle. On other systems run `npx playwright install chromium` or set `BROWSER_PATH`. Browser traces/screenshots, builds, SDK paths, signing keys and APKs are ignored by Git.

- [Architecture and save format](docs/ARCHITECTURE.md)
- [Android toolchain, build steps and device QA](docs/ANDROID.md)
- [Actual verification and limitations](docs/TESTING.md)
- [Scoped implementation plan](docs/IMPLEMENTATION_PLAN.md)

**Next:** verify the Android shell on physical phones/tablets and the N100, obtain/reconcile the missing reported gameplay checkpoint if available, then add the career/shop/housing/construction loops to these shared rules—not to separate platform games.
