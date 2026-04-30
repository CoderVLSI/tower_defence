import { describe, expect, it } from 'vitest';
import {
  MAX_TOWER_LEVEL,
  getTowerManagementState,
  getTowerStats
} from '../src/game/ui/towerManagement';

describe('tower management panel', () => {
  it('shows stats, sell value, and upgrade cost for a placed tower', () => {
    const state = getTowerManagementState({
      kind: 'blaster',
      level: 1,
      coins: 70
    });

    expect(state.title).toBe('Blaster');
    expect(state.level).toBe(1);
    expect(state.stats.damage).toBe(20);
    expect(state.stats.range).toBe(170);
    expect(state.sellValue).toBe(35);
    expect(state.upgradeCost).toBe(40);
    expect(state.canUpgrade).toBe(true);
  });

  it('scales tower stats by level', () => {
    expect(getTowerStats('laser', 2)).toMatchObject({
      damage: 46,
      range: 225,
      cooldownMs: 855
    });
  });

  it('disables upgrade at max level', () => {
    const state = getTowerManagementState({
      kind: 'forge',
      level: MAX_TOWER_LEVEL,
      coins: 999
    });

    expect(state.upgradeCost).toBeNull();
    expect(state.canUpgrade).toBe(false);
  });

  it('offers branching level 4 paths at level 3', () => {
    const state = getTowerManagementState({
      kind: 'mage',
      level: 3,
      coins: 999
    });

    expect(state.canUpgrade).toBe(false);
    expect(state.specializationOptions.map((option) => option.id)).toEqual(['power', 'control']);
  });

  it('applies specialization stats at level 4', () => {
    const power = getTowerStats('mage', 4, 'power');
    const control = getTowerStats('mage', 4, 'control');

    expect(power.damage).toBeGreaterThan(control.damage);
    expect(control.cooldownMs).toBeLessThan(power.cooldownMs);
    expect(control.range).toBeGreaterThan(power.range);
  });
});
