export type PokemonType =
  | 'FIRE'
  | 'WATER'
  | 'GRASS'
  | 'ELECTRIC'
  | 'FLYING'
  | 'POISON'
  | 'GHOST'
  | 'PSYCHIC'
  | 'NORMAL'
  | 'GROUND'
  | 'ROCK'
  | 'ICE';

export type StatusCondition = 'NONE' | 'BRN' | 'PAR' | 'SLP';

export type MoveVfxStyle =
  | 'fire_stream'
  | 'fire_spin'
  | 'water_cannon'
  | 'water_wave'
  | 'razor_leaf'
  | 'solar_beam'
  | 'thunderbolt'
  | 'thunder'
  | 'shadow_orb'
  | 'psychic_wave'
  | 'lunge'
  | 'hyper_beam'
  | 'heal';

export interface MoveData {
  id: string;
  name: string;
  type: PokemonType;
  power: number; // 0 for status/heal moves
  accuracy: number; // 1-100
  maxPp: number;
  vfx: MoveVfxStyle;
  priority?: number;
  statusEffect?: {
    condition: Exclude<StatusCondition, 'NONE'>;
    chance: number; // 0-1
  };
  healFraction?: number; // e.g., 0.5 or 1.0
  selfStatBoost?: 'atk' | 'spd';
  description: string;
}

export interface PokemonSpecies {
  id: string;
  dexNumber: string;
  name: string;
  types: [PokemonType] | [PokemonType, PokemonType];
  level: number;
  maxHp: number;
  attack: number;
  defense: number;
  speed: number;
  heightMeters: number;
  primaryColor: string;
  accentColor: string;
  moves: [MoveData, MoveData, MoveData, MoveData];
}

export interface BattleMoveInstance {
  data: MoveData;
  pp: number;
}

export interface BattlePokemon {
  species: PokemonSpecies;
  currentHp: number;
  maxHp: number;
  atkStage: number; // -2 to +4
  spdStage: number; // -2 to +4
  status: StatusCondition;
  sleepTurns: number;
  moves: BattleMoveInstance[];
}

export const TYPE_COLORS: Record<PokemonType, string> = {
  FIRE: '#f97316',
  WATER: '#3b82f6',
  GRASS: '#22c55e',
  ELECTRIC: '#eab308',
  FLYING: '#60a5fa',
  POISON: '#a855f7',
  GHOST: '#6366f1',
  PSYCHIC: '#ec4899',
  NORMAL: '#9ca3af',
  GROUND: '#d97706',
  ROCK: '#a16207',
  ICE: '#38bdf8',
};

// Authentic Gen 1 Type Effectiveness Chart (adapted cleanly for our battle types)
const TYPE_CHART: Partial<Record<PokemonType, Partial<Record<PokemonType, number>>>> = {
  FIRE: {
    GRASS: 2,
    ICE: 2,
    WATER: 0.5,
    FIRE: 0.5,
    ROCK: 0.5,
  },
  WATER: {
    FIRE: 2,
    GROUND: 2,
    ROCK: 2,
    WATER: 0.5,
    GRASS: 0.5,
  },
  GRASS: {
    WATER: 2,
    GROUND: 2,
    ROCK: 2,
    FIRE: 0.5,
    GRASS: 0.5,
    POISON: 0.5,
    FLYING: 0.5,
  },
  ELECTRIC: {
    WATER: 2,
    FLYING: 2,
    GRASS: 0.5,
    ELECTRIC: 0.5,
    GROUND: 0,
  },
  FLYING: {
    GRASS: 2,
    ELECTRIC: 0.5,
    ROCK: 0.5,
  },
  POISON: {
    GRASS: 2,
    POISON: 0.5,
    GROUND: 0.5,
    ROCK: 0.5,
    GHOST: 0.5,
  },
  GHOST: {
    GHOST: 2,
    PSYCHIC: 0, // Iconic Gen 1 quirk: Ghost had 0x vs Psychic in Red/Blue, or let's make it 2x? Wait: in Gen 1 Ghost was 0x vs Psychic due to a famous bug, and 2x vs Ghost!
    NORMAL: 0,
  },
  PSYCHIC: {
    POISON: 2,
    PSYCHIC: 0.5,
  },
  NORMAL: {
    ROCK: 0.5,
    GHOST: 0,
  },
  GROUND: {
    FIRE: 2,
    ELECTRIC: 2,
    POISON: 2,
    ROCK: 2,
    GRASS: 0.5,
    FLYING: 0,
  },
  ROCK: {
    FIRE: 2,
    ICE: 2,
    FLYING: 2,
    GROUND: 0.5,
  },
  ICE: {
    GRASS: 2,
    GROUND: 2,
    FLYING: 2,
    WATER: 0.5,
    ICE: 0.5,
  },
};

