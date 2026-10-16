# Shared Windows + Android architecture

## Reuse, not a port

The audited prototype's procedural Morrow Bay, character animation, analytic collision, first/third-person camera rules, Mira's errand, currency, energy, inventory and day progression are reused. There is no second world, Android-specific quest implementation, engine change, or replacement starter.

```text
keyboard / mouse / touch / future controller adapter
                  ↓
InputBindings → ActionInput (axes, look, zoom, held actions, one-shot edges)
                  ↓
game.js: one movement/camera/interaction loop ↔ GameState
                  ↓                              ↓
        Three.js world/character          validated schema-2 document
                  ↓                              ↓
        one DOM GameUI + tokens       browser localStorage / native Preferences
                  ↓
       viewport/capability presentation
```

## Modules

| Module | Responsibility |
| --- | --- |
| `src/main.js` | Lightweight shared shell, CSS and async game boot with a visible failure state. |
| `src/game.js` | Original runtime moved out of the entry point: camera, player physics, world interactions, action dispatch, save orchestration, native Back priority, pause-aware frame scheduling. |
| `src/game-state.js` | Platform-free quest/time/economy rules, safe schema validation/migration, slots and portable documents. |
| `src/input.js` | Device-independent Move/Look/Zoom plus Jump, Run, Interact, Switch camera, Inventory, Phone, Pause, Confirm, Cancel, Save, Load. A reserved construction action is not a working construction feature. |
| `src/input-bindings.js` | Physical key codes, pointer lock + mouse fallback, wheel, joystick and independent touch pointers. Capability detection and disposal of DOM listeners. |
| `src/ui.js` / `src/styles.css` / `index.html` | One HUD, toolbar, context action, dialogue, field/inventory/journal panel, item cards, settings and confirmation dialog. No gameplay transactions duplicated in markup. |
| `src/platform.js` | Lazy native lifecycle/exit adapters, pure Back-priority function and rendering preset definitions. |
| `src/storage.js` | Browser/native adapter selection, ordered Preferences cache/flush, portable browser download or Android cache-file/share-sheet export. |
| `src/world.js` / `src/character.js` | Shared procedural scene, props, NPC, collision, roof cutaway and animation. |
| `src/scene-resources.js` | Dispose reused geometries, materials, textures and light shadow targets exactly once on development teardown. |
| `android/` | Thin Capacitor host, Gradle wrapper, app identifiers and local launcher resources. No gameplay implemented in Java. |

## Input contract and mixed devices

- Movement is an analog vector with a dead zone and a magnitude no greater than one. Most recently active non-neutral source wins. Keyboard plus joystick cannot double speed; releasing one source restores the other.
- Run has source-specific holds. Discrete edges use a Set drained once per frame. Repeated keydown events do not retrigger actions. UI buttons retain native keyboard activation without also emitting a gameplay Enter/Space.
- Touch game buttons act on their own pointer-down, including a non-primary/third finger; their compatibility click is ignored. Mouse and keyboard retain real button clicks.
- Only the canvas handles look/wheel. Only the joystick handles its captured pointer. UI gestures never bubble into a document-wide look handler. Touch look begins on the right 58% of the world and supports a separate movement pointer.
- Menus/dialogue/confirmations block world input. Enter/E can respond to dialogue; Escape cancels the top UI. Editable inputs do not send movement/interaction actions.
- Blur/background, pointer cancellation, viewport rotation, load and UI transitions clear held keys, pointers, run toggle and queued jump/look. InputBindings and lifecycle listeners are explicitly disposed on HMR.
- There is an action contract for a future controller, **not a shipped gamepad binding**.

## Shared responsive design system

Tokens cover colors, typography, spacing, radii, glass borders, safe areas and a 44px minimum button target. Reusable button/panel/dialogue/setting/item-card/confirmation classes supply one visual identity. The game uses installed system fonts; no external font downloads.

- Desktop: complete keyboard/mouse control; side field panel; optional pointer lock; toolbar and prompts remain mouse-accessible. No virtual controls on fine-pointer-only devices.
- Capability policy: Automatic considers `maxTouchPoints` / `any-pointer`, with explicit On/Off for hybrid devices. Mouse capture/drag and keys remain usable even with touch controls visible.
- ≤760px: compact header; ≤600px portrait: vertical reachable toolbar and full-width menu; ≤520px height: compact landscape HUD; very short/narrow screens omit the HUD objective description but keep it in the journal.
- Touch: independent lower-left joystick, right-look world region, run/jump, view, third-person zoom, and context interaction. Ambient desktop control text is hidden, rather than competing with the thumb areas.
- Panels have independent vertical scrolling/overscroll containment. Touch camera/joystick use `touch-action: none`; panels use `pan-y`. Viewport metadata does not disable user scaling.
- `viewport-fit=cover`, dynamic viewport height and safe-area tokens handle notches/system bars. Capacitor 8's SystemBars injected `--safe-area-inset-*` values take precedence over browser `env(...)`, avoiding duplicate padding on older WebViews.
- Modal roles/descriptions, visible focus rings, a topmost focus trap, conservative confirmation focus, accessible names and reduced-motion CSS are shared. This is not a claim of a full screen-reader accessibility audit.

