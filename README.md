# Beyond Destination

**Beyond Destination** is an original open-world life-simulation RPG. This repository now contains the first playable 3D slice: a small coastal neighborhood called Morrow Bay.

## Run the game

Requirements: Node.js 20.19+ (or Node 22.12+) and npm. After dependencies have been installed:

```bash
npm install
npm run dev
```

Open the local URL printed by Vite (normally `http://localhost:5173`). The prototype runs entirely on the device and does not contact a game server or require an account. To make a static offline build:

```bash
npm run build
npm run preview
```

`launch-windows.bat` starts the local game on Windows after `npm install`; it opens the local game in the default browser. This is a browser-playable Windows prototype, not yet a native `.exe`. Godot was evaluated as the preferred desktop engine, but no Godot installation or reachable official binary was available in this environment. See [the implementation plan](docs/IMPLEMENTATION_PLAN.md).

## Controls

| Input | Action |
|---|---|
| WASD | Walk |
| Shift | Run |
| Space | Jump |
| Mouse | Look / orbit camera (click the world to capture the mouse) |
| V | Switch first-person / third-person |
| Mouse wheel | Zoom third-person camera |
| E | Talk, collect, or use a nearby object |
| Enter | Choose the current dialogue action |
| Escape | Release the mouse / open or close the field settings |
| F5 / F9 | Save / load the selected slot |

In the first errand, speak with Mira Calder at Lantern Post, accept the parcel delivery, collect the parcel on the pier, and return it to Mira for 35 credits. The bed in the cabin advances the day and restores energy. The objective card and contextual prompt show what can be done nearby.

The field settings let you choose among three local save slots, adjust mouse sensitivity and field of view, toggle vertical look inversion, and disable dynamic shadows for lower graphics load. Saves are stored in the current browser's local storage; use the same browser and local origin to load them later.

## Project structure

- `src/main.js` — game loop, input, player/camera, interaction routing, and UI wiring.
- `src/world.js` — low-poly Morrow Bay scene, geometry, colliders, and interactables.
- `src/game-state.js` — life-sim state, task flow, clock, validation, and versioned multi-slot saves.
- `src/ui.js`, `src/styles.css` — in-game HUD/dialogue/settings presentation.
- `test/` — automated tests for progression, economy, save validation, and recovery.
- `docs/FEATURE_STATUS.md` — honest implementation and test status.
- `docs/TESTING.md` — automated results, browser QA notes, and a manual playthrough checklist.

## Development status

This is a deliberately small playable foundation, not a completed planet or a finished RPG. Current scope and remaining work are tracked in [Feature status](docs/FEATURE_STATUS.md).