export function getTypeEffectiveness(
  moveType: PokemonType,
  defenderTypes: readonly PokemonType[]
): number {
  let mult = 1;
  const row = TYPE_CHART[moveType];
  if (!row) return 1;
  for (const defType of defenderTypes) {
    const factor = row[defType];
    if (factor !== undefined) {
      mult *= factor;
    }
  }
  return mult;
}

export const GEN1_POKEDEX: Record<string, PokemonSpecies> = {
  charizard: {
    id: 'charizard',
    dexNumber: '#006',
    name: 'CHARIZARD',
    types: ['FIRE', 'FLYING'],
    level: 50,
    maxHp: 175,
    attack: 96,
    defense: 82,
    speed: 105,
    heightMeters: 0.52,
    primaryColor: '#ef6c2f',
    accentColor: '#fde047',
    moves: [
      {
        id: 'flamethrower',
        name: 'FLAMETHROWER',
        type: 'FIRE',
        power: 95,
        accuracy: 100,
        maxPp: 15,
        vfx: 'fire_stream',
        statusEffect: {condition: 'BRN', chance: 0.15},
        description: 'Scorching fire blast. May inflict Burn.',
      },
      {
        id: 'wing_attack',
        name: 'WING ATTACK',
        type: 'FLYING',
        power: 65,
        accuracy: 100,
        maxPp: 25,
        vfx: 'lunge',
        description: 'Strikes target with spread wings.',
      },
      {
        id: 'slash',
        name: 'SLASH',
        type: 'NORMAL',
        power: 70,
        accuracy: 100,
        maxPp: 20,
        vfx: 'lunge',
        description: 'High-crit razor claw strike.',
      },
      {
        id: 'fire_spin',
        name: 'FIRE SPIN',
        type: 'FIRE',
        power: 75,
        accuracy: 90,
        maxPp: 15,
        vfx: 'fire_spin',
        statusEffect: {condition: 'BRN', chance: 0.25},
        description: 'Vortex of flames. 25% Burn chance.',
      },
    ],
  },
  blastoise: {
    id: 'blastoise',
    dexNumber: '#009',
    name: 'BLASTOISE',
    types: ['WATER'],
    level: 50,
    maxHp: 184,
    attack: 90,
    defense: 105,
    speed: 80,
    heightMeters: 0.48,
    primaryColor: '#2563eb',
    accentColor: '#93c5fd',
    moves: [
      {
        id: 'hydro_pump',
        name: 'HYDRO PUMP',
        type: 'WATER',
        power: 115,
        accuracy: 85,
        maxPp: 5,
        vfx: 'water_cannon',
        description: 'Massive twin-cannon water blast.',
      },
      {
        id: 'surf',
        name: 'SURF',
        type: 'WATER',
        power: 90,
        accuracy: 100,
        maxPp: 15,
        vfx: 'water_wave',
        description: 'Crashing tidal surge across the arena.',
      },
      {
        id: 'ice_beam',
        name: 'ICE BEAM',
        type: 'ICE',
        power: 90,
        accuracy: 100,
        maxPp: 10,
        vfx: 'water_cannon',
        description: 'Freezing beam from shoulder cannons.',
      },
      {
        id: 'skull_bash',
        name: 'SKULL BASH',
        type: 'NORMAL',
        power: 95,
        accuracy: 95,
        maxPp: 15,
        vfx: 'lunge',
        description: 'Heavy armored charge tackle.',
      },
    ],
  },
  venusaur: {
    id: 'venusaur',
    dexNumber: '#003',
    name: 'VENUSAUR',
    types: ['GRASS', 'POISON'],
    level: 50,
    maxHp: 186,
    attack: 92,
    defense: 90,
    speed: 82,
    heightMeters: 0.46,
    primaryColor: '#16a34a',
    accentColor: '#f43f5e',
    moves: [
      {
        id: 'razor_leaf',
        name: 'RAZOR LEAF',
        type: 'GRASS',
        power: 75,
        accuracy: 95,
        maxPp: 25,
        vfx: 'razor_leaf',
        description: 'Spinning sharp leaves. High crit rate.',
      },
      {
        id: 'solar_beam',
        name: 'SOLAR BEAM',
        type: 'GRASS',
        power: 115,
        accuracy: 90,
        maxPp: 10,
        vfx: 'solar_beam',
        description: 'Concentrated beam of Kanto sunlight.',
      },
      {
        id: 'sludge_bomb',
        name: 'ACID SPRAY',
        type: 'POISON',
        power: 80,
        accuracy: 100,
        maxPp: 15,
        vfx: 'shadow_orb',
        description: 'Toxic burst from the dorsal flower.',
      },
      {
        id: 'body_slam',
        name: 'BODY SLAM',
        type: 'NORMAL',
        power: 85,
        accuracy: 100,
        maxPp: 15,
        vfx: 'lunge',
        statusEffect: {condition: 'PAR', chance: 0.3},
        description: 'Full-weight slam. 30% Paralyze chance.',
      },
    ],
  },
  pikachu: {
    id: 'pikachu',
    dexNumber: '#025',
    name: 'PIKACHU',
    types: ['ELECTRIC'],
    level: 50,
    maxHp: 145,
    attack: 95,
    defense: 68,
    speed: 120,
    heightMeters: 0.36,
    primaryColor: '#facc15',
    accentColor: '#ef4444',
    moves: [
      {
        id: 'thunderbolt',
        name: 'THUNDERBOLT',
        type: 'ELECTRIC',
        power: 95,
        accuracy: 100,
        maxPp: 15,
        vfx: 'thunderbolt',
        statusEffect: {condition: 'PAR', chance: 0.15},
        description: '100,000-volt strike. May Paralyze.',
      },
      {
        id: 'thunder',
        name: 'THUNDER',
        type: 'ELECTRIC',
        power: 120,
        accuracy: 75,
        maxPp: 10,
        vfx: 'thunder',
        statusEffect: {condition: 'PAR', chance: 0.3},
        description: 'Sky-splitting bolt. High power, 75% acc.',
      },
      {
        id: 'quick_attack',
        name: 'QUICK ATTACK',
        type: 'NORMAL',
        power: 55,
        accuracy: 100,
        maxPp: 30,
        vfx: 'lunge',
        priority: 1,
        description: 'Always strikes first in the turn.',
      },
      {
        id: 'agility',
        name: 'AGILITY',
        type: 'PSYCHIC',
        power: 0,
        accuracy: 100,
        maxPp: 20,
        vfx: 'psychic_wave',
        selfStatBoost: 'spd',
        description: 'Sharply raises Speed for criticals.',
      },
    ],
  },
  gengar: {
    id: 'gengar',
    dexNumber: '#094',
    name: 'GENGAR',
    types: ['GHOST', 'POISON'],
    level: 50,
    maxHp: 158,
    attack: 108,
    defense: 74,
    speed: 112,
    heightMeters: 0.44,
    primaryColor: '#7c3aed',
    accentColor: '#f43f5e',
    moves: [
      {
        id: 'night_shade',
        name: 'SHADOW ORB',
        type: 'GHOST',
        power: 85,
        accuracy: 100,
        maxPp: 15,
        vfx: 'shadow_orb',
        description: 'Condensed spectral energy sphere.',
      },
      {
        id: 'psychic',
        name: 'PSYCHIC',
        type: 'PSYCHIC',
        power: 90,
        accuracy: 100,
        maxPp: 10,
        vfx: 'psychic_wave',
        description: 'Telekinetic wave from the shadows.',
      },
      {
        id: 'hypnosis',
        name: 'HYPNOSIS',
        type: 'PSYCHIC',
        power: 0,
        accuracy: 75,
        maxPp: 20,
        vfx: 'psychic_wave',
        statusEffect: {condition: 'SLP', chance: 1.0},
        description: 'Puts the opponent into deep sleep.',
      },
      {
        id: 'thunderbolt_g',
        name: 'THUNDERBOLT',
        type: 'ELECTRIC',
        power: 90,
        accuracy: 100,
        maxPp: 15,
        vfx: 'thunderbolt',
        statusEffect: {condition: 'PAR', chance: 0.1},
        description: 'Surprise Gen 1 TM electric burst.',
      },
    ],
  },
  snorlax: {
    id: 'snorlax',
    dexNumber: '#143',
    name: 'SNORLAX',
    types: ['NORMAL'],
    level: 50,
    maxHp: 245,
    attack: 110,
    defense: 88,
    speed: 40,
    heightMeters: 0.55,
    primaryColor: '#0f766e',
    accentColor: '#fef3c7',
    moves: [
      {
        id: 'body_slam_s',
        name: 'BODY SLAM',
        type: 'NORMAL',
        power: 85,
        accuracy: 100,
        maxPp: 15,
        vfx: 'lunge',
        statusEffect: {condition: 'PAR', chance: 0.3},
        description: 'Crushing drop. 30% Paralyze chance.',
      },
      {
        id: 'hyper_beam',
        name: 'HYPER BEAM',
        type: 'NORMAL',
        power: 135,
        accuracy: 90,
        maxPp: 5,
        vfx: 'hyper_beam',
        description: 'Devastating raw energy beam.',
      },
      {
        id: 'earthquake',
        name: 'EARTHQUAKE',
        type: 'GROUND',
        power: 100,
        accuracy: 100,
        maxPp: 10,
        vfx: 'lunge',
        description: 'Shakes the entire stadium floor.',
      },
      {
        id: 'rest',
        name: 'REST',
        type: 'PSYCHIC',
        power: 0,
        accuracy: 100,
        maxPp: 10,
        vfx: 'heal',
        healFraction: 0.65,
        description: 'Naps to restore 65% HP and cure status.',
      },
    ],
  },
};

