import React, {useEffect, useRef, useState} from 'react';
import {createRoot, type Root} from 'react-dom/client';
import {
  TYPE_COLORS,
  type BattlePokemon,
  type PokemonType,
  type StatusCondition,
} from '../pokemonData.ts';

export interface PokemonHudSnapshot {
  speciesId: string;
  dexNumber: string;
  name: string;
  level: number;
  types: readonly PokemonType[];
  currentHp: number;
  maxHp: number;
  status: StatusCondition;
  atkStage: number;
  spdStage: number;
  teamAlive: boolean[];
  hitNonce: number;
}

export interface BattleHudState {
  visible: boolean;
  player: PokemonHudSnapshot | null;
  enemy: PokemonHudSnapshot | null;
}

export interface ScreenProjection {
  x: number;
  y: number;
  inFront: boolean;
  scale: number;
  tiltYawDeg: number;
}

export function buildPokemonHudSnapshot(
  active: BattlePokemon,
  team: BattlePokemon[],
  hitNonce: number
): PokemonHudSnapshot {
  return {
    speciesId: active.species.id,
    dexNumber: active.species.dexNumber,
    name: active.species.name,
    level: active.species.level,
    types: active.species.types,
    currentHp: active.currentHp,
    maxHp: active.maxHp,
    status: active.status,
    atkStage: active.atkStage,
    spdStage: active.spdStage,
    teamAlive: team.map((m) => m.currentHp > 0),
    hitNonce,
  };
}

class BattleHudController {
  private state: BattleHudState = {visible: false, player: null, enemy: null};
  private listeners = new Set<(state: BattleHudState) => void>();
  private playerAnchorEl: HTMLDivElement | null = null;
  private enemyAnchorEl: HTMLDivElement | null = null;

  subscribe(listener: (state: BattleHudState) => void): () => void {
    this.listeners.add(listener);
    listener(this.state);
    return () => {
      this.listeners.delete(listener);
    };
  }

  setState(next: BattleHudState): void {
    this.state = next;
    for (const listener of this.listeners) {
      listener(this.state);
    }
  }

  registerAnchors(
    playerEl: HTMLDivElement | null,
    enemyEl: HTMLDivElement | null
  ): void {
    this.playerAnchorEl = playerEl;
    this.enemyAnchorEl = enemyEl;
  }

  updateScreenPositions(
    playerProj: ScreenProjection,
    enemyProj: ScreenProjection
  ): void {
    this.applyAnchorTransform(this.playerAnchorEl, playerProj, 'left');
    this.applyAnchorTransform(this.enemyAnchorEl, enemyProj, 'right');
  }

