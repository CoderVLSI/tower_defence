import { getEnemyStats, type EnemyType } from '../sim/waves';
import { getHeroRoster } from '../sim/heroes';

export type EnemyLibraryEntry = {
  type: EnemyType;
  name: string;
  role: string;
  detail: string;
  frame: number;
  stats: {
    hp: number;
    speed: number;
    reward: number;
    damage: number;
  };
};

export type HeroLibraryEntry = {
  id: string;
  name: string;
  role: string;
  detail: string;
  portraitClass: string;
  status: 'available' | 'future';
};

const ENEMY_ORDER: EnemyType[] = ['grunt', 'runner', 'brute', 'guard', 'flyer', 'caster'];

const ENEMY_COPY: Record<EnemyType, Pick<EnemyLibraryEntry, 'name' | 'role' | 'detail'>> = {
  grunt: {
    name: 'Goblin Grunt',
    role: 'Baseline raider',
    detail: 'Cheap front-line pressure with balanced speed and health.'
  },
  runner: {
    name: 'Hooded Runner',
    role: 'Fast leak threat',
    detail: 'Low health but sprints through weak tower coverage.'
  },
  brute: {
    name: 'Iron Brute',
    role: 'Heavy tank',
    detail: 'Slow, durable, and dangerous if ignored near the champion.'
  },
  guard: {
    name: 'Shield Guard',
    role: 'Armored blocker',
    detail: 'Sturdier than grunts and punishes reinforcements in melee.'
  },
  flyer: {
    name: 'Bat Demon',
    role: 'Very fast flyer',
    detail: 'Rushes the road with high speed and awkward timing.'
  },
  caster: {
    name: 'Plague Caster',
    role: 'Ranged magic unit',
    detail: 'Attacks from farther away with green necromancer magic.'
  }
};

export function getEnemyLibrary(): EnemyLibraryEntry[] {
  return ENEMY_ORDER.map((type, index) => {
    const stats = getEnemyStats(type);

    return {
      type,
      ...ENEMY_COPY[type],
      frame: index * 4,
      stats: {
        hp: stats.maxHealth,
        speed: stats.speed,
        reward: stats.reward,
        damage: stats.damage
      }
    };
  });
}

export function getHeroLibrary(): HeroLibraryEntry[] {
  return getHeroRoster().map((hero) => ({
    id: hero.id,
    name: hero.name,
    role: hero.role,
    detail: hero.detail,
    portraitClass: hero.portraitClass,
    status: hero.available ? 'available' : 'future'
  }));
}
