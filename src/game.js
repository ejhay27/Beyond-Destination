import * as THREE from 'three';
import { GameState } from './game-state.js';
import { createHumanoid } from './character.js';
import { createMorrowBay } from './world.js';
import { GameUI } from './ui.js';
import { disposeScene } from './scene-resources.js';
import { Action, ActionInput } from './input.js';
import { InputBindings, detectInputCapabilities } from './input-bindings.js';
import { createPersistence, exportSaveFile } from './storage.js';
import { bindPlatformLifecycle, nextBackAction, exitNativeApp, GRAPHICS_PRESETS, renderingOptions } from './platform.js';

const canvas = document.getElementById('gameCanvas');
const ui = new GameUI();
const persistence = await createPersistence();
const capabilities = detectInputCapabilities();
const state = new GameState(persistence.storage);
const bootLoad = state.loadSlot(state.selectedSlot);
if (!bootLoad.ok && (persistence.native || (capabilities.touch && !capabilities.fine))) state.graphics.quality = 'low';
let activeSlot = state.selectedSlot;
let activeSlotWritable = (bootLoad.ok && !bootLoad.recovered) || !state.slotHasData(activeSlot);
let savedFingerprint = null;
let fileOperation = false;
const scene = new THREE.Scene();

let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: false,
    alpha: false,
    powerPreference: 'low-power',
    depth: true,
    stencil: false,
  });
} catch {
  ui.showError('This browser could not start WebGL 2. Try a current version of Edge, Chrome, Firefox or Android System WebView with hardware acceleration enabled.');
  throw new Error('WebGL 2 is required to render Beyond Destination.');
}

renderer.setPixelRatio(renderingOptions(state.graphics, window.devicePixelRatio || 1).pixelRatio);
renderer.setSize(window.innerWidth, window.innerHeight, false);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.shadowMap.enabled = state.graphics.shadows;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const world = createMorrowBay(scene);
world.sun.castShadow = state.graphics.shadows;

const camera = new THREE.PerspectiveCamera(state.camera.fov, window.innerWidth / window.innerHeight, 0.1, 220);
camera.position.set(0, 3.2, 18);
const player = createHumanoid({
  skin: '#bd8e72',
  hair: '#292b32',
  top: '#557d7a',
  trousers: '#34434c',
  shoes: '#292d31',
  accent: '#d2b078',
});
scene.add(player.root);

const spawn = new THREE.Vector3(0, world.groundHeight(0, 10), 10);
if (bootLoad.ok && world.canOccupy(state.player.position[0], state.player.position[2], 0.34)) {
  player.root.position.fromArray(state.player.position);
  player.root.position.y = world.groundHeight(player.root.position.x, player.root.position.z);
  player.root.rotation.y = state.player.yaw;
} else {
  player.root.position.copy(spawn);
  if (bootLoad.ok) state.player = { position: spawn.toArray(), yaw: 0 };
}
player.visual.visible = state.camera.mode !== 'first';

