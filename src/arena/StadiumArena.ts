import * as THREE from 'three';

export interface ArenaSpots {
  playerPadLocal: THREE.Vector3;
  enemyPadLocal: THREE.Vector3;
  playerPadWorld: THREE.Vector3;
  enemyPadWorld: THREE.Vector3;
}

function createArenaSurfaceTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const width = 1024;
  const height = 680;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;

  // Rich Indigo Plateau stadium turf + subtle checkerboard mow stripes
  const baseGrad = ctx.createLinearGradient(0, 0, 0, height);
  baseGrad.addColorStop(0, '#1e4d3b');
  baseGrad.addColorStop(0.5, '#245e47');
  baseGrad.addColorStop(1, '#1b4535');
  ctx.fillStyle = baseGrad;
  ctx.fillRect(0, 0, width, height);

  // Subtle turf bands
  const stripeCount = 12;
  const stripeW = width / stripeCount;
  for (let i = 0; i < stripeCount; i++) {
    if (i % 2 === 0) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.035)';
      ctx.fillRect(i * stripeW, 0, stripeW, height);
    }
  }

  // Subtle organic turf grain
  for (let i = 0; i < 3200; i++) {
    const x = Math.random() * width;
    const y = Math.random() * height;
    ctx.fillStyle =
      Math.random() > 0.5 ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.04)';
    ctx.fillRect(x, y, 2, 2);
  }

  // Crisp white stadium perimeter & center line
  const pad = 42;
  ctx.strokeStyle = 'rgba(248, 250, 252, 0.85)';
  ctx.lineWidth = 8;
  ctx.strokeRect(pad, pad, width - pad * 2, height - pad * 2);

  // Corner arcs
  const cornerR = 32;
  for (const [cx, cy, sa, ea] of [
    [pad, pad, 0, Math.PI / 2],
    [width - pad, pad, Math.PI / 2, Math.PI],
    [width - pad, height - pad, Math.PI, Math.PI * 1.5],
    [pad, height - pad, Math.PI * 1.5, Math.PI * 2],
  ]) {
    ctx.beginPath();
    ctx.arc(cx, cy, cornerR, sa, ea);
    ctx.stroke();
  }

  // Center line & Poké Ball Arena Emblem
  const cx = width / 2;
  const cy = height / 2;
  ctx.beginPath();
  ctx.moveTo(cx, pad);
  ctx.lineTo(cx, height - pad);
  ctx.stroke();

  const ballR = 112;
  // Upper red semicircle
  ctx.beginPath();
  ctx.arc(cx, cy, ballR, Math.PI, 0);
  ctx.fillStyle = 'rgba(220, 38, 38, 0.35)';
  ctx.fill();

  // Lower white semicircle
  ctx.beginPath();
  ctx.arc(cx, cy, ballR, 0, Math.PI);
  ctx.fillStyle = 'rgba(248, 250, 252, 0.25)';
  ctx.fill();

  // Outer circle
  ctx.beginPath();
  ctx.arc(cx, cy, ballR, 0, Math.PI * 2);
  ctx.lineWidth = 10;
  ctx.strokeStyle = 'rgba(248, 250, 252, 0.9)';
  ctx.stroke();

  // Center band + button
  ctx.fillStyle = 'rgba(15, 23, 42, 0.72)';
  ctx.fillRect(cx - ballR, cy - 10, ballR * 2, 20);
  ctx.beginPath();
  ctx.arc(cx, cy, 30, 0, Math.PI * 2);
  ctx.fillStyle = '#0f172a';
  ctx.fill();
  ctx.lineWidth = 7;
  ctx.strokeStyle = '#f8fafc';
  ctx.stroke();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = Math.min(8, maxAnisotropy || 1);
  return tex;
}

export class StadiumArena {
  readonly group = new THREE.Group();
  readonly vrSurroundings = new THREE.Group();
  readonly playerPadRing: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  readonly enemyPadRing: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>;
  readonly spots: ArenaSpots;

  private surfaceTex: THREE.CanvasTexture;
  private disposables: Array<{dispose(): void}> = [];

