import { describe, expect, it } from 'vitest';
import {
  TOWER_DEFS,
  getHeroTarget,
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

  it('exposes tower definitions and helpers', () => {
    expect(TOWER_DEFS.blaster.cost).toBe(50);
    expect(TOWER_DEFS.laser.cost).toBe(100);
    expect(TOWER_DEFS.forge.cost).toBe(150);
    expect(pointInRange({ x: 0, y: 0 }, { x: 3, y: 4 }, 5)).toBe(true);
    expect(getTowerTint('laser')).not.toBe(getTowerTint('blaster'));
  });
});