export const POKEMON_LIST: PokemonSpecies[] = Object.values(GEN1_POKEDEX);

export function createBattlePokemon(speciesId: string): BattlePokemon {
  const species = GEN1_POKEDEX[speciesId] ?? GEN1_POKEDEX.charizard;
  return {
    species,
    currentHp: species.maxHp,
    maxHp: species.maxHp,
    atkStage: 0,
    spdStage: 0,
    status: 'NONE',
    sleepTurns: 0,
    moves: species.moves.map((m) => ({data: m, pp: m.maxPp})),
  };
}

export function buildBalancedTeams(leadId: string): {
  playerTeam: BattlePokemon[];
  enemyTeam: BattlePokemon[];
} {
  const allIds = POKEMON_LIST.map((p) => p.id);
  const chosenLead = allIds.includes(leadId) ? leadId : 'charizard';

  // Pick rival lead as classic Gen 1 counter-starter or iconic rival
  const rivalCounterMap: Record<string, string> = {
    charizard: 'blastoise',
    blastoise: 'venusaur',
    venusaur: 'charizard',
    pikachu: 'snorlax',
    gengar: 'pikachu',
    snorlax: 'gengar',
  };
  const rivalLead = rivalCounterMap[chosenLead] ?? 'blastoise';

  const remaining = allIds.filter((id) => id !== chosenLead && id !== rivalLead);
  // Deterministic balanced 3v3 split
  const playerIds = [chosenLead, remaining[0], remaining[2]];
  const enemyIds = [rivalLead, remaining[1], remaining[3]];

  return {
    playerTeam: playerIds.map(createBattlePokemon),
    enemyTeam: enemyIds.map(createBattlePokemon),
  };
}