const input = new ActionInput(() => requestFrame());
let bindings;
let touchMode = false;
let suspended = false;
let contextLost = false;
let animationFrame = 0;
let needsRender = true;
let autosaveAccumulator = 0;
let renderedFrames = 0;
let perfStart = performance.now();
let perfFrames = 0;
let measuredFps = 0;
let movementAmount = 0;
const moveVector = new THREE.Vector3();
const cameraTarget = new THREE.Vector3();
const cameraDirection = new THREE.Vector3();
const desiredCameraPosition = new THREE.Vector3();
const firstPersonForward = new THREE.Vector3();
const zeroUp = new THREE.Vector3(0, 1, 0);
let thirdPersonPitch = state.camera.mode === 'third' ? state.camera.pitch : 0.22;
let elapsed = 0;
let previousFrame = performance.now();
let uiRefreshAccumulator = 0;
let verticalVelocity = 0;
let grounded = true;
let jumpQueued = false;
let pointerLocked = false;
let nearby = null;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const smoothAngle = (from, to, amount) => {
  let difference = ((to - from + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return from + difference * amount;
};

function requestFrame() {
  if (!animationFrame && !suspended && !contextLost) animationFrame = requestAnimationFrame(frame);
}

function invalidate() { needsRender = true; requestFrame(); }

function syncSettingsPanel() {
  ui.setSettings({
    slot: state.selectedSlot, activeSlot, native: persistence.native,
    ...state.camera, ...state.graphics, ...state.settings,
    savedSlots: [1, 2, 3].filter((slot) => state.hasSave(slot)),
    occupiedSlots: [1, 2, 3].filter((slot) => state.slotHasData(slot)),
  });
}

function syncRuntimeToState() {
  state.syncRuntime({ position: player.root.position.toArray(), playerYaw: player.root.rotation.y, camera: state.camera });
}

function fingerprint() { syncRuntimeToState(); return JSON.stringify(state.createSaveDocument().state); }
function hasUnsavedChanges() { return fingerprint() !== savedFingerprint; }

async function saveProgress({ showMessage = false, slot = activeSlot, allowOverwrite = false, activate = false } = {}) {
  syncRuntimeToState();
  if (slot === activeSlot && !activeSlotWritable && !allowOverwrite) {
    if (showMessage) ui.showToast('This slot is protected. Export this life or explicitly confirm a replacement in the field kit.');
    return { ok: false, reason: 'protected-save' };
  }
  const captured = fingerprint();
  const result = state.saveSlot(slot, { allowOverwrite, select: activate });
  if (result.ok) {
    try { await persistence.flush(); }
    catch {
      if (showMessage) ui.showToast('The device could not finish writing. Keep the app open, retry Save, or export your life.');
      return { ok: false, reason: 'native-write-failed' };
    }
    savedFingerprint = captured;
    if (activate) activeSlot = slot;
    activeSlotWritable = true;
    syncSettingsPanel();
  }
  if (showMessage) ui.showToast(result.ok
    ? `Life saved on this device · slot ${String(slot).padStart(2, '0')}`
    : result.reason === 'protected-save'
      ? 'Unreadable or newer save protected. Export first, or explicitly replace it.'
      : 'Save failed. Storage may be full or unavailable. Export before closing.');
  return result;
}

async function manualSave() {
  if (fileOperation || ui.isConfirmOpen) return;
  fileOperation = true;
  try {
    const slot = state.selectedSlot;
    const replace = (!activeSlotWritable && slot === activeSlot) || (slot !== activeSlot && state.slotHasData(slot));
    if (replace && !await ui.askConfirmation({ title: 'Replace this saved life?', text: `Slot ${slot} already contains a journey or unreadable data. A readable previous copy is retained as backup. Unreadable data is replaced only with your confirmation. Export important saves first.`, accept: 'Replace & save', cancel: 'Keep both for now' })) return;
    await saveProgress({ showMessage: true, slot, allowOverwrite: replace, activate: true });
  } finally { fileOperation = false; }
}

function applyGraphics() {
  const options = renderingOptions(state.graphics, window.devicePixelRatio || 1);
  renderer.setPixelRatio(options.pixelRatio);
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  renderer.shadowMap.enabled = options.shadows;
  world.sun.castShadow = options.shadows;
  if (world.sun.shadow.mapSize.x !== options.shadowSize) {
    world.sun.shadow.map?.dispose(); world.sun.shadow.map = null;
    world.sun.shadow.mapSize.set(options.shadowSize, options.shadowSize);
  }
  camera.far = options.drawDistance;
  camera.fov = state.camera.fov;
  camera.updateProjectionMatrix();
  invalidate();
}

function applyTouchMode() {
  touchMode = state.settings.touchControls === 'on' || (state.settings.touchControls === 'auto' && capabilities.touch);
  bindings?.setTouchMode(touchMode);
  ui.setTouchMode(touchMode);
  ui.showCaptureHint(!pointerLocked && !touchMode);
}

function applyLoadedState() {
  const [x, , z] = state.player.position;
  if (!world.canOccupy(x, z, 0.34)) {
    player.root.position.copy(spawn); state.player.position = spawn.toArray(); state.player.yaw = 0;
  } else player.root.position.set(x, world.groundHeight(x, z), z);
  player.root.rotation.y = state.player.yaw;
  player.visual.visible = state.camera.mode !== 'first';
  if (state.camera.mode === 'third') thirdPersonPitch = state.camera.pitch;
  verticalVelocity = 0; grounded = true; jumpQueued = false;
  bindings?.reset();
  applyGraphics(); applyTouchMode(); syncSettingsPanel(); ui.update(state);
  updateCamera(1); updateNearbyUI();
}

async function loadProgress({ showMessage = true, confirm = true } = {}) {
  if (fileOperation || ui.isConfirmOpen) return { ok: false, reason: 'busy' };
  fileOperation = true;
  try {
    if (!state.hasSave(state.selectedSlot)) {
      if (showMessage) ui.showToast('No compatible save in this slot. Unreadable/newer data is left untouched.');
      return { ok: false, reason: 'no-valid-save' };
    }
    if (confirm && hasUnsavedChanges() && !await ui.askConfirmation({ title: 'Load the saved life?', text: 'Changes since the last successful save will be discarded. You can cancel and save or export them first.', accept: 'Load & discard changes' })) return { ok: false, reason: 'cancelled' };
    const result = state.loadSlot(state.selectedSlot);
    if (!result.ok) { if (showMessage) ui.showToast('This save needs a newer game or could not be read. Nothing was replaced.'); return result; }
    activeSlot = result.slot;
    activeSlotWritable = result.source === 'primary';
    applyLoadedState(); savedFingerprint = fingerprint();
    try { await persistence.flush(); } catch { ui.showToast('Slot preference could not be stored. The journey itself was loaded.'); }
    if (showMessage) ui.showToast(result.recovered ? 'Previous save recovered. Use Save to confirm replacement of the damaged primary.' : `Life loaded · slot ${result.slot}`);
    return result;
  } finally { fileOperation = false; }
}

async function exportProgress() {
  if (fileOperation) return;
  fileOperation = true;
  try {
    syncRuntimeToState();
    const document = GameState.validateDocument(state.createSaveDocument());
    if (!document) { ui.showToast('The current state cannot be exported safely. Existing saved files are untouched.'); return; }
    await exportSaveFile(document, persistence.native);
    ui.showToast(persistence.native ? 'Save opened in the Android share sheet.' : 'Portable save downloaded. Keep it somewhere safe.');
  } catch { ui.showToast('Export was cancelled or failed. Your saved life is unchanged.'); }
  finally { fileOperation = false; }
}

async function importProgress(raw) {
  if (fileOperation || ui.isConfirmOpen) return;
  if (!GameState.validateDocument(raw)) { ui.showToast('Not a compatible save. Your current life and all slots are unchanged.'); return; }
  fileOperation = true;
  try {
    const slot = state.selectedSlot;
    if (!await ui.askConfirmation({ title: 'Bring this life here?', text: `Import into slot ${slot} and switch to it? ${state.slotHasData(slot) ? 'The existing primary will become the backup. ' : ''}Any unsaved current progress will be discarded.`, accept: 'Import & load', cancel: 'Keep current life' })) return;
    const result = state.importSave(raw, slot, { overwrite: true });
    if (!result.ok) { ui.showToast('Import could not be written. Current progress was not replaced.'); return; }
    activeSlot = slot; activeSlotWritable = true;
    applyLoadedState();
    try { await persistence.flush(); savedFingerprint = fingerprint(); ui.showToast(`Life imported · slot ${slot}`); }
    catch { ui.showToast('Imported for this session, but the device write failed. Retry Save or export before closing.'); }
  } finally { fileOperation = false; }
}

function releaseControls() {
  bindings?.reset(); jumpQueued = false; movementAmount = 0;
  document.exitPointerLock?.();
}
function openPanel(panel = 'settings') {
  if (ui.isBlocking) return;
  releaseControls(); syncSettingsPanel(); ui.openPanel(panel); ui.update(state); ui.showCaptureHint(false);
}
function openSettings() { openPanel('settings'); }
function requestLookCapture() {
  if (ui.isBlocking || suspended) return;
  try {
    const result = canvas.requestPointerLock?.();
    if (result?.catch) result.catch(() => ui.showCaptureHint(true));
  } catch { ui.showCaptureHint(true); }
}
function closeSettings() {
  if (ui.isConfirmOpen) return;
  ui.closeSettings(); releaseControls(); canvas.focus({ preventScroll: true });
  ui.showCaptureHint(!pointerLocked && !touchMode); invalidate();
}
function closeDialogue() {
  ui.closeDialogue(); releaseControls(); canvas.focus({ preventScroll: true });
  ui.showCaptureHint(!pointerLocked && !touchMode); invalidate();
}

async function quitApp() {
  if (!persistence.native || fileOperation) return;
  const result = await saveProgress({ showMessage: true });
  if (result.ok) await exitNativeApp();
  else if (await ui.askConfirmation({ title: 'Exit without a saved copy?', text: 'Saving failed. Unsaved progress will be lost. Cancel to retry Save or export this life first.', accept: 'Discard & exit', cancel: 'Stay here' })) await exitNativeApp();
}

async function handleBack(android = false) {
  const action = nextBackAction({ confirmation: ui.isConfirmOpen, dialogue: ui.isDialogueOpen, panel: ui.activePanel });
  if (action === 'cancel-confirmation') ui.resolveConfirmation(false);
  else if (action === 'close-dialogue') closeDialogue();
  else if (action === 'close-panel' || (action === 'offer-exit' && !android)) closeSettings();
  else if (action === 'open-pause') openSettings();
  else if (action === 'offer-exit') {
    if (await ui.askConfirmation({ title: 'Leave Morrow Bay?', text: 'Save this journey on the device and exit the Android app. You can also keep playing.', accept: 'Save & exit' })) {
      if (persistence.native) await quitApp();
      else ui.showToast('Exit is available in the Android app. This browser preview stays open.');
    }
  }
}

function describeMiraDialogue() {
  switch (state.taskStage) {
    case 'available':
      return {
        text: 'Morning. The post boat left a sealed parcel at the end of the pier. Would you bring it back here? I can offer 35 credits for the walk.',
        actionLabel: 'Accept delivery',
      };
    case 'fetch':
      return {
        text: 'I left it at the end of the pier, just past the tide line. Look for a small parcel marked with an amber seal. No hurry.',
        actionLabel: 'I’ll find it',
      };
    case 'return':
      return {
        text: 'That seal is still dry. Thank you. Here are 35 credits — and the post boat can leave on time after all.',
        actionLabel: 'Hand over parcel · +35¢',
      };
    default:
      return {
        text: 'Thanks again. The post boat has one less worry today. Make yourself at home; Morrow Bay is good at keeping a person awhile.',
        actionLabel: 'Goodbye, Mira',
      };
  }
}

function interactWithMira() {
  const dialogue = describeMiraDialogue();
  releaseControls();
  ui.showDialogue({ text: dialogue.text, actionLabel: dialogue.actionLabel });
  ui.showCaptureHint(false);
}

function performDialogueAction() {
  const stage = state.taskStage;
  if (stage === 'available') {
    if (state.acceptDelivery()) {
      closeDialogue();
      saveProgress();
      ui.showToast('Errand accepted · the parcel is on the pier.');
    }
    return;
  }
  if (stage === 'return') {
    if (state.completeDelivery()) {
      closeDialogue();
      saveProgress();
      ui.showToast('Parcel delivered · 35 credits added.');
    }
    return;
  }
  closeDialogue();
}

function nearestInteraction() {
  const x = player.root.position.x;
  const z = player.root.position.z;
  const candidates = [];
  const addCandidate = (kind, label, point, radius) => {
    const distance = Math.hypot(x - point.x, z - point.z);
    if (distance <= radius) candidates.push({ kind, label, distance });
  };
  addCandidate('npc', state.taskStage === 'done' ? 'Talk to Mira' : 'Talk to Mira', world.interactables.npc.position, world.interactables.npc.radius);
  if (state.taskStage === 'fetch') {
    addCandidate('parcel', 'Collect sealed parcel', world.interactables.parcel.position, world.interactables.parcel.radius);
  }
  addCandidate('bed', 'Rest until morning', world.interactables.bed.position, world.interactables.bed.radius);
  candidates.sort((a, b) => a.distance - b.distance);
  return candidates[0] ?? null;
}

function interact() {
  if (ui.isBlocking || suspended) return;
  nearby = nearestInteraction();
  if (!nearby) {
    ui.showToast('Nothing nearby to interact with.');
    return;
  }
  if (nearby.kind === 'npc') {
    interactWithMira();
    return;
  }
  if (nearby.kind === 'parcel') {
    if (state.collectParcel()) {
      saveProgress();
      ui.showToast('Parcel collected · bring it back to Mira.');
    }
    return;
  }
  if (nearby.kind === 'bed') {
    state.restUntilMorning();
    saveProgress();
    ui.showToast(`Day ${state.day} · 06:00 · you wake rested.`);
  }
}

function toggleCamera() {
  if (ui.isBlocking) return;
  if (state.camera.mode === 'third') {
    thirdPersonPitch = state.camera.pitch;
    state.camera.mode = 'first';
    state.camera.pitch = 0;
    player.root.rotation.y = state.camera.yaw;
    player.visual.visible = false;
    ui.showToast('First-person view');
  } else {
    state.camera.mode = 'third';
    state.camera.pitch = thirdPersonPitch;
    player.visual.visible = true;
    ui.showToast('Third-person view');
  }
}

function onMouseLook(deltaX, deltaY) {
  if (ui.isBlocking) return;
  const sensitivity = state.camera.sensitivity;
  const invert = state.camera.invertY ? -1 : 1;
  state.camera.yaw -= deltaX * sensitivity;
  if (state.camera.mode === 'first') {
    state.camera.pitch = clamp(state.camera.pitch - deltaY * sensitivity * invert, -1.18, 1.18);
    player.root.rotation.y = state.camera.yaw;
  } else {
    state.camera.pitch = clamp(state.camera.pitch + deltaY * sensitivity * invert, 0.06, 1.02);
    thirdPersonPitch = state.camera.pitch;
  }
}

bindings = new InputBindings({
  input, canvas, joystick: document.getElementById('moveJoystick'),
  isBlocked: () => ui.isBlocking || suspended || contextLost,
  isDialogueOpen: () => ui.isDialogueOpen && !ui.isConfirmOpen,
  onCapture: requestLookCapture,
  onTouchMode: () => { if (!capabilities.touch) { capabilities.touch = true; applyTouchMode(); } },
  onPointerLock: (locked) => { pointerLocked = locked; ui.showCaptureHint(!locked && !touchMode); },
});

ui.setHandlers({
  onOpenSettings: openSettings, onCloseSettings: closeSettings,
  onSave: manualSave, onLoad: () => loadProgress(),
  onExport: exportProgress, onImport: importProgress,
  onDialogueAction: performDialogueAction, onCloseDialogue: closeDialogue,
  onSlotChange: (slot) => { state.setSelectedSlot(slot); syncSettingsPanel(); void persistence.flush().catch(() => ui.showToast('Slot preference could not be stored.')); },
  onCameraSettings: (settings) => { state.syncRuntime({ camera: settings }); camera.fov = state.camera.fov; camera.updateProjectionMatrix(); invalidate(); },
  onGraphicsSettings: (settings) => {
    if (settings.quality && GRAPHICS_PRESETS[settings.quality]) {
      state.graphics.quality = settings.quality;
      state.graphics.shadows = GRAPHICS_PRESETS[settings.quality].shadows;
    }
    if (typeof settings.shadows === 'boolean') state.graphics.shadows = settings.shadows;
    if (Number.isFinite(settings.renderScale)) state.graphics.renderScale = clamp(settings.renderScale, 0.6, 1);
    applyGraphics(); syncSettingsPanel();
  },
  onTouchSettings: (mode) => { state.settings.touchControls = mode; applyTouchMode(); invalidate(); },
  onFullscreen: async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.documentElement.requestFullscreen(); }
    catch { ui.showToast('Fullscreen was not permitted by this browser. Windowed play still works.'); }
  },
  onQuit: async () => { if (await ui.askConfirmation({ title: 'Leave Morrow Bay?', text: 'Save the active journey on this device before exiting.', accept: 'Save & exit' })) await quitApp(); },
  onUIChange: () => { releaseControls(); perfFrames = 0; perfStart = performance.now(); invalidate(); },
});

