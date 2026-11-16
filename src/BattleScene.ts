import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import * as xb from 'xrblocks';
import {StadiumArena} from './arena/StadiumArena.ts';
import {BattleAudio} from './audio/BattleAudio.ts';
import {BattleVFX} from './effects/BattleVFX.ts';
import {
  createPokeballRig,
  createPokemonRig,
  setRigHitFlash,
  updatePokemonIdleRig,
  type PokeballRig,
  type PokemonRig,
} from './models/ProceduralPokemon.ts';
import {
  buildBalancedTeams,
  calculateGen1Damage,
  getTypeEffectiveness,
  TYPE_COLORS,
  type BattleMoveInstance,
  type BattlePokemon,
} from './pokemonData.ts';
import {
  battleHudController,
  buildPokemonHudSnapshot,
  type ScreenProjection,
} from './overlay/BattleOverlay.tsx';
import {SpatialBattleUI, type BagInventory} from './ui/SpatialBattleUI.ts';

const _projVec = new THREE.Vector3();
const _worldAnchor = new THREE.Vector3();

type BattlePhase = 'TITLE' | 'INTRO' | 'PLAYER_TURN' | 'RESOLVING' | 'GAME_OVER';

interface ActiveRigAnimation {
  side: 'player' | 'enemy';
  mode: 'lunge' | 'hit' | 'faint' | 'summon';
  elapsed: number;
  duration: number;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export class BattleScene extends xb.Script {
  private arena!: StadiumArena;
  private vfx!: BattleVFX;
  private audio = new BattleAudio();
  private ui!: SpatialBattleUI;

  private phase: BattlePhase = 'TITLE';
  private selectedLeadId = 'charizard';
  private isVrMode = false;

  private playerTeam: BattlePokemon[] = [];
  private enemyTeam: BattlePokemon[] = [];
  private playerActiveIdx = 0;
  private enemyActiveIdx = 0;
  private bag: BagInventory = {superPotion: 2, fullRestore: 1, xAttack: 2};

  private playerRig: PokemonRig | null = null;
  private enemyRig: PokemonRig | null = null;
  private pokeballRig: PokeballRig | null = null;
  private activeAnims: ActiveRigAnimation[] = [];

  private playerBasePos = new THREE.Vector3();
  private enemyBasePos = new THREE.Vector3();
  private arenaShakeIntensity = 0;
  private hitstopRemaining = 0;

  private turnCount = 0;
  private totalDamageDealt = 0;
  private enemyKos = 0;
  private matchToken = 0;
  private playerHitNonce = 0;
  private enemyHitNonce = 0;

  private readonly onKeyDownBound = (e: KeyboardEvent) => this.handleKeyDown(e);

  init(): void {
    this.setupStudioLightingAndEnv();

    const maxAniso =
      (xb.core.renderer as THREE.WebGLRenderer)?.capabilities?.getMaxAnisotropy?.() ??
      4;
    this.arena = new StadiumArena(maxAniso);
    this.add(this.arena.group);

    this.vfx = new BattleVFX();
    this.add(this.vfx.group);

    this.playerBasePos.copy(this.arena.spots.playerPadWorld);
    this.enemyBasePos.copy(this.arena.spots.enemyPadWorld);

    this.ui = new SpatialBattleUI({
      onSelectLead: (id) => this.selectLeadPreview(id),
      onStartBattle: () => void this.startBattle(),
      onSelectMove: (idx) => void this.handlePlayerMove(idx),
      onUseItem: (item) => void this.handlePlayerItem(item),
      onSwitchPokemon: (idx) => void this.handlePlayerSwitch(idx),
      onToggleMute: () => {
        const muted = this.audio.toggleMute();
        this.ui.setMuteVisual(muted);
      },
      onToggleXrMode: () => this.toggleXrEnvironmentMode(),
      onRestartMatch: () => this.resetToTitle(),
    });

    this.add(
      this.ui.titleCard,
      this.ui.commandCard,
      this.ui.resultCard,
      this.ui.playerHpPlate.card,
      this.ui.enemyHpPlate.card
    );

    // Position floating HP plates cleanly above & beside each pad
    this.ui.playerHpPlate.card.position.set(
      this.playerBasePos.x - 0.14,
      this.playerBasePos.y + 0.68,
      this.playerBasePos.z + 0.05
    );
    this.ui.enemyHpPlate.card.position.set(
      this.enemyBasePos.x + 0.14,
      this.enemyBasePos.y + 0.68,
      this.enemyBasePos.z - 0.05
    );

    this.pokeballRig = createPokeballRig();
    this.pokeballRig.root.visible = false;
    this.add(this.pokeballRig.root);

    window.addEventListener('keydown', this.onKeyDownBound);

    this.resetToTitle();
  }

  private setupStudioLightingAndEnv(): void {
    const renderer = xb.core.renderer as THREE.WebGLRenderer | undefined;
    if (renderer && 'toneMapping' in renderer) {
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.08;
      if (renderer.shadowMap) {
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      }

      // Generate RoomEnvironment studio reflections once for crisp metallic/clearcoat PBR
      const pmrem = new THREE.PMREMGenerator(renderer);
      xb.core.scene.environment = pmrem.fromScene(
        new RoomEnvironment(),
        0.04
      ).texture;
      pmrem.dispose();
    }

    // Warm/cool 3-point stadium lighting rig
    const hemi = new THREE.HemisphereLight(0xbbe1ff, 0x2b3648, 1.55);
    this.add(hemi);

    const keyLight = new THREE.DirectionalLight(0xfff1d6, 2.3);
    keyLight.position.set(-1.2, 3.2, 0.8);
    keyLight.target.position.set(0, 0.9, -1.72);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.set(1024, 1024);
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 7.5;
    keyLight.shadow.camera.left = -1.5;
    keyLight.shadow.camera.right = 1.5;
    keyLight.shadow.camera.top = 1.5;
    keyLight.shadow.camera.bottom = -1.5;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    this.add(keyLight, keyLight.target);

    const rimLight = new THREE.DirectionalLight(0x60a5fa, 0.95);
    rimLight.position.set(1.8, 2.2, -3.4);
    this.add(rimLight);
  }

  private toggleXrEnvironmentMode(): void {
    this.audio.playMenuBlip();
    if (!xb.core.transition) return;

    if (this.isVrMode) {
      this.isVrMode = false;
      xb.core.transition.toAR();
      this.arena.vrSurroundings.visible = false;
      xb.core.scene.fog = null;
    } else {
      this.isVrMode = true;
      xb.core.transition.toVR({color: 0x0b132b, targetAlpha: 1});
      this.arena.vrSurroundings.visible = true;
      xb.core.scene.fog = new THREE.FogExp2(0x0b132b, 0.085);
    }
    this.ui.setXrModeVisual(this.isVrMode);
  }

  private resetToTitle(): void {
    this.matchToken++;
    this.phase = 'TITLE';
    this.activeAnims.length = 0;
    this.ui.showTitleState();
    battleHudController.setState({visible: false, player: null, enemy: null});
    this.selectLeadPreview(this.selectedLeadId);
  }

  private selectLeadPreview(speciesId: string): void {
    if (this.phase !== 'TITLE') return;
    this.audio.playMenuBlip();
    this.selectedLeadId = speciesId;
    this.ui.highlightSelectedLead(speciesId);

    const {playerTeam, enemyTeam} = buildBalancedTeams(speciesId);
    this.playerTeam = playerTeam;
    this.enemyTeam = enemyTeam;
    this.playerActiveIdx = 0;
    this.enemyActiveIdx = 0;

    this.spawnSidePokemon('player', playerTeam[0].species.id, false);
    this.spawnSidePokemon('enemy', enemyTeam[0].species.id, false);
  }

  private spawnSidePokemon(
    side: 'player' | 'enemy',
    speciesId: string,
    withSummonAnim: boolean
  ): void {
    const isPlayer = side === 'player';
    const oldRig = isPlayer ? this.playerRig : this.enemyRig;
    if (oldRig) {
      this.remove(oldRig.root);
      oldRig.dispose();
    }

    const rig = createPokemonRig(speciesId);
    const basePos = isPlayer ? this.playerBasePos : this.enemyBasePos;
    const otherPos = isPlayer ? this.enemyBasePos : this.playerBasePos;

    rig.root.position.copy(basePos);
    rig.root.lookAt(otherPos.x, basePos.y, otherPos.z);

    if (withSummonAnim) {
      rig.root.scale.setScalar(0.05);
      this.activeAnims.push({
        side,
        mode: 'summon',
        elapsed: 0,
        duration: 0.38,
      });
    }

    this.add(rig.root);
    if (isPlayer) {
      this.playerRig = rig;
    } else {
      this.enemyRig = rig;
    }

    const pActive = this.playerTeam[this.playerActiveIdx];
    const eActive = this.enemyTeam[this.enemyActiveIdx];
    if (pActive && eActive) {
      this.arena.setPadColors(
        TYPE_COLORS[pActive.species.types[0]],
        TYPE_COLORS[eActive.species.types[0]]
      );
    }
  }

  private async playPokeballThrow(side: 'player' | 'enemy', colorHex: string): Promise<void> {
    if (!this.pokeballRig) return;
    const target = side === 'player' ? this.playerBasePos : this.enemyBasePos;
    const start =
      side === 'player'
        ? new THREE.Vector3(-0.35, 1.35, -0.85)
        : new THREE.Vector3(0.45, 1.5, -2.55);

    const ball = this.pokeballRig;
    ball.root.visible = true;
    ball.topHalf.rotation.x = 0;
    (ball.coreGlow.material as THREE.MeshBasicMaterial).opacity = 0;

    const steps = 18;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      ball.root.position.lerpVectors(start, target, t);
      ball.root.position.y += Math.sin(t * Math.PI) * 0.32 + 0.08;
      ball.root.rotation.x += 0.35;
      ball.root.rotation.z += 0.18;
      await wait(16);
    }

    // Pop open
    ball.topHalf.rotation.x = -1.1;
    (ball.coreGlow.material as THREE.MeshBasicMaterial).opacity = 0.95;
    this.audio.playPokeballRelease();
    this.vfx.spawnPokeballBurst(target, colorHex);
    await wait(160);
    ball.root.visible = false;
  }

