export type HeroId = 'shadow-sneaker' | 'ember-knight' | 'frost-oracle';

export type HeroProfile = {
  id: HeroId;
  name: string;
  role: string;
  detail: string;
  portraitClass: string;
  available: boolean;
  spriteSet: 'shadow-directional' | 'ember-directional' | 'frost-directional';
  spriteFrameStart: number;
  attackStyle: 'melee' | 'ranged';
  maxHp: number;
  speed: number;
  range: number;
  attackDamage: number;
  attackCooldownMs: number;
  specialGain: number;
  specialName: string;
  autoSpecial: boolean;
  specialColor: string;
};

const HERO_ROSTER: HeroProfile[] = [
  {
    id: 'shadow-sneaker',
    name: 'Shadow Sneaker',
    role: 'Assassin champion',
    detail: 'Teleports automatically when the special bar fills and executes the strongest enemy with a backstab.',
    portraitClass: 'shadow-sneaker',
    available: true,
    spriteSet: 'shadow-directional',
    spriteFrameStart: 0,
    attackStyle: 'melee',
    maxHp: 100,
    speed: 210,
    range: 120,
    attackDamage: 24,
    attackCooldownMs: 650,
    specialGain: 14,
    specialName: 'Execution Backstab',
    autoSpecial: true,
    specialColor: '#c56bff'
  },
  {
    id: 'ember-knight',
    name: 'Ember Knight',
    role: 'Front-line bruiser',
    detail: 'Builds ember charge while fighting, then erupts in a molten shockwave that burns down clustered enemies.',
    portraitClass: 'ember-knight',
    available: true,
    spriteSet: 'ember-directional',
    spriteFrameStart: 0,
    attackStyle: 'melee',
    maxHp: 160,
    speed: 180,
    range: 108,
    attackDamage: 28,
    attackCooldownMs: 760,
    specialGain: 12,
    specialName: 'Molten Stand',
    autoSpecial: true,
    specialColor: '#ff8a38'
  },
  {
    id: 'frost-oracle',
    name: 'Frost Oracle',
    role: 'Control caster',
    detail: 'Fires icy bolts from longer range, then drops Absolute Zero to freeze and shatter the strongest push.',
    portraitClass: 'frost-oracle',
    available: true,
    spriteSet: 'frost-directional',
    spriteFrameStart: 4,
    attackStyle: 'ranged',
    maxHp: 92,
    speed: 188,
    range: 172,
    attackDamage: 20,
    attackCooldownMs: 700,
    specialGain: 15,
    specialName: 'Absolute Zero',
    autoSpecial: true,
    specialColor: '#79d8ff'
  }
];

export function getHeroRoster(): HeroProfile[] {
  return HERO_ROSTER;
}

export function getHeroById(heroId: HeroId): HeroProfile {
  return HERO_ROSTER.find((hero) => hero.id === heroId) ?? HERO_ROSTER[0];
}