function dispatchActions(actions) {
  for (const action of actions) {
    if (action === Action.CANCEL) { void handleBack(); continue; }
    if (action === Action.CONFIRM && ui.isDialogueOpen && !ui.isConfirmOpen) { performDialogueAction(); continue; }
    if (ui.isBlocking) continue;
    if (action === Action.PAUSE) openSettings();
    else if (action === Action.INTERACT) interact();
    else if (action === Action.SWITCH_CAMERA) toggleCamera();
    else if (action === Action.JUMP) jumpQueued = true;
    else if (action === Action.INVENTORY) openPanel('inventory');
    else if (action === Action.PHONE) openPanel('journal');
    else if (action === Action.SAVE) void manualSave();
    else if (action === Action.LOAD) void loadProgress();
  }
}

function updatePlayer(deltaTime, controls) {
  if (jumpQueued && grounded) {
    verticalVelocity = 5.1;
    grounded = false;
  }
  jumpQueued = false;

  const forwardX = -Math.sin(state.camera.yaw);
  const forwardZ = -Math.cos(state.camera.yaw);
  const rightX = Math.cos(state.camera.yaw);
  const rightZ = -Math.sin(state.camera.yaw);
  const forwardInput = controls.y;
  const sideInput = controls.x;
  moveVector.set(
    forwardX * forwardInput + rightX * sideInput,
    0,
    forwardZ * forwardInput + rightZ * sideInput,
  );
  const moving = moveVector.lengthSq() > 0.001;
  movementAmount = Math.min(1, moveVector.length());
  if (moving) moveVector.normalize().multiplyScalar(movementAmount);

  const wantsToRun = controls.run && state.energy > 2 && moving;
  const speed = wantsToRun ? 5.55 : 3.35;
  if (moving) {
    const nextX = player.root.position.x + moveVector.x * speed * deltaTime;
    if (world.canOccupy(nextX, player.root.position.z, 0.34)) player.root.position.x = nextX;
    const nextZ = player.root.position.z + moveVector.z * speed * deltaTime;
    if (world.canOccupy(player.root.position.x, nextZ, 0.34)) player.root.position.z = nextZ;

    if (state.camera.mode === 'third') {
      const targetYaw = Math.atan2(-moveVector.x, -moveVector.z);
      player.root.rotation.y = smoothAngle(player.root.rotation.y, targetYaw, 1 - Math.exp(-deltaTime * 11));
    } else {
      player.root.rotation.y = state.camera.yaw;
    }
  }

  if (wantsToRun) state.addEnergy(-deltaTime * 8.5);
  else state.addEnergy(deltaTime * (moving ? 1.8 : 7));

  const floorY = world.groundHeight(player.root.position.x, player.root.position.z);
  if (grounded) {
    player.root.position.y = floorY;
  } else {
    verticalVelocity -= 14.5 * deltaTime;
    player.root.position.y += verticalVelocity * deltaTime;
    if (player.root.position.y <= floorY) {
      player.root.position.y = floorY;
      verticalVelocity = 0;
      grounded = true;
    }
  }

  player.animate(elapsed, moving ? (wantsToRun ? 1 : 0.58) : 0, moving);
}