  private async startBattle(): Promise<void> {
    if (this.phase !== 'TITLE') return;
    const token = ++this.matchToken;
    this.phase = 'INTRO';
    this.audio.playMenuConfirm();

    const {playerTeam, enemyTeam} = buildBalancedTeams(this.selectedLeadId);
    this.playerTeam = playerTeam;
    this.enemyTeam = enemyTeam;
    this.playerActiveIdx = 0;
    this.enemyActiveIdx = 0;
    this.bag = {superPotion: 2, fullRestore: 1, xAttack: 2};
    this.turnCount = 0;
    this.totalDamageDealt = 0;
    this.enemyKos = 0;

    // Hide showcase rigs briefly for Pokeball release
    if (this.playerRig) this.playerRig.root.visible = false;
    if (this.enemyRig) this.enemyRig.root.visible = false;

    const isPresenting = Boolean(xb.core.renderer?.xr?.isPresenting);
    this.ui.showBattleState(isPresenting);
    this.ui.setDeckMode('busy');
    this.playerHitNonce = 0;
    this.enemyHitNonce = 0;

    const enemyActive = this.enemyTeam[this.enemyActiveIdx];
    const playerActive = this.playerTeam[this.playerActiveIdx];
    this.syncHudNow(true);

    this.ui.setLog(`Rival sent out ${enemyActive.species.name}!`);
    await this.playPokeballThrow('enemy', enemyActive.species.primaryColor);
    if (token !== this.matchToken) return;
    this.spawnSidePokemon('enemy', enemyActive.species.id, true);
    await wait(380);

    if (token !== this.matchToken) return;
    this.ui.setLog(`Go! ${playerActive.species.name}!`);
    await this.playPokeballThrow('player', playerActive.species.primaryColor);
    if (token !== this.matchToken) return;
    this.spawnSidePokemon('player', playerActive.species.id, true);
    await wait(420);

    if (token !== this.matchToken) return;
    this.phase = 'PLAYER_TURN';
    this.ui.syncCombatContext(
      playerActive,
      enemyActive,
      this.playerTeam,
      this.enemyTeam,
      this.bag,
      this.playerActiveIdx,
      true
    );
    this.ui.setDeckMode('main');
    this.ui.setLog(`What will ${playerActive.species.name} do?`);
  }

