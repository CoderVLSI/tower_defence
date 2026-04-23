import { describe, expect, it } from 'vitest';
import { getHeroLibrary } from '../src/game/ui/library';

describe('hero library', () => {
  it('marks the current roster as available heroes', () => {
    const heroes = getHeroLibrary();

    expect(heroes.map((hero) => hero.id)).toEqual(['shadow-sneaker', 'ember-knight', 'frost-oracle']);
    expect(heroes.every((hero) => hero.status === 'available')).toBe(true);
  });
});