function updateCamera(deltaTime) {
  if (state.camera.mode === 'first') {
    camera.position.set(player.root.position.x, player.root.position.y + 1.62, player.root.position.z);
    const cosPitch = Math.cos(state.camera.pitch);
    firstPersonForward.set(
      -Math.sin(state.camera.yaw) * cosPitch,
      Math.sin(state.camera.pitch),
      -Math.cos(state.camera.yaw) * cosPitch,
    );
    cameraTarget.copy(camera.position).add(firstPersonForward);
    camera.up.copy(zeroUp);
    camera.lookAt(cameraTarget);
    return;
  }

  const walkBob = movementAmount > 0 ? Math.sin(elapsed * 10.5) * 0.025 : 0;
  cameraTarget.set(player.root.position.x, player.root.position.y + 1.42 + walkBob, player.root.position.z);
  const pitch = state.camera.pitch;
  const cosPitch = Math.cos(pitch);
  cameraDirection.set(
    Math.sin(state.camera.yaw) * cosPitch,
    Math.sin(pitch),
    Math.cos(state.camera.yaw) * cosPitch,
  ).normalize();
  const safeDistance = world.cameraDistance(cameraTarget, cameraDirection, state.camera.distance, 0.24);
  desiredCameraPosition.copy(cameraTarget).addScaledVector(cameraDirection, safeDistance);
  camera.position.lerp(desiredCameraPosition, 1 - Math.exp(-deltaTime * 10));
  camera.up.copy(zeroUp);
  camera.lookAt(cameraTarget);
}

