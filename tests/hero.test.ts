import { describe, expect, it } from 'vitest';
import {
  HERO_REGEN_DELAY_SECONDS,
  HERO_REGEN_PER_SECOND,
  HERO_RESPAWN_SECONDS,
  getHeroRegen,
  getHeroRecoveryProgress,
  getHeroRespawnLabel
} from '../src/game/sim/hero';

describe('hero recovery', () => {
  it('uses a 30 second respawn cooldown', () => {
    expect(HERO_RESPAWN_SECONDS).toBe(30);
  });

  it('formats the respawn countdown for the hero frame', () => {
    expect(getHeroRespawnLabel(29.2)).toBe('Recovering in 30s');
    expect(getHeroRespawnLabel(1.1)).toBe('Recovering in 2s');
    expect(getHeroRespawnLabel(0)).toBe('Ready');
  });

  it('reports recovery progress for portrait feedback', () => {
    expect(getHeroRecoveryProgress(30)).toBe(0);
    expect(getHeroRecoveryProgress(15)).toBe(0.5);
    expect(getHeroRecoveryProgress(0)).toBe(1);
  });

  it('starts health regeneration after 15 seconds without damage', () => {
    expect(HERO_REGEN_DELAY_SECONDS).toBe(15);
    expect(HERO_REGEN_PER_SECOND).toBe(6);
    expect(getHeroRegen({ hp: 50, maxHp: 100, secondsSinceDamage: 14.9, dt: 1 })).toBe(50);
    expect(getHeroRegen({ hp: 50, maxHp: 100, secondsSinceDamage: 15, dt: 1 })).toBe(56);
    expect(getHeroRegen({ hp: 98, maxHp: 100, secondsSinceDamage: 20, dt: 1 })).toBe(100);
  });
});
