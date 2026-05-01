import { TOWER_DEFS, type TowerKind } from '../sim/combat';

export const MAX_TOWER_LEVEL = 4;
export type TowerSpecialization =
  | 'blaster-shrapnel'
  | 'blaster-rocket'
  | 'archer-musketeer'
  | 'archer-royal'
  | 'archer-mystical'
  | 'mage-necromancer'
  | 'mage-arcane'
  | 'laser-prism'
  | 'laser-storm'
  | 'barracks-paladin'
  | 'barracks-barbarian'
  | 'forge-mortar'
  | 'forge-volcano';

export type TowerStats = {
  damage: number;
  range: number;
  cooldownMs: number;
  damageType: (typeof TOWER_DEFS)[TowerKind]['damageType'];
  canTargetAir: boolean;
  specialization?: TowerSpecialization;
};

export type TowerSpecializationOption = {
  id: TowerSpecialization;
  label: string;
  description: string;
  cost: number;
  canAfford: boolean;
};

export type TowerManagementState = {
  title: string;
  kind: TowerKind;
  level: number;
  stats: TowerStats;
  sellValue: number;
  upgradeCost: number | null;
  canUpgrade: boolean;
  specialization?: TowerSpecialization;
  specializationLabel?: string;
  specializationOptions: TowerSpecializationOption[];
};

type SpecializationDef = {
  id: TowerSpecialization;
  kind: TowerKind;
  label: string;
  shortLabel: string;
  description: string;
  damageMultiplier: number;
  rangeBonus: number;
  cooldownMultiplier: number;
  canTargetAir?: boolean;
};

export const TOWER_SPECIALIZATIONS: Record<TowerSpecialization, SpecializationDef> = {
  'blaster-shrapnel': {
    id: 'blaster-shrapnel',
    kind: 'blaster',
    label: 'Shrapnel Bastion',
    shortLabel: 'SH',
    description: 'Explosive bolts hit harder.',
    damageMultiplier: 1.35,
    rangeBonus: 8,
    cooldownMultiplier: 1
  },
  'blaster-rocket': {
    id: 'blaster-rocket',
    kind: 'blaster',
    label: 'Rocket Battery',
    shortLabel: 'RB',
    description: 'Longer range and faster salvos.',
    damageMultiplier: 1.12,
    rangeBonus: 24,
    cooldownMultiplier: 0.82
  },
  'archer-musketeer': {
    id: 'archer-musketeer',
    kind: 'archer',
    label: 'Musketeer Tower',
    shortLabel: 'MS',
    description: 'Slow precision shots with heavy damage.',
    damageMultiplier: 1.55,
    rangeBonus: 28,
    cooldownMultiplier: 1.18
  },
  'archer-royal': {
    id: 'archer-royal',
    kind: 'archer',
    label: 'Royal Archers',
    shortLabel: 'RA',
    description: 'Elite volley tower with fast cadence.',
    damageMultiplier: 1.18,
    rangeBonus: 16,
    cooldownMultiplier: 0.76
  },
  'archer-mystical': {
    id: 'archer-mystical',
    kind: 'archer',
    label: 'Mystical Archers',
    shortLabel: 'MY',
    description: 'Enchanted arrows gain magic reach.',
    damageMultiplier: 1.26,
    rangeBonus: 22,
    cooldownMultiplier: 0.9
  },
  'mage-necromancer': {
    id: 'mage-necromancer',
    kind: 'mage',
    label: 'Necromancer Tower',
    shortLabel: 'NC',
    description: 'Dark magic hits harder.',
    damageMultiplier: 1.38,
    rangeBonus: 10,
    cooldownMultiplier: 0.96
  },
  'mage-arcane': {
    id: 'mage-arcane',
    kind: 'mage',
    label: 'Arcane Tower',
    shortLabel: 'AR',
    description: 'Arcane focus casts faster and farther.',
    damageMultiplier: 1.18,
    rangeBonus: 30,
    cooldownMultiplier: 0.78
  },
  'laser-prism': {
    id: 'laser-prism',
    kind: 'laser',
    label: 'Prism Spire',
    shortLabel: 'PR',
    description: 'Focused beam damage.',
    damageMultiplier: 1.42,
    rangeBonus: 12,
    cooldownMultiplier: 0.96
  },
  'laser-storm': {
    id: 'laser-storm',
    kind: 'laser',
    label: 'Storm Lens',
    shortLabel: 'ST',
    description: 'Faster pulses and wider coverage.',
    damageMultiplier: 1.12,
    rangeBonus: 28,
    cooldownMultiplier: 0.78
  },
  'barracks-paladin': {
    id: 'barracks-paladin',
    kind: 'barracks',
    label: 'Paladin Hall',
    shortLabel: 'PA',
    description: 'Larger, tougher defenders.',
    damageMultiplier: 1,
    rangeBonus: 16,
    cooldownMultiplier: 0.9
  },
  'barracks-barbarian': {
    id: 'barracks-barbarian',
    kind: 'barracks',
    label: 'Barbarian Lodge',
    shortLabel: 'BA',
    description: 'More aggressive soldiers rally faster.',
    damageMultiplier: 1,
    rangeBonus: 8,
    cooldownMultiplier: 0.72
  },
  'forge-mortar': {
    id: 'forge-mortar',
    kind: 'forge',
    label: 'Siege Mortar',
    shortLabel: 'MO',
    description: 'Heavy shells with larger impact.',
    damageMultiplier: 1.4,
    rangeBonus: 14,
    cooldownMultiplier: 1.04
  },
  'forge-volcano': {
    id: 'forge-volcano',
    kind: 'forge',
    label: 'Volcano Furnace',
    shortLabel: 'VF',
    description: 'Faster magma shots and wider road cover.',
    damageMultiplier: 1.16,
    rangeBonus: 28,
    cooldownMultiplier: 0.78
  }
};