  constructor(maxAnisotropy = 4) {
    this.group.name = 'Kanto Stadium Arena';
    this.group.position.set(0, 0.88, -1.72);

    const deckW = 1.72;
    const deckD = 1.12;

    // 1. Sculpted beveled stadium chassis
    const hullShape = new THREE.Shape();
    const hw = deckW / 2;
    const hd = deckD / 2;
    const r = 0.1;
    hullShape.moveTo(-hw + r, -hd);
    hullShape.lineTo(hw - r, -hd);
    hullShape.quadraticCurveTo(hw, -hd, hw, -hd + r);
    hullShape.lineTo(hw, hd - r);
    hullShape.quadraticCurveTo(hw, hd, hw - r, hd);
    hullShape.lineTo(-hw + r, hd);
    hullShape.quadraticCurveTo(-hw, hd, -hw, hd - r);
    hullShape.lineTo(-hw, -hd + r);
    hullShape.quadraticCurveTo(-hw, -hd, -hw + r, -hd);

    const hullGeo = new THREE.ExtrudeGeometry(hullShape, {
      depth: 0.055,
      bevelEnabled: true,
      bevelThickness: 0.014,
      bevelSize: 0.015,
      bevelSegments: 3,
    });
    hullGeo.rotateX(Math.PI / 2);

    const hullMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.42,
      metalness: 0.65,
    });
    const hullMesh = new THREE.Mesh(hullGeo, hullMat);
    hullMesh.position.y = 0.0;
    hullMesh.receiveShadow = true;
    hullMesh.castShadow = true;
    this.group.add(hullMesh);

    // Metallic crimson/gold stadium accent trim
    const trimGeo = new THREE.BoxGeometry(deckW + 0.025, 0.014, deckD + 0.025);
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0xdc2626,
      roughness: 0.28,
      metalness: 0.55,
    });
    const trimMesh = new THREE.Mesh(trimGeo, trimMat);
    trimMesh.position.y = -0.022;
    this.group.add(trimMesh);

    // 2. Top textured battle pitch
    this.surfaceTex = createArenaSurfaceTexture(maxAnisotropy);
    const pitchGeo = new THREE.PlaneGeometry(deckW - 0.06, deckD - 0.06);
    pitchGeo.rotateX(-Math.PI / 2);
    const pitchMat = new THREE.MeshStandardMaterial({
      map: this.surfaceTex,
      roughness: 0.84,
      metalness: 0.02,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const pitchMesh = new THREE.Mesh(pitchGeo, pitchMat);
    pitchMesh.position.y = 0.016;
    pitchMesh.receiveShadow = true;
    this.group.add(pitchMesh);

    // 3. Player & Opponent Battle Pads
    const playerPos = new THREE.Vector3(-0.46, 0.024, 0.14);
    const enemyPos = new THREE.Vector3(0.46, 0.024, -0.14);

    const padGeo = new THREE.CylinderGeometry(0.24, 0.26, 0.014, 32);
    const padMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.52,
      metalness: 0.32,
    });
    const playerPad = new THREE.Mesh(padGeo, padMat);
    playerPad.position.copy(playerPos);
    playerPad.position.y = 0.017;
    playerPad.receiveShadow = true;

    const enemyPad = new THREE.Mesh(padGeo, padMat);
    enemyPad.position.copy(enemyPos);
    enemyPad.position.y = 0.017;
    enemyPad.receiveShadow = true;
    this.group.add(playerPad, enemyPad);

    const ringGeo = new THREE.RingGeometry(0.22, 0.248, 36);
    ringGeo.rotateX(-Math.PI / 2);
    const pRingMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    });
    const eRingMat = new THREE.MeshBasicMaterial({
      color: 0xf43f5e,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
    });
    this.playerPadRing = new THREE.Mesh(ringGeo, pRingMat);
    this.playerPadRing.position.set(playerPos.x, 0.026, playerPos.z);

    this.enemyPadRing = new THREE.Mesh(ringGeo, eRingMat);
    this.enemyPadRing.position.set(enemyPos.x, 0.026, enemyPos.z);
    this.group.add(this.playerPadRing, this.enemyPadRing);

    // 4. Four Corner Stadium Floodlight Pylons
    const pylonPoleGeo = new THREE.CylinderGeometry(0.012, 0.018, 0.34, 10);
    const pylonHeadGeo = new THREE.BoxGeometry(0.085, 0.042, 0.035);
    const lampFaceGeo = new THREE.PlaneGeometry(0.07, 0.028);
    const steelMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.28,
      metalness: 0.82,
    });
    const lampMat = new THREE.MeshBasicMaterial({color: 0xfffbeb});

    const corners: [number, number][] = [
      [-hw + 0.07, -hd + 0.07],
      [hw - 0.07, -hd + 0.07],
      [-hw + 0.07, hd - 0.07],
      [hw - 0.07, hd - 0.07],
    ];
    for (const [cx, cz] of corners) {
      const pylon = new THREE.Group();
      pylon.position.set(cx, 0.01, cz);
      pylon.lookAt(0, 0.01, 0);

      const pole = new THREE.Mesh(pylonPoleGeo, steelMat);
      pole.position.y = 0.17;
      pole.castShadow = true;

      const head = new THREE.Mesh(pylonHeadGeo, hullMat);
      head.position.set(0, 0.34, 0.01);
      head.rotation.x = 0.45;

      const lamp = new THREE.Mesh(lampFaceGeo, lampMat);
      lamp.position.set(0, 0.332, 0.028);
      lamp.rotation.x = 0.45;

      pylon.add(pole, head, lamp);
      this.group.add(pylon);
    }

    // 5. VR Surroundings (Indigo Plateau Bowl + Distant Skyline)
    this.buildVrSurroundings();
    this.vrSurroundings.visible = false;
    this.group.add(this.vrSurroundings);

    this.disposables.push(
      hullGeo,
      hullMat,
      trimGeo,
      trimMat,
      this.surfaceTex,
      pitchGeo,
      pitchMat,
      padGeo,
      padMat,
      ringGeo,
      pRingMat,
      eRingMat,
      pylonPoleGeo,
      pylonHeadGeo,
      lampFaceGeo,
      steelMat,
      lampMat
    );

    this.group.updateMatrixWorld(true);
    this.spots = {
      playerPadLocal: playerPos.clone(),
      enemyPadLocal: enemyPos.clone(),
      playerPadWorld: playerPos.clone().applyMatrix4(this.group.matrixWorld),
      enemyPadWorld: enemyPos.clone().applyMatrix4(this.group.matrixWorld),
    };
  }

  private buildVrSurroundings(): void {
    // Terraced stadium tiers surrounding the arena
    const tierMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.75,
      metalness: 0.15,
    });
    const tierAccentMat = new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      emissive: 0x1d4ed8,
      emissiveIntensity: 0.35,
      roughness: 0.4,
    });

    for (let i = 0; i < 3; i++) {
      const radius = 3.2 + i * 0.9;
      const tierGeo = new THREE.CylinderGeometry(
        radius + 0.55,
        radius,
        0.55,
        36,
        1,
        true
      );
      const tier = new THREE.Mesh(tierGeo, tierMat);
      tier.material.side = THREE.DoubleSide;
      tier.position.y = -0.7 + i * 0.55;
      this.vrSurroundings.add(tier);

      const bandGeo = new THREE.TorusGeometry(radius + 0.25, 0.025, 8, 48);
      bandGeo.rotateX(Math.PI / 2);
      const band = new THREE.Mesh(bandGeo, tierAccentMat);
      band.position.y = -0.45 + i * 0.55;
      this.vrSurroundings.add(band);

      this.disposables.push(tierGeo, bandGeo);
    }

    // Floor below stadium
    const floorGeo = new THREE.CircleGeometry(12, 48);
    floorGeo.rotateX(-Math.PI / 2);
    const floorMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.9,
    });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.position.y = -0.88;
    floor.receiveShadow = true;
    this.vrSurroundings.add(floor);

    this.disposables.push(tierMat, tierAccentMat, floorGeo, floorMat);
  }

  setPadColors(playerHex: string, enemyHex: string): void {
    this.playerPadRing.material.color.set(playerHex);
    this.enemyPadRing.material.color.set(enemyHex);
  }

  update(elapsed: number): void {
    const pulse = 0.65 + Math.sin(elapsed * 2.5) * 0.2;
    this.playerPadRing.material.opacity = pulse;
    this.enemyPadRing.material.opacity = pulse;
  }

  dispose(): void {
    for (const d of this.disposables) {
      d.dispose();
    }
  }
}