  private async handlePlayerMove(moveIndex: number): Promise<void> {
    if (this.phase !== 'PLAYER_TURN') return;
    const playerActive = this.playerTeam[this.playerActiveIdx];
    const enemyActive = this.enemyTeam[this.enemyActiveIdx];
    const moveInst = playerActive.moves[moveIndex];
    if (!moveInst || moveInst.pp <= 0) return;

    const token = this.matchToken;
    this.phase = 'RESOLVING';
    this.audio.playMenuConfirm();
    this.ui.setDeckMode('busy');
    this.turnCount++;

    moveInst.pp--;
    const enemyMove = this.chooseEnemyMove(enemyActive, playerActive);

    const playerSpeed =
      playerActive.species.speed *
      (playerActive.status === 'PAR' ? 0.5 : 1) *
      (1 + playerActive.spdStage * 0.25);
    const enemySpeed =
      enemyActive.species.speed *
      (enemyActive.status === 'PAR' ? 0.5 : 1) *
      (1 + enemyActive.spdStage * 0.25);

    const pPrio = moveInst.data.priority ?? 0;
    const ePrio = enemyMove.data.priority ?? 0;
    const playerFirst =
      pPrio !== ePrio ? pPrio > ePrio : playerSpeed >= enemySpeed;

    if (playerFirst) {
      await this.executeAttack('player', moveInst, token);
      if (token !== this.matchToken) return;
      if (enemyActive.currentHp > 0 && playerActive.currentHp > 0) {
        await this.executeAttack('enemy', enemyMove, token);
      }
    } else {
      await this.executeAttack('enemy', enemyMove, token);
      if (token !== this.matchToken) return;
      if (playerActive.currentHp > 0 && enemyActive.currentHp > 0) {
        await this.executeAttack('player', moveInst, token);
      }
    }

    if (token !== this.matchToken) return;
    await this.resolveEndOfTurnAndFaints(token);
  }

