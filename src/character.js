import * as THREE from 'three';

const sharedGeometry = {
  torso: new THREE.CylinderGeometry(0.3, 0.34, 0.88, 9),
  head: new THREE.SphereGeometry(0.255, 12, 10),
  hair: new THREE.SphereGeometry(0.27, 10, 8),
  limb: new THREE.CylinderGeometry(0.12, 0.145, 0.68, 8),
  hand: new THREE.SphereGeometry(0.105, 8, 7),
  shoe: new THREE.BoxGeometry(0.31, 0.16, 0.42),
};

function standard(color, roughness = 0.9) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.02 });
}

function mesh(geometry, material, position, parent, scale = null) {
  const object = new THREE.Mesh(geometry, material);
  object.position.set(...position);
  if (scale) object.scale.set(...scale);
  object.castShadow = true;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}

export function createHumanoid({
  skin = '#d59c78',
  hair = '#272b32',
  top = '#638a89',
  trousers = '#35404b',
  shoes = '#292c31',
  accent = '#e6b66f',
} = {}) {
  const root = new THREE.Group();
  const visual = new THREE.Group();
  root.add(visual);

  const materials = {
    skin: standard(skin),
    hair: standard(hair),
    top: standard(top),
    trousers: standard(trousers),
    shoes: standard(shoes),
    accent: standard(accent, 0.65),
  };

  mesh(sharedGeometry.torso, materials.top, [0, 1.26, 0], visual);
  mesh(sharedGeometry.head, materials.skin, [0, 1.88, -0.01], visual);
  const hairCap = mesh(sharedGeometry.hair, materials.hair, [0, 2.005, -0.035], visual, [1.02, 0.78, 1.02]);
  hairCap.scale.set(1.02, 0.78, 1.02);
  mesh(sharedGeometry.hair, materials.hair, [0, 1.83, 0.14], visual, [0.78, 0.82, 0.62]);

  const collar = mesh(
    new THREE.TorusGeometry(0.21, 0.045, 5, 12),
    materials.accent,
    [0, 1.65, 0],
    visual,
  );
  collar.rotation.x = Math.PI / 2;
  collar.scale.set(1, 0.8, 1);

  const arms = [];
  for (const side of [-1, 1]) {
    const arm = new THREE.Group();
    arm.position.set(side * 0.39, 1.52, 0);
    visual.add(arm);
    mesh(sharedGeometry.limb, materials.top, [0, -0.31, 0], arm);
    mesh(sharedGeometry.hand, materials.skin, [0, -0.68, 0.005], arm);
    arms.push({ group: arm, side });
  }

  const legs = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.18, 0.83, 0);
    visual.add(leg);
    mesh(sharedGeometry.limb, materials.trousers, [0, -0.34, 0], leg);
    mesh(sharedGeometry.shoe, materials.shoes, [0, -0.72, -0.045], leg);
    legs.push({ group: leg, side });
  }

  // A small, readable color block keeps the player/NPC silhouette distinct at distance.
  mesh(
    new THREE.BoxGeometry(0.12, 0.24, 0.055),
    materials.accent,
    [0.23, 1.28, -0.286],
    visual,
  );

  return {
    root,
    visual,
    arms,
    legs,
    animate(timeSeconds, moveAmount = 0, isMoving = false) {
      const gait = isMoving ? Math.sin(timeSeconds * 10.5) * Math.min(1, moveAmount) : 0;
      const breath = Math.sin(timeSeconds * 2.1) * 0.012;
      visual.position.y = breath + (isMoving ? Math.abs(gait) * 0.025 : 0);
      for (const { group, side } of legs) group.rotation.x = gait * side * 0.72;
      for (const { group, side } of arms) group.rotation.x = -gait * side * 0.58;
    },
  };
}
