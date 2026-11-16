import * as THREE from 'three';

export type PokemonAnimState = 'idle' | 'attack' | 'hit' | 'faint';

export interface PokemonRig {
  root: THREE.Group;
  bodyGroup: THREE.Group;
  headGroup?: THREE.Group;
  tailGroup?: THREE.Group;
  leftArm?: THREE.Object3D;
  rightArm?: THREE.Object3D;
  leftWing?: THREE.Object3D;
  rightWing?: THREE.Object3D;
  flameGroup?: THREE.Group;
  contactShadow: THREE.Mesh;
  materials: THREE.MeshStandardMaterial[];
  baseEmissives: THREE.Color[];
  speciesId: string;
  dispose(): void;
}

export interface PokeballRig {
  root: THREE.Group;
  topHalf: THREE.Group;
  bottomHalf: THREE.Group;
  coreGlow: THREE.Mesh;
  dispose(): void;
}

let sharedShadowTexture: THREE.CanvasTexture | null = null;

function getContactShadowTexture(): THREE.CanvasTexture {
  if (sharedShadowTexture) return sharedShadowTexture;
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const grad = ctx.createRadialGradient(
    size / 2,
    size / 2,
    size * 0.08,
    size / 2,
    size / 2,
    size * 0.5
  );
  grad.addColorStop(0, 'rgba(0, 0, 0, 0.72)');
  grad.addColorStop(0.55, 'rgba(0, 0, 0, 0.28)');
  grad.addColorStop(1, 'rgba(0, 0, 0, 0.0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  sharedShadowTexture = tex;
  return tex;
}

function createContactShadow(radius: number): THREE.Mesh {
  const geo = new THREE.PlaneGeometry(radius * 2, radius * 2);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    map: getContactShadowTexture(),
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.y = 0.003;
  mesh.renderOrder = 2;
  return mesh;
}

function makeMat(
  params: THREE.MeshStandardMaterialParameters,
  trackMaterials: THREE.MeshStandardMaterial[],
  trackEmissives: THREE.Color[]
): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial(params);
  trackMaterials.push(mat);
  trackEmissives.push(mat.emissive.clone());
  return mat;
}

function enableShadows(group: THREE.Object3D): void {
  group.traverse((obj) => {
    if ((obj as THREE.Mesh).isMesh) {
      obj.castShadow = true;
      obj.receiveShadow = true;
    }
  });
}

function addEyes(
  parent: THREE.Object3D,
  eyeY: number,
  eyeZ: number,
  eyeXOffset: number,
  irisColor: number,
  radius: number,
  mats: THREE.MeshStandardMaterial[],
  emissives: THREE.Color[],
  angryTilt = 0
): void {
  const scleraMat = makeMat(
    {color: 0xffffff, roughness: 0.15, metalness: 0.05},
    mats,
    emissives
  );
  const irisMat = makeMat(
    {
      color: irisColor,
      emissive: irisColor,
      emissiveIntensity: 0.15,
      roughness: 0.2,
    },
    mats,
    emissives
  );
  const pupilMat = makeMat({color: 0x0b0f19, roughness: 0.1}, mats, emissives);

  const eyeGeo = new THREE.SphereGeometry(radius, 14, 12);
  const irisGeo = new THREE.SphereGeometry(radius * 0.62, 12, 10);
  const pupilGeo = new THREE.SphereGeometry(radius * 0.35, 10, 8);

  for (const side of [-1, 1]) {
    const eyeGroup = new THREE.Group();
    eyeGroup.position.set(side * eyeXOffset, eyeY, eyeZ);
    eyeGroup.rotation.z = side * angryTilt;

    const sclera = new THREE.Mesh(eyeGeo, scleraMat);
    sclera.scale.set(0.95, 1.15, 0.55);

    const iris = new THREE.Mesh(irisGeo, irisMat);
    iris.position.set(-side * radius * 0.1, 0, radius * 0.34);
    iris.scale.set(0.9, 1.1, 0.5);

    const pupil = new THREE.Mesh(pupilGeo, pupilMat);
    pupil.position.set(-side * radius * 0.1, 0, radius * 0.48);
    pupil.scale.set(0.85, 1.15, 0.4);

    eyeGroup.add(sclera, iris, pupil);
    parent.add(eyeGroup);
  }
}