  private async handlePlayerItem(item: keyof BagInventory): Promise<void> {
    if (this.phase !== 'PLAYER_TURN' || this.bag[item] <= 0) return;
    const token = this.matchToken;
    const playerActive = this.playerTeam[this.playerActiveIdx];
    const enemyActive = this.enemyTeam[this.enemyActiveIdx];

    this.phase = 'RESOLVING';
    this.audio.playMenuConfirm();
    this.ui.setDeckMode('busy');
    this.turnCount++;
    this.bag[item]--;

    if (item === 'superPotion') {
      playerActive.currentHp = Math.min(
        playerActive.maxHp,
        playerActive.currentHp + 50
      );
      this.audio.playHeal();
      this.vfx.spawnMoveEffect(
        'heal',
        this.playerBasePos,
        this.playerBasePos,
        '#4ade80'
      );
      this.ui.setLog(`Used SUPER POTION on ${playerActive.species.name}!`);
    } else if (item === 'fullRestore') {
      playerActive.currentHp = playerActive.maxHp;
      playerActive.status = 'NONE';
      playerActive.sleepTurns = 0;
      this.audio.playHeal();
      this.vfx.spawnMoveEffect(
        'heal',
        this.playerBasePos,
        this.playerBasePos,
        '#a78bfa'
      );
      this.ui.setLog(`${playerActive.species.name} was fully restored!`);
    } else {
      playerActive.atkStage = Math.min(4, playerActive.atkStage + 1);
      this.audio.playHeal();
      this.vfx.spawnPokeballBurst(this.playerBasePos, '#ef4444');
      this.ui.setLog(`${playerActive.species.name}'s ATTACK rose!`);
    }

    this.syncHudNow();
    await wait(900);
    if (token !== this.matchToken) return;

    const enemyMove = this.chooseEnemyMove(enemyActive, playerActive);
    await this.executeAttack('enemy', enemyMove, token);
    if (token !== this.matchToken) return;
    await this.resolveEndOfTurnAndFaints(token);
  }

  private async handlePlayerSwitch(teamIndex: number): Promise<void> {
    if (
      (this.phase !== 'PLAYER_TURN' && this.phase !== 'RESOLVING') ||
      teamIndex === this.playerActiveIdx
    ) {
      return;
    }
    const target = this.playerTeam[teamIndex];
    if (!target || target.currentHp <= 0) return;

    const token = this.matchToken;
    const wasForcedSwitch = this.playerTeam[this.playerActiveIdx].currentHp <= 0;
    this.phase = 'RESOLVING';
    this.audio.playMenuConfirm();
    this.ui.setDeckMode('busy');

    this.playerActiveIdx = teamIndex;
    this.ui.setLog(`Go! ${target.species.name}!`);
    await this.playPokeballThrow('player', target.species.primaryColor);
    if (token !== this.matchToken) return;
    this.spawnSidePokemon('player', target.species.id, true);
    await wait(450);
    if (token !== this.matchToken) return;

    const enemyActive = this.enemyTeam[this.enemyActiveIdx];
    this.syncHudNow(true);

    if (!wasForcedSwitch) {
      this.turnCount++;
      const enemyMove = this.chooseEnemyMove(enemyActive, target);
      await this.executeAttack('enemy', enemyMove, token);
      if (token !== this.matchToken) return;
      await this.resolveEndOfTurnAndFaints(token);
    } else {
      this.phase = 'PLAYER_TURN';
      this.ui.setDeckMode('main');
      this.ui.setLog(`What will ${target.species.name} do?`);
    }
  }

