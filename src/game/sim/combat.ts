import type { Point } from './arena';

export type TowerKind = 'blaster' | 'laser' | 'forge';

export type TowerDef = {
  kind: TowerKind;
  cost: number;
  damage: number;
  range: number;
  cooldownMs: number;
  beamDurationMs?: number;
  description: string;
};

export type CombatEnemy = Point & {
  id: string;
  progress: number;
};

export type TowerAim = Point & {
  range: number;
  damage: number;
  kind: TowerKind;
};

export type HeroAim = Point & { range: number };

export const TOWER_DEFS: Record<TowerKind, TowerDef> = {
  blaster: {
    kind: 'blaster',
    cost: 50,
    damage: 20,
    range: 170,
    cooldownMs: 600,
    description: 'Fast bolt tower with reliable single-target damage.'
  },
  laser: {
    kind: 'laser',
    cost: 100,
    damage: 34,
    range: 210,
    cooldownMs: 950,
    beamDurationMs: 140,
    description: 'Heavy beam tower that bursts down front-line threats.'
  },
  forge: {
    kind: 'forge',
    cost: 150,
    damage: 0,
    range: 150,
    cooldownMs: 3000,
    description: 'Support forge that grants income and buffs nearby towers.'
  }
};

export function pointInRange(from: Point, to: Point, range: number): boolean {
  const dx = from.x - to.x;
  const dy = from.y - to.y;
  return dx * dx + dy * dy <= range * range;
}

export function getTowerTint(kind: TowerKind): number {
  switch (kind) {
    case 'laser':
      return 0x7ce6ff;
    case 'forge':
      return 0xff9f5c;
    default:
      return 0xc95b5b;
  }
}

export function getTowerShot(tower: TowerAim, enemies: CombatEnemy[]) {
  const target = enemies
    .filter((enemy) => pointInRange(tower, enemy, tower.range))
    .sort((left, right) => right.progress - left.progress)[0];

  if (!target) {
    return null;
  }

  return {
    targetId: target.id,
    damage: tower.damage,
    kind: tower.kind
  };
}

export function getHeroTarget(hero: HeroAim, enemies: CombatEnemy[]) {
  return enemies
    .filter((enemy) => pointInRange(hero, enemy, hero.range))
    .sort((left, right) => {
      const leftDistance = (left.x - hero.x) ** 2 + (left.y - hero.y) ** 2;
      const rightDistance = (right.x - hero.x) ** 2 + (right.y - hero.y) ** 2;
      return leftDistance - rightDistance;
    })[0] ?? null;
}

