import './styles.css';
import * as THREE from 'three';
import { GameState } from './game-state.js';
import { createHumanoid } from './character.js';
import { createMorrowBay } from './world.js';
import { GameUI } from './ui.js';

const canvas = document.getElementById('gameCanvas');
const ui = new GameUI();
const state = new GameState();
const bootLoad = state.loadSlot(state.selectedSlot);
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
  ui.showError('This browser could not start WebGL 2. Try a current desktop version of Edge, Chrome, or Firefox with hardware acceleration enabled.');
  throw new Error('WebGL 2 is required to render Beyond Destination.');
}

renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.2));
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

const heldKeys = new Set();
const moveVector = new THREE.Vector3();
const forwardVector = new THREE.Vector3();
const rightVector = new THREE.Vector3();
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
let dragLook = false;
let lastPointerX = 0;
let lastPointerY = 0;
let nearby = null;
let toastStorageWarningShown = false;
let menuWasOpen = false;

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
const smoothAngle = (from, to, amount) => {
  let difference = ((to - from + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return from + difference * amount;
};

function syncSettingsPanel() {
  ui.setSettings({
    slot: state.selectedSlot,
    sensitivity: state.camera.sensitivity,
    fov: state.camera.fov,
    invertY: state.camera.invertY,
    shadows: state.graphics.shadows,
    savedSlots: [1, 2, 3].filter((slot) => state.hasSave(slot)),
  });
}

function syncRuntimeToState() {
  state.syncRuntime({
    position: player.root.position.toArray(),
    playerYaw: player.root.rotation.y,
    camera: state.camera,
  });
}

function saveProgress({ showMessage = false } = {}) {
  syncRuntimeToState();
  const result = state.saveSlot(state.selectedSlot);
  if (!result.ok) {
    if (showMessage) {
      const message = result.reason === 'storage-unavailable'
        ? 'Browser storage is unavailable; this life cannot persist after closing the tab.'
        : 'The save could not be written. Check browser storage and try again.';
      ui.showToast(message);
    }
    return result;
  }

  syncSettingsPanel();
  if (showMessage) {
    ui.showToast(result.persistent
      ? `Life saved · slot ${String(result.slot).padStart(2, '0')}`
      : `Saved for this tab · slot ${String(result.slot).padStart(2, '0')}`);
  }
  return result;
}

function applyLoadedState() {
  const [x, , z] = state.player.position;
  if (!world.canOccupy(x, z, 0.34)) {
    player.root.position.copy(spawn);
    state.player.position = spawn.toArray();
    state.player.yaw = 0;
  } else {
    player.root.position.set(x, world.groundHeight(x, z), z);
  }
  player.root.rotation.y = state.player.yaw;
  player.visual.visible = state.camera.mode !== 'first';
  if (state.camera.mode === 'third') thirdPersonPitch = state.camera.pitch;
  verticalVelocity = 0;
  grounded = true;
  camera.fov = state.camera.fov;
  camera.updateProjectionMatrix();
  world.sun.castShadow = state.graphics.shadows;
  renderer.shadowMap.enabled = state.graphics.shadows;
  syncSettingsPanel();
  ui.update(state);
}

function loadProgress({ showMessage = true } = {}) {
  const result = state.loadSlot(state.selectedSlot);
  if (!result.ok) {
    if (showMessage) ui.showToast('No valid save in this slot yet.');
    return result;
  }
  applyLoadedState();
  if (showMessage) {
    ui.showToast(result.recovered
      ? `Recovered the previous save · slot ${String(result.slot).padStart(2, '0')}`
      : `Life loaded · slot ${String(result.slot).padStart(2, '0')}`);
  }
  return result;
}

if (bootLoad.ok) {
  applyLoadedState();
  if (bootLoad.recovered) ui.showToast('A previous save copy was recovered.');
}

function openSettings() {
  if (ui.isDialogueOpen) return;
  heldKeys.clear();
  document.exitPointerLock?.();
  dragLook = false;
  syncSettingsPanel();
  ui.openSettings();
  ui.showCaptureHint(false);
}

function requestLookCapture() {
  if (ui.isMenuOpen || ui.isDialogueOpen) return;
  try {
    const result = canvas.requestPointerLock?.();
    if (result && typeof result.catch === 'function') result.catch(() => ui.showCaptureHint(true));
  } catch {
    ui.showCaptureHint(true);
  }
}

function closeSettings() {
  ui.closeSettings();
  heldKeys.clear();
  requestLookCapture();
}

function closeDialogue() {
  ui.closeDialogue();
  heldKeys.clear();
  ui.showCaptureHint(!pointerLocked);
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
  document.exitPointerLock?.();
  dragLook = false;
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
  if (ui.isMenuOpen || ui.isDialogueOpen) return;
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
  if (ui.isMenuOpen || ui.isDialogueOpen) return;
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

function handleKeyDown(event) {
  const key = event.key.toLowerCase();
  if (event.code === 'Escape') {
    event.preventDefault();
    if (ui.isDialogueOpen) closeDialogue();
    else if (ui.isMenuOpen) closeSettings();
    else openSettings();
    return;
  }

  if (ui.isMenuOpen) return;
  if (ui.isDialogueOpen) {
    if (event.code === 'Enter' || key === 'e') {
      event.preventDefault();
      performDialogueAction();
    }
    return;
  }

  if (event.code === 'F5') {
    event.preventDefault();
    saveProgress({ showMessage: true });
    return;
  }
  if (event.code === 'F9') {
    event.preventDefault();
    loadProgress({ showMessage: true });
    return;
  }
  if (key === 'v' && !event.repeat) {
    event.preventDefault();
    toggleCamera();
    return;
  }
  if (key === 'e' && !event.repeat) {
    event.preventDefault();
    interact();
    return;
  }
  if (event.code === 'Space') {
    event.preventDefault();
    if (!event.repeat) jumpQueued = true;
    return;
  }
  if (['w', 'a', 's', 'd', 'shift'].includes(key)) {
    event.preventDefault();
    heldKeys.add(key);
  }
}

window.addEventListener('keydown', handleKeyDown);
window.addEventListener('keyup', (event) => heldKeys.delete(event.key.toLowerCase()));
window.addEventListener('blur', () => heldKeys.clear());
window.addEventListener('contextmenu', (event) => event.preventDefault());

canvas.addEventListener('click', () => {
  if (!pointerLocked && !ui.isMenuOpen && !ui.isDialogueOpen) requestLookCapture();
});
canvas.addEventListener('pointerdown', (event) => {
  if (pointerLocked || ui.isMenuOpen || ui.isDialogueOpen) return;
  dragLook = true;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
  try { canvas.setPointerCapture(event.pointerId); } catch { /* Browser may not support capture. */ }
});
canvas.addEventListener('pointermove', (event) => {
  if (pointerLocked) {
    onMouseLook(event.movementX || 0, event.movementY || 0);
    return;
  }
  if (!dragLook) return;
  const dx = event.clientX - lastPointerX;
  const dy = event.clientY - lastPointerY;
  lastPointerX = event.clientX;
  lastPointerY = event.clientY;
  onMouseLook(dx, dy);
});
canvas.addEventListener('pointerup', () => { dragLook = false; });
canvas.addEventListener('pointercancel', () => { dragLook = false; });
canvas.addEventListener('wheel', (event) => {
  if (state.camera.mode !== 'third' || ui.isMenuOpen || ui.isDialogueOpen) return;
  event.preventDefault();
  state.camera.distance = clamp(state.camera.distance + Math.sign(event.deltaY) * 0.72, 3.5, 13);
}, { passive: false });

document.addEventListener('pointerlockchange', () => {
  pointerLocked = document.pointerLockElement === canvas;
  if (pointerLocked) dragLook = false;
  ui.showCaptureHint(!pointerLocked);
});

ui.setHandlers({
  onOpenSettings: openSettings,
  onCloseSettings: closeSettings,
  onSave: () => saveProgress({ showMessage: true }),
  onLoad: () => loadProgress({ showMessage: true }),
  onDialogueAction: performDialogueAction,
  onCloseDialogue: closeDialogue,
  onSlotChange: (slot) => {
    state.setSelectedSlot(slot);
    syncSettingsPanel();
  },
  onCameraSettings: (settings) => {
    state.syncRuntime({ camera: settings });
    camera.fov = state.camera.fov;
    camera.updateProjectionMatrix();
  },
  onGraphicsSettings: (settings) => {
    if (typeof settings.shadows === 'boolean') state.graphics.shadows = settings.shadows;
    renderer.shadowMap.enabled = state.graphics.shadows;
    world.sun.castShadow = state.graphics.shadows;
    ui.showToast(state.graphics.shadows ? 'Dynamic shadows enabled' : 'Dynamic shadows disabled');
  },
});

function updatePlayer(deltaTime) {
  if (jumpQueued && grounded) {
    verticalVelocity = 5.1;
    grounded = false;
  }
  jumpQueued = false;

  const forwardX = -Math.sin(state.camera.yaw);
  const forwardZ = -Math.cos(state.camera.yaw);
  const rightX = Math.cos(state.camera.yaw);
  const rightZ = -Math.sin(state.camera.yaw);
  const forwardInput = Number(heldKeys.has('w')) - Number(heldKeys.has('s'));
  const sideInput = Number(heldKeys.has('d')) - Number(heldKeys.has('a'));
  moveVector.set(
    forwardX * forwardInput + rightX * sideInput,
    0,
    forwardZ * forwardInput + rightZ * sideInput,
  );
  const moving = moveVector.lengthSq() > 0.001;
  if (moving) moveVector.normalize();

  const wantsToRun = heldKeys.has('shift') && state.energy > 2 && moving;
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

  const walkBob = heldKeys.size > 0 ? Math.sin(elapsed * 10.5) * 0.025 : 0;
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
  const deltaTime = Math.min(0.1, Math.max(0, (now - previousFrame) / 1000));
  previousFrame = now;
  const isPaused = ui.isMenuOpen || ui.isDialogueOpen;
  if (!isPaused) {
    elapsed += deltaTime;
    state.advanceClock(deltaTime);
    updatePlayer(deltaTime);
  } else {
    heldKeys.clear();
    player.animate(elapsed, 0, false);
  }

  const npcDx = player.root.position.x - world.npc.root.position.x;
  const npcDz = player.root.position.z - world.npc.root.position.z;
  if (npcDx * npcDx + npcDz * npcDz < 64) {
    const facePlayer = Math.atan2(-npcDx, -npcDz);
    world.npc.root.rotation.y = smoothAngle(world.npc.root.rotation.y, facePlayer, 1 - Math.exp(-deltaTime * 2.2));
  }
  world.npc.animate(elapsed, 0, false);
  world.update({
    elapsed,
    minuteOfDay: state.minuteOfDay,
    playerPosition: player.root.position,
    taskStage: state.taskStage,
  });
  updateCamera(deltaTime);

  uiRefreshAccumulator += deltaTime;
  if (uiRefreshAccumulator >= 0.18) {
    uiRefreshAccumulator = 0;
    ui.update(state);
    if (!ui.isMenuOpen && !ui.isDialogueOpen) updateNearbyUI();
  }

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

function resize() {
  const width = Math.max(1, window.innerWidth);
  const height = Math.max(1, window.innerHeight);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.2));
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
}

ui.setSettings({
  slot: state.selectedSlot,
  sensitivity: state.camera.sensitivity,
  fov: state.camera.fov,
  invertY: state.camera.invertY,
  shadows: state.graphics.shadows,
  savedSlots: [1, 2, 3].filter((slot) => state.hasSave(slot)),
});
ui.update(state);
ui.showCaptureHint(true);
window.addEventListener('resize', resize);
window.addEventListener('pagehide', () => saveProgress());
window.addEventListener('beforeunload', () => saveProgress());

if (bootLoad.ok) {
  ui.showToast(`Welcome back · day ${state.day} in Morrow Bay.`);
}

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
        selectedSlot: state.selectedSlot,
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
      load: () => loadProgress({ showMessage: false }),
      toggleCamera,
    }),
  });
}

requestAnimationFrame((now) => {
  previousFrame = now;
  ui.finishLoading();
  frame(now + 1);
});
