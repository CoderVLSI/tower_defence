import { describe, expect, it } from 'vitest';
import { getSpellEffectProfile } from '../src/game/render/spellEffects';

describe('spell effect profiles', () => {
  it('defines distinct visual profiles for every spell', () => {
    expect(getSpellEffectProfile('fire')).toMatchObject({
      color: 0xff6f28,
      accent: 0xffd36b,
      burstCount: 10
    });
    expect(getSpellEffectProfile('reinforce')).toMatchObject({
      color: 0x8cff9d,
      accent: 0xffdf7a,
      burstCount: 2
    });
    expect(getSpellEffectProfile('frost')).toMatchObject({
      color: 0x8beaff,
      accent: 0xe8fcff,
      burstCount: 12
    });
    expect(getSpellEffectProfile('storm')).toMatchObject({
      color: 0xc476ff,
      accent: 0xf2dcff,
      burstCount: 4
    });
  });
});
