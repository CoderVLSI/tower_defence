import { describe, expect, it } from 'vitest';
import {
  ARENA_HEIGHT,
  ARENA_WIDTH,
  BUILD_PADS,
  ENEMY_PATH,
  getPadById,
  getPathPoint
} from '../src/game/sim/arena';

describe('arena layout', () => {
  it('keeps key points inside the map bounds', () => {
    expect(ARENA_WIDTH).toBeGreaterThan(1200);
    expect(ARENA_HEIGHT).toBeGreaterThan(700);

    for (const point of ENEMY_PATH) {
      expect(point.x).toBeGreaterThanOrEqual(0);
      expect(point.x).toBeLessThanOrEqual(ARENA_WIDTH);
      expect(point.y).toBeGreaterThanOrEqual(0);
      expect(point.y).toBeLessThanOrEqual(ARENA_HEIGHT);
    }

    for (const pad of BUILD_PADS) {
      expect(pad.x).toBeGreaterThan(100);
      expect(pad.y).toBeGreaterThan(100);
    }
  });

  it('returns pad lookups and path points', () => {
    expect(getPadById('pad-3')?.slot).toBe('bottom-lane');
    expect(getPathPoint(0)).toEqual(ENEMY_PATH[0]);
    expect(getPathPoint(999)).toEqual(ENEMY_PATH[ENEMY_PATH.length - 1]);
  });
});