  private async executeAttack(
    attackerSide: 'player' | 'enemy',
    moveInst: BattleMoveInstance,
    token: number
  ): Promise<void> {
    const isPlayer = attackerSide === 'player';
    const attacker = isPlayer
      ? this.playerTeam[this.playerActiveIdx]
      : this.enemyTeam[this.enemyActiveIdx];
    const defender = isPlayer
      ? this.enemyTeam[this.enemyActiveIdx]
      : this.playerTeam[this.playerActiveIdx];
    const defenderSide: 'player' | 'enemy' = isPlayer ? 'enemy' : 'player';

    const fromPos = isPlayer ? this.playerBasePos : this.enemyBasePos;
    const toPos = isPlayer ? this.enemyBasePos : this.playerBasePos;

    // Sleep check
    if (attacker.status === 'SLP') {
      if (attacker.sleepTurns > 0) {
        attacker.sleepTurns--;
        this.ui.setLog(`${attacker.species.name} is fast asleep!`);
        await wait(850);
        return;
      }
      attacker.status = 'NONE';
      this.ui.setLog(`${attacker.species.name} woke up!`);
      await wait(650);
    }

    // Paralysis check
    if (attacker.status === 'PAR' && Math.random() < 0.25) {
      this.ui.setLog(`${attacker.species.name} is paralyzed! It can't move!`);
      await wait(850);
      return;
    }

    const move = moveInst.data;
    this.ui.setLog(`${attacker.species.name} used ${move.name}!`);

    // Handle self-heal or stat boost moves
    if (move.healFraction) {
      const healAmt = Math.round(attacker.maxHp * move.healFraction);
      attacker.currentHp = Math.min(attacker.maxHp, attacker.currentHp + healAmt);
      attacker.status = 'NONE';
      this.audio.playHeal();
      this.vfx.spawnMoveEffect('heal', fromPos, fromPos, '#4ade80');
      this.syncHudNow();
      await wait(850);
      return;
    }

    if (move.selfStatBoost) {
      if (move.selfStatBoost === 'spd') attacker.spdStage = Math.min(4, attacker.spdStage + 2);
      if (move.selfStatBoost === 'atk') attacker.atkStage = Math.min(4, attacker.atkStage + 2);
      this.audio.playHeal();
      this.vfx.spawnPokeballBurst(fromPos, TYPE_COLORS[move.type]);
      this.ui.setLog(`${attacker.species.name}'s SPEED rose sharply!`);
      this.syncHudNow();
      await wait(800);
      return;
    }

    // Animate lunge + spawn VFX
    this.activeAnims.push({
      side: attackerSide,
      mode: 'lunge',
      elapsed: 0,
      duration: 0.34,
    });
    this.audio.playMoveLaunch(move.type);
    this.vfx.spawnMoveEffect(move.vfx, fromPos, toPos, TYPE_COLORS[move.type]);

    await wait(290);
    if (token !== this.matchToken) return;

    const result = calculateGen1Damage(attacker, defender, move);
    if (!result.hit) {
      this.ui.setLog(`${attacker.species.name}'s attack missed!`);
      await wait(800);
      return;
    }

    if (result.effectiveness === 0) {
      this.ui.setLog(`It doesn't affect ${defender.species.name}...`);
      await wait(800);
      return;
    }

    if (result.damage > 0) {
      defender.currentHp = Math.max(0, defender.currentHp - result.damage);
      if (isPlayer) {
        this.totalDamageDealt += result.damage;
        this.enemyHitNonce++;
      } else {
        this.playerHitNonce++;
      }

      // Hitstop, camera/arena impulse, flash, and impact burst
      this.hitstopRemaining = result.effectiveness >= 2 || result.critical ? 0.055 : 0.03;
      this.arenaShakeIntensity =
        result.effectiveness >= 2 || result.critical ? 0.028 : 0.014;
      this.activeAnims.push({
        side: defenderSide,
        mode: 'hit',
        elapsed: 0,
        duration: 0.35,
      });
      this.audio.playHitImpact(result.effectiveness, result.critical);
      this.vfx.spawnImpactBurst(
        toPos,
        TYPE_COLORS[move.type],
        result.effectiveness >= 2
      );
      this.syncHudNow();
    }

    const notes: string[] = [];
    if (result.critical) notes.push('A critical hit!');
    if (result.effectiveness >= 2) notes.push("It's super effective!");
    else if (result.effectiveness < 1) notes.push("It's not very effective...");

    if (result.inflictedStatus !== 'NONE' && defender.currentHp > 0) {
      defender.status = result.inflictedStatus;
      if (result.inflictedStatus === 'SLP') {
        defender.sleepTurns = 1 + Math.floor(Math.random() * 2);
        notes.push(`${defender.species.name} fell asleep!`);
      } else if (result.inflictedStatus === 'BRN') {
        notes.push(`${defender.species.name} was burned!`);
      } else if (result.inflictedStatus === 'PAR') {
        notes.push(`${defender.species.name} was paralyzed!`);
      }
      this.syncHudNow();
    }

    if (notes.length > 0) {
      this.ui.setLog(notes.join(' '));
      await wait(900);
    } else {
      await wait(650);
    }
  }

