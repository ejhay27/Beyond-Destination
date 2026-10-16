import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createMorrowBay } from '../src/world.js';

function installCanvasStub() {
  globalThis.document = {
    createElement(tagName) {
      assert.equal(tagName, 'canvas');
      return {
        width: 0,
        height: 0,
        getContext() {
          return {
            fillRect() {},
            strokeRect() {},
            fillText() {},
          };
        },
      };
    },
  };
}

function makeWorld() {
  installCanvasStub();
  const scene = new THREE.Scene();
  const world = createMorrowBay(scene);
  return { scene, world };
}

test('Morrow Bay generates a populated, bounded scene and a named NPC', () => {
  const { scene, world } = makeWorld();
  let meshCount = 0;
  scene.traverse((object) => { if (object.isMesh) meshCount += 1; });
  assert.ok(scene.children.length > 30);
  assert.ok(meshCount > 60);
  const geometries = new Set();
  let instanceCount = 0;
  scene.traverse((object) => {
    if (object.isMesh) geometries.add(object.geometry);
    if (object.isInstancedMesh) instanceCount += object.count;
  });
  assert.ok(geometries.size < 50, 'Static geometry must be shared rather than cloned per prop');
  assert.ok(instanceCount > 100, 'Repeated static structures and scenery should be batched');
  assert.ok(world.colliders.length > 25);
  assert.equal(world.npc.root.position.x, 2.55);
  assert.equal(world.npc.root.position.z, -1.35);
  assert.equal(world.canOccupy(0, 10), true);
  assert.equal(world.canOccupy(0, -20), true);
  assert.equal(world.canOccupy(4, -20), false);
  assert.equal(world.canOccupy(-15, 4), false);
});

test('parcel state controls its world prop and interior cutaway responds to player position', () => {
  const { scene, world } = makeWorld();
  const outside = new THREE.Vector3(0, 0, 10);
  world.update({ elapsed: 0, minuteOfDay: 480, playerPosition: outside, taskStage: 'available' });
  assert.equal(world.parcel.visible, false);
  assert.equal(world.parcelMarker.visible, false);

  world.update({ elapsed: 1, minuteOfDay: 481, playerPosition: outside, taskStage: 'fetch' });
  assert.equal(world.parcel.visible, true);
  assert.equal(world.parcelMarker.visible, true);

  const cabinRoof = scene.children.filter((object) => object.isMesh && object.geometry.type === 'BoxGeometry'
    && object.position.x === -11 && object.position.y === 3.12);
  assert.equal(cabinRoof.length, 2);
  const inside = new THREE.Vector3(-11, 0, 4);
  world.update({ elapsed: 2, minuteOfDay: 482, playerPosition: inside, taskStage: 'fetch' });
  assert.ok(cabinRoof.every((roof) => roof.visible === false));
  world.update({ elapsed: 3, minuteOfDay: 483, playerPosition: outside, taskStage: 'fetch' });
  assert.ok(cabinRoof.every((roof) => roof.visible === true));
});

test('camera collision shortens the follow distance at a world obstacle', () => {
  const { world } = makeWorld();
  const origin = new THREE.Vector3(5, 2, 4);
  const direction = new THREE.Vector3(0, 0, 1);
  const safeDistance = world.cameraDistance(origin, direction, 8);
  assert.ok(safeDistance < 8);
  assert.ok(safeDistance >= 2.2);
});
