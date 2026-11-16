import * as THREE from 'three';
import type {MoveVfxStyle} from '../pokemonData.ts';

interface ActiveParticle {
  active: boolean;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  age: number;
  maxAge: number;
  size: number;
  gravity: number;
  color: THREE.Color;
}

interface ActiveProjectile {
  mesh: THREE.Mesh;
  start: THREE.Vector3;
  end: THREE.Vector3;
  age: number;
  duration: number;
  arcHeight: number;
  spinSpeed: number;
  spiralRadius: number;
}

interface ActiveBeam {
  mesh: THREE.Mesh;
  age: number;
  duration: number;
  baseRadius: number;
}

interface ActiveRing {
  mesh: THREE.Mesh;
  age: number;
  duration: number;
  maxScale: number;
}

const MAX_PARTICLES = 180;
const _mat4 = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3();
const _dir = new THREE.Vector3();
const _mid = new THREE.Vector3();
const _up = new THREE.Vector3(0, 1, 0);

export class BattleVFX {
  readonly group = new THREE.Group();

  private particles: ActiveParticle[] = [];
  private particleInstanced: THREE.InstancedMesh;
  private particleGeo: THREE.SphereGeometry;
  private particleMat: THREE.MeshBasicMaterial;

  private projectiles: ActiveProjectile[] = [];
  private beams: ActiveBeam[] = [];
  private rings: ActiveRing[] = [];
  private lightningBolts: Array<{group: THREE.Group; age: number; duration: number}> = [];

  private sharedSphereGeo = new THREE.SphereGeometry(0.032, 12, 10);
  private sharedLeafGeo: THREE.ConeGeometry;
  private sharedBeamGeo = new THREE.CylinderGeometry(0.035, 0.035, 1, 12, 1, true);
  private sharedRingGeo = new THREE.RingGeometry(0.05, 0.08, 28);

