# Feature status

Status key: **Tested** = exercised by an automated test or observed in a running build; **Implemented** = present in code but still needs the indicated integration/hardware test; **Partial** = useful subset only; **Planned** = not implemented.

## Playable foundation

| Feature | Status | Notes |
|---|---|---|
| 3D environment and local launch | Tested | Procedural low-poly Morrow Bay; production build succeeds, local Vite modules return HTTP 200, headless Chromium initializes WebGL 2. |
| Walking/running and obstacle collision | Tested | Keyboard movement was exercised in the running browser; automated scene tests cover world bounds, walls, trees, water, and pier collision. |
| First- and third-person cameras | Tested | Headless browser verified mode switch, drag orbit fallback, and mouse-wheel zoom; automated scene tests cover follow-camera collision distance. Confirm pointer-lock feel in a normal Windows browser. |
| NPC proximity interaction and dialogue | Tested | Mira's dialogue opens in the running game and changes with errand state. |
| Money/inventory-changing activity | Tested | Parcel route was completed in the running game: inventory changed, parcel cleared, balance rose from 85 to 120 credits. Unit tests enforce one-time reward and inventory consistency. |
| World clock and day advancement | Tested | Clock rollover/rest have unit tests; the running bed interaction advanced the day to 06:00 and restored energy. |
| Persistent progress | Tested | Three browser-local slots, version validation, staged write, and backup recovery; browser save/reload restored quest, currency, day, camera mode, and location. |
| Character animation | Partial | Procedural idle/walk/run limb motion; no authored skeletal animation. |
| Graphics settings | Partial | Pixel ratio capped at 1.2; shadows default off and can be toggled. FOV, sensitivity, and vertical inversion controls exist; full device-specific tuning remains. |
| Windows native executable | Planned | Current deliverable is browser-playable on Windows, not a native `.exe`. Godot tooling was unavailable during this milestone. |
| N100 / 8 GB performance baseline | Planned | Headless SwiftShader measured 18.7 FPS at 1280×720 after initial draw-call/shadow reductions. This does not substitute for a measurement on the target hardware. |

## Later phases

| Feature | Status |
|---|---|
| Food, needs, and cooking | Planned |
| Apartment interiors and housing transactions | Planned |
| Construction and furniture placement | Planned |
| Complete job application, interview, and café shift | Planned |
| NPC schedules, relationships, and voiced dialogue | Planned |
| Weather, seasons, and latitude-aware auroras | Planned |
| World map and streamed regions | Planned |
| Vehicle ownership and driving | Planned |
| Phone, contacts, and navigation | Planned |
| Instruments, band, venues, and arcade minigame | Planned |
| Main mystery, complete ending, and post-game | Planned |
| Accessibility, Windows packaging, and release QA | Planned |

No population, planet-size, performance, or voice-coverage claims are made for unimplemented content.