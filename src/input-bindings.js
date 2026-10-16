import { Action } from './input.js';

const keyActions = {
  Space: Action.JUMP, KeyE: Action.INTERACT, KeyV: Action.SWITCH_CAMERA,
  KeyI: Action.INVENTORY, KeyP: Action.PHONE, Enter: Action.CONFIRM,
  Escape: Action.CANCEL, F5: Action.SAVE, F9: Action.LOAD,
};
const moveCodes = new Set(['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight']);
const editable = (target) => target?.closest?.('input, select, textarea, [contenteditable="true"]');

export function detectInputCapabilities(win = window, nav = navigator) {
  return {
    touch: (nav.maxTouchPoints ?? 0) > 0 || Boolean(win.matchMedia?.('(any-pointer: coarse)').matches),
    fine: Boolean(win.matchMedia?.('(any-pointer: fine)').matches),
  };
}

// Adapters only translate devices into actions; no quests, economy or camera rules here.
export class InputBindings {
  constructor({ input, canvas, joystick, isBlocked, isDialogueOpen, onCapture, onTouchMode, onPointerLock }) {
    Object.assign(this, { input, canvas, joystick, isBlocked, isDialogueOpen, onCapture, onTouchMode, onPointerLock });
    this.abort = new AbortController();
    this.keys = new Set();
    this.pointers = new Map();
    this.lookPointer = null;
    this.joyPointer = null;
    this.runLatched = false;
    this.touchMode = false;
    this.locked = false;
    const listen = (target, name, handler, opts = {}) => target.addEventListener(name, handler, { ...opts, signal: this.abort.signal });
    listen(window, 'keydown', (e) => this.keyDown(e));
    listen(window, 'keyup', (e) => { this.keys.delete(e.code); this.updateKeys(); });
    listen(window, 'blur', () => this.reset());
    listen(canvas, 'contextmenu', (e) => e.preventDefault());
    listen(canvas, 'click', (e) => {
      if (e.pointerType !== 'touch' && !this.isBlocked()) this.onCapture();
    });
    listen(canvas, 'pointerdown', (e) => this.startLook(e));
    listen(canvas, 'pointermove', (e) => this.moveLook(e));
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(canvas, name, (e) => this.endLook(e));
    listen(canvas, 'wheel', (e) => {
      if (this.isBlocked()) return;
      e.preventDefault();
      this.input.zoom(Math.sign(e.deltaY) * 0.72);
    }, { passive: false });
    listen(document, 'pointerlockchange', () => {
      this.locked = document.pointerLockElement === canvas;
      this.lookPointer = null;
      this.pointers.clear();
      this.onPointerLock(this.locked);
    });
    listen(document, 'pointerdown', (e) => {
      if (e.pointerType === 'touch') this.onTouchMode();
    }, { capture: true });
    listen(joystick, 'pointerdown', (e) => this.startJoystick(e));
    listen(joystick, 'pointermove', (e) => this.moveJoystick(e));
    for (const name of ['pointerup', 'pointercancel', 'lostpointercapture']) listen(joystick, name, (e) => {
      if (e.pointerId === this.joyPointer) this.resetJoystick();
    });
    for (const button of document.querySelectorAll('[data-input-action]')) {
      const activate = () => {
        if (this.isBlocked()) return;
        const action = button.dataset.inputAction;
        if (action === Action.RUN) {
          this.runLatched = !this.runLatched;
          this.input.hold(Action.RUN, 'touch-run', this.runLatched);
          button.setAttribute('aria-pressed', String(this.runLatched));
        } else this.input.press(action);
      };
      // Touch acts on its own pointer (including a third finger while moving/looking).
      // Ignore its compatibility click; keyboard and mouse retain native button clicks.
      listen(button, 'pointerdown', (e) => { if (e.pointerType === 'touch') { e.preventDefault(); activate(); } });
      listen(button, 'click', (e) => { if (e.pointerType !== 'touch') activate(); });
    }
    for (const button of document.querySelectorAll('[data-zoom]')) {
      const zoom = () => { if (!this.isBlocked()) this.input.zoom(Number(button.dataset.zoom)); };
      listen(button, 'pointerdown', (e) => { if (e.pointerType === 'touch') { e.preventDefault(); zoom(); } });
      listen(button, 'click', (e) => { if (e.pointerType !== 'touch') zoom(); });
    }
  }

  setTouchMode(active) {
    if (active === this.touchMode) return;
    this.reset();
    this.touchMode = active;
    if (active) document.exitPointerLock?.();
  }

