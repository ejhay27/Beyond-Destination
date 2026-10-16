import test from 'node:test';
import assert from 'node:assert/strict';
import { Action, ActionInput } from '../src/input.js';
import { detectInputCapabilities } from '../src/input-bindings.js';

test('keyboard, joystick and future controller use normalized shared movement', () => {
  const input = new ActionInput();
  input.setMove('keyboard', 1, 1);
  assert.ok(Math.abs(Math.hypot(input.movement.x, input.movement.y) - 1) < 1e-9);
  input.setMove('joystick', 0.3, 0.4);
  assert.equal(input.sample().x, 0.3);
  input.setMove('joystick', 0, 0);
  assert.ok(input.movement.x > 0.7);
  input.setMove('controller', 0, -1);
  assert.equal(input.sample().y, -1);
});

test('hybrid one-shot actions deduplicate within a frame, never auto-repeat', () => {
  const input = new ActionInput();
  input.press(Action.INTERACT);
  input.press(Action.INTERACT);
  input.press(Action.SWITCH_CAMERA);
  assert.deepEqual(input.sample().actions, [Action.INTERACT, Action.SWITCH_CAMERA]);
  assert.deepEqual(input.sample().actions, []);
});

test('releasing one input source does not release another device run hold', () => {
  const input = new ActionInput();
  input.hold(Action.RUN, 'keyboard', true);
  input.hold(Action.RUN, 'touch', true);
  input.hold(Action.RUN, 'keyboard', false);
  assert.equal(input.sample().run, true);
  input.hold(Action.RUN, 'touch', false);
  assert.equal(input.sample().run, false);
});

test('movement and look coexist; reset clears jumps, run and camera gestures', () => {
  const input = new ActionInput();
  input.setMove('joystick', 0, 1);
  input.look(20, -15);
  input.zoom(-0.72);
  input.press(Action.JUMP);
  input.hold(Action.RUN, 'touch', true);
  const frame = input.sample();
  assert.equal(frame.y, 1);
  assert.equal(frame.lookX, 20);
  assert.equal(frame.lookY, -15);
  assert.equal(frame.zoom, -0.72);
  assert.deepEqual(frame.actions, [Action.JUMP]);
  input.press(Action.JUMP);
  input.look(300, 10);
  input.reset();
  assert.deepEqual(input.sample(), { x: 0, y: 0, run: false, lookX: 0, lookY: 0, zoom: 0, actions: [] });
});

test('invalid axes and gesture values cannot poison the simulation', () => {
  const input = new ActionInput();
  input.setMove('bad', NaN, Infinity);
  input.look(NaN, 20);
  input.zoom(Infinity);
  assert.equal(input.sample().x, 0);
});

test('capability detection supports hybrid devices without user-agent sniffing', () => {
  const win = { matchMedia: (query) => ({ matches: query.includes('fine') }) };
  assert.deepEqual(detectInputCapabilities(win, { maxTouchPoints: 10 }), { touch: true, fine: true });
  assert.deepEqual(detectInputCapabilities(win, { maxTouchPoints: 0 }), { touch: false, fine: true });
});
