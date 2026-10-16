# Prototype testing

## Automated results

Verified on the current branch after implementation:

- `npm test` — **12 tests passed**. Covers the one-time delivery state machine, inventory and reward consistency, transaction rejection, clock rollover/rest, save/load fields, corrupt-save backup recovery, interrupted temporary-save recovery, world bounds, pier/water collision, parcel visibility, cabin roof cutaway, and follow-camera collision distance.
- `npm run build` — **passed**. Vite produced a local static build; the game JavaScript bundle is about 579 KB (about 148 KB gzip). No build warning remained.
- `node --check` for all game modules — **passed**.
- Vite development server on `0.0.0.0:5173` — **served the game and local Three.js modules with HTTP 200**.
- Headless Chromium 153 / SwiftShader smoke test at 1280×720 — **WebGL 2 initialized, the canvas rendered, and there were no browser console/page errors**. A short interactive pass exercised keyboard movement, drag-to-orbit fallback, mouse-wheel zoom, opening Mira's dialogue, accepting the errand, collecting the pier parcel, returning it for 35 credits, sleeping to advance the day, changing camera mode, saving locally, and reloading the page with task/currency/day/camera/position restored.
- The same software-rendered headless run measured **18.7 FPS over 3 seconds** at 1280×720 after reducing draw calls and disabling dynamic shadows by default. This is a headless SwiftShader observation, not an N100 measurement and not a claim about Windows hardware performance.

The browser test used a development-only hook enabled by `?qa=1`; it is removed from the production build. The normal game remains playable using the documented controls.

## Manual playthrough

1. Run `npm install` once, then `npm run dev`; open the local URL shown by Vite.
2. Click the 3D world to capture the mouse. Walk north with **W** toward the Lantern Post; use **D** to close the final distance to Mira. Press **E** and **Enter** to accept her parcel errand.
3. Follow the amber marker down the pier and press **E** at the parcel. Return to Mira and choose the delivery response. Confirm the balance changes from 85 to 120 credits and the objective completes.
4. Enter the open-front cabin to the west and press **E** at the bed to advance to the next morning.
5. Press **V** to check both perspectives. In third-person, move the mouse to orbit and scroll to zoom; use the field kit to adjust sensitivity, FOV, inversion, and shadows.
6. Press **F5** to save, refresh the same local game origin, and confirm the saved location, day, currency, errand state, and camera preference return. **F9** loads the selected slot during a session.

## Limits of this QA pass

- The headless browser has no physical mouse/keyboard feel, and its SwiftShader rate is not representative of an Intel N100 integrated GPU.
- No N100/8 GB hardware is attached to this environment; profile it there before setting a release performance target.
- The current deliverable is a browser-playable Windows prototype. It is not a native Windows executable, and native packaging/export still needs an available desktop engine/toolchain.