function updateNearbyUI() {
  nearby = nearestInteraction();
  ui.setNearbyAction(nearby?.label ?? null);
}

function frame(now) {
  animationFrame = 0;
  if (suspended || contextLost) return;
  const deltaTime = Math.min(0.1, Math.max(0, (now - previousFrame) / 1000));
  previousFrame = now;
  const controls = input.sample();
  dispatchActions(controls.actions);
  const isPaused = ui.isBlocking;
  if (!isPaused) {
    onMouseLook(controls.lookX, controls.lookY);
    if (state.camera.mode === 'third') state.camera.distance = clamp(state.camera.distance + controls.zoom, 3.5, 13);
    elapsed += deltaTime; state.advanceClock(deltaTime); updatePlayer(deltaTime, controls);
    const npcDx = player.root.position.x - world.npc.root.position.x;
    const npcDz = player.root.position.z - world.npc.root.position.z;
    if (npcDx * npcDx + npcDz * npcDz < 64) {
      const facePlayer = Math.atan2(-npcDx, -npcDz);
      world.npc.root.rotation.y = smoothAngle(world.npc.root.rotation.y, facePlayer, 1 - Math.exp(-deltaTime * 2.2));
    }
    world.npc.animate(elapsed, 0, false);
    autosaveAccumulator += deltaTime;
    if (autosaveAccumulator > 30) { autosaveAccumulator = 0; void saveProgress(); }
  }
  if (!isPaused || needsRender) {
    world.update({ elapsed, minuteOfDay: state.minuteOfDay, playerPosition: player.root.position, taskStage: state.taskStage });
    updateCamera(isPaused ? 1 : deltaTime);
    renderer.render(scene, camera);
    renderedFrames += 1; perfFrames += 1; needsRender = false;
  }
  if (!isPaused && now - perfStart >= 1500) {
    measuredFps = Math.round(perfFrames / ((now - perfStart) / 1000) * 10) / 10;
    perfFrames = 0; perfStart = now;
    ui.text('performanceSummary', `Last active sample: ${measuredFps} FPS · ${renderer.info.render.calls} draw calls · ${renderer.info.memory.geometries} geometries. Not a device benchmark. Rendering stops while paused.`);
  }
  uiRefreshAccumulator += deltaTime;
  if (uiRefreshAccumulator >= 0.18 || isPaused) {
    uiRefreshAccumulator = 0; ui.update(state);
    if (!isPaused) updateNearbyUI();
  }
  if (!isPaused) requestFrame();
}

