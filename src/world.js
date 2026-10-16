import * as THREE from 'three';
import { createHumanoid } from './character.js';

const COLORS = {
  grass: '#617866',
  grassLight: '#738a72',
  sand: '#c6ad83',
  boardwalk: '#805f45',
  wood: '#68513e',
  woodLight: '#a7835e',
  stone: '#889393',
  roof: '#53696a',
  water: '#397782',
  path: '#aeb5a9',
};

function makeMaterial(color, roughness = 0.9, options = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness: options.metalness ?? 0.02,
    emissive: options.emissive ?? '#000000',
    emissiveIntensity: options.emissiveIntensity ?? 0,
    transparent: options.transparent ?? false,
    opacity: options.opacity ?? 1,
  });
}

function drawSignTexture(title, subtitle = '') {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 192;
  const context = canvas.getContext('2d');
  context.fillStyle = '#20383c';
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.strokeStyle = '#d5b477';
  context.lineWidth = 8;
  context.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);
  context.textAlign = 'center';
  context.fillStyle = '#f4ead3';
  context.font = '700 48px Georgia, serif';
  context.fillText(title, canvas.width / 2, subtitle ? 91 : 116, 450);
  if (subtitle) {
    context.fillStyle = '#c4d5cc';
    context.font = '500 20px Arial, sans-serif';
    context.letterSpacing = '4px';
    context.fillText(subtitle.toUpperCase(), canvas.width / 2, 142, 450);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 2;
  return texture;
}

