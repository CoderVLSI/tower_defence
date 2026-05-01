import { describe, expect, it } from 'vitest';
import {
  MAX_TOWER_LEVEL,
  getSpecializationCost,
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
    expect(state.specializationOptions.map((option) => option.id)).toEqual(['mage-necromancer', 'mage-arcane']);
    expect(state.specializationOptions.map((option) => option.label)).toEqual(['Necromancer Tower', 'Arcane Tower']);
    expect(state.specializationOptions.map((option) => option.cost)).toEqual([220, 220]);
  });

  it('prices level 4 transformations as premium upgrades', () => {
    expect(getSpecializationCost('forge')).toBe(300);
    expect(getSpecializationCost('mage')).toBe(220);
  });

  it('applies specialization stats at level 4', () => {
    const necromancer = getTowerStats('mage', 4, 'mage-necromancer');
    const arcane = getTowerStats('mage', 4, 'mage-arcane');

    expect(necromancer.damage).toBeGreaterThan(arcane.damage);
    expect(arcane.cooldownMs).toBeLessThan(necromancer.cooldownMs);
    expect(arcane.range).toBeGreaterThan(necromancer.range);
  });
});
