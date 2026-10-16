// Device-independent actions. Gameplay never reads DOM events or pointer types.
export const Action = Object.freeze({
  JUMP: 'jump', RUN: 'run', INTERACT: 'interact', SWITCH_CAMERA: 'switch-camera',
  INVENTORY: 'inventory', PHONE: 'phone', PAUSE: 'pause', CONFIRM: 'confirm', CANCEL: 'cancel',
  SAVE: 'save', LOAD: 'load', CONSTRUCTION: 'construction',
});

const clamp = (n, min, max) => Math.min(max, Math.max(min, n));

export class ActionInput {
  constructor(onChange = () => {}) {
    this.onChange = onChange;
    this.moves = new Map();
    this.held = new Map();
    this.pending = new Set();
    this.lookX = 0;
    this.lookY = 0;
    this.zoomDelta = 0;
    this.sequence = 0;
  }

  setMove(source, x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    const length = Math.hypot(x, y);
    if (length < 0.08) this.moves.delete(source);
    else this.moves.set(source, { x: x / Math.max(1, length), y: y / Math.max(1, length), order: ++this.sequence });
    this.onChange();
  }

  get movement() {
    // Most recently active device wins; mixed input cannot double movement speed.
    let latest = null;
    for (const move of this.moves.values()) if (!latest || move.order > latest.order) latest = move;
    return latest ?? { x: 0, y: 0 };
  }

  hold(action, source, active) {
    if (!this.held.has(action)) this.held.set(action, new Set());
    const sources = this.held.get(action);
    if (active) sources.add(source);
    else sources.delete(source);
    this.onChange();
  }

  isHeld(action) { return (this.held.get(action)?.size ?? 0) > 0; }

  press(action) {
    this.pending.add(action); // One edge per action/frame, even on hybrid devices.
    this.onChange();
  }

  look(x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) return;
    this.lookX += clamp(x, -500, 500);
    this.lookY += clamp(y, -500, 500);
    this.onChange();
  }

  zoom(amount) {
    if (Number.isFinite(amount)) this.zoomDelta += clamp(amount, -4, 4);
    this.onChange();
  }

  sample() {
    const move = this.movement;
    const sample = {
      x: move.x, y: move.y, run: this.isHeld(Action.RUN),
      lookX: this.lookX, lookY: this.lookY, zoom: this.zoomDelta,
      actions: [...this.pending],
    };
    this.pending.clear();
    this.lookX = this.lookY = this.zoomDelta = 0;
    return sample;
  }

  reset() {
    this.moves.clear();
    this.held.clear();
    this.pending.clear();
    this.lookX = this.lookY = this.zoomDelta = 0;
  }
}