// ---------------------------------------------------------------------------
// #006 CHARIZARD (Composite 14-part Dragon Rig)
// ---------------------------------------------------------------------------
function buildCharizard(): PokemonRig {
  const root = new THREE.Group();
  root.name = 'Charizard';
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const mats: THREE.MeshStandardMaterial[] = [];
  const emissives: THREE.Color[] = [];

  const scaleOrange = makeMat(
    {color: 0xe85d22, roughness: 0.68, metalness: 0.04},
    mats,
    emissives
  );
  const bellyCream = makeMat(
    {color: 0xf4dc9c, roughness: 0.85, metalness: 0.0},
    mats,
    emissives
  );
  const wingTeal = makeMat(
    {color: 0x1e747c, roughness: 0.45, metalness: 0.08, side: THREE.DoubleSide},
    mats,
    emissives
  );
  const clawIvory = makeMat(
    {color: 0xfaf5e8, roughness: 0.25, metalness: 0.1},
    mats,
    emissives
  );
  const flameOuter = makeMat(
    {
      color: 0xff6a00,
      emissive: 0xff4500,
      emissiveIntensity: 1.4,
      roughness: 0.3,
    },
    mats,
    emissives
  );
  const flameInner = makeMat(
    {
      color: 0xfff07a,
      emissive: 0xffd000,
      emissiveIntensity: 2.0,
      roughness: 0.2,
    },
    mats,
    emissives
  );

  // 1. Torso via LatheGeometry
  const torsoPts = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.11, 0.02),
    new THREE.Vector2(0.135, 0.09),
    new THREE.Vector2(0.115, 0.17),
    new THREE.Vector2(0.075, 0.23),
    new THREE.Vector2(0.0, 0.25),
  ];
  const torsoGeo = new THREE.LatheGeometry(torsoPts, 20);
  const torso = new THREE.Mesh(torsoGeo, scaleOrange);
  torso.position.y = 0.08;
  torso.scale.set(1.0, 1.0, 0.92);
  bodyGroup.add(torso);

  // 2. Cream Belly Plate
  const bellyGeo = new THREE.SphereGeometry(0.115, 18, 16);
  const belly = new THREE.Mesh(bellyGeo, bellyCream);
  belly.position.set(0, 0.175, 0.042);
  belly.scale.set(0.84, 1.08, 0.72);
  bodyGroup.add(belly);

  // 3. Neck & Head Group
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.31, 0.03);
  bodyGroup.add(headGroup);

  const neckCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.04, -0.01),
    new THREE.Vector3(0, 0.04, 0.015),
    new THREE.Vector3(0, 0.11, 0.03),
  ]);
  const neck = new THREE.Mesh(
    new THREE.TubeGeometry(neckCurve, 12, 0.048, 12, false),
    scaleOrange
  );
  headGroup.add(neck);

  // Skull + Snout
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.068, 16, 14), scaleOrange);
  skull.position.set(0, 0.135, 0.04);
  skull.scale.set(0.95, 0.9, 1.15);
  headGroup.add(skull);

  const snout = new THREE.Mesh(
    new THREE.CylinderGeometry(0.036, 0.052, 0.095, 14),
    scaleOrange
  );
  snout.rotation.x = Math.PI / 2 - 0.1;
  snout.position.set(0, 0.12, 0.11);
  snout.scale.set(1.05, 1, 0.76);
  headGroup.add(snout);

  // Twin swept dragon horns
  const hornGeo = new THREE.ConeGeometry(0.018, 0.085, 10);
  for (const side of [-1, 1]) {
    const horn = new THREE.Mesh(hornGeo, scaleOrange);
    horn.position.set(side * 0.036, 0.195, 0.0);
    horn.rotation.x = -0.65;
    horn.rotation.z = -side * 0.22;
    headGroup.add(horn);
  }

  addEyes(headGroup, 0.145, 0.09, 0.042, 0x16a34a, 0.016, mats, emissives, -0.2);

  // 4. Bat Wings (ExtrudeGeometry with bone struts)
  const wingShape = new THREE.Shape();
  wingShape.moveTo(0, 0);
  wingShape.lineTo(0.24, 0.18);
  wingShape.lineTo(0.28, 0.05);
  wingShape.quadraticCurveTo(0.2, 0.01, 0.18, -0.09);
  wingShape.quadraticCurveTo(0.11, -0.05, 0.08, -0.14);
  wingShape.quadraticCurveTo(0.03, -0.07, 0, -0.09);
  wingShape.closePath();
  const wingGeo = new THREE.ExtrudeGeometry(wingShape, {
    depth: 0.008,
    bevelEnabled: true,
    bevelThickness: 0.003,
    bevelSize: 0.003,
    bevelSegments: 2,
  });

  const leftWing = new THREE.Group();
  leftWing.position.set(-0.07, 0.28, -0.05);
  leftWing.rotation.y = 0.42;
  const lwMesh = new THREE.Mesh(wingGeo, wingTeal);
  lwMesh.scale.x = -1;
  const lwStrut = new THREE.Mesh(
    new THREE.CylinderGeometry(0.01, 0.014, 0.29, 8),
    scaleOrange
  );
  lwStrut.rotation.z = Math.PI / 2 - 0.65;
  lwStrut.position.set(-0.11, 0.09, 0.005);
  leftWing.add(lwMesh, lwStrut);
  bodyGroup.add(leftWing);

  const rightWing = new THREE.Group();
  rightWing.position.set(0.07, 0.28, -0.05);
  rightWing.rotation.y = -0.42;
  const rwMesh = new THREE.Mesh(wingGeo, wingTeal);
  const rwStrut = new THREE.Mesh(
    new THREE.CylinderGeometry(0.01, 0.014, 0.29, 8),
    scaleOrange
  );
  rwStrut.rotation.z = -(Math.PI / 2 - 0.65);
  rwStrut.position.set(0.11, 0.09, 0.005);
  rightWing.add(rwMesh, rwStrut);
  bodyGroup.add(rightWing);

  // 5. Legs & Feet (grounded at y = 0)
  const legGeo = new THREE.CylinderGeometry(0.042, 0.036, 0.11, 12);
  const footGeo = new THREE.SphereGeometry(0.046, 12, 10);
  const clawGeo = new THREE.ConeGeometry(0.01, 0.028, 8);
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(legGeo, scaleOrange);
    leg.position.set(side * 0.092, 0.075, 0.01);
    bodyGroup.add(leg);

    const foot = new THREE.Mesh(footGeo, scaleOrange);
    foot.position.set(side * 0.095, 0.025, 0.025);
    foot.scale.set(0.95, 0.55, 1.35);
    bodyGroup.add(foot);

    for (let c = -1; c <= 1; c++) {
      const claw = new THREE.Mesh(clawGeo, clawIvory);
      claw.rotation.x = Math.PI / 2;
      claw.position.set(side * 0.095 + c * 0.018, 0.015, 0.088);
      bodyGroup.add(claw);
    }
  }

  // 6. Arms
  const armGeo = new THREE.CylinderGeometry(0.02, 0.016, 0.11, 10);
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.105, 0.255, 0.045);
  const laMesh = new THREE.Mesh(armGeo, scaleOrange);
  laMesh.rotation.z = 0.7;
  laMesh.rotation.x = 0.45;
  laMesh.position.set(-0.04, -0.03, 0.03);
  leftArm.add(laMesh);
  bodyGroup.add(leftArm);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.105, 0.255, 0.045);
  const raMesh = new THREE.Mesh(armGeo, scaleOrange);
  raMesh.rotation.z = -0.7;
  raMesh.rotation.x = 0.45;
  raMesh.position.set(0.04, -0.03, 0.03);
  rightArm.add(raMesh);
  bodyGroup.add(rightArm);

  // 7. Curved Tail & Animated Flame
  const tailGroup = new THREE.Group();
  tailGroup.position.set(0, 0.09, -0.08);
  bodyGroup.add(tailGroup);

  const tailCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.02, -0.03, -0.14),
    new THREE.Vector3(0.09, 0.04, -0.24),
    new THREE.Vector3(0.13, 0.16, -0.22),
  ]);
  const tailMesh = new THREE.Mesh(
    new THREE.TubeGeometry(tailCurve, 18, 0.028, 10, false),
    scaleOrange
  );
  tailGroup.add(tailMesh);

  const flameGroup = new THREE.Group();
  flameGroup.position.set(0.13, 0.18, -0.22);
  const flameO = new THREE.Mesh(new THREE.ConeGeometry(0.042, 0.105, 12), flameOuter);
  flameO.position.y = 0.04;
  const flameI = new THREE.Mesh(new THREE.ConeGeometry(0.024, 0.07, 10), flameInner);
  flameI.position.y = 0.03;
  flameGroup.add(flameO, flameI);
  tailGroup.add(flameGroup);

  enableShadows(bodyGroup);
  const contactShadow = createContactShadow(0.22);
  root.add(contactShadow);

  return {
    root,
    bodyGroup,
    headGroup,
    tailGroup,
    leftArm,
    rightArm,
    leftWing,
    rightWing,
    flameGroup,
    contactShadow,
    materials: mats,
    baseEmissives: emissives,
    speciesId: 'charizard',
    dispose() {
      root.traverse((obj) => {
        const m = obj as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
      mats.forEach((m) => m.dispose());
      (contactShadow.material as THREE.Material).dispose();
    },
  };
}

// ---------------------------------------------------------------------------
// #009 BLASTOISE (Composite 13-part Armored Turtle Rig)
// ---------------------------------------------------------------------------
function buildBlastoise(): PokemonRig {
  const root = new THREE.Group();
  root.name = 'Blastoise';
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const mats: THREE.MeshStandardMaterial[] = [];
  const emissives: THREE.Color[] = [];

  const navySkin = makeMat(
    {color: 0x2962c8, roughness: 0.68, metalness: 0.04},
    mats,
    emissives
  );
  const shellBrown = makeMat(
    {color: 0x6f4324, roughness: 0.42, metalness: 0.08},
    mats,
    emissives
  );
  const plastronCream = makeMat(
    {color: 0xf0dfb4, roughness: 0.78, metalness: 0.0},
    mats,
    emissives
  );
  const shellRim = makeMat(
    {color: 0xf8fafc, roughness: 0.45, metalness: 0.05},
    mats,
    emissives
  );
  const cannonSteel = makeMat(
    {color: 0xcbd5e1, roughness: 0.2, metalness: 0.88},
    mats,
    emissives
  );
  const cannonCore = makeMat(
    {color: 0x1e293b, roughness: 0.5, metalness: 0.4},
    mats,
    emissives
  );

  // 1. Torso & Belly Plastron
  const torso = new THREE.Mesh(
    new THREE.SphereGeometry(0.155, 22, 18),
    navySkin
  );
  torso.position.y = 0.21;
  torso.scale.set(1.05, 1.08, 0.95);
  bodyGroup.add(torso);

  const plastron = new THREE.Mesh(
    new THREE.SphereGeometry(0.145, 20, 16),
    plastronCream
  );
  plastron.position.set(0, 0.2, 0.032);
  plastron.scale.set(0.9, 1.0, 0.75);
  bodyGroup.add(plastron);

  // 2. Heavy Armored Shell (Lathe/hemisphere + white rim torus)
  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(0.165, 22, 16, 0, Math.PI * 2, 0, Math.PI * 0.58),
    shellBrown
  );
  shell.position.set(0, 0.21, -0.035);
  shell.rotation.x = -Math.PI / 2 - 0.15;
  shell.scale.set(1.02, 1.05, 0.95);
  bodyGroup.add(shell);

  const rim = new THREE.Mesh(
    new THREE.TorusGeometry(0.158, 0.022, 12, 26),
    shellRim
  );
  rim.position.set(0, 0.21, -0.02);
  rim.rotation.y = Math.PI / 2;
  rim.rotation.x = 0.15;
  rim.scale.set(1.04, 1.0, 1.0);
  bodyGroup.add(rim);

  // 3. Twin Brushed-Steel Water Cannons
  const cannonGeo = new THREE.CylinderGeometry(0.034, 0.042, 0.14, 16);
  const muzzleGeo = new THREE.CylinderGeometry(0.026, 0.026, 0.02, 14);
  for (const side of [-1, 1]) {
    const cannonGroup = new THREE.Group();
    cannonGroup.position.set(side * 0.11, 0.35, -0.02);
    cannonGroup.rotation.x = 0.52;
    cannonGroup.rotation.z = -side * 0.18;

    const barrel = new THREE.Mesh(cannonGeo, cannonSteel);
    barrel.position.y = 0.05;
    const muzzle = new THREE.Mesh(muzzleGeo, cannonCore);
    muzzle.position.y = 0.115;
    cannonGroup.add(barrel, muzzle);
    bodyGroup.add(cannonGroup);
  }

  // 4. Head + Ears + Jaw
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.35, 0.09);
  bodyGroup.add(headGroup);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.075, 18, 14), navySkin);
  head.scale.set(1.05, 0.92, 1.08);
  headGroup.add(head);

  const jaw = new THREE.Mesh(
    new THREE.SphereGeometry(0.062, 14, 10),
    plastronCream
  );
  jaw.position.set(0, -0.026, 0.024);
  jaw.scale.set(0.95, 0.55, 1.0);
  headGroup.add(jaw);

  const earGeo = new THREE.ConeGeometry(0.02, 0.05, 10);
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(earGeo, navySkin);
    ear.position.set(side * 0.055, 0.055, -0.02);
    ear.rotation.z = -side * 0.45;
    ear.rotation.x = -0.25;
    headGroup.add(ear);
  }

  addEyes(headGroup, 0.015, 0.062, 0.04, 0xb91c1c, 0.017, mats, emissives, -0.15);

  // 5. Stout Limbs & Tail
  const legGeo = new THREE.CylinderGeometry(0.052, 0.056, 0.1, 14);
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(legGeo, navySkin);
    leg.position.set(side * 0.1, 0.05, 0.01);
    bodyGroup.add(leg);
  }

  const armGeo = new THREE.CylinderGeometry(0.032, 0.036, 0.12, 12);
  const leftArm = new THREE.Group();
  leftArm.position.set(-0.14, 0.22, 0.04);
  const laMesh = new THREE.Mesh(armGeo, navySkin);
  laMesh.rotation.z = 0.85;
  laMesh.rotation.x = 0.4;
  laMesh.position.set(-0.045, -0.02, 0.03);
  leftArm.add(laMesh);
  bodyGroup.add(leftArm);

  const rightArm = new THREE.Group();
  rightArm.position.set(0.14, 0.22, 0.04);
  const raMesh = new THREE.Mesh(armGeo, navySkin);
  raMesh.rotation.z = -0.85;
  raMesh.rotation.x = 0.4;
  raMesh.position.set(0.045, -0.02, 0.03);
  rightArm.add(raMesh);
  bodyGroup.add(rightArm);

  const tailGroup = new THREE.Group();
  tailGroup.position.set(0, 0.08, -0.13);
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.11, 12), navySkin);
  tail.rotation.x = -Math.PI / 2 + 0.3;
  tail.position.z = -0.04;
  tailGroup.add(tail);
  bodyGroup.add(tailGroup);

  enableShadows(bodyGroup);
  const contactShadow = createContactShadow(0.24);
  root.add(contactShadow);

  return {
    root,
    bodyGroup,
    headGroup,
    tailGroup,
    leftArm,
    rightArm,
    contactShadow,
    materials: mats,
    baseEmissives: emissives,
    speciesId: 'blastoise',
    dispose() {
      root.traverse((obj) => {
        const m = obj as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
      mats.forEach((m) => m.dispose());
      (contactShadow.material as THREE.Material).dispose();
    },
  };
}

// ---------------------------------------------------------------------------
// #003 VENUSAUR (Composite 15-part Quadruped + Rafflesia Bloom Rig)
// ---------------------------------------------------------------------------
function buildVenusaur(): PokemonRig {
  const root = new THREE.Group();
  root.name = 'Venusaur';
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const mats: THREE.MeshStandardMaterial[] = [];
  const emissives: THREE.Color[] = [];

  const frogTeal = makeMat(
    {color: 0x2d9c8e, roughness: 0.78, metalness: 0.02},
    mats,
    emissives
  );
  const trunkBrown = makeMat(
    {color: 0x7c4a2d, roughness: 0.88, metalness: 0.0},
    mats,
    emissives
  );
  const frondGreen = makeMat(
    {color: 0x1e8f3e, roughness: 0.55, metalness: 0.04, side: THREE.DoubleSide},
    mats,
    emissives
  );
  const petalRed = makeMat(
    {color: 0xe13b53, roughness: 0.45, metalness: 0.05},
    mats,
    emissives
  );
  const spotWhite = makeMat(
    {color: 0xfef3c7, roughness: 0.65, metalness: 0.0},
    mats,
    emissives
  );

  // 1. Squat wide body
  const body = new THREE.Mesh(
    new THREE.SphereGeometry(0.18, 22, 16),
    frogTeal
  );
  body.position.set(0, 0.14, 0);
  body.scale.set(1.12, 0.72, 1.24);
  bodyGroup.add(body);

  // 2. 4 sturdy legs flush to ground (y = 0)
  const legGeo = new THREE.CylinderGeometry(0.044, 0.048, 0.11, 12);
  const legPositions: [number, number][] = [
    [-0.125, 0.12],
    [0.125, 0.12],
    [-0.125, -0.11],
    [0.125, -0.11],
  ];
  for (const [lx, lz] of legPositions) {
    const leg = new THREE.Mesh(legGeo, frogTeal);
    leg.position.set(lx, 0.055, lz);
    bodyGroup.add(leg);
  }

  // 3. Broad Head + Ears + Eyes
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.18, 0.19);
  bodyGroup.add(headGroup);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.095, 18, 14), frogTeal);
  head.scale.set(1.22, 0.74, 0.98);
  headGroup.add(head);

  const earGeo = new THREE.ConeGeometry(0.025, 0.05, 10);
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(earGeo, frogTeal);
    ear.position.set(side * 0.08, 0.055, -0.02);
    ear.rotation.z = -side * 0.38;
    headGroup.add(ear);
  }
  addEyes(headGroup, 0.028, 0.075, 0.052, 0xdc2626, 0.018, mats, emissives, -0.12);

  // 4. Palm Trunk + 4 Layered Fronds + Giant Rafflesia Flower
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.042, 0.068, 0.14, 14),
    trunkBrown
  );
  trunk.position.set(0, 0.27, -0.02);
  bodyGroup.add(trunk);

  const leafShape = new THREE.Shape();
  leafShape.moveTo(0, 0);
  leafShape.quadraticCurveTo(0.085, 0.07, 0.24, 0.02);
  leafShape.quadraticCurveTo(0.09, -0.06, 0, 0);
  const leafGeo = new THREE.ExtrudeGeometry(leafShape, {
    depth: 0.008,
    bevelEnabled: true,
    bevelThickness: 0.003,
    bevelSize: 0.003,
    bevelSegments: 2,
  });

  for (let i = 0; i < 4; i++) {
    const frond = new THREE.Mesh(leafGeo, frondGreen);
    const angle = (i * Math.PI) / 2 + Math.PI / 4;
    frond.position.set(0, 0.32, -0.02);
    frond.rotation.y = angle;
    frond.rotation.z = -0.18;
    frond.rotation.x = Math.PI / 2;
    bodyGroup.add(frond);
  }

  // Rafflesia petals + spots
  const petalGeo = new THREE.SphereGeometry(0.072, 14, 12);
  for (let i = 0; i < 6; i++) {
    const angle = (i * Math.PI * 2) / 6;
    const petal = new THREE.Mesh(petalGeo, petalRed);
    petal.position.set(
      Math.cos(angle) * 0.09,
      0.345,
      -0.02 + Math.sin(angle) * 0.09
    );
    petal.scale.set(1.15, 0.32, 0.88);
    petal.rotation.y = -angle;
    bodyGroup.add(petal);

    const spot = new THREE.Mesh(new THREE.SphereGeometry(0.016, 8, 8), spotWhite);
    spot.position.set(
      Math.cos(angle) * 0.105,
      0.365,
      -0.02 + Math.sin(angle) * 0.105
    );
    spot.scale.y = 0.3;
    bodyGroup.add(spot);
  }

  const centerBulb = new THREE.Mesh(
    new THREE.CylinderGeometry(0.052, 0.036, 0.065, 16),
    makeMat({color: 0xb45309, roughness: 0.55}, mats, emissives)
  );
  centerBulb.position.set(0, 0.365, -0.02);
  bodyGroup.add(centerBulb);

  enableShadows(bodyGroup);
  const contactShadow = createContactShadow(0.25);
  root.add(contactShadow);

  return {
    root,
    bodyGroup,
    headGroup,
    contactShadow,
    materials: mats,
    baseEmissives: emissives,
    speciesId: 'venusaur',
    dispose() {
      root.traverse((obj) => {
        const m = obj as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
      mats.forEach((m) => m.dispose());
      (contactShadow.material as THREE.Material).dispose();
    },
  };
}

// ---------------------------------------------------------------------------
// #025 PIKACHU (Composite 12-part Electric Mouse Rig)
// ---------------------------------------------------------------------------
function buildPikachu(): PokemonRig {
  const root = new THREE.Group();
  root.name = 'Pikachu';
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const mats: THREE.MeshStandardMaterial[] = [];
  const emissives: THREE.Color[] = [];

  const furYellow = makeMat(
    {color: 0xfacc15, roughness: 0.72, metalness: 0.02},
    mats,
    emissives
  );
  const cheekRed = makeMat(
    {
      color: 0xef4444,
      emissive: 0xdc2626,
      emissiveIntensity: 0.25,
      roughness: 0.35,
    },
    mats,
    emissives
  );
  const tipBlack = makeMat(
    {color: 0x111827, roughness: 0.6},
    mats,
    emissives
  );
  const stripeBrown = makeMat(
    {color: 0x78350f, roughness: 0.78},
    mats,
    emissives
  );

  // 1. Plump pear-shaped body via LatheGeometry
  const pts = [
    new THREE.Vector2(0, 0),
    new THREE.Vector2(0.088, 0.018),
    new THREE.Vector2(0.095, 0.08),
    new THREE.Vector2(0.078, 0.145),
    new THREE.Vector2(0.06, 0.175),
    new THREE.Vector2(0, 0.185),
  ];
  const torso = new THREE.Mesh(new THREE.LatheGeometry(pts, 20), furYellow);
  torso.position.y = 0.03;
  bodyGroup.add(torso);

  // Back stripes
  for (let i = 0; i < 2; i++) {
    const stripe = new THREE.Mesh(
      new THREE.BoxGeometry(0.09, 0.018, 0.025),
      stripeBrown
    );
    stripe.position.set(0, 0.09 + i * 0.045, -0.075);
    bodyGroup.add(stripe);
  }

  // 2. Round Head + Rosy Cheeks + Black-Tipped Ears
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.235, 0.01);
  bodyGroup.add(headGroup);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.082, 20, 16), furYellow);
  head.scale.set(1.06, 0.96, 0.98);
  headGroup.add(head);

  const cheekGeo = new THREE.SphereGeometry(0.022, 12, 10);
  for (const side of [-1, 1]) {
    const cheek = new THREE.Mesh(cheekGeo, cheekRed);
    cheek.position.set(side * 0.062, -0.018, 0.056);
    cheek.scale.set(0.95, 0.95, 0.5);
    headGroup.add(cheek);
  }

  addEyes(headGroup, 0.015, 0.07, 0.034, 0x111827, 0.016, mats, emissives);

  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.007, 8, 8), tipBlack);
  nose.position.set(0, 0.002, 0.08);
  headGroup.add(nose);

  const earBaseGeo = new THREE.CylinderGeometry(0.016, 0.022, 0.08, 12);
  const earTipGeo = new THREE.ConeGeometry(0.016, 0.045, 12);
  for (const side of [-1, 1]) {
    const ear = new THREE.Group();
    ear.position.set(side * 0.048, 0.068, -0.005);
    ear.rotation.z = -side * 0.45;
    ear.rotation.x = 0.15;

    const base = new THREE.Mesh(earBaseGeo, furYellow);
    base.position.y = 0.04;
    const tip = new THREE.Mesh(earTipGeo, tipBlack);
    tip.position.y = 0.102;
    ear.add(base, tip);
    headGroup.add(ear);
  }

  // 3. Feet & Arms
  const footGeo = new THREE.SphereGeometry(0.028, 12, 10);
  for (const side of [-1, 1]) {
    const foot = new THREE.Mesh(footGeo, furYellow);
    foot.position.set(side * 0.048, 0.018, 0.032);
    foot.scale.set(0.75, 0.55, 1.45);
    bodyGroup.add(foot);
  }

  const armGeo = new THREE.CapsuleGeometry(0.016, 0.045, 6, 10);
  const leftArm = new THREE.Mesh(armGeo, furYellow);
  leftArm.position.set(-0.082, 0.14, 0.04);
  leftArm.rotation.z = 0.6;
  leftArm.rotation.x = 0.5;
  bodyGroup.add(leftArm);

  const rightArm = new THREE.Mesh(armGeo, furYellow);
  rightArm.position.set(0.082, 0.14, 0.04);
  rightArm.rotation.z = -0.6;
  rightArm.rotation.x = 0.5;
  bodyGroup.add(rightArm);

  // 4. Lightning-Bolt Tail (ExtrudeGeometry)
  const tailGroup = new THREE.Group();
  tailGroup.position.set(0, 0.06, -0.075);
  bodyGroup.add(tailGroup);

  const boltShape = new THREE.Shape();
  boltShape.moveTo(0, 0);
  boltShape.lineTo(0.055, 0.05);
  boltShape.lineTo(0.03, 0.065);
  boltShape.lineTo(0.1, 0.125);
  boltShape.lineTo(0.065, 0.145);
  boltShape.lineTo(0.155, 0.235);
  boltShape.lineTo(0.095, 0.255);
  boltShape.lineTo(0.025, 0.16);
  boltShape.lineTo(0.052, 0.14);
  boltShape.lineTo(-0.005, 0.08);
  boltShape.lineTo(0.02, 0.06);
  boltShape.lineTo(-0.015, 0.018);
  boltShape.closePath();

  const tailBolt = new THREE.Mesh(
    new THREE.ExtrudeGeometry(boltShape, {
      depth: 0.012,
      bevelEnabled: true,
      bevelThickness: 0.003,
      bevelSize: 0.003,
      bevelSegments: 2,
    }),
    furYellow
  );
  tailBolt.rotation.y = Math.PI / 2 - 0.35;
  tailGroup.add(tailBolt);

  enableShadows(bodyGroup);
  const contactShadow = createContactShadow(0.17);
  root.add(contactShadow);

  return {
    root,
    bodyGroup,
    headGroup,
    tailGroup,
    leftArm,
    rightArm,
    contactShadow,
    materials: mats,
    baseEmissives: emissives,
    speciesId: 'pikachu',
    dispose() {
      root.traverse((obj) => {
        const m = obj as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
      mats.forEach((m) => m.dispose());
      (contactShadow.material as THREE.Material).dispose();
    },
  };
}

// ---------------------------------------------------------------------------
// #094 GENGAR (Composite 12-part Shadow Ghost Rig)
// ---------------------------------------------------------------------------
function buildGengar(): PokemonRig {
  const root = new THREE.Group();
  root.name = 'Gengar';
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const mats: THREE.MeshStandardMaterial[] = [];
  const emissives: THREE.Color[] = [];

  const ghostViolet = makeMat(
    {color: 0x5b3ea6, roughness: 0.62, metalness: 0.08},
    mats,
    emissives
  );
  const eyeCrimson = makeMat(
    {
      color: 0xff2b55,
      emissive: 0xe11d48,
      emissiveIntensity: 0.85,
      roughness: 0.2,
    },
    mats,
    emissives
  );
  const grinWhite = makeMat(
    {
      color: 0xf8fafc,
      emissive: 0xe2e8f0,
      emissiveIntensity: 0.25,
      roughness: 0.25,
    },
    mats,
    emissives
  );

  // 1. Plump spherical phantom body
  const torso = new THREE.Mesh(
    new THREE.SphereGeometry(0.165, 24, 20),
    ghostViolet
  );
  torso.position.y = 0.195;
  torso.scale.set(1.08, 1.0, 0.96);
  bodyGroup.add(torso);

  // 2. Twin devilish ears + spiky dorsal crest
  const earGeo = new THREE.ConeGeometry(0.048, 0.125, 12);
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(earGeo, ghostViolet);
    ear.position.set(side * 0.115, 0.34, -0.01);
    ear.rotation.z = -side * 0.55;
    ear.rotation.x = -0.15;
    bodyGroup.add(ear);
  }

  const spikeGeo = new THREE.ConeGeometry(0.028, 0.08, 10);
  for (let i = 0; i < 4; i++) {
    const spike = new THREE.Mesh(spikeGeo, ghostViolet);
    const angle = -0.25 + i * 0.42;
    spike.position.set(
      0,
      0.24 + Math.cos(angle) * 0.145,
      -0.02 - Math.sin(angle) * 0.145
    );
    spike.rotation.x = -angle - 0.3;
    bodyGroup.add(spike);
  }

  // 3. Glowing crimson eyes + jagged grinning mouth
  const eyeGeo = new THREE.SphereGeometry(0.032, 12, 10);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeo, eyeCrimson);
    eye.position.set(side * 0.068, 0.255, 0.135);
    eye.scale.set(1.1, 0.72, 0.35);
    eye.rotation.z = -side * 0.36;
    bodyGroup.add(eye);
  }

  const smileShape = new THREE.Shape();
  smileShape.moveTo(-0.095, 0.025);
  smileShape.quadraticCurveTo(0, -0.025, 0.095, 0.025);
  smileShape.quadraticCurveTo(0, -0.068, -0.095, 0.025);
  const smile = new THREE.Mesh(
    new THREE.ExtrudeGeometry(smileShape, {
      depth: 0.012,
      bevelEnabled: false,
    }),
    grinWhite
  );
  smile.position.set(0, 0.168, 0.145);
  bodyGroup.add(smile);

  // 4. Stubby arms & legs
  const armGeo = new THREE.ConeGeometry(0.038, 0.11, 12);
  const leftArm = new THREE.Mesh(armGeo, ghostViolet);
  leftArm.position.set(-0.18, 0.19, 0.04);
  leftArm.rotation.z = 1.1;
  bodyGroup.add(leftArm);

  const rightArm = new THREE.Mesh(armGeo, ghostViolet);
  rightArm.position.set(0.18, 0.19, 0.04);
  rightArm.rotation.z = -1.1;
  bodyGroup.add(rightArm);

  const legGeo = new THREE.CylinderGeometry(0.045, 0.038, 0.09, 12);
  for (const side of [-1, 1]) {
    const leg = new THREE.Mesh(legGeo, ghostViolet);
    leg.position.set(side * 0.088, 0.045, 0.01);
    bodyGroup.add(leg);
  }

  const tailGroup = new THREE.Group();
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.09, 10), ghostViolet);
  tail.position.set(0, 0.07, -0.16);
  tail.rotation.x = -Math.PI / 2 + 0.25;
  tailGroup.add(tail);
  bodyGroup.add(tailGroup);

  enableShadows(bodyGroup);
  const contactShadow = createContactShadow(0.22);
  root.add(contactShadow);

  return {
    root,
    bodyGroup,
    tailGroup,
    leftArm,
    rightArm,
    contactShadow,
    materials: mats,
    baseEmissives: emissives,
    speciesId: 'gengar',
    dispose() {
      root.traverse((obj) => {
        const m = obj as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
      mats.forEach((m) => m.dispose());
      (contactShadow.material as THREE.Material).dispose();
    },
  };
}

// ---------------------------------------------------------------------------
// #143 SNORLAX (Composite 11-part Colossal Sleeper Rig)
// ---------------------------------------------------------------------------
function buildSnorlax(): PokemonRig {
  const root = new THREE.Group();
  root.name = 'Snorlax';
  const bodyGroup = new THREE.Group();
  root.add(bodyGroup);

  const mats: THREE.MeshStandardMaterial[] = [];
  const emissives: THREE.Color[] = [];

  const tealBody = makeMat(
    {color: 0x165e63, roughness: 0.8, metalness: 0.02},
    mats,
    emissives
  );
  const creamBelly = makeMat(
    {color: 0xf6e6c2, roughness: 0.86, metalness: 0.0},
    mats,
    emissives
  );
  const padTan = makeMat(
    {color: 0xb48a60, roughness: 0.72},
    mats,
    emissives
  );
  const darkLine = makeMat({color: 0x111827, roughness: 0.35}, mats, emissives);

  // 1. Huge Belly Torso
  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.22, 24, 18), tealBody);
  torso.position.y = 0.21;
  torso.scale.set(1.12, 1.0, 0.98);
  bodyGroup.add(torso);

  const belly = new THREE.Mesh(
    new THREE.SphereGeometry(0.19, 20, 16),
    creamBelly
  );
  belly.position.set(0, 0.195, 0.068);
  belly.scale.set(0.95, 0.92, 0.78);
  bodyGroup.add(belly);

  // 2. Round Head + Face Mask + Ears + Happy Squint Eyes
  const headGroup = new THREE.Group();
  headGroup.position.set(0, 0.42, 0.04);
  bodyGroup.add(headGroup);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.11, 20, 16), tealBody);
  head.scale.set(1.06, 0.92, 0.95);
  headGroup.add(head);

  const face = new THREE.Mesh(new THREE.SphereGeometry(0.088, 16, 14), creamBelly);
  face.position.set(0, -0.01, 0.042);
  face.scale.set(1.0, 0.86, 0.72);
  headGroup.add(face);

  const earGeo = new THREE.ConeGeometry(0.032, 0.068, 12);
  for (const side of [-1, 1]) {
    const ear = new THREE.Mesh(earGeo, tealBody);
    ear.position.set(side * 0.072, 0.082, -0.01);
    ear.rotation.z = -side * 0.38;
    headGroup.add(ear);

    // Closed sleeping eye slit
    const eyeSlit = new THREE.Mesh(
      new THREE.BoxGeometry(0.034, 0.007, 0.01),
      darkLine
    );
    eyeSlit.position.set(side * 0.038, 0.012, 0.1);
    eyeSlit.rotation.z = side * 0.08;
    headGroup.add(eyeSlit);
  }

  // 3. Broad Arms & Big Feet with Brown Pads
  const armGeo = new THREE.CapsuleGeometry(0.045, 0.11, 8, 12);
  const leftArm = new THREE.Mesh(armGeo, tealBody);
  leftArm.position.set(-0.22, 0.25, 0.03);
  leftArm.rotation.z = 0.75;
  bodyGroup.add(leftArm);

  const rightArm = new THREE.Mesh(armGeo, tealBody);
  rightArm.position.set(0.22, 0.25, 0.03);
  rightArm.rotation.z = -0.75;
  bodyGroup.add(rightArm);

  const footGeo = new THREE.SphereGeometry(0.068, 14, 12);
  const padGeo = new THREE.CylinderGeometry(0.035, 0.035, 0.01, 12);
  for (const side of [-1, 1]) {
    const foot = new THREE.Mesh(footGeo, creamBelly);
    foot.position.set(side * 0.135, 0.045, 0.095);
    foot.scale.set(0.95, 0.65, 1.15);
    bodyGroup.add(foot);

    const pad = new THREE.Mesh(padGeo, padTan);
    pad.rotation.x = Math.PI / 2;
    pad.position.set(side * 0.135, 0.045, 0.168);
    bodyGroup.add(pad);
  }

  enableShadows(bodyGroup);
  const contactShadow = createContactShadow(0.28);
  root.add(contactShadow);

  return {
    root,
    bodyGroup,
    headGroup,
    leftArm,
    rightArm,
    contactShadow,
    materials: mats,
    baseEmissives: emissives,
    speciesId: 'snorlax',
    dispose() {
      root.traverse((obj) => {
        const m = obj as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
      mats.forEach((m) => m.dispose());
      (contactShadow.material as THREE.Material).dispose();
    },
  };
}

// ---------------------------------------------------------------------------
// Factory & Idle/Battle Pose Updater
// ---------------------------------------------------------------------------
export function createPokemonRig(speciesId: string): PokemonRig {
  switch (speciesId) {
    case 'charizard':
      return buildCharizard();
    case 'blastoise':
      return buildBlastoise();
    case 'venusaur':
      return buildVenusaur();
    case 'pikachu':
      return buildPikachu();
    case 'gengar':
      return buildGengar();
    case 'snorlax':
      return buildSnorlax();
    default:
      return buildCharizard();
  }
}

export function updatePokemonIdleRig(
  rig: PokemonRig,
  elapsed: number,
  phaseOffset: number,
  isParalyzed = false
): void {
  const t = elapsed + phaseOffset;
  const speedMult = isParalyzed ? 0.45 : 1.0;

  // Gentle grounded breathing bob
  const breathe = Math.sin(t * 2.6 * speedMult);
  if (rig.speciesId === 'gengar') {
    // Gengar hovers slightly above ground!
    rig.bodyGroup.position.y = 0.03 + Math.sin(t * 3.0 * speedMult) * 0.025;
  } else {
    rig.bodyGroup.scale.y = 1 + breathe * 0.028;
    rig.bodyGroup.scale.x = 1 - breathe * 0.014;
    rig.bodyGroup.scale.z = 1 - breathe * 0.014;
  }

  if (rig.headGroup) {
    rig.headGroup.rotation.x = Math.sin(t * 1.9 * speedMult) * 0.06;
    rig.headGroup.rotation.y = Math.sin(t * 1.1 * speedMult) * 0.07;
  }
  if (rig.tailGroup) {
    rig.tailGroup.rotation.y = Math.sin(t * 4.0 * speedMult) * 0.14;
  }
  if (rig.leftWing && rig.rightWing) {
    const flap = Math.sin(t * 3.8 * speedMult) * 0.16;
    rig.leftWing.rotation.y = 0.42 + flap;
    rig.rightWing.rotation.y = -0.42 - flap;
  }
  if (rig.flameGroup) {
    const flicker = 0.9 + Math.sin(t * 18.0) * 0.18 + Math.cos(t * 11.0) * 0.1;
    rig.flameGroup.scale.set(
      0.95 + Math.sin(t * 14) * 0.1,
      flicker,
      0.95 + Math.cos(t * 14) * 0.1
    );
  }
  if (rig.leftArm && rig.rightArm && rig.speciesId !== 'pikachu') {
    rig.leftArm.rotation.x = Math.sin(t * 2.6 * speedMult) * 0.08;
    rig.rightArm.rotation.x = -Math.sin(t * 2.6 * speedMult) * 0.08;
  }
}

export function setRigHitFlash(rig: PokemonRig, intensity: number): void {
  for (let i = 0; i < rig.materials.length; i++) {
    const mat = rig.materials[i];
    const base = rig.baseEmissives[i];
    if (intensity > 0.01) {
      mat.emissive.setRGB(
        THREE.MathUtils.lerp(base.r, 1.0, intensity),
        THREE.MathUtils.lerp(base.g, 1.0, intensity),
        THREE.MathUtils.lerp(base.b, 1.0, intensity)
      );
      mat.emissiveIntensity = Math.max(1.0, intensity * 2.2);
    } else {
      mat.emissive.copy(base);
      mat.emissiveIntensity = base.r + base.g + base.b > 0.1 ? 1.2 : 0.0;
    }
  }
}

// ---------------------------------------------------------------------------
// Composite 5-Part 3D Poké Ball
// ---------------------------------------------------------------------------
export function createPokeballRig(): PokeballRig {
  const root = new THREE.Group();
  const radius = 0.055;

  const redMat = new THREE.MeshPhysicalMaterial({
    color: 0xdc2626,
    roughness: 0.18,
    metalness: 0.15,
    clearcoat: 0.9,
    clearcoatRoughness: 0.12,
  });
  const whiteMat = new THREE.MeshPhysicalMaterial({
    color: 0xf8fafc,
    roughness: 0.22,
    metalness: 0.08,
    clearcoat: 0.8,
  });
  const bandMat = new THREE.MeshStandardMaterial({
    color: 0x111827,
    roughness: 0.5,
    metalness: 0.2,
  });
  const chromeMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.15,
    metalness: 0.9,
  });
  const glowMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    transparent: true,
    opacity: 0.0,
  });

  const topHalf = new THREE.Group();
  const topSphere = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 20, 12, 0, Math.PI * 2, 0, Math.PI * 0.48),
    redMat
  );
  topHalf.add(topSphere);
  root.add(topHalf);

  const bottomHalf = new THREE.Group();
  const bottomSphere = new THREE.Mesh(
    new THREE.SphereGeometry(
      radius,
      20,
      12,
      0,
      Math.PI * 2,
      Math.PI * 0.52,
      Math.PI * 0.48
    ),
    whiteMat
  );
  const centerBand = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 1.005, radius * 1.005, 0.012, 24),
    bandMat
  );
  const buttonOuter = new THREE.Mesh(
    new THREE.CylinderGeometry(0.016, 0.016, 0.014, 16),
    bandMat
  );
  buttonOuter.rotation.x = Math.PI / 2;
  buttonOuter.position.z = radius * 0.92;

  const buttonInner = new THREE.Mesh(
    new THREE.CylinderGeometry(0.01, 0.01, 0.017, 16),
    chromeMat
  );
  buttonInner.rotation.x = Math.PI / 2;
  buttonInner.position.z = radius * 0.94;

  bottomHalf.add(bottomSphere, centerBand, buttonOuter, buttonInner);
  root.add(bottomHalf);

  const coreGlow = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.72, 16, 12), glowMat);
  root.add(coreGlow);

  return {
    root,
    topHalf,
    bottomHalf,
    coreGlow,
    dispose() {
      root.traverse((obj) => {
        const m = obj as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
      });
      redMat.dispose();
      whiteMat.dispose();
      bandMat.dispose();
      chromeMat.dispose();
      glowMat.dispose();
    },
  };
}
