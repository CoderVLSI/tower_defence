import { describe, expect, it } from 'vitest';
import { createWave, getEnemyStats } from '../src/game/sim/waves';

describe('wave generation', () => {
  it('ramps up enemy count and mixes tougher units on later waves', () => {
    const firstWave = createWave(1);
    const fifthWave = createWave(5);

    expect(firstWave.length).toBe(6);
    expect(fifthWave.length).toBeGreaterThan(firstWave.length);
    expect(fifthWave.some((spawn) => spawn.type === 'brute')).toBe(true);
    expect(fifthWave[fifthWave.length - 1]?.type).toBe('runner');
  });

  it('provides enemy stats with increasing threat', () => {
    const grunt = getEnemyStats('grunt');
    const brute = getEnemyStats('brute');

    expect(brute.maxHealth).toBeGreaterThan(grunt.maxHealth);
    expect(brute.reward).toBeGreaterThan(grunt.reward);
  });
});