  private async resolveEndOfTurnAndFaints(token: number): Promise<void> {
    const playerActive = this.playerTeam[this.playerActiveIdx];
    const enemyActive = this.enemyTeam[this.enemyActiveIdx];

    // Burn end-of-turn chip
    for (const [mon, sideLabel] of [
      [playerActive, 'player'],
      [enemyActive, 'enemy'],
    ] as const) {
      if (mon.currentHp > 0 && mon.status === 'BRN') {
        const burnDmg = Math.max(1, Math.round(mon.maxHp / 12));
        mon.currentHp = Math.max(0, mon.currentHp - burnDmg);
        this.ui.setLog(`${mon.species.name} is hurt by its burn!`);
        this.vfx.spawnImpactBurst(
          sideLabel === 'player' ? this.playerBasePos : this.enemyBasePos,
          '#f97316',
          false
        );
        this.syncHudNow();
        await wait(650);
        if (token !== this.matchToken) return;
      }
    }

    // Check enemy faint
    if (enemyActive.currentHp <= 0) {
      this.enemyKos++;
      this.audio.playFaint();
      this.activeAnims.push({
        side: 'enemy',
        mode: 'faint',
        elapsed: 0,
        duration: 0.45,
      });
      this.ui.setLog(`Foe ${enemyActive.species.name} fainted!`);
      await wait(900);
      if (token !== this.matchToken) return;

      const nextEnemyIdx = this.enemyTeam.findIndex((p) => p.currentHp > 0);
      if (nextEnemyIdx === -1) {
        this.finishMatch(true);
        return;
      }

      this.enemyActiveIdx = nextEnemyIdx;
      const nextEnemy = this.enemyTeam[nextEnemyIdx];
      this.ui.setLog(`Rival sent out ${nextEnemy.species.name}!`);
      await this.playPokeballThrow('enemy', nextEnemy.species.primaryColor);
      if (token !== this.matchToken) return;
      this.spawnSidePokemon('enemy', nextEnemy.species.id, true);
      this.syncHudNow(true);
      await wait(550);
      if (token !== this.matchToken) return;
    }

    // Check player faint
    if (playerActive.currentHp <= 0) {
      this.audio.playFaint();
      this.activeAnims.push({
        side: 'player',
        mode: 'faint',
        elapsed: 0,
        duration: 0.45,
      });
      this.ui.setLog(`${playerActive.species.name} fainted!`);
      await wait(900);
      if (token !== this.matchToken) return;

      const nextPlayerIdx = this.playerTeam.findIndex((p) => p.currentHp > 0);
      if (nextPlayerIdx === -1) {
        this.finishMatch(false);
        return;
      }

      this.syncHudNow();
      this.ui.setDeckMode('switch', true);
      this.ui.setLog('Choose your next Pokemon!');
      return;
    }

    this.phase = 'PLAYER_TURN';
    this.syncHudNow();
    this.ui.setDeckMode('main');
    this.ui.setLog(`What will ${this.playerTeam[this.playerActiveIdx].species.name} do?`);
  }

  private finishMatch(victory: boolean): void {
    this.phase = 'GAME_OVER';
    if (victory) {
      this.audio.playVictoryFanfare();
    } else {
      this.audio.playFaint();
    }
    const remaining = this.playerTeam.filter((p) => p.currentHp > 0).length;
    const summary =
      `Turns Played: ${this.turnCount}\n` +
      `Opponents Defeated: ${this.enemyKos} / 3\n` +
      `Pokemon Remaining: ${remaining} / 3\n` +
      `Total Damage Dealt: ${this.totalDamageDealt}`;
    this.ui.showResultState(victory, summary);
    battleHudController.setState({visible: false, player: null, enemy: null});
  }

