import { describe, expect, it } from 'vitest';
import { getBuildMenuOptions, getBuildMenuState } from '../src/game/ui/buildMenu';

describe('build pad tower menu', () => {
  it('opens for an empty pad with affordability for each tower', () => {
    const state = getBuildMenuState({
      padId: 'pad-2',
      occupiedPadIds: ['pad-1'],
      coins: 75
    });

    expect(state.open).toBe(true);
    expect(state.padId).toBe('pad-2');
    expect(state.options.map((option) => [option.kind, option.canAfford])).toEqual([
      ['blaster', true],
      ['archer', true],
      ['mage', false],
      ['laser', false],
      ['barracks', false],
      ['forge', false]
    ]);
  });

  it('stays closed when a pad is already occupied', () => {
    const state = getBuildMenuState({
      padId: 'pad-1',
      occupiedPadIds: ['pad-1'],
      coins: 200
    });

    expect(state.open).toBe(false);
    expect(state.options).toEqual([]);
  });

  it('returns visual tower choices in shop order', () => {
    expect(getBuildMenuOptions(200).map((option) => option.kind)).toEqual(['blaster', 'archer', 'mage', 'laser', 'barracks', 'forge']);
  });
});
