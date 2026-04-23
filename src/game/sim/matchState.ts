export type MatchOutcome = 'playing' | 'victory' | 'defeat';

export function getMatchOutcome({
  lives,
  wave,
  maxWave,
  pendingSpawns,
  aliveEnemies
}: {
  lives: number;
  wave: number;
  maxWave: number;
  waveInFlight: boolean;
  pendingSpawns: number;
  aliveEnemies: number;
}): MatchOutcome {
  if (lives <= 0) {
    return 'defeat';
  }

  if (wave >= maxWave && pendingSpawns <= 0 && aliveEnemies <= 0) {
    return 'victory';
  }

  return 'playing';
}