const SPECIALIZATION_ORDER: Record<TowerKind, TowerSpecialization[]> = {
  blaster: ['blaster-shrapnel', 'blaster-rocket'],
  archer: ['archer-musketeer', 'archer-royal', 'archer-mystical'],
  mage: ['mage-necromancer', 'mage-arcane'],
  laser: ['laser-prism', 'laser-storm'],
  barracks: ['barracks-paladin', 'barracks-barbarian'],
  forge: ['forge-mortar', 'forge-volcano']
};

export function getTowerStats(kind: TowerKind, level: number, specialization?: TowerSpecialization): TowerStats {
  const safeLevel = Math.max(1, Math.min(MAX_TOWER_LEVEL, level));
  const def = TOWER_DEFS[kind];
  const bonusSteps = safeLevel - 1;
  const advanced = specialization ? TOWER_SPECIALIZATIONS[specialization] : undefined;

  return {
    damage: Math.round(def.damage * (1 + bonusSteps * 0.35) * (advanced?.damageMultiplier ?? 1)),
    range: def.range + bonusSteps * 15 + (advanced?.rangeBonus ?? 0),
    cooldownMs: Math.round(def.cooldownMs * (1 - bonusSteps * 0.1) * (advanced?.cooldownMultiplier ?? 1)),
    damageType: def.damageType,
    canTargetAir: advanced?.canTargetAir ?? def.canTargetAir,
    specialization
  };
}

export function getUpgradeCost(kind: TowerKind, level: number): number | null {
  if (level >= MAX_TOWER_LEVEL) {
    return null;
  }

  return Math.round(TOWER_DEFS[kind].cost * (0.55 + level * 0.25));
}

export function getSpecializationCost(kind: TowerKind): number {
  return Math.round(TOWER_DEFS[kind].cost * 2);
}

export function getSpecializationOptions(kind: TowerKind, level: number, coins: number, specialization?: TowerSpecialization): TowerSpecializationOption[] {
  if (level < 3 || level >= MAX_TOWER_LEVEL || specialization) {
    return [];
  }

  const cost = getSpecializationCost(kind);
  return SPECIALIZATION_ORDER[kind].map((id) => ({
    id,
    label: TOWER_SPECIALIZATIONS[id].label,
    description: TOWER_SPECIALIZATIONS[id].description,
    cost,
    canAfford: coins >= cost
  }));
}

export function getSellValue(kind: TowerKind, level: number, specialization?: TowerSpecialization): number {
  let invested = TOWER_DEFS[kind].cost;

  const paidLevel = specialization ? Math.min(level, 3) : level;
  for (let currentLevel = 1; currentLevel < paidLevel; currentLevel += 1) {
    invested += getUpgradeCost(kind, currentLevel) ?? 0;
  }
  if (specialization) {
    invested += getSpecializationCost(kind);
  }

  return Math.floor(invested * 0.7);
}

export function getTowerManagementState({
  kind,
  level,
  coins,
  specialization
}: {
  kind: TowerKind;
  level: number;
  coins: number;
  specialization?: TowerSpecialization;
}): TowerManagementState {
  const upgradeCost = getUpgradeCost(kind, level);
  const specializationOptions = getSpecializationOptions(kind, level, coins, specialization);

  return {
    title: specialization ? TOWER_SPECIALIZATIONS[specialization].label : kind[0].toUpperCase() + kind.slice(1),
    kind,
    level,
    stats: getTowerStats(kind, level, specialization),
    sellValue: getSellValue(kind, level, specialization),
    upgradeCost,
    canUpgrade: specializationOptions.length === 0 && upgradeCost !== null && coins >= upgradeCost,
    specialization,
    specializationLabel: specialization ? TOWER_SPECIALIZATIONS[specialization].label : undefined,
    specializationOptions
  };
}
