export type EnemyType =
  | 'grunt'
  | 'runner'
  | 'brute'
  | 'guard'
  | 'flyer'
  | 'caster'
  | 'spider'
  | 'wizard'
  | 'knight'
  | 'monster'
  | 'boss';

export type EnemyStats = {
  type: EnemyType;
  speed: number;
  maxHealth: number;
  reward: number;
  size: number;
  tint: number;
  damage: number;
  armor: number;
  magicResist: number;
  airborne: boolean;
};

export type WaveSpawn = {
  id: string;
  type: EnemyType;
  delayMs: number;
};

const ENEMY_STATS: Record<EnemyType, EnemyStats> = {
  grunt: { type: 'grunt', speed: 52, maxHealth: 64, reward: 10, size: 18, tint: 0xd6e7f7, damage: 8, armor: 0, magicResist: 0, airborne: false },
  runner: { type: 'runner', speed: 88, maxHealth: 44, reward: 12, size: 14, tint: 0xffc17d, damage: 6, armor: 0, magicResist: 0, airborne: false },
  brute: { type: 'brute', speed: 40, maxHealth: 150, reward: 24, size: 24, tint: 0xbb7cff, damage: 16, armor: 0.18, magicResist: 0, airborne: false },
  guard: { type: 'guard', speed: 46, maxHealth: 104, reward: 18, size: 20, tint: 0x9bd68a, damage: 10, armor: 0.28, magicResist: 0, airborne: false },
  flyer: { type: 'flyer', speed: 104, maxHealth: 58, reward: 16, size: 15, tint: 0xcb78ff, damage: 7, armor: 0, magicResist: 0.12, airborne: true },
  caster: { type: 'caster', speed: 48, maxHealth: 82, reward: 20, size: 18, tint: 0xa8ff6f, damage: 12, armor: 0, magicResist: 0.18, airborne: false },
  spider: { type: 'spider', speed: 92, maxHealth: 54, reward: 14, size: 15, tint: 0x7dff9a, damage: 7, armor: 0, magicResist: 0, airborne: false },
  wizard: { type: 'wizard', speed: 44, maxHealth: 96, reward: 24, size: 18, tint: 0x8beaff, damage: 14, armor: 0, magicResist: 0.3, airborne: false },
  knight: { type: 'knight', speed: 38, maxHealth: 190, reward: 32, size: 25, tint: 0xffcc84, damage: 18, armor: 0.38, magicResist: 0.1, airborne: false },
  monster: { type: 'monster', speed: 34, maxHealth: 260, reward: 42, size: 30, tint: 0xff8a6a, damage: 24, armor: 0.22, magicResist: 0.12, airborne: false },
  boss: { type: 'boss', speed: 28, maxHealth: 900, reward: 160, size: 42, tint: 0xff5c5c, damage: 32, armor: 0.24, magicResist: 0.24, airborne: false }
};

export function getEnemyStats(type: EnemyType): EnemyStats {
  return ENEMY_STATS[type];
}

export function createWave(index: number): WaveSpawn[] {
  const count = 5 + index;
  const spawns: WaveSpawn[] = [];

  for (let i = 0; i < count; i += 1) {
    let type: EnemyType = 'grunt';

    if (index >= 3 && i % 3 === 2) {
      type = 'runner';
    }

    if (index >= 5 && i % 4 === 1) {
      type = 'guard';
    }

    if (index >= 6 && i % 5 === 3) {
      type = 'flyer';
    }

    if (index >= 7 && i % 6 === 4) {
      type = 'caster';
    }

    if (index >= 4 && i === Math.floor(count / 2)) {
      type = 'brute';
    }

    if (index >= 5 && i === count - 1) {
      type = 'runner';
    }

    spawns.push({
      id: `wave-${index}-${i}`,
      type,
      delayMs: i * Math.max(380, 760 - index * 40)
    });
  }

  return spawns;
}
