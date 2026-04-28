import { describe, expect, it } from 'vitest';
import { CAMPAIGN_LEVELS, createCampaignWave, getCampaignLevel } from '../src/game/sim/campaignLevels';

describe('campaign levels', () => {
  it('defines a 10 level campaign with a final boss level', () => {
    expect(CAMPAIGN_LEVELS).toHaveLength(10);
    expect(CAMPAIGN_LEVELS.map((level) => level.id)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(getCampaignLevel(10)).toMatchObject({
      difficulty: 'boss',
      boss: 'boss'
    });
  });

  it('gives every level a playable path, pads, and enemy pool', () => {
    for (const level of CAMPAIGN_LEVELS) {
      expect(level.path.length).toBeGreaterThanOrEqual(6);
      expect(level.pads.length).toBeGreaterThanOrEqual(5);
      expect(level.enemyPool.length).toBeGreaterThanOrEqual(2);
      expect(level.maxWave).toBeGreaterThanOrEqual(5);
    }
  });

  it('creates level-scaled waves from each level pool', () => {
    const early = createCampaignWave(getCampaignLevel(1), 1);
    const boss = createCampaignWave(getCampaignLevel(10), 10);

    expect(early.every((spawn) => getCampaignLevel(1).enemyPool.includes(spawn.type))).toBe(true);
    expect(boss[boss.length - 1]?.type).toBe('boss');
    expect(boss.length).toBeGreaterThan(early.length);
  });
});