  constructor() {
    this.group.name = 'BattleVFX';
    this.sharedLeafGeo = new THREE.ConeGeometry(0.025, 0.08, 4);
    this.sharedLeafGeo.scale(1.2, 1, 0.2);
    this.sharedRingGeo.rotateX(-Math.PI / 2);

    this.particleGeo = new THREE.SphereGeometry(0.018, 8, 6);
    this.particleMat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.92,
    });
    this.particleInstanced = new THREE.InstancedMesh(
      this.particleGeo,
      this.particleMat,
      MAX_PARTICLES
    );
    this.particleInstanced.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.particleInstanced.frustumCulled = false;

    for (let i = 0; i < MAX_PARTICLES; i++) {
      this.particles.push({
        active: false,
        pos: new THREE.Vector3(),
        vel: new THREE.Vector3(),
        age: 0,
        maxAge: 1,
        size: 1,
        gravity: 0,
        color: new THREE.Color(0xffffff),
      });
      _scale.set(0, 0, 0);
      _mat4.compose(_mid, _quat, _scale);
      this.particleInstanced.setMatrixAt(i, _mat4);
      this.particleInstanced.setColorAt(i, new THREE.Color(0xffffff));
    }
    this.particleInstanced.instanceMatrix.needsUpdate = true;
    if (this.particleInstanced.instanceColor) {
      this.particleInstanced.instanceColor.needsUpdate = true;
    }
    this.group.add(this.particleInstanced);
  }

  private emitParticle(
    pos: THREE.Vector3,
    vel: THREE.Vector3,
    color: number | string,
    maxAge: number,
    size = 1.0,
    gravity = 0.0
  ): void {
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.active) {
        p.active = true;
        p.pos.copy(pos);
        p.vel.copy(vel);
        p.age = 0;
        p.maxAge = maxAge;
        p.size = size;
        p.gravity = gravity;
        p.color.set(color);
        this.particleInstanced.setColorAt(i, p.color);
        if (this.particleInstanced.instanceColor) {
          this.particleInstanced.instanceColor.needsUpdate = true;
        }
        return;
      }
    }
  }

  spawnPokeballBurst(worldPos: THREE.Vector3, colorHex: string): void {
    this.spawnRing(worldPos, 0xffffff, 4.5, 0.45);
    this.spawnRing(worldPos, colorHex, 3.6, 0.52);

    const vel = new THREE.Vector3();
    for (let i = 0; i < 28; i++) {
      const theta = (i / 28) * Math.PI * 2;
      const speed = 0.6 + Math.random() * 0.9;
      vel.set(
        Math.cos(theta) * speed,
        0.5 + Math.random() * 1.1,
        Math.sin(theta) * speed
      );
      this.emitParticle(
        worldPos,
        vel,
        i % 2 === 0 ? 0xffffff : colorHex,
        0.48 + Math.random() * 0.25,
        1.1,
        1.8
      );
    }
  }

  spawnImpactBurst(
    worldPos: THREE.Vector3,
    colorHex: string,
    isSuperEffective: boolean
  ): void {
    const count = isSuperEffective ? 34 : 20;
    this.spawnRing(
      worldPos,
      isSuperEffective ? 0xfacc15 : colorHex,
      isSuperEffective ? 5.8 : 3.8,
      0.42
    );

    const vel = new THREE.Vector3();
    for (let i = 0; i < count; i++) {
      vel.set(
        (Math.random() - 0.5) * 1.9,
        0.3 + Math.random() * 1.4,
        (Math.random() - 0.5) * 1.9
      );
      this.emitParticle(
        worldPos,
        vel,
        i % 3 === 0 ? 0xffffff : colorHex,
        0.35 + Math.random() * 0.28,
        isSuperEffective ? 1.35 : 1.0,
        2.4
      );
    }
  }

  spawnRing(
    pos: THREE.Vector3,
    color: number | string,
    maxScale: number,
    duration: number
  ): void {
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(this.sharedRingGeo, mat);
    mesh.position.copy(pos);
    mesh.position.y += 0.03;
    this.group.add(mesh);
    this.rings.push({mesh, age: 0, duration, maxScale});
  }

  spawnMoveEffect(
    style: MoveVfxStyle,
    fromWorld: THREE.Vector3,
    toWorld: THREE.Vector3,
    colorHex: string
  ): void {
    const start = fromWorld.clone().add(new THREE.Vector3(0, 0.24, 0));
    const end = toWorld.clone().add(new THREE.Vector3(0, 0.2, 0));

    switch (style) {
      case 'fire_stream':
      case 'fire_spin': {
        const count = style === 'fire_spin' ? 8 : 6;
        for (let i = 0; i < count; i++) {
          const mat = new THREE.MeshBasicMaterial({
            color: i % 2 === 0 ? 0xff6a00 : 0xfde047,
            transparent: true,
            opacity: 0.95,
          });
          const mesh = new THREE.Mesh(this.sharedSphereGeo, mat);
          mesh.scale.setScalar(1.15 - i * 0.08);
          this.group.add(mesh);
          this.projectiles.push({
            mesh,
            start: start.clone(),
            end: end.clone(),
            age: -i * 0.045,
            duration: 0.36,
            arcHeight: 0.08,
            spinSpeed: 8,
            spiralRadius: style === 'fire_spin' ? 0.09 : 0.025,
          });
        }
        break;
      }

      case 'water_cannon':
      case 'water_wave': {
        for (let i = 0; i < 6; i++) {
          const mat = new THREE.MeshBasicMaterial({
            color: i % 2 === 0 ? 0x38bdf8 : 0xe0f2fe,
            transparent: true,
            opacity: 0.9,
          });
          const mesh = new THREE.Mesh(this.sharedSphereGeo, mat);
          mesh.scale.set(1.2, 0.85, 1.8);
          this.group.add(mesh);
          this.projectiles.push({
            mesh,
            start: start.clone(),
            end: end.clone(),
            age: -i * 0.04,
            duration: 0.32,
            arcHeight: style === 'water_wave' ? 0.14 : 0.02,
            spinSpeed: 4,
            spiralRadius: style === 'water_wave' ? 0.08 : 0.01,
          });
        }
        break;
      }

      case 'razor_leaf': {
        for (let i = 0; i < 6; i++) {
          const mat = new THREE.MeshBasicMaterial({
            color: 0x4ade80,
            side: THREE.DoubleSide,
          });
          const mesh = new THREE.Mesh(this.sharedLeafGeo, mat);
          mesh.scale.setScalar(1.3);
          this.group.add(mesh);
          this.projectiles.push({
            mesh,
            start: start.clone(),
            end: end.clone(),
            age: -i * 0.05,
            duration: 0.34,
            arcHeight: 0.12 + (i % 2) * 0.06,
            spinSpeed: 22,
            spiralRadius: 0.06,
          });
        }
        break;
      }

      case 'solar_beam':
      case 'hyper_beam': {
        const beamColor = style === 'solar_beam' ? 0x86efac : 0xfef08a;
        this.spawnBeam(start, end, beamColor, 0.48, 1.35);
        this.spawnBeam(start, end, 0xffffff, 0.45, 0.55);
        break;
      }

      case 'thunderbolt':
      case 'thunder': {
        this.spawnLightning(end, style === 'thunder' ? 0.9 : 0.55);
        break;
      }

      case 'shadow_orb':
      case 'psychic_wave': {
        const orbColor = style === 'shadow_orb' ? 0x7c3aed : 0xec4899;
        const mat = new THREE.MeshBasicMaterial({
          color: orbColor,
          transparent: true,
          opacity: 0.95,
        });
        const mesh = new THREE.Mesh(this.sharedSphereGeo, mat);
        mesh.scale.setScalar(2.4);
        this.group.add(mesh);
        this.projectiles.push({
          mesh,
          start: start.clone(),
          end: end.clone(),
          age: 0,
          duration: 0.38,
          arcHeight: 0.06,
          spinSpeed: 10,
          spiralRadius: 0.03,
        });
        break;
      }

      case 'heal': {
        const vel = new THREE.Vector3();
        for (let i = 0; i < 24; i++) {
          const p = fromWorld.clone().add(
            new THREE.Vector3(
              (Math.random() - 0.5) * 0.25,
              0.05,
              (Math.random() - 0.5) * 0.25
            )
          );
          vel.set(0, 0.55 + Math.random() * 0.5, 0);
          this.emitParticle(p, vel, i % 2 === 0 ? 0x4ade80 : 0xfef08a, 0.65, 1.1, -0.2);
        }
        this.spawnRing(fromWorld, 0x4ade80, 3.2, 0.5);
        break;
      }

      default: {
        // Physical lunge burst
        this.spawnRing(end, colorHex, 3.4, 0.36);
        break;
      }
    }
  }

  private spawnBeam(
    start: THREE.Vector3,
    end: THREE.Vector3,
    color: number,
    duration: number,
    radiusMult: number
  ): void {
    const dist = start.distanceTo(end);
    const mat = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(this.sharedBeamGeo, mat);
    _mid.addVectors(start, end).multiplyScalar(0.5);
    _dir.subVectors(end, start).normalize();
    mesh.position.copy(_mid);
    mesh.quaternion.setFromUnitVectors(_up, _dir);
    mesh.scale.set(radiusMult, dist, radiusMult);
    this.group.add(mesh);
    this.beams.push({mesh, age: 0, duration, baseRadius: radiusMult});
  }

  private spawnLightning(targetPos: THREE.Vector3, height: number): void {
    const boltGroup = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({color: 0xfef08a});

    const segments = 6;
    let prev = new THREE.Vector3(
      targetPos.x + (Math.random() - 0.5) * 0.14,
      targetPos.y + height,
      targetPos.z + (Math.random() - 0.5) * 0.14
    );

    for (let i = 1; i <= segments; i++) {
      const t = i / segments;
      const next = new THREE.Vector3(
        THREE.MathUtils.lerp(prev.x, targetPos.x, t) +
          (i < segments ? (Math.random() - 0.5) * 0.16 : 0),
        THREE.MathUtils.lerp(targetPos.y + height, targetPos.y, t),
        THREE.MathUtils.lerp(prev.z, targetPos.z, t) +
          (i < segments ? (Math.random() - 0.5) * 0.16 : 0)
      );
      const segLen = prev.distanceTo(next);
      const segGeo = new THREE.CylinderGeometry(0.014, 0.014, segLen, 6);
      const segMesh = new THREE.Mesh(segGeo, mat);
      _mid.addVectors(prev, next).multiplyScalar(0.5);
      _dir.subVectors(next, prev).normalize();
      segMesh.position.copy(_mid);
      segMesh.quaternion.setFromUnitVectors(_up, _dir);
      boltGroup.add(segMesh);
      prev = next;
    }

    this.group.add(boltGroup);
    this.lightningBolts.push({group: boltGroup, age: 0, duration: 0.36});
  }

  update(dt: number): void {
    // Update particles
    let dirty = false;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      const p = this.particles[i];
      if (!p.active) continue;
      dirty = true;
      p.age += dt;
      if (p.age >= p.maxAge) {
        p.active = false;
        _scale.set(0, 0, 0);
        _mat4.compose(p.pos, _quat, _scale);
        this.particleInstanced.setMatrixAt(i, _mat4);
        continue;
      }
      p.vel.y -= p.gravity * dt;
      p.pos.addScaledVector(p.vel, dt);
      const life = 1 - p.age / p.maxAge;
      const s = p.size * life;
      _scale.set(s, s, s);
      _mat4.compose(p.pos, _quat, _scale);
      this.particleInstanced.setMatrixAt(i, _mat4);
    }
    if (dirty) {
      this.particleInstanced.instanceMatrix.needsUpdate = true;
    }

    // Update projectiles
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const proj = this.projectiles[i];
      proj.age += dt;
      if (proj.age < 0) {
        proj.mesh.visible = false;
        continue;
      }
      proj.mesh.visible = true;
      const t = Math.min(1, proj.age / proj.duration);
      proj.mesh.position.lerpVectors(proj.start, proj.end, t);
      proj.mesh.position.y += Math.sin(t * Math.PI) * proj.arcHeight;
      if (proj.spiralRadius > 0) {
        proj.mesh.position.x += Math.cos(t * 14) * proj.spiralRadius * (1 - t);
        proj.mesh.position.y += Math.sin(t * 14) * proj.spiralRadius * (1 - t);
      }
      proj.mesh.rotation.y += proj.spinSpeed * dt;
      proj.mesh.rotation.x += proj.spinSpeed * 0.5 * dt;

      if (t >= 1) {
        this.group.remove(proj.mesh);
        (proj.mesh.material as THREE.Material).dispose();
        this.projectiles.splice(i, 1);
      }
    }

    // Update beams
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const beam = this.beams[i];
      beam.age += dt;
      const t = Math.min(1, beam.age / beam.duration);
      const pulse = Math.sin(t * Math.PI);
      beam.mesh.scale.x = beam.baseRadius * (0.4 + pulse * 1.1);
      beam.mesh.scale.z = beam.baseRadius * (0.4 + pulse * 1.1);
      (beam.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - t * 0.85;
      if (t >= 1) {
        this.group.remove(beam.mesh);
        (beam.mesh.material as THREE.Material).dispose();
        this.beams.splice(i, 1);
      }
    }

    // Update rings
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const ring = this.rings[i];
      ring.age += dt;
      const t = Math.min(1, ring.age / ring.duration);
      const s = THREE.MathUtils.lerp(0.6, ring.maxScale, t);
      ring.mesh.scale.setScalar(s);
      (ring.mesh.material as THREE.MeshBasicMaterial).opacity = 1 - t;
      if (t >= 1) {
        this.group.remove(ring.mesh);
        (ring.mesh.material as THREE.Material).dispose();
        this.rings.splice(i, 1);
      }
    }

    // Update lightning bolts
    for (let i = this.lightningBolts.length - 1; i >= 0; i--) {
      const bolt = this.lightningBolts[i];
      bolt.age += dt;
      bolt.group.visible = Math.floor(bolt.age * 35) % 2 === 0;
      if (bolt.age >= bolt.duration) {
        bolt.group.traverse((obj) => {
          const m = obj as THREE.Mesh;
          if (m.geometry) m.geometry.dispose();
          if (m.material) (m.material as THREE.Material).dispose();
        });
        this.group.remove(bolt.group);
        this.lightningBolts.splice(i, 1);
      }
    }
  }

  dispose(): void {
    this.particleGeo.dispose();
    this.particleMat.dispose();
    this.sharedSphereGeo.dispose();
    this.sharedLeafGeo.dispose();
    this.sharedBeamGeo.dispose();
    this.sharedRingGeo.dispose();
  }
}