  private chooseEnemyMove(
    attacker: BattlePokemon,
    defender: BattlePokemon
  ): BattleMoveInstance {
    // Use Rest when low HP if available
    const restMove = attacker.moves.find(
      (m) => m.data.healFraction && m.pp > 0
    );
    if (restMove && attacker.currentHp < attacker.maxHp * 0.35) {
      return restMove;
    }

    // Score offensive moves by power * STAB * type effectiveness
    let best = attacker.moves[0];
    let bestScore = -1;
    for (const m of attacker.moves) {
      if (m.pp <= 0) continue;
      const eff =
        m.data.power > 0
          ? getTypeEffectiveness(m.data.type, defender.species.types)
          : 0.4;
      const stab = attacker.species.types.includes(m.data.type) ? 1.5 : 1.0;
      const score =
        (m.data.power > 0 ? m.data.power * stab * eff : 35) *
        (0.85 + Math.random() * 0.3);
      if (score > bestScore) {
        bestScore = score;
        best = m;
      }
    }
    best.pp = Math.max(0, best.pp - 1);
    return best;
  }

  private syncHudNow(snapHp = false): void {
    const pActive = this.playerTeam[this.playerActiveIdx];
    const eActive = this.enemyTeam[this.enemyActiveIdx];
    if (pActive && eActive) {
      this.ui.syncCombatContext(
        pActive,
        eActive,
        this.playerTeam,
        this.enemyTeam,
        this.bag,
        this.playerActiveIdx,
        snapHp
      );
      const isPresenting = Boolean(xb.core.renderer?.xr?.isPresenting);
      const inBattle =
        this.phase === 'INTRO' ||
        this.phase === 'PLAYER_TURN' ||
        this.phase === 'RESOLVING';
      battleHudController.setState({
        visible: inBattle && !isPresenting,
        player: buildPokemonHudSnapshot(
          pActive,
          this.playerTeam,
          this.playerHitNonce
        ),
        enemy: buildPokemonHudSnapshot(
          eActive,
          this.enemyTeam,
          this.enemyHitNonce
        ),
      });
    }
  }

  private handleKeyDown(e: KeyboardEvent): void {
    if (e.key === 'm' || e.key === 'M') {
      const muted = this.audio.toggleMute();
      this.ui.setMuteVisual(muted);
      return;
    }

    if (this.phase === 'TITLE' && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      void this.startBattle();
      return;
    }

    if (this.phase === 'GAME_OVER' && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault();
      this.resetToTitle();
      return;
    }

    if (this.phase === 'PLAYER_TURN') {
      if (e.key >= '1' && e.key <= '4') {
        const idx = Number(e.key) - 1;
        this.ui.setDeckMode('moves');
        void this.handlePlayerMove(idx);
      } else if (e.key === 'Escape') {
        this.ui.setDeckMode('main');
      }
    }
  }

