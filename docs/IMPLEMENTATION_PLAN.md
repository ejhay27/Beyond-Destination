# Beyond Destination — implementation plan

## Repository checkpoint

- Inspected the repository before changing it: the initial project contained only `README.md`; there were no game sources, assets, dependencies, or engine project to preserve.
- The working tree was clean at the supplied baseline commit `312e4d4` on `arena/0bb89570-beyond-destination`. That commit is the recoverable pre-implementation checkpoint.
- No Godot executable/editor is installed in the environment. A probe of the official GitHub release endpoint redirected the binary download to a release-asset host that is not reachable here. Godot remains the preferred future native-export target, but an un-runnable project would not satisfy the first playable milestone.

## Chosen first-milestone implementation

Build a real, single-player 3D game slice in Three.js, Vite, and plain JavaScript modules. It runs locally in a modern Windows browser and has no server-side services or run-time network dependencies. This is a deliberate, documented fallback to keep the milestone playable and testable in this environment; it is not represented as a native Windows executable. Keep gameplay state, world generation, input, presentation, and persistence separated so a later Godot port or native packaging effort does not have to undo a monolithic prototype.

## Immediate playable slice: Morrow Bay

1. A compact, hand-authored coastal neighborhood, dock, cabin, café, landmarks, and low-poly scenery.
2. A controllable avatar with walk/run, collision, a third-person follow camera, mouse orbit and zoom, plus a first-person view toggle.
3. One named NPC, Mira Calder, with contextual dialogue and a one-time parcel errand: accept, collect the parcel at the pier, return it, and receive 35 credits.
4. A real rest interaction that advances the day, restores energy, and preserves the world clock.
5. Three local save slots with versioned, validated JSON, a temporary write, and a recoverable previous-save copy. Save/load includes task and inventory, money, clock, player transform, camera preferences, and energy.
6. A compact in-game HUD, objective, interaction prompt, dialogue, and settings/pause panel; no title-menu-only or dashboard substitute.

## Validation plan

- Run the production build and the project's automated state/persistence tests.
- Start the game server and verify the game entry point, bundled Three.js code, and static assets return successfully.
- Exercise the movement/camera/interaction/save loop in a headless Chromium build where possible, and record separately any controls that still need a hands-on desktop-browser check. The environment has no installed desktop browser; a temporary headless Chromium/SwiftShader package was used for the smoke pass.
- Keep the visual scene lightweight: procedural meshes, no large texture packs, capped device pixel ratio, and configurable shadows. Establish measured performance only when a real browser/device can be profiled; do not claim an N100 benchmark without one.

## Next milestone after the prototype

Add an apartment interior, item/shop transactions, and one complete café shift/interview loop. Before growing the world, profile the current slice on the stated N100 / 8 GB target and decide whether to continue the browser runtime or provision a Godot editor/export toolchain for the Windows-native release path.