import { describe, expect, it } from 'vitest';
import { getEnemyLibrary, getHeroLibrary } from '../src/game/ui/library';

describe('main menu library', () => {
  it('lists every current enemy with sprite frames and combat stats', () => {
    const enemies = getEnemyLibrary();

    expect(enemies.map((enemy) => enemy.type)).toEqual(['grunt', 'runner', 'brute', 'guard', 'flyer', 'caster']);
    expect(enemies.every((enemy) => enemy.stats.hp > 0 && enemy.stats.damage > 0)).toBe(true);
    expect(enemies.map((enemy) => enemy.frame)).toEqual([0, 4, 8, 12, 16, 20]);
  });

  it('keeps Shadow Sneaker available and leaves future hero slots', () => {
    const heroes = getHeroLibrary();

    expect(heroes[0]).toMatchObject({
      id: 'shadow-sneaker',
      status: 'available'
    });
    expect(heroes.some((hero) => hero.status === 'future')).toBe(true);
  });
});
