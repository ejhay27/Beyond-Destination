# Beyond Destination · scoped cross-platform milestone

## Recovery and audit

This session started on `arena/114d80af-beyond-destination` at immutable commit `4ccb7d6a456fe599b33ea7e95f6abe29337eb099`. Local recovery tag: `checkpoint/pre-cross-platform-4ccb7d6`; audit-only checkpoint commit: `907ee9c`. Work stays on the session branch; no main-branch replacement or new starter project.

The earlier Godot/future-engine discussion in the original prototype report is historical context, not this milestone's implementation direction. The existing procedural Three.js/WebGL/Vite game is already compatible with a thin Capacitor host and a shared responsive DOM UI. Replacing it with another engine would discard functioning code without addressing the actual platform/input/save work.

Reported construction milestone `c75a399` was not available in local or GitHub history. The verified source has the original Mira/parcel/rest/camera/save slice, not jobs, shop transactions, Bayview housing or furniture. See the immutable [baseline audit](AUDIT_2026-10-16.md).

## Steps implemented and checked

1. **Audit before edits.** Inspect source/UI/world/input/storage/tests/docs, run 12 baseline tests/build, query current Git/GitHub history and tooling, tag the clean baseline.
2. **Preserve the shared runtime.** Keep world/character/collision/state rules; move the runtime from the tiny boot entry into `game.js`, not a new game.
3. **Centralize input.** Shared normalized axes, look/zoom, edge/held actions, focus gating, reset/disposal and capability detection. Keep keyboard/mouse; add independent multi-pointer touch adapters.
4. **Responsive presentation.** One token/component system for HUD/toolbar/context button/dialogue/menus/settings/confirmations; inventory and local phone journal reflect actual state. Touch-first phone layout and desktop side panels, safe areas/rotation/scrolling/focus handling.
5. **Save compatibility and safety.** Preserve original slot keys/schema-1 progress, migrate to 2, guard unsupported/future data, keep backup/staged/readback checks, distinguish active journey from target slot, require discard/overwrite consent, provide validated portable JSON.
6. **Native and web lifecycle.** Pause and save, clear held input, return paused, prioritized Back and save-and-exit/discard consent; browser events and lazy native App plugin.
7. **Conservative rendering.** Reuse geometry/materials, batch suitable static meshes, keep cutaway/moving objects independent, remove some per-frame allocations, stop background/menu RAF, add presentation-only quality/resolution/shadow controls and explicit resource disposal.
8. **Android packaging configuration.** Pin Capacitor/plugins, generate Android host/Gradle wrapper, reuse existing logo for real launcher/launch resources, restrict shared files to cache exports, sync `dist`, add toolchain preflight/build verification script and an optional manual CI workflow.
9. **Verification and documentation.** Unit/state/scene/input/storage/config tests, ordinary no-helper desktop errand, multi-touch browser workflows, production/no-QA/fullscreen smoke, software-renderer resource measurements, exact Android finish/QA instructions.
10. **Push the reviewed work to the session branch.** Do not merge into `main` or publish a release APK without an actual verified build and device gate.

The unit/build gates were rerun throughout; actual commands/results and the limits of each test method are in [TESTING.md](TESTING.md).

## Blocked release gate, not a completed native release

The sandbox has no JDK 21, Android SDK/platform/build tools, adb or emulator, and cannot reach the required SDK/Maven/Gradle distribution hosts. The web build and Capacitor sync succeed; the native preflight correctly stops. **No APK, Android emulator run, physical phone/tablet run or N100 benchmark is claimed.** [ANDROID.md](ANDROID.md) supplies reproducible setup/build/signature/install steps.

## Next milestone in order

1. Build/signature-check the debug APK on a configured computer or the optional manual runner; complete emulator **and physical** phone/tablet lifecycle/input/save-transfer QA.
2. Profile the shared slice on Intel N100/8 GB and modest Android hardware (frame times, memory, draw calls, background cost and thermals). Tune only measured presentation costs, not gameplay rules.
3. Obtain/reconcile the missing `c75a399` or another real source checkpoint if it exists. Do not accept unfamiliar save fields merely to silently strip them. Reuse working career/shop/housing/furniture rules if supplied; otherwise implement these as small shared, tested rule/state/UI additions with migrations.
4. Add touch construction presentation **with** the actual construction/catalog/ownership/placement rules, not disconnected placeholder controls.
5. Expand coastal regions, mountains, parks, cities/cyber-city, transport, resources/cooking, music/social venues and the larger narrative gradually after the foundation/device gate. These are a vision, not completed features.

No automatic cloud synchronization, separate Android gameplay implementation, native Windows EXE or massive-map rewrite is part of this milestone.