export interface DamageResult {
  hit: boolean;
  damage: number;
  critical: boolean;
  effectiveness: number;
  inflictedStatus: StatusCondition;
}

function stageMultiplier(stage: number): number {
  const clamped = Math.max(-2, Math.min(4, stage));
  return clamped >= 0 ? (2 + clamped) / 2 : 2 / (2 - clamped);
}

export function calculateGen1Damage(
  attacker: BattlePokemon,
  defender: BattlePokemon,
  move: MoveData
): DamageResult {
  if (Math.random() * 100 > move.accuracy) {
    return {
      hit: false,
      damage: 0,
      critical: false,
      effectiveness: 1,
      inflictedStatus: 'NONE',
    };
  }

  const effectiveness = getTypeEffectiveness(move.type, defender.species.types);
  if (move.power <= 0) {
    let inflictedStatus: StatusCondition = 'NONE';
    if (
      move.statusEffect &&
      defender.status === 'NONE' &&
      Math.random() <= move.statusEffect.chance
    ) {
      inflictedStatus = move.statusEffect.condition;
    }
    return {
      hit: true,
      damage: 0,
      critical: false,
      effectiveness: 1,
      inflictedStatus,
    };
  }

  if (effectiveness === 0) {
    return {
      hit: true,
      damage: 0,
      critical: false,
      effectiveness: 0,
      inflictedStatus: 'NONE',
    };
  }

  // Gen 1 style speed-based critical rate (higher for Slash & Razor Leaf)
  const highCrit = move.id === 'slash' || move.id === 'razor_leaf';
  const baseCritProb = Math.min(0.35, attacker.species.speed / 512);
  const critProb = highCrit ? Math.min(0.55, baseCritProb * 3.2) : baseCritProb;
  const critical = Math.random() < critProb;

  const burnPenalty = attacker.status === 'BRN' && !critical ? 0.65 : 1.0;
  const atk =
    attacker.species.attack *
    (critical ? 1 : stageMultiplier(attacker.atkStage)) *
    burnPenalty;
  const def = defender.species.defense;

  const levelFactor = (2 * attacker.species.level) / 5 + 2;
  let baseDamage = ((levelFactor * move.power * (atk / def)) / 50 + 2) * 0.92;

  if (critical) baseDamage *= 1.65;
  const stab = attacker.species.types.includes(move.type) ? 1.5 : 1.0;
  const randomRoll = 0.88 + Math.random() * 0.12;
  const finalDamage = Math.max(
    1,
    Math.round(baseDamage * stab * effectiveness * randomRoll)
  );

  let inflictedStatus: StatusCondition = 'NONE';
  if (
    move.statusEffect &&
    defender.status === 'NONE' &&
    Math.random() <= move.statusEffect.chance
  ) {
    inflictedStatus = move.statusEffect.condition;
  }

  return {
    hit: true,
    damage: finalDamage,
    critical,
    effectiveness,
    inflictedStatus,
  };
}