  keyDown(e) {
    if (e.ctrlKey || e.altKey || e.metaKey || e.isComposing) return;
    const action = keyActions[e.code];
    if (editable(e.target) && action !== Action.CANCEL) return;
    // Let focused buttons retain native Space/Enter activation, avoiding click + action.
    if (e.target?.closest?.('button, a') && ['Space', 'Enter'].includes(e.code)) return;
    if (e.code === 'Escape') {
      e.preventDefault();
      if (!e.repeat) this.input.press(Action.CANCEL);
      return;
    }
    if (this.isBlocked()) {
      if (this.isDialogueOpen() && ['Enter', 'KeyE'].includes(e.code)) {
        e.preventDefault();
        if (!e.repeat) this.input.press(Action.CONFIRM);
      }
      return;
    }
    if (moveCodes.has(e.code)) {
      e.preventDefault();
      this.keys.add(e.code);
      this.updateKeys();
    } else if (action) {
      e.preventDefault();
      if (!e.repeat) this.input.press(action);
    }
  }

  updateKeys() {
    if (this.isBlocked()) return;
    this.input.setMove('keyboard', Number(this.keys.has('KeyD')) - Number(this.keys.has('KeyA')),
      Number(this.keys.has('KeyW')) - Number(this.keys.has('KeyS')));
    this.input.hold(Action.RUN, 'keyboard', this.keys.has('ShiftLeft') || this.keys.has('ShiftRight'));
  }

  startLook(e) {
    if (this.isBlocked() || this.locked || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (e.pointerType === 'touch') {
      // Leave the left half free for the movement thumb; independent pointer capture.
      if (e.clientX < window.innerWidth * 0.42 || !this.touchMode) return;
      e.preventDefault();
    }
    if (this.lookPointer !== null) return;
    this.lookPointer = e.pointerId;
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    try { this.canvas.setPointerCapture(e.pointerId); } catch { /* Synthetic or cancelled pointer. */ }
  }

  moveLook(e) {
    if (this.isBlocked()) return;
    if (this.locked && e.pointerType === 'mouse') {
      this.input.look(e.movementX || 0, e.movementY || 0);
      return;
    }
    if (e.pointerId !== this.lookPointer) return;
    e.preventDefault();
    const before = this.pointers.get(e.pointerId);
    if (before) this.input.look(e.clientX - before.x, e.clientY - before.y);
    this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  }

  endLook(e) {
    if (this.lookPointer !== e.pointerId) return;
    this.pointers.delete(e.pointerId);
    this.lookPointer = null;
  }

  startJoystick(e) {
    if (this.isBlocked() || this.joyPointer !== null) return;
    e.preventDefault();
    this.joyPointer = e.pointerId;
    const rect = this.joystick.getBoundingClientRect();
    this.joyCenter = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2, radius: rect.width * 0.33 };
    try { this.joystick.setPointerCapture(e.pointerId); } catch { /* Synthetic/cancelled pointer. */ }
    this.moveJoystick(e);
  }

  moveJoystick(e) {
    if (e.pointerId !== this.joyPointer || this.isBlocked()) return;
    e.preventDefault();
    const { x, y, radius } = this.joyCenter;
    let dx = (e.clientX - x) / radius;
    let dy = (e.clientY - y) / radius;
    const length = Math.max(1, Math.hypot(dx, dy));
    dx /= length; dy /= length;
    this.input.setMove('joystick', dx, -dy);
    this.joystick.style.setProperty('--stick-x', `${dx * radius}px`);
    this.joystick.style.setProperty('--stick-y', `${dy * radius}px`);
  }

  resetJoystick() {
    const pointer = this.joyPointer;
    this.joyPointer = null;
    if (pointer !== null && this.joystick.hasPointerCapture?.(pointer)) this.joystick.releasePointerCapture(pointer);
    this.input.setMove('joystick', 0, 0);
    this.joystick.style.setProperty('--stick-x', '0px');
    this.joystick.style.setProperty('--stick-y', '0px');
  }

  reset() {
    this.keys.clear();
    const pointer = this.lookPointer;
    this.lookPointer = null;
    if (pointer !== null && this.canvas.hasPointerCapture?.(pointer)) this.canvas.releasePointerCapture(pointer);
    this.pointers.clear();
    this.resetJoystick();
    this.runLatched = false;
    document.querySelector('[data-input-action="run"]')?.setAttribute('aria-pressed', 'false');
    this.input.reset();
  }

  dispose() { this.reset(); this.abort.abort(); }
}
