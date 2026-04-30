import { describe, expect, it } from 'vitest';
import {
  TOWER_DEFS,
  getHeroTarget,
  resolveDamage,
  getTowerShot,
  getTowerTint,
  pointInRange
} from '../src/game/sim/combat';

describe('combat helpers', () => {
  it('targets the furthest enemy in range', () => {
    const shot = getTowerShot(
      { x: 100, y: 100, range: 160, damage: 18, kind: 'blaster' },
      [
        { id: 'a', x: 180, y: 100, progress: 0.2 },
        { id: 'b', x: 210, y: 100, progress: 0.55 },
        { id: 'c', x: 400, y: 100, progress: 0.8 }
      ]
    );

    expect(shot?.targetId).toBe('b');
    expect(shot?.damage).toBe(18);
  });

  it('picks the closest hero target within range', () => {
    const target = getHeroTarget(
      { x: 500, y: 400, range: 140 },
      [
        { id: 'near', x: 580, y: 440, progress: 0.2 },
        { id: 'far', x: 620, y: 450, progress: 0.8 }
      ]
    );

    expect(target?.id).toBe('near');
  });

  it('prevents ground-only towers from targeting flyers', () => {
    const shot = getTowerShot(
      { x: 100, y: 100, range: 200, damage: 18, kind: 'blaster' },
      [
        { id: 'flyer', x: 180, y: 100, progress: 0.9, airborne: true },
        { id: 'ground', x: 170, y: 100, progress: 0.4, airborne: false }
      ]
    );

    expect(shot?.targetId).toBe('ground');
  });

  it('applies armor and magic resistance to resolved damage', () => {
    expect(resolveDamage(20, 'physical', { armor: 0.25, magicResist: 0 })).toBe(15);
    expect(resolveDamage(20, 'magic', { armor: 0, magicResist: 0.3 })).toBe(14);
    expect(resolveDamage(20, 'true', { armor: 0.8, magicResist: 0.8 })).toBe(20);
  });

  it('exposes tower definitions and helpers', () => {
    expect(TOWER_DEFS.blaster.cost).toBe(50);
    expect(TOWER_DEFS.archer.cost).toBe(70);
    expect(TOWER_DEFS.laser.cost).toBe(100);
    expect(TOWER_DEFS.barracks.cost).toBe(120);
    expect(TOWER_DEFS.forge.cost).toBe(150);
    expect(TOWER_DEFS.mage.damageType).toBe('magic');
    expect(TOWER_DEFS.forge.damage).toBeGreaterThan(0);
    expect(TOWER_DEFS.archer.canTargetAir).toBe(true);
    expect(TOWER_DEFS.blaster.canTargetAir).toBe(false);
    expect(pointInRange({ x: 0, y: 0 }, { x: 3, y: 4 }, 5)).toBe(true);
    expect(getTowerTint('laser')).not.toBe(getTowerTint('blaster'));
  });
});
