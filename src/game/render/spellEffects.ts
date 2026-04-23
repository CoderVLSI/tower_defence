export type SpellEffectKind = 'fire' | 'reinforce' | 'frost' | 'storm';

export type SpellEffectProfile = {
  color: number;
  accent: number;
  burstCount: number;
};

const SPELL_EFFECTS: Record<SpellEffectKind, SpellEffectProfile> = {
  fire: { color: 0xff6f28, accent: 0xffd36b, burstCount: 10 },
  reinforce: { color: 0x8cff9d, accent: 0xffdf7a, burstCount: 2 },
  frost: { color: 0x8beaff, accent: 0xe8fcff, burstCount: 12 },
  storm: { color: 0xc476ff, accent: 0xf2dcff, burstCount: 4 }
};

export function getSpellEffectProfile(kind: SpellEffectKind): SpellEffectProfile {
  return SPELL_EFFECTS[kind];
}
