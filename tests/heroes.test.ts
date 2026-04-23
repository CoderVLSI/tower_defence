import { describe, expect, it } from 'vitest';
import { getHeroById, getHeroRoster } from '../src/game/sim/heroes';

describe('hero roster', () => {
  it('keeps all three current heroes selectable', () => {
    expect(getHeroRoster().map((hero) => hero.id)).toEqual(['shadow-sneaker', 'ember-knight', 'frost-oracle']);
    expect(getHeroRoster().every((hero) => hero.available)).toBe(true);
  });

  it('defines the expected auto specials for each hero', () => {
    expect(getHeroById('shadow-sneaker')).toMatchObject({
      name: 'Shadow Sneaker',
      specialName: 'Execution Backstab',
      autoSpecial: true
    });
    expect(getHeroById('ember-knight')).toMatchObject({
      name: 'Ember Knight',
      specialName: 'Molten Stand',
      autoSpecial: true
    });
    expect(getHeroById('frost-oracle')).toMatchObject({
      name: 'Frost Oracle',
      specialName: 'Absolute Zero',
      autoSpecial: true
    });
  });

  it('uses directional sprite sets for every active hero', () => {
    expect(getHeroById('shadow-sneaker').spriteSet).toBe('shadow-directional');
    expect(getHeroById('ember-knight').spriteSet).toBe('ember-directional');
    expect(getHeroById('frost-oracle').spriteSet).toBe('frost-directional');
  });
});
