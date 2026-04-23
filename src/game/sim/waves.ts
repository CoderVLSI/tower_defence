export type EnemyType = 'grunt' | 'runner' | 'brute' | 'guard' | 'flyer' | 'caster';

export type EnemyStats = {
  type: EnemyType;
  speed: number;
  maxHealth: number;
  reward: number;
  size: number;
  tint: number;
  damage: number;
};

export type WaveSpawn = {
  id: string;
  type: EnemyType;
  delayMs: number;
};

const ENEMY_STATS: Record<EnemyType, EnemyStats> = {
  grunt: { type: 'grunt', speed: 52, maxHealth: 64, reward: 10, size: 18, tint: 0xd6e7f7, damage: 8 },
  runner: { type: 'runner', speed: 88, maxHealth: 44, reward: 12, size: 14, tint: 0xffc17d, damage: 6 },
  brute: { type: 'brute', speed: 40, maxHealth: 150, reward: 24, size: 24, tint: 0xbb7cff, damage: 16 },
  guard: { type: 'guard', speed: 46, maxHealth: 104, reward: 18, size: 20, tint: 0x9bd68a, damage: 10 },
  flyer: { type: 'flyer', speed: 104, maxHealth: 58, reward: 16, size: 15, tint: 0xcb78ff, damage: 7 },
  caster: { type: 'caster', speed: 48, maxHealth: 82, reward: 20, size: 18, tint: 0xa8ff6f, damage: 12 }
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
