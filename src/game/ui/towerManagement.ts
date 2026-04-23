import { TOWER_DEFS, type TowerKind } from '../sim/combat';

export const MAX_TOWER_LEVEL = 3;

export type TowerStats = {
  damage: number;
  range: number;
  cooldownMs: number;
};

export type TowerManagementState = {
  title: string;
  kind: TowerKind;
  level: number;
  stats: TowerStats;
  sellValue: number;
  upgradeCost: number | null;
  canUpgrade: boolean;
};

export function getTowerStats(kind: TowerKind, level: number): TowerStats {
  const safeLevel = Math.max(1, Math.min(MAX_TOWER_LEVEL, level));
  const def = TOWER_DEFS[kind];
  const bonusSteps = safeLevel - 1;

  return {
    damage: Math.round(def.damage * (1 + bonusSteps * 0.35)),
    range: def.range + bonusSteps * 15,
    cooldownMs: Math.round(def.cooldownMs * (1 - bonusSteps * 0.1))
  };
}

export function getUpgradeCost(kind: TowerKind, level: number): number | null {
  if (level >= MAX_TOWER_LEVEL) {
    return null;
  }

  return Math.round(TOWER_DEFS[kind].cost * (0.55 + level * 0.25));
}

export function getSellValue(kind: TowerKind, level: number): number {
  let invested = TOWER_DEFS[kind].cost;

  for (let currentLevel = 1; currentLevel < level; currentLevel += 1) {
    invested += getUpgradeCost(kind, currentLevel) ?? 0;
  }

  return Math.floor(invested * 0.7);
}

export function getTowerManagementState({
  kind,
  level,
  coins
}: {
  kind: TowerKind;
  level: number;
  coins: number;
}): TowerManagementState {
  const upgradeCost = getUpgradeCost(kind, level);

  return {
    title: kind[0].toUpperCase() + kind.slice(1),
    kind,
    level,
    stats: getTowerStats(kind, level),
    sellValue: getSellValue(kind, level),
    upgradeCost,
    canUpgrade: upgradeCost !== null && coins >= upgradeCost
  };
}
