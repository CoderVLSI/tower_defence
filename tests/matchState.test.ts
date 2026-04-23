import { describe, expect, it } from 'vitest';
import { getMatchOutcome } from '../src/game/sim/matchState';

describe('match outcome', () => {
  it('ends in defeat when lives reach zero', () => {
    expect(
      getMatchOutcome({
        lives: 0,
        wave: 3,
        maxWave: 8,
        waveInFlight: true,
        pendingSpawns: 2,
        aliveEnemies: 4
      })
    ).toBe('defeat');
  });

  it('ends in victory after the final wave is fully cleared', () => {
    expect(
      getMatchOutcome({
        lives: 4,
        wave: 8,
        maxWave: 8,
        waveInFlight: true,
        pendingSpawns: 0,
        aliveEnemies: 0
      })
    ).toBe('victory');
  });

  it('keeps playing before a terminal state', () => {
    expect(
      getMatchOutcome({
        lives: 4,
        wave: 8,
        maxWave: 8,
        waveInFlight: true,
        pendingSpawns: 1,
        aliveEnemies: 0
      })
    ).toBe('playing');
  });
});