  update(): void {
    const rawDt = xb.getDeltaTime();
    const dt = Math.min(rawDt, 0.05);
    const elapsed = xb.getElapsedTime();

    if (this.hitstopRemaining > 0) {
      this.hitstopRemaining -= dt;
      return;
    }

    // Update arena pulse & damped impact shake
    this.arena.update(elapsed);
    if (this.arenaShakeIntensity > 0.0005) {
      this.arena.group.position.set(
        (Math.random() - 0.5) * this.arenaShakeIntensity,
        0.88 + (Math.random() - 0.5) * this.arenaShakeIntensity * 0.6,
        -1.72 + (Math.random() - 0.5) * this.arenaShakeIntensity
      );
      this.arenaShakeIntensity = THREE.MathUtils.damp(
        this.arenaShakeIntensity,
        0,
        14,
        dt
      );
    } else {
      this.arena.group.position.set(0, 0.88, -1.72);
    }

    // Idle rig animations
    const pMon = this.playerTeam[this.playerActiveIdx];
    const eMon = this.enemyTeam[this.enemyActiveIdx];
    if (this.playerRig && this.playerRig.root.visible) {
      updatePokemonIdleRig(this.playerRig, elapsed, 0, pMon?.status === 'PAR');
    }
    if (this.enemyRig && this.enemyRig.root.visible) {
      updatePokemonIdleRig(this.enemyRig, elapsed, 1.7, eMon?.status === 'PAR');
    }

    // Active combat animations (lunge, hit recoil/flash, faint, summon)
    for (let i = this.activeAnims.length - 1; i >= 0; i--) {
      const anim = this.activeAnims[i];
      anim.elapsed += dt;
      const t = Math.min(1, anim.elapsed / anim.duration);
      const rig = anim.side === 'player' ? this.playerRig : this.enemyRig;
      const basePos =
        anim.side === 'player' ? this.playerBasePos : this.enemyBasePos;
      const otherPos =
        anim.side === 'player' ? this.enemyBasePos : this.playerBasePos;

      if (!rig) {
        this.activeAnims.splice(i, 1);
        continue;
      }

      if (anim.mode === 'summon') {
        const s = 0.05 + 0.95 * (1 - Math.pow(1 - t, 3));
        rig.root.scale.setScalar(s);
      } else if (anim.mode === 'lunge') {
        const forward = Math.sin(t * Math.PI) * 0.28;
        const dirX = otherPos.x - basePos.x;
        const dirZ = otherPos.z - basePos.z;
        const len = Math.hypot(dirX, dirZ) || 1;
        rig.root.position.set(
          basePos.x + (dirX / len) * forward,
          basePos.y + Math.sin(t * Math.PI) * 0.05,
          basePos.z + (dirZ / len) * forward
        );
      } else if (anim.mode === 'hit') {
        const flash = Math.sin(t * Math.PI * 3) > 0 ? 0.85 * (1 - t) : 0;
        setRigHitFlash(rig, flash);
        const knock = Math.sin(t * Math.PI) * 0.07;
        const dirX = basePos.x - otherPos.x;
        const dirZ = basePos.z - otherPos.z;
        const len = Math.hypot(dirX, dirZ) || 1;
        rig.root.position.set(
          basePos.x + (dirX / len) * knock,
          basePos.y,
          basePos.z + (dirZ / len) * knock
        );
      } else if (anim.mode === 'faint') {
        rig.root.position.y = basePos.y - t * 0.14;
        rig.root.scale.set(1 + t * 0.12, Math.max(0.05, 1 - t * 0.95), 1 + t * 0.12);
      }

      if (t >= 1) {
        if (anim.mode === 'hit') setRigHitFlash(rig, 0);
        if (anim.mode !== 'faint') {
          rig.root.position.copy(basePos);
          rig.root.scale.setScalar(1);
        } else {
          rig.root.visible = false;
        }
        this.activeAnims.splice(i, 1);
      }
    }

    this.vfx.update(dt);
    this.ui.update(dt);
    this.updateOverlay3DProjection();
  }

  private updateOverlay3DProjection(): void {
    const isPresenting = Boolean(xb.core.renderer?.xr?.isPresenting);
    const inBattle =
      this.phase === 'INTRO' ||
      this.phase === 'PLAYER_TURN' ||
      this.phase === 'RESOLVING';
    this.ui.setSpatialHpPlatesVisible(inBattle && isPresenting);
    if (!inBattle || isPresenting) return;

    const cam = xb.core.simulator?.getRenderCamera?.() ?? xb.core.camera;
    if (!cam) return;

    const pProj = this.projectAnchorToScreen(
      cam,
      this.playerBasePos.x - 0.12,
      this.playerBasePos.y + 0.54,
      this.playerBasePos.z + 0.05
    );
    const eProj = this.projectAnchorToScreen(
      cam,
      this.enemyBasePos.x + 0.12,
      this.enemyBasePos.y + 0.54,
      this.enemyBasePos.z - 0.05
    );
    battleHudController.updateScreenPositions(pProj, eProj);
  }

  private projectAnchorToScreen(
    camera: THREE.Camera,
    wx: number,
    wy: number,
    wz: number
  ): ScreenProjection {
    _worldAnchor.set(wx, wy, wz);
    _projVec.copy(_worldAnchor).project(camera);
    const vw = window.innerWidth || 1280;
    const vh = window.innerHeight || 720;
    const inFront = _projVec.z >= -1 && _projVec.z <= 1;
    const x = (_projVec.x * 0.5 + 0.5) * vw;
    const y = (-_projVec.y * 0.5 + 0.5) * vh;
    const dist = camera.position.distanceTo(_worldAnchor);
    const scale = THREE.MathUtils.clamp(1.75 / Math.max(0.8, dist), 0.78, 1.12);
    return {x, y, inFront, scale, tiltYawDeg: _projVec.x * -10};
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDownBound);
    battleHudController.setState({visible: false, player: null, enemy: null});
    this.playerRig?.dispose();
    this.enemyRig?.dispose();
    this.pokeballRig?.dispose();
    this.arena?.dispose();
    this.vfx?.dispose();
  }
}
