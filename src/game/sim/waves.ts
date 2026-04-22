export type EnemyType = 'grunt' | 'runner' | 'brute';

export type EnemyStats = {
  type: EnemyType;
  speed: number;
  maxHealth: number;
  reward: number;
  size: number;
  tint: number;
};

export type WaveSpawn = {
  id: string;
  type: EnemyType;
  delayMs: number;
};

const ENEMY_STATS: Record<EnemyType, EnemyStats> = {
  grunt: { type: 'grunt', speed: 52, maxHealth: 64, reward: 10, size: 18, tint: 0xd6e7f7 },
  runner: { type: 'runner', speed: 86, maxHealth: 44, reward: 12, size: 14, tint: 0xffc17d },
  brute: { type: 'brute', speed: 40, maxHealth: 142, reward: 22, size: 24, tint: 0xbb7cff }
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