function resize() {
  bindings.reset(); jumpQueued = false;
  camera.aspect = Math.max(1, window.innerWidth) / Math.max(1, window.innerHeight);
  applyGraphics();
}

function suspend(reason) {
  if (suspended) return;
  suspended = true; releaseControls();
  cancelAnimationFrame(animationFrame); animationFrame = 0;
  if (!ui.isBlocking) { syncSettingsPanel(); ui.openSettings(); }
  void saveProgress().then((result) => { if (!result.ok) ui.showToast('Background save failed. Keep this life open and export or retry Save.'); });
  if (reason !== 'blur') ui.showCaptureHint(false);
}
function resume() {
  if (!suspended) return;
  suspended = false; releaseControls(); previousFrame = performance.now();
  if (!ui.isBlocking) { syncSettingsPanel(); ui.openSettings(); }
  invalidate();
}

const runtimeEvents = new AbortController();
window.addEventListener('resize', resize, { signal: runtimeEvents.signal });
window.visualViewport?.addEventListener('resize', resize, { signal: runtimeEvents.signal });
canvas.addEventListener('webglcontextlost', (event) => {
  event.preventDefault(); contextLost = true; releaseControls();
  cancelAnimationFrame(animationFrame); animationFrame = 0;
  void saveProgress();
  ui.showError('Graphics were interrupted. Your journey is paused while the device restores the view.');
}, { signal: runtimeEvents.signal });
canvas.addEventListener('webglcontextrestored', () => {
  contextLost = false; ui.node('errorScreen').hidden = true; applyGraphics();
  previousFrame = performance.now(); if (!ui.isBlocking) openSettings(); invalidate();
}, { signal: runtimeEvents.signal });
const disposeLifecycle = await bindPlatformLifecycle({ native: persistence.native, onSuspend: suspend, onResume: resume, onBack: () => void handleBack(true) });
applyLoadedState();
if (bootLoad.ok) savedFingerprint = fingerprint();
ui.showCaptureHint(!touchMode);
if (persistence.warning) ui.showToast(persistence.warning);
else if (!activeSlotWritable) ui.showToast('Saved data is protected. Load a compatible slot, export this session, or confirm a replacement before saving.');
else if (bootLoad.ok) ui.showToast(`Welcome back · day ${state.day} in Morrow Bay.`);

