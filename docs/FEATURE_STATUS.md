# Feature status · cross-platform foundation 0.2.0

**Tested** here means automated unit/browser evidence, not Android hardware verification. **Implemented / native QA pending** means native code/configuration exists but an APK/device has not exercised it.

## Audit boundary

The supplied baseline was `4ccb7d6`, and reported commit `c75a399` could not be found locally or through GitHub. The detailed evidence is in [the audit](AUDIT_2026-10-16.md). This milestone preserves what actually exists instead of claiming the missing career/housing/furniture milestone is present.

## Shared playable game

| Feature | Status | Evidence / limits |
| --- | --- | --- |
| Procedural Morrow Bay and WebGL 2 | Tested | Development and production Chromium builds render locally with no page/console errors or runtime external requests. |
| Walking/running/jumping and collision | Tested | Keyboard browser pass, multi-pointer touch pass, analytic scene/collision tests. Physical feel still needs Windows/Android hardware. |
| First-/third-person cameras, orbit and zoom | Tested | V, repeat suppression, mouse drag, wheel, touch drag, View and dedicated zoom buttons. Pointer lock is present with fallback; physical lock feel unmeasured. |
| Mira Calder dialogue and one-time parcel errand | Tested | Ordinary keyboard playthrough without QA helpers, targeted touch workflow and unit reward/item consistency tests. |
| Credits and carried quest items | Tested | One parcel, one 35-credit reward, actual inventory view, save/import validation. No shop/economic expansion implied. |
| Rest, energy and day progression | Tested | Touch bed interaction advanced day/restored energy; unit rollover/rest tests. |
| Local slots and schema migration | Tested | Original namespace preserved; schema 1 → 2; staged/backup recovery, write failure and readback tests. Browser save, tab close/reopen and reload verified. |
| Safe import/export and slot targeting | Tested in browser; native QA pending | Real browser download/file import, validation/consent, active vs selected slot, future/unsupported data protection. Native sharing and persistence need APK tests. |
| Character animation | Partial | Existing procedural idle/walk/run limb animation, no authored skeletal animation. |

## Cross-platform presentation

| Feature | Status | Evidence / limits |
| --- | --- | --- |
| One gameplay/action foundation | Tested | Device-independent input unit tests and all existing gameplay tests. No duplicate platform rules. |
| Responsive shared HUD/dialogue/field kit | Tested | Phone/tablet/desktop sizing, rotation and safe-area simulation; readable scrolling panels, 44px button targets, focus trap and confirmation dialogs. Not a full accessibility audit. |
| Windows controls and mouse-accessible menus | Tested in headless Chromium | Original keys preserved; inventory/journal toolbar added; fullscreen entered/exited through the production button. Not a native EXE. |
| Android touch presentation | Tested in browser emulation | Independent joystick + right-look + third-finger jump, run toggle, camera/view/zoom, inventory, journal, dialogue, interaction and settings. Browser emulation is not Android WebView certification. |
| Hybrid input | Tested at action/capability level | Keys still work with touch enabled; per-source holds/axes and one-shot/compatibility-click suppression. Windows touch hardware/gamepad not tested. |
| Low/Balanced/High and resource optimizations | Tested | Geometry/material reuse, extra static instancing, render scale/shadows/draw distance. Software-renderer metrics only; no N100/Android FPS claim. |
| Pause-aware rendering / web lifecycle | Tested in browser | No RAF frames while paused, neutral-input resume, simulated blur/focus flush save. Native interruptions still need physical tests. |
| WebGL interruption recovery | Implemented | Context loss/restoration listeners and visible pause/recovery state; GPU-driver/Android recovery not device-tested. |

## Native Android shell

| Feature | Status | Evidence / limits |
| --- | --- | --- |
| Capacitor reuse of Vite dist | Configured and synced | Native Android project, pinned plugins, Gradle wrapper, no development server URL. |
| Launcher/launch identity | Generated and structurally tested | Existing SVG-derived legacy/round/adaptive/monochrome icons and dark launch theme. Launcher masks not visually checked on a phone. |
| Native pause/resume/Back | Implemented / native QA pending | App plugin bridge; pure Back-priority tests plus browser integration simulation. |
| Native save adapter / JSON sharing | Implemented / native QA pending | Preferences mock restart/failure/order tests, Filesystem cache export, restricted FileProvider and Share bridge. No actual native restart/share-sheet test. |
| APK | **Not built** | Preflight fails clearly: no JDK 21, SDK API 36 / build tools / platform-tools / command-line tools. Exact completion commands in [ANDROID.md](ANDROID.md). |
| Android emulator / real devices | **Not tested** | No emulator, adb, phone or tablet attached. |
| Intel N100 / 8 GB | **Not tested** | Only sandbox Chromium/SwiftShader software observations. |

## Missing baseline features / later milestones

The café/provisions building is scenery. Shop purchases/consumables, café applications/interviews/hiring/shifts/wages, Bayview leases/rent/renewal, furniture ownership/catalog/placement/editing/deletion and appearance personalization are **not implemented in the supplied checkpoint or this deliberately scoped milestone**. There are no fake visible buttons claiming otherwise. Neither a C shortcut nor touch construction controls are advertised as working.

Recover/reconcile the reported gameplay checkpoint if available; otherwise add these shared state/rule/UI loops incrementally with save migrations and transaction regression tests. Then expand regions, transport, social systems, resources, cooking, performances, cyber-city and narrative only after real-device cross-platform validation. Automatic cloud synchronization, a native Windows executable, controller bindings, a huge streamed map and a finished RPG ending are not shipped here.
