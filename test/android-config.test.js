import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { disposeScene } from '../src/scene-resources.js';
import { GameState, MemoryStorage, SAVE_PREFIX } from '../src/game-state.js';

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), 'utf8');

test('Android shell packages the same dist, with no development server or cleartext permissions', async () => {
  const config = JSON.parse(await read('capacitor.config.json'));
  assert.equal(config.webDir, 'dist');
  assert.equal(config.appId, 'io.beyonddestination.game');
  assert.equal(config.server.url, undefined);
  assert.equal(config.android.allowMixedContent, false);
  const manifest = await read('android/app/src/main/AndroidManifest.xml');
  assert.match(manifest, /usesCleartextTraffic="false"/);
  assert.match(manifest, /0x00030000/);
  assert.doesNotMatch(manifest, /WRITE_EXTERNAL_STORAGE|READ_EXTERNAL_STORAGE/);
  assert.match(await read('android/app/src/main/res/xml/file_paths.xml'), /path="exports\/"/);
  assert.match(await read('android/variables.gradle'), /compileSdkVersion = 36/);
  assert.match(await read('android/app/capacitor.build.gradle'), /JavaVersion.VERSION_21/);
  assert.match(await read('android/gradle/wrapper/gradle-wrapper.properties'), /gradle-8.14.3-all.zip/);
});

test('Android launcher legacy images have real expected dimensions; adaptive art reuses original paths', async () => {
  for (const [density, size] of [['mdpi', 48], ['hdpi', 72], ['xhdpi', 96], ['xxhdpi', 144], ['xxxhdpi', 192]]) {
    const png = await readFile(new URL(`../android/app/src/main/res/mipmap-${density}/ic_launcher.png`, import.meta.url));
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
  }
  const source = await read('assets/beyond-destination-mark.svg');
  const vector = await read('android/app/src/main/res/drawable-v24/ic_launcher_foreground.xml');
  for (const [, path] of source.matchAll(/ d="([^"]+)"/g)) assert.ok(vector.includes(path));
  assert.match(await read('android/app/src/main/res/mipmap-anydpi-v33/ic_launcher.xml'), /monochrome/);
});

test('shared geometry, textures and materials are disposed once and the scene is cleared', () => {
  const scene = new THREE.Scene();
  const geometry = new THREE.BoxGeometry();
  const texture = new THREE.Texture();
  const material = new THREE.MeshBasicMaterial({ map: texture });
  const counts = { geometry: 0, texture: 0, material: 0, instances: 0 };
  geometry.addEventListener('dispose', () => counts.geometry++);
  texture.addEventListener('dispose', () => counts.texture++);
  material.addEventListener('dispose', () => counts.material++);
  const instances = new THREE.InstancedMesh(geometry, material, 3);
  instances.addEventListener('dispose', () => counts.instances++);
  scene.add(new THREE.Mesh(geometry, material), new THREE.Mesh(geometry, material), instances);
  disposeScene(scene);
  assert.deepEqual(counts, { geometry: 1, texture: 1, material: 1, instances: 1 });
  assert.equal(scene.children.length, 0);
});

test('a future interrupted save also blocks automatic writes and old-backup loads', () => {
  const storage = new MemoryStorage();
  const state = new GameState(storage);
  state.saveSlot(1);
  const future = { ...state.createSaveDocument(), schemaVersion: 99 };
  storage.setItem(`${SAVE_PREFIX}1.tmp`, JSON.stringify(future));
  assert.equal(state.loadSlot(1).reason, 'newer-schema');
  assert.equal(state.saveSlot(1).reason, 'protected-save');
  assert.equal(JSON.parse(storage.getItem(`${SAVE_PREFIX}1.tmp`)).schemaVersion, 99);
});