  private applyAnchorTransform(
    el: HTMLDivElement | null,
    proj: ScreenProjection,
    fallbackSide: 'left' | 'right'
  ): void {
    if (!el) return;
    const vw = window.innerWidth || 1280;
    const vh = window.innerHeight || 720;

    let x = proj.x;
    let y = proj.y;
    let scale = proj.scale;

    if (!proj.inFront) {
      x = fallbackSide === 'left' ? 160 : vw - 160;
      y = 148;
      scale = 0.92;
    } else {
      x = Math.max(150, Math.min(vw - 150, x));
      y = Math.max(132, Math.min(vh - 220, y));
      scale = Math.max(0.76, Math.min(1.12, scale));
    }

    el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0px) translate(-50%, -100%) scale(${scale.toFixed(3)})`;
    el.style.opacity = '1';
  }
}

export const battleHudController = new BattleHudController();

function StatusIcon({status}: {status: Exclude<StatusCondition, 'NONE'>}) {
  if (status === 'BRN') {
    return (
      <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path d="M8.5 1.5c.3 2.1-1.2 3.4-1.2 5.1 0 .8.6 1.4 1.3 1.4.9 0 1.5-.8 1.5-2.1 1.6 1.1 2.6 2.9 2.6 4.7a4.7 4.7 0 1 1-9.4 0c0-2.7 2-5.4 5.2-9.1Z" />
      </svg>
    );
  }
  if (status === 'PAR') {
    return (
      <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path d="M9.6 1 3.5 9.2h4.2L6.4 15l6.1-8.2H8.3L9.6 1Z" />
      </svg>
    );
  }
  return (
    <svg width="11" height="11" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M3 3h5l-5 4h5M9.5 8.5h4l-4 3.5h4" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function PokemonHudCard({
  side,
  data,
}: {
  side: 'player' | 'enemy';
  data: PokemonHudSnapshot;
}) {
  const ratio = Math.max(0, Math.min(1, data.currentHp / Math.max(1, data.maxHp)));
  const pct = Math.round(ratio * 100);
  const barColor =
    ratio > 0.5 ? '#22c55e' : ratio > 0.22 ? '#f59e0b' : '#ef4444';

  const [hitAnimating, setHitAnimating] = useState(false);
  const lastHitNonce = useRef(data.hitNonce);

  useEffect(() => {
    if (data.hitNonce !== lastHitNonce.current && data.hitNonce > 0) {
      lastHitNonce.current = data.hitNonce;
      setHitAnimating(true);
      const timer = window.setTimeout(() => setHitAnimating(false), 260);
      return () => window.clearTimeout(timer);
    }
  }, [data.hitNonce]);

  return (
    <div
      className={`battle-hud-card battle-hud-card--${side}${hitAnimating ? ' battle-hud-card--hit' : ''}`}
    >
      <div className="battle-hud-header">
        <div className="battle-hud-title-group">
          <span className={`battle-hud-side-tag battle-hud-side-tag--${side}`}>
            {side === 'player' ? 'YOU' : 'FOE'}
          </span>
          <span className="battle-hud-name">{data.name}</span>
        </div>
        <span className="battle-hud-level">Lv.{data.level}</span>
      </div>

      <div className="battle-hud-meta-row">
        <div className="battle-hud-badges">
          {data.types.map((t) => (
            <span
              key={t}
              className="battle-hud-type-pill"
              style={{backgroundColor: TYPE_COLORS[t]}}
            >
              {t}
            </span>
          ))}
          {data.status !== 'NONE' && (
            <span className={`battle-hud-status-pill battle-hud-status-pill--${data.status}`}>
              <StatusIcon status={data.status} />
              {data.status}
            </span>
          )}
          {data.atkStage > 0 && (
            <span className="battle-hud-stage-pill">ATK +{data.atkStage}</span>
          )}
          {data.spdStage > 0 && (
            <span className="battle-hud-stage-pill">SPD +{data.spdStage}</span>
          )}
        </div>

        <div className="battle-hud-squad" aria-label="Squad status">
          {data.teamAlive.map((alive, idx) => (
            <span
              key={idx}
              className={`battle-hud-ball${alive ? '' : ' battle-hud-ball--fainted'}`}
            />
          ))}
        </div>
      </div>

      <div className="battle-hud-hp-track">
        <div className="battle-hud-hp-ghost" style={{width: `${pct}%`}} />
        <div
          className="battle-hud-hp-fill"
          style={{width: `${pct}%`, backgroundColor: barColor}}
        />
      </div>

      <div className="battle-hud-hp-footer">
        <span>
          {data.currentHp} / {data.maxHp} HP
        </span>
        <span className="battle-hud-hp-pct">{pct}%</span>
      </div>
    </div>
  );
}

function BattleOverlayApp() {
  const [hud, setHud] = useState<BattleHudState>({
    visible: false,
    player: null,
    enemy: null,
  });

  const playerAnchorRef = useRef<HTMLDivElement | null>(null);
  const enemyAnchorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    return battleHudController.subscribe(setHud);
  }, []);

  useEffect(() => {
    battleHudController.registerAnchors(
      playerAnchorRef.current,
      enemyAnchorRef.current
    );
    return () => battleHudController.registerAnchors(null, null);
  }, [hud.visible]);

  if (!hud.visible || !hud.player || !hud.enemy) {
    return null;
  }

  return (
    <div className="battle-hud-root" aria-live="polite">
      <div
        ref={playerAnchorRef}
        className="battle-hud-anchor"
        style={{transform: 'translate3d(24vw, 24vh, 0px) translate(-50%, -100%)'}}
      >
        <PokemonHudCard side="player" data={hud.player} />
      </div>

      <div
        ref={enemyAnchorRef}
        className="battle-hud-anchor"
        style={{transform: 'translate3d(76vw, 24vh, 0px) translate(-50%, -100%)'}}
      >
        <PokemonHudCard side="enemy" data={hud.enemy} />
      </div>
    </div>
  );
}

let mountedRoot: Root | null = null;

export function mountBattleOverlay(): void {
  const container = document.getElementById('root');
  if (!container || mountedRoot) return;
  mountedRoot = createRoot(container);
  mountedRoot.render(<BattleOverlayApp />);
}

export function unmountBattleOverlay(): void {
  mountedRoot?.unmount();
  mountedRoot = null;
}