if (import.meta.hot) import.meta.hot.dispose(() => {
  suspended = true; cancelAnimationFrame(animationFrame);
  runtimeEvents.abort(); bindings.dispose(); ui.dispose();
  void disposeLifecycle(); disposeScene(scene); renderer.dispose();
});

if (import.meta.env.DEV && new URLSearchParams(window.location.search).get('qa') === '1') {
  Object.defineProperty(window, '__BD_QA__', {
    configurable: false,
    enumerable: false,
    value: Object.freeze({
      snapshot: () => ({
        day: state.day,
        minuteOfDay: state.minuteOfDay,
        credits: state.credits,
        energy: state.energy,
        taskStage: state.taskStage,
        selectedSlot: state.selectedSlot, activeSlot,
        touchMode, suspended, grounded,
        graphics: { ...state.graphics },
        stats: { renderedFrames, fps: measuredFps, drawCalls: renderer.info.render.calls, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures, triangles: renderer.info.render.triangles, pixelRatio: renderer.getPixelRatio() },
        inventory: { ...state.inventory },
        position: player.root.position.toArray(),
        camera: { ...state.camera },
        nearby: nearestInteraction()?.kind ?? null,
      }),
      placePlayer: (x, z) => {
        if (!Number.isFinite(x) || !Number.isFinite(z) || !world.canOccupy(x, z, 0.34)) return false;
        player.root.position.set(x, world.groundHeight(x, z), z);
        verticalVelocity = 0;
        grounded = true;
        return true;
      },
      interact,
      respond: performDialogueAction,
      save: () => saveProgress(),
      load: () => loadProgress({ showMessage: false, confirm: false }),
      back: () => handleBack(true), suspend, resume,
      toggleCamera,
    }),
  });
}

requestAnimationFrame((now) => {
  previousFrame = now;
  ui.finishLoading();
  invalidate();
});
