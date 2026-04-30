import { describe, expect, it } from 'vitest';
import { getEnemyLibrary, getHeroLibrary } from '../src/game/ui/library';

describe('main menu library', () => {
  it('lists every current enemy with sprite frames and combat stats', () => {
    const enemies = getEnemyLibrary();

    expect(enemies.map((enemy) => enemy.type)).toEqual([
      'grunt',
      'runner',
      'brute',
      'guard',
      'flyer',
      'caster',
      'spider',
      'wizard',
      'knight',
      'monster',
      'boss'
    ]);
    expect(enemies.every((enemy) => enemy.stats.hp > 0 && enemy.stats.damage > 0)).toBe(true);
    expect(enemies.every((enemy) => enemy.stats.armor >= 0 && enemy.stats.magicResist >= 0)).toBe(true);
    expect(enemies.find((enemy) => enemy.type === 'flyer')?.detail).toContain('anti-air');
    expect(enemies.every((enemy) => enemy.frame === 0)).toBe(true);
  });

  it('keeps the active hero roster available', () => {
    const heroes = getHeroLibrary();

    expect(heroes[0]).toMatchObject({
      id: 'shadow-sneaker',
      status: 'available'
    });
    expect(heroes.every((hero) => hero.status === 'available')).toBe(true);
  });
});