export function createMorrowBay(scene) {
  const colliders = [];
  const cameraOccluders = [];
  const roofParts = [];
  const lampMaterials = [];
  let roofLifted = false;
  const materials = new Map();
  const getMaterial = (color, roughness = 0.9, options = {}) => {
    const key = `${color}:${roughness}:${options.emissive ?? ''}`;
    if (!materials.has(key)) materials.set(key, makeMaterial(color, roughness, options));
    return materials.get(key);
  };

  function addBox(size, position, color, {
    roughness = 0.9,
    solid = false,
    cameraOnly = false,
    cameraBlocker = solid,
    castShadow = true,
    receiveShadow = true,
    rotation = null,
    parent = scene,
    emissive = '#000000',
    emissiveIntensity = 0,
  } = {}) {
    const mesh = new THREE.Mesh(
      new THREE.BoxGeometry(size[0], size[1], size[2]),
      getMaterial(color, roughness, { emissive, emissiveIntensity }),
    );
    mesh.position.set(position[0], position[1], position[2]);
    if (rotation) mesh.rotation.set(rotation[0], rotation[1], rotation[2]);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = receiveShadow;
    parent.add(mesh);
    if (solid || cameraOnly) {
      colliders.push({
        type: 'box',
        cameraOnly: cameraOnly && !solid,
        minX: position[0] - size[0] / 2,
        maxX: position[0] + size[0] / 2,
        minY: position[1] - size[1] / 2,
        maxY: position[1] + size[1] / 2,
        minZ: position[2] - size[2] / 2,
        maxZ: position[2] + size[2] / 2,
      });
    }
    if (cameraBlocker) cameraOccluders.push(mesh);
    return mesh;
  }

  function addCylinder(radiusTop, radiusBottom, height, position, color, {
    segments = 8,
    solidRadius = 0,
    cameraBlocker = false,
    castShadow = true,
    roughness = 0.9,
    parent = scene,
  } = {}) {
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(radiusTop, radiusBottom, height, segments),
      getMaterial(color, roughness),
    );
    mesh.position.set(position[0], position[1], position[2]);
    mesh.castShadow = castShadow;
    mesh.receiveShadow = true;
    parent.add(mesh);
    if (solidRadius > 0) {
      colliders.push({
        type: 'circle',
        x: position[0],
        z: position[2],
        minY: position[1] - height / 2,
        maxY: position[1] + height / 2,
        radius: solidRadius,
      });
    }
    if (cameraBlocker) cameraOccluders.push(mesh);
    return mesh;
  }

  function addGroundPlane(width, depth, position, material, { rotation = -Math.PI / 2 } = {}) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), material);
    mesh.rotation.x = rotation;
    mesh.position.set(position[0], position[1], position[2]);
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh;
  }

  function addInstancedBoxes(size, positions, color, { castShadow = true, receiveShadow = true } = {}) {
    if (positions.length === 0) return null;
    const instances = new THREE.InstancedMesh(
      new THREE.BoxGeometry(size[0], size[1], size[2]),
      getMaterial(color),
      positions.length,
    );
    const transform = new THREE.Object3D();
    positions.forEach(([x, y, z, rotationY = 0], index) => {
      transform.position.set(x, y, z);
      transform.rotation.set(0, rotationY, 0);
      transform.scale.set(1, 1, 1);
      transform.updateMatrix();
      instances.setMatrixAt(index, transform.matrix);
    });
    instances.instanceMatrix.needsUpdate = true;
    instances.castShadow = castShadow;
    instances.receiveShadow = receiveShadow;
    scene.add(instances);
    return instances;
  }

  function addSign(title, subtitle, position, size, rotationY = 0) {
    const group = new THREE.Group();
    group.position.set(position[0], position[1], position[2]);
    group.rotation.y = rotationY;
    scene.add(group);
    addBox([size[0] + 0.22, size[1] + 0.2, 0.18], [0, 0, 0], COLORS.wood, {
      castShadow: false,
      cameraBlocker: false,
      parent: group,
    });
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(size[0], size[1]),
      new THREE.MeshBasicMaterial({ map: drawSignTexture(title, subtitle), toneMapped: false }),
    );
    face.position.z = 0.102;
    group.add(face);
    return group;
  }

  const night = new THREE.Color('#071521');
  const day = new THREE.Color('#83b7c7');
  const dawn = new THREE.Color('#c78570');
  const skyColor = new THREE.Color();
  const fogTint = new THREE.Color('#aeb8a2');
  scene.background = day.clone();
  scene.fog = new THREE.FogExp2(day, 0.0145);

  const hemisphere = new THREE.HemisphereLight('#d7ebeb', '#586052', 1.45);
  scene.add(hemisphere);
  const sun = new THREE.DirectionalLight('#ffefcf', 2.1);
  sun.position.set(-18, 35, 24);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -38;
  sun.shadow.camera.right = 38;
  sun.shadow.camera.top = 38;
  sun.shadow.camera.bottom = -38;
  sun.shadow.bias = -0.0006;
  scene.add(sun);
  scene.add(sun.target);

  const starPositions = [];
  let seed = 19021;
  const random = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };
  for (let i = 0; i < 180; i += 1) {
    const theta = random() * Math.PI * 2;
    const y = random() * 0.88 + 0.12;
    const ring = Math.sqrt(1 - y * y);
    starPositions.push(Math.cos(theta) * ring * 180, y * 180, Math.sin(theta) * ring * 180);
  }
  const starGeometry = new THREE.BufferGeometry();
  starGeometry.setAttribute('position', new THREE.Float32BufferAttribute(starPositions, 3));
  const stars = new THREE.Points(
    starGeometry,
    new THREE.PointsMaterial({ color: '#e6efff', size: 0.8, transparent: true, opacity: 0, depthWrite: false }),
  );
  scene.add(stars);

  const sunDisc = new THREE.Mesh(
    new THREE.SphereGeometry(1.65, 12, 10),
    new THREE.MeshBasicMaterial({ color: '#ffe0a0', toneMapped: false }),
  );
  scene.add(sunDisc);

  // Land, shoreline, road, plaza, and the connected route to the pier.
  addGroundPlane(58, 64, [0, -0.13, 6], getMaterial(COLORS.grass));
  addGroundPlane(58, 7, [0, -0.09, -10.3], getMaterial(COLORS.sand));
  addGroundPlane(120, 48, [0, -0.17, -36], getMaterial(COLORS.water, 0.38, { metalness: 0.1 }));
  addGroundPlane(54, 5.2, [0, -0.045, 9.7], getMaterial('#5c625f'));
  addGroundPlane(19, 13, [0, -0.025, 1.2], getMaterial(COLORS.path));
  addGroundPlane(4.1, 8.5, [0, 0.005, -6.8], getMaterial('#b6a989'));
  addGroundPlane(3.1, 22, [0, 0.13, -21], getMaterial(COLORS.boardwalk));

  const laneMarkPositions = [];
  for (let x = -24; x <= 24; x += 4) {
    if (Math.abs(x) < 2.1) continue;
    laneMarkPositions.push([x, 0.005, 9.7]);
  }
  addInstancedBoxes([0.18, 0.035, 0.55], laneMarkPositions, '#d6c69d', { castShadow: false });

  const pierPostPositions = [];
  const pierRailPositions = [];
  for (let z = -10; z >= -31; z -= 2.6) {
    for (const side of [-1, 1]) {
      pierPostPositions.push([side * 1.52, 0.42, z]);
      pierRailPositions.push([side * 1.52, 0.72, z]);
      colliders.push({
        type: 'box',
        minX: side * 1.52 - 0.06,
        maxX: side * 1.52 + 0.06,
        minY: 0.16,
        maxY: 0.68,
        minZ: z - 0.06,
        maxZ: z + 0.06,
      });
    }
  }
  addInstancedBoxes([0.12, 0.52, 0.12], pierPostPositions, '#715840');
  addInstancedBoxes([0.12, 0.08, 2.7], pierRailPositions, '#a78963', { castShadow: false });
  for (let x = -1; x <= 1; x += 1) {
    addBox([0.04, 0.02, 0.04], [x, 0.151, -11.3], '#d8bf90', { castShadow: false, cameraBlocker: false });
  }

  // A small open-front home. The roof lifts when the player steps inside so the bed stays visible.
  addBox([8, 0.24, 7.4], [-11, 0.03, 4.15], '#b4aa92', { cameraBlocker: false });
  addBox([0.28, 2.5, 7.1], [-15, 1.32, 4.1], '#d1c5a6', { solid: true });
  addBox([0.28, 2.5, 7.1], [-7, 1.32, 4.1], '#d1c5a6', { solid: true });
  addBox([8, 2.5, 0.28], [-11, 1.32, 0.55], '#d1c5a6', { solid: true });
  addBox([2.55, 2.5, 0.28], [-13.72, 1.32, 7.75], '#d1c5a6', { solid: true });
  addBox([2.55, 2.5, 0.28], [-8.28, 1.32, 7.75], '#d1c5a6', { solid: true });
  const roofMaterial = getMaterial(COLORS.roof, 0.78);
  const roofA = addBox([8.8, 0.2, 4.4], [-11, 3.12, 5.55], COLORS.roof, {
    rotation: [-0.38, 0, 0],
    cameraOnly: true,
    cameraBlocker: true,
    castShadow: false,
  });
  const roofB = addBox([8.8, 0.2, 4.4], [-11, 3.12, 2.75], COLORS.roof, {
    rotation: [0.38, 0, 0],
    cameraOnly: true,
    cameraBlocker: true,
    castShadow: false,
  });
  roofA.material = roofMaterial;
  roofB.material = roofMaterial;
  roofParts.push(roofA, roofB);
  addBox([0.28, 2.55, 0.28], [-15, 1.32, 0.55], '#8a7055');
  addBox([0.28, 2.55, 0.28], [-7, 1.32, 0.55], '#8a7055');
  addBox([2, 0.42, 1.15], [-11, 0.22, 8.36], '#9a8667', { cameraBlocker: false });

  const bedGroup = new THREE.Group();
  bedGroup.position.set(-10.2, 0, 4.4);
  scene.add(bedGroup);
  addBox([2.05, 0.36, 1.18], [0, 0.29, 0], '#6a5545', { cameraBlocker: false, parent: bedGroup });
  addBox([1.94, 0.24, 1.12], [0, 0.57, 0], '#e4d8c0', { cameraBlocker: false, parent: bedGroup });
  addBox([1.12, 0.12, 1.12], [0.38, 0.72, 0.02], '#668a8a', { cameraBlocker: false, parent: bedGroup });
  addBox([0.42, 0.14, 0.52], [-0.58, 0.73, -0.25], '#f4ecdc', { cameraBlocker: false, parent: bedGroup });
  const bedMarker = new THREE.Mesh(
    new THREE.TorusGeometry(0.62, 0.055, 6, 24),
    new THREE.MeshBasicMaterial({ color: '#e8c58a', transparent: true, opacity: 0.54 }),
  );
  bedMarker.rotation.x = -Math.PI / 2;
  bedMarker.position.set(-9.65, 0.015, 4.4);
  scene.add(bedMarker);

  // Café / grocery frontage with an open door and restrained warm details.
  addGroundPlane(9.6, 8.2, [12, -0.005, 4.65], getMaterial('#9c927e'));
  addBox([0.3, 2.85, 7.8], [7.5, 1.42, 4.65], '#d6c6a4', { solid: true });
  addBox([0.3, 2.85, 7.8], [16.5, 1.42, 4.65], '#d6c6a4', { solid: true });
  addBox([9, 2.85, 0.3], [12, 1.42, 0.7], '#d6c6a4', { solid: true });
  addBox([3.05, 2.85, 0.3], [9.03, 1.42, 8.6], '#d6c6a4', { solid: true });
  addBox([3.05, 2.85, 0.3], [14.97, 1.42, 8.6], '#d6c6a4', { solid: true });
  addBox([9.8, 0.25, 8.6], [12, 3.02, 4.65], '#536d6b', { cameraBlocker: true, castShadow: false });
  addBox([9.6, 0.18, 0.7], [12, 2.78, 8.75], '#bd8c63', { cameraBlocker: false });
  addSign('TIDE & TABLE', 'coffee • provisions', [12, 2.15, 8.78], [4.8, 1.25]);
  addBox([1.4, 1.35, 0.06], [8.8, 1.72, 8.43], '#6c8b89', { cameraBlocker: false });
  addBox([1.4, 1.35, 0.06], [15.2, 1.72, 8.43], '#6c8b89', { cameraBlocker: false });
  addBox([0.45, 0.95, 0.1], [12, 0.58, 8.46], '#745641', { cameraBlocker: false });
  addBox([2.4, 0.12, 0.5], [12, 1.12, 8.12], '#b58050', { cameraBlocker: false });

  // Lantern Post kiosk and its caretaker, Mira Calder.
  addBox([5.4, 0.24, 3.7], [4.25, 0.05, -3.75], '#9d8a6b', { cameraBlocker: false });
  addBox([0.22, 2.05, 3.5], [1.62, 1.08, -3.75], '#967252', { solid: true });
  addBox([0.22, 2.05, 3.5], [6.88, 1.08, -3.75], '#967252', { solid: true });
  addBox([5.4, 2.05, 0.22], [4.25, 1.08, -5.5], '#967252', { solid: true });
  addBox([5.4, 0.17, 3.9], [4.25, 2.18, -3.75], '#4b6a68', { cameraBlocker: true, castShadow: false });
  addBox([5.7, 0.18, 4.1], [4.25, 2.34, -3.75], '#8f7456', { cameraBlocker: false });
  addSign('LANTERN POST', 'letters • local notices', [4.25, 2.0, -5.64], [4.45, 1.22]);
  addBox([2.2, 0.72, 0.6], [4.45, 0.74, -3.1], '#6e5640', { cameraBlocker: false });
  addBox([2.35, 0.1, 0.68], [4.45, 1.15, -3.1], '#bd9a69', { cameraBlocker: false });

  const npc = createHumanoid({
    skin: '#d9a384',
    hair: '#47313a',
    top: '#377e78',
    trousers: '#34464b',
    shoes: '#313238',
    accent: '#e4bc78',
  });
  npc.root.position.set(2.55, 0, -1.35);
  npc.root.rotation.y = Math.PI * 0.88;
  scene.add(npc.root);
  colliders.push({ type: 'circle', x: 2.55, z: -1.35, minY: 0, maxY: 2.1, radius: 0.39 });

  const npcMarker = new THREE.Group();
  npcMarker.position.set(2.55, 2.55, -1.35);
  const markerGem = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.16, 0),
    new THREE.MeshStandardMaterial({ color: '#edc889', emissive: '#9e6e2e', emissiveIntensity: 0.62, roughness: 0.4 }),
  );
  npcMarker.add(markerGem);
  const markerRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.25, 0.022, 5, 22),
    new THREE.MeshBasicMaterial({ color: '#f4d79e', transparent: true, opacity: 0.7 }),
  );
  markerRing.rotation.x = Math.PI / 2;
  markerRing.position.y = -0.28;
  npcMarker.add(markerRing);
  scene.add(npcMarker);

  // The sealed parcel appears on the pier only after the errand is accepted.
  const parcel = new THREE.Group();
  parcel.position.set(0, 0.3, -20.7);
  scene.add(parcel);
  addBox([0.72, 0.62, 0.62], [0, 0.36, 0], '#9e7550', { cameraBlocker: false, parent: parcel });
  addBox([0.13, 0.65, 0.65], [0, 0.36, 0], '#e4cb91', { cameraBlocker: false, parent: parcel });
  addBox([0.74, 0.12, 0.12], [0, 0.6, 0], '#e4cb91', { cameraBlocker: false, parent: parcel });
  const parcelMarker = new THREE.Group();
  parcelMarker.position.set(0, 1.75, -20.7);
  const parcelHalo = new THREE.Mesh(
    new THREE.TorusGeometry(0.38, 0.035, 6, 24),
    new THREE.MeshBasicMaterial({ color: '#efc779', transparent: true, opacity: 0.62 }),
  );
  parcelHalo.rotation.x = Math.PI / 2;
  parcelMarker.add(parcelHalo);
  const parcelRay = new THREE.Mesh(
    new THREE.CylinderGeometry(0.035, 0.22, 1.55, 10, 1, true),
    new THREE.MeshBasicMaterial({ color: '#e7bd74', transparent: true, opacity: 0.12, side: THREE.DoubleSide, depthWrite: false }),
  );
  parcelRay.position.y = 0.8;
  parcelMarker.add(parcelRay);
  scene.add(parcelMarker);
  // Gentle landmarks: benches, lamps, pines, grasses, and a skiff.
  for (const [x, z] of [[-5.7, 0.2], [5.6, 0.2]]) {
    addBox([2.2, 0.18, 0.55], [x, 0.6, z], '#796047', { cameraBlocker: false });
    addBox([2.2, 0.58, 0.16], [x, 0.9, z + 0.22], '#866c50', { cameraBlocker: false });
    for (const side of [-1, 1]) addBox([0.13, 0.56, 0.14], [x + side * 0.82, 0.3, z], '#493f36', { cameraBlocker: false });
  }

  function addLamp(x, z) {
    addCylinder(0.055, 0.075, 3.2, [x, 1.6, z], '#4a5555', { solidRadius: 0.13, cameraBlocker: true });
    const bulb = addBox([0.42, 0.38, 0.42], [x, 3.25, z], '#ead6a1', {
      roughness: 0.5,
      emissive: '#f0bd70',
      emissiveIntensity: 0.2,
      cameraBlocker: false,
    });
    lampMaterials.push(bulb.material);
  }
  for (const point of [[-5, 8.5], [5, 8.5], [-6, -1], [6, -1], [2.8, -8.6]]) addLamp(...point);

  const pinePlacements = [];
  function addPine(x, z, scale = 1) {
    pinePlacements.push({ x, z, scale });
    colliders.push({ type: 'circle', x, z, minY: 0, maxY: 5.2 * scale, radius: 0.5 * scale });
  }

  function buildPineInstances() {
    const transform = new THREE.Object3D();
    const trunks = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.18, 0.26, 1.8, 6),
      getMaterial('#6c5140'),
      pinePlacements.length,
    );
    pinePlacements.forEach(({ x, z, scale }, index) => {
      transform.position.set(x, 0.9 * scale, z);
      transform.scale.setScalar(scale);
      transform.updateMatrix();
      trunks.setMatrixAt(index, transform.matrix);
    });
    trunks.instanceMatrix.needsUpdate = true;
    trunks.castShadow = true;
    trunks.receiveShadow = true;
    scene.add(trunks);

    for (let layer = 0; layer < 3; layer += 1) {
      const boughs = new THREE.InstancedMesh(
        new THREE.ConeGeometry(1.05 - layer * 0.18, 2.05 - layer * 0.18, 7),
        getMaterial(layer === 1 ? '#45675a' : '#3e5e53'),
        pinePlacements.length,
      );
      pinePlacements.forEach(({ x, z, scale }, index) => {
        transform.position.set(x, (1.8 + layer * 0.78) * scale, z);
        transform.scale.setScalar(scale);
        transform.updateMatrix();
        boughs.setMatrixAt(index, transform.matrix);
      });
      boughs.instanceMatrix.needsUpdate = true;
      boughs.castShadow = true;
      boughs.receiveShadow = true;
      scene.add(boughs);
    }
  }

  for (const [x, z, scale] of [
    [-21, 13, 1.2], [-19, 4, 0.9], [-22, -4, 1.1], [-17, -9, 0.8],
    [20, 14, 1.1], [22, 6, 0.9], [19, -3, 1.2], [22, -9, 0.9],
    [-18, 18, 1], [18, 20, 1.25], [-22, 21, 1.1], [23, 20, 1.1],
  ]) addPine(x, z, scale);
  buildPineInstances();

  for (const [x, z, radius, height] of [[-3.5, -10.2, 0.8, 0.7], [4.5, -11.1, 0.9, 0.8], [-5.8, -8.2, 0.65, 0.55], [7.5, -9.3, 1.0, 0.72]]) {
    const rock = new THREE.Mesh(new THREE.DodecahedronGeometry(radius, 0), getMaterial('#888c82'));
    rock.position.set(x, height * 0.45, z);
    rock.scale.y = height;
    rock.castShadow = true;
    rock.receiveShadow = true;
    scene.add(rock);
    colliders.push({ type: 'circle', x, z, minY: 0, maxY: height * 0.9, radius: radius * 0.8 });
    cameraOccluders.push(rock);
  }

  // A small skiff sits offshore, beyond the walkable waterline.
  const skiff = new THREE.Group();
  skiff.position.set(6.6, 0.05, -24.8);
  skiff.rotation.y = -0.12;
  scene.add(skiff);
  addBox([2.1, 0.28, 4.4], [0, 0.12, 0], '#6f563f', { cameraBlocker: false, parent: skiff });
  addBox([0.18, 0.45, 0.18], [0, 0.48, -0.45], '#9b805f', { cameraBlocker: false, parent: skiff });
  addBox([0.1, 0.03, 1.35], [0.02, 1.02, -0.42], '#dfd3b3', { cameraBlocker: false, parent: skiff });

  // Distant tree-covered ridges anchor the small slice without loading another region.
  for (const [x, z, radius, height, color] of [
    [-33, -3, 12, 22, '#557264'], [-43, 1, 17, 31, '#4c675e'],
    [34, -1, 13, 24, '#4e6e64'], [46, 3, 20, 34, '#465f59'],
  ]) {
    const hill = new THREE.Mesh(
      new THREE.ConeGeometry(radius, height, 9),
      getMaterial(color),
    );
    hill.position.set(x, height / 2 - 2, z);
    hill.rotation.y = 0.24;
    hill.receiveShadow = true;
    scene.add(hill);
  }

  const interactables = {
    npc: { position: new THREE.Vector3(2.55, 0, -1.35), radius: 2.45 },
    parcel: { position: new THREE.Vector3(0, 0, -20.7), radius: 1.65 },
    bed: { position: new THREE.Vector3(-9.65, 0, 4.4), radius: 1.95 },
  };

  function canOccupy(x, z, radius = 0.34) {
    if (x < -26 + radius || x > 26 - radius || z < -32 + radius || z > 25 - radius) return false;
    if (z < -11.9 && Math.abs(x) > 1.48 - radius * 0.35) return false;
    for (const collider of colliders) {
      if (collider.cameraOnly) continue;
      if (collider.type === 'circle') {
        const dx = x - collider.x;
        const dz = z - collider.z;
        const combined = radius + collider.radius;
        if (dx * dx + dz * dz < combined * combined) return false;
      } else {
        const closestX = Math.max(collider.minX, Math.min(x, collider.maxX));
        const closestZ = Math.max(collider.minZ, Math.min(z, collider.maxZ));
        const dx = x - closestX;
        const dz = z - closestZ;
        if (dx * dx + dz * dz < radius * radius) return false;
      }
    }
    return true;
  }

  function groundHeight(x, z) {
    return z < -11.75 && Math.abs(x) < 1.7 ? 0.13 : 0;
  }

  function cameraDistance(origin, direction, maxDistance, padding = 0.24) {
    let nearest = maxDistance;
    const verticalEntry = (entry, exit, collider) => {
      let low = Math.max(0, entry);
      let high = Math.min(maxDistance, exit);
      if (low > high) return null;
      const minY = (collider.minY ?? 0) - padding;
      const maxY = (collider.maxY ?? 3) + padding;
      if (Math.abs(direction.y) < 1e-6) {
        return origin.y >= minY && origin.y <= maxY ? low : null;
      }
      const a = (minY - origin.y) / direction.y;
      const b = (maxY - origin.y) / direction.y;
      low = Math.max(low, Math.min(a, b));
      high = Math.min(high, Math.max(a, b));
      return low <= high ? low : null;
    };

    for (const collider of colliders) {
      if (collider.cameraOnly && roofLifted) continue;
      let entry = -Infinity;
      let exit = Infinity;
      if (collider.type === 'box') {
        const axes = [
          [origin.x, direction.x, collider.minX - padding, collider.maxX + padding],
          [origin.z, direction.z, collider.minZ - padding, collider.maxZ + padding],
        ];
        let blocked = false;
        for (const [coordinate, velocity, min, max] of axes) {
          if (Math.abs(velocity) < 1e-7) {
            if (coordinate < min || coordinate > max) blocked = true;
            continue;
          }
          const t1 = (min - coordinate) / velocity;
          const t2 = (max - coordinate) / velocity;
          entry = Math.max(entry, Math.min(t1, t2));
          exit = Math.min(exit, Math.max(t1, t2));
        }
        if (blocked || entry > exit) continue;
      } else {
        const ox = origin.x - collider.x;
        const oz = origin.z - collider.z;
        const a = direction.x * direction.x + direction.z * direction.z;
        if (a < 1e-8) continue;
        const radius = collider.radius + padding;
        const b = 2 * (ox * direction.x + oz * direction.z);
        const c = ox * ox + oz * oz - radius * radius;
        const discriminant = b * b - 4 * a * c;
        if (discriminant < 0) continue;
        const root = Math.sqrt(discriminant);
        entry = (-b - root) / (2 * a);
        exit = (-b + root) / (2 * a);
      }

      const hit = verticalEntry(entry, exit, collider);
      if (hit !== null && hit > 0.28 && hit < nearest) nearest = hit;
    }
    return Math.max(2.2, nearest - (nearest < maxDistance ? padding : 0));
  }

  function syncTask(stage) {
    const available = stage === 'fetch';
    parcel.visible = available;
    parcelMarker.visible = available;
  }

  function update({ elapsed, minuteOfDay, playerPosition, taskStage }) {
    const insideCabin = playerPosition.x > -15.5 && playerPosition.x < -6.5
      && playerPosition.z > 0.6 && playerPosition.z < 8.35;
    roofLifted = insideCabin;
    for (const roof of roofParts) roof.visible = !insideCabin;
    bedMarker.material.opacity = 0.46 + Math.sin(elapsed * 2.2) * 0.08;

    npcMarker.position.y = 2.55 + Math.sin(elapsed * 2.1) * 0.08;
    markerGem.rotation.y = elapsed * 0.75;
    markerRing.rotation.z = elapsed * 0.24;
    parcel.rotation.y = Math.sin(elapsed * 0.6) * 0.08;
    parcelMarker.position.y = 1.78 + Math.sin(elapsed * 2.6) * 0.13;
    parcelHalo.rotation.z = elapsed * 0.3;
    syncTask(taskStage);

    const solarAngle = ((minuteOfDay / 1440) - 0.25) * Math.PI * 2;
    const sunHeight = Math.sin(solarAngle);
    const daylight = Math.max(0, Math.min(1, (sunHeight + 0.18) / 1.12));
    const warm = Math.max(0, 1 - Math.abs(sunHeight) / 0.38) * (sunHeight > -0.22 ? 1 : 0);
    skyColor.copy(night).lerp(day, daylight).lerp(dawn, warm * 0.32);
    scene.background.copy(skyColor);
    scene.fog.color.copy(skyColor).lerp(fogTint, 0.12 * daylight);
    scene.fog.density = 0.014 + (1 - daylight) * 0.006;
    hemisphere.intensity = 0.32 + daylight * 1.24;
    sun.intensity = 0.08 + daylight * 1.72;
    sun.color.set(daylight > 0.3 ? '#fff1d8' : '#8299bb');
    sun.position.set(Math.cos(solarAngle) * 42, Math.max(-6, sunHeight * 48), -12);
    sun.target.position.set(0, 0, 0);
    sunDisc.position.copy(sun.position).normalize().multiplyScalar(120);
    sunDisc.visible = sunHeight > -0.12;
    stars.material.opacity = Math.max(0, Math.min(0.78, (-sunHeight + 0.12) * 1.1));
    for (const material of lampMaterials) material.emissiveIntensity = 0.03 + (1 - daylight) * 0.45;
  }

  return {
    colliders,
    cameraOccluders,
    interactables,
    sun,
    npc,
    npcMarker,
    parcel,
    parcelMarker,
    bedMarker,
    canOccupy,
    groundHeight,
    cameraDistance,
    update,
  };
}