## Lifecycle and rendering

One active RAF chain advances gameplay only when no modal is open. Opening a panel/confirmation paints at most an invalidated frame, then stops scheduling. Changed camera/graphics/viewport values request a single paused repaint. Background/blur cancels RAF, saves the active journey and clears input. Resume leaves a pause panel up; time does not fast-forward and old held input cannot continue. A WebGL context loss pauses and attempts a save; restoration reapplies graphics and returns paused.

Native `App.appStateChange` and `App.backButton` are lazy-loaded. Browser visibility/pagehide/focus events also work in web builds. Back priority is: cancel confirmation → close dialogue/detail panel → reserved future construction exit → open pause → offer exit from pause. Escape on desktop closes the pause panel instead of exiting the browser. Native quit awaits persistence; a failed write requires a second explicit discard confirmation.

### Rendering optimization and bundle review

- Unit cube/plane geometry and dimension-keyed cylinders are reused. Materials are cached using their complete options, avoiding incorrect material aliasing.
- Compatible static root boxes are instanced by material/shadow state. Movable parcel/NPC meshes and the two cutaway roof parts keep independent transforms. Analytic collision remains unchanged.
- Existing instanced trees/road marks/pier rails are retained. Frustum culling remains enabled. Camera collision no longer allocates per-axis arrays per box per frame.
- Low/Balanced/High set maximum DPR **0.85 / 1.2 / 1.75**, far plane **105 / 180 / 220**, shadow resolution **512 / 768 / 1024**, default shadows off/off/on. Resolution scaling **60–100%** is separate. The world/collision/quest rules do not change.
- Procedural signs remain two small 512×192 CanvasTextures. No large textures, new asset packs, post-processing, streaming region or unnecessary online dependencies were introduced.
- Boot and native file/share/Preferences/App adapters are split by real loading boundaries. The essential Three.js renderer is still the bulk of the ~602 kB game chunk; hiding it behind artificial shards would not reduce the work needed to enter this small world. The existing 700 kB warning limit was not raised to mask a new problem. Desktop does not fetch the native file/share modules until needed.
- Shared resources are explicitly disposed during development teardown. Context restoration relies on Three.js re-uploading retained CPU-side resources. Actual Android GPU memory/thermal behavior remains unverified.

## Save contract and safety

`schemaVersion: 2`, ISO `savedAt`, and `state` with day/minute/credits/energy/taskStage, sealedParcel/shells inventory, player transform, camera preferences, graphics and touch-presentation preference. Schema 1 migrates by filling the new preferences; all original gameplay fields are preserved. The historical `beyond-destination.v1.slot-{1,2,3}` namespace is deliberately unchanged.

Critical gameplay fields must validate; unknown schemas, invalid currency, inconsistent quest parcel counts, unrecognized state/inventory gameplay fields, non-finite transforms, oversized imports, invalid camera values and malformed JSON are rejected. Missing/invalid non-gameplay preferences safely default. No absent furniture/career save format is invented or promised compatible.

Writes retain a readable prior primary as `.bak`, validate a staged `.tmp`, write/read-check the primary, then remove the staged copy. Corrupt-primary recovery never destroys an already valid backup merely to retain corrupt data. Loads prefer committed primary, then temporary, then backup; newer primary/temporary schemas block automatic loading/writing instead of silently falling back to old fields.

The UI separates active journey from selected save/load target. Autosave cannot redirect to another occupied slot just because the dropdown changed. Explicit replacement/import requires consent. Load/import compares the current runtime fingerprint with the last durable save before discarding changes. Export is a validated, account-free document, not cloud synchronization.

Native PreferencesStorage preloads the known keys, can copy previous WebView localStorage saves without deleting them, and queues writes/removals in order. `GameState` remains synchronous and platform-free; the runtime awaits `flush()` before reporting native durability. Failed native operations stay queued for retry. No save system can guarantee the last frame survives abrupt OS power loss; exported backups and staged recovery remain important.

## Scope boundary

The original checkout has no shop/career/interview/shift, lease, construction, furniture or appearance system. The UI does not expose fake apps/catalogs for those features. Add those rules once the reported missing checkpoint is reconciled, as shared state modules with migrations and transaction tests; input/presentation/native wrappers should not grow separate implementations.
