import { BUILD_PADS, ENEMY_PATH, type BuildPad, type Point } from './arena';
import type { EnemyType, WaveSpawn } from './waves';

export type TerrainTheme =
  | 'meadow'
  | 'ruins'
  | 'marsh'
  | 'canyon'
  | 'snow'
  | 'graveyard'
  | 'lava'
  | 'forest'
  | 'storm'
  | 'citadel';

export type CampaignLevel = {
  id: number;
  name: string;
  theme: TerrainTheme;
  difficulty: 'easy' | 'normal' | 'hard' | 'boss';
  lives: number;
  coins: number;
  maxWave: number;
  path: Point[];
  alternatePaths?: Point[][];
  pads: BuildPad[];
  enemyPool: EnemyType[];
  boss?: EnemyType;
  intro: string;
};

const shiftPath = (points: Point[], offsetY: number): Point[] =>
  points.map((point) => ({ x: point.x, y: Math.max(120, Math.min(660, point.y + offsetY)) }));

const shiftPads = (pads: BuildPad[], offsetY: number): BuildPad[] =>
  pads.map((pad) => ({ ...pad, y: Math.max(160, Math.min(680, pad.y + offsetY)) }));

const BROKEN_WATCH_PATH: Point[] = [
  { x: 0, y: 230 },
  { x: 170, y: 230 },
  { x: 325, y: 320 },
  { x: 500, y: 255 },
  { x: 680, y: 255 },
  { x: 845, y: 360 },
  { x: 1030, y: 360 },
  { x: 1365, y: 505 }
];

const SPIDER_MARSH_PATH: Point[] = [
  { x: 0, y: 380 },
  { x: 190, y: 380 },
  { x: 320, y: 300 },
  { x: 480, y: 405 },
  { x: 650, y: 405 },
  { x: 810, y: 315 },
  { x: 1010, y: 390 },
  { x: 1365, y: 390 }
];

const FROST_MILL_PATH: Point[] = [
  { x: 0, y: 205 },
  { x: 230, y: 205 },
  { x: 405, y: 270 },
  { x: 600, y: 215 },
  { x: 760, y: 315 },
  { x: 950, y: 315 },
  { x: 1120, y: 420 },
  { x: 1365, y: 420 }
];

const GRAVE_LANTERNS_PATH: Point[] = [
  { x: 0, y: 470 },
  { x: 215, y: 470 },
  { x: 360, y: 360 },
  { x: 520, y: 450 },
  { x: 690, y: 450 },
  { x: 850, y: 330 },
  { x: 1045, y: 330 },
  { x: 1365, y: 245 }
];

const ASH_FOUNDRY_PATH: Point[] = [
  { x: 0, y: 335 },
  { x: 180, y: 335 },
  { x: 340, y: 435 },
  { x: 535, y: 435 },
  { x: 690, y: 335 },
  { x: 875, y: 410 },
  { x: 1050, y: 540 },
  { x: 1365, y: 540 }
];

const STORM_CROWN_PATH: Point[] = [
  { x: 0, y: 185 },
  { x: 210, y: 185 },
  { x: 370, y: 300 },
  { x: 550, y: 220 },
  { x: 720, y: 345 },
  { x: 890, y: 255 },
  { x: 1085, y: 385 },
  { x: 1365, y: 385 }
];

export const CAMPAIGN_LEVELS: CampaignLevel[] = [
  {
    id: 1,
    name: 'Greenroad Gate',
    theme: 'meadow',
    difficulty: 'easy',
    lives: 20,
    coins: 190,
    maxWave: 5,
    path: ENEMY_PATH,
    pads: BUILD_PADS,
    enemyPool: ['grunt', 'runner'],
    intro: 'Stop the raiders before they learn the road.'
  },
  {
    id: 2,
    name: 'Broken Watch',
    theme: 'ruins',
    difficulty: 'easy',
    lives: 20,
    coins: 180,
    maxWave: 6,
    path: BROKEN_WATCH_PATH,
    alternatePaths: [
      [
        { x: 0, y: 470 },
        { x: 190, y: 470 },
        { x: 360, y: 390 },
        { x: 545, y: 430 },
        { x: 760, y: 350 },
        { x: 930, y: 415 },
        { x: 1365, y: 415 }
      ]
    ],
    pads: shiftPads(BUILD_PADS, -22),
    enemyPool: ['grunt', 'runner', 'guard'],
    intro: 'Shield guards enter the lane near the ruined tower.'
  },
  {
    id: 3,
    name: 'Spider Marsh',
    theme: 'marsh',
    difficulty: 'normal',
    lives: 18,
    coins: 170,
    maxWave: 6,
    path: SPIDER_MARSH_PATH,
    alternatePaths: [
      [
        { x: 0, y: 230 },
        { x: 210, y: 230 },
        { x: 410, y: 305 },
        { x: 610, y: 250 },
        { x: 800, y: 335 },
        { x: 1020, y: 300 },
        { x: 1365, y: 475 }
      ]
    ],
    pads: shiftPads(BUILD_PADS, 20),
    enemyPool: ['spider', 'runner', 'grunt'],
    intro: 'Fast swarms pressure weak tower coverage.'
  },
  {
    id: 4,
    name: 'Redstone Pass',
    theme: 'canyon',
    difficulty: 'normal',
    lives: 18,
    coins: 170,
    maxWave: 7,
    path: [
      { x: 0, y: 250 },
      { x: 205, y: 250 },
      { x: 390, y: 330 },
      { x: 610, y: 330 },
      { x: 760, y: 430 },
      { x: 980, y: 430 },
      { x: 1140, y: 560 },
      { x: 1365, y: 560 }
    ],
    alternatePaths: [
      [
        { x: 0, y: 495 },
        { x: 180, y: 495 },
        { x: 320, y: 390 },
        { x: 520, y: 455 },
        { x: 760, y: 360 },
        { x: 1000, y: 360 },
        { x: 1365, y: 280 }
      ]
    ],
    pads: shiftPads(BUILD_PADS, -10),
    enemyPool: ['grunt', 'guard', 'knight'],
    intro: 'Heavy knights start testing the middle bends.'
  },
  {
    id: 5,
    name: 'Frost Mill',
    theme: 'snow',
    difficulty: 'hard',
    lives: 17,
    coins: 165,
    maxWave: 7,
    path: FROST_MILL_PATH,
    alternatePaths: [
      [
        { x: 0, y: 500 },
        { x: 220, y: 500 },
        { x: 380, y: 420 },
        { x: 600, y: 470 },
        { x: 790, y: 365 },
        { x: 1010, y: 450 },
        { x: 1365, y: 450 }
      ]
    ],
    pads: shiftPads(BUILD_PADS, -35),
    enemyPool: ['runner', 'flyer', 'wizard', 'guard'],
    intro: 'The cold lane favors flyers and backline casters.'
  },
  {
    id: 6,
    name: 'Grave Lanterns',
    theme: 'graveyard',
    difficulty: 'hard',
    lives: 16,
    coins: 160,
    maxWave: 8,
    path: GRAVE_LANTERNS_PATH,
    alternatePaths: [
      [
        { x: 0, y: 260 },
        { x: 230, y: 260 },
        { x: 415, y: 345 },
        { x: 615, y: 290 },
        { x: 820, y: 390 },
        { x: 1030, y: 330 },
        { x: 1365, y: 330 }
      ]
    ],
    pads: shiftPads(BUILD_PADS, 12),
    enemyPool: ['wizard', 'caster', 'grunt', 'guard'],
    intro: 'Wizards begin healing and protecting the march.'
  },
  {
    id: 7,
    name: 'Ash Foundry',
    theme: 'lava',
    difficulty: 'hard',
    lives: 16,
    coins: 155,
    maxWave: 8,
    path: ASH_FOUNDRY_PATH,
    alternatePaths: [
      [
        { x: 0, y: 190 },
        { x: 220, y: 190 },
        { x: 380, y: 300 },
        { x: 600, y: 260 },
        { x: 830, y: 360 },
        { x: 1030, y: 290 },
        { x: 1365, y: 420 }
      ]
    ],
    pads: shiftPads(BUILD_PADS, 28),
    enemyPool: ['monster', 'guard', 'runner', 'wizard'],
    intro: 'Big armor columns move through the foundry smoke.'
  },
  {
    id: 8,
    name: 'Elderwood Split',
    theme: 'forest',
    difficulty: 'hard',
    lives: 15,
    coins: 160,
    maxWave: 8,
    path: [
      { x: 0, y: 300 },
      { x: 170, y: 300 },
      { x: 360, y: 390 },
      { x: 520, y: 300 },
      { x: 710, y: 390 },
      { x: 900, y: 390 },
      { x: 1080, y: 505 },
      { x: 1365, y: 505 }
    ],
    alternatePaths: [
      [
        { x: 0, y: 500 },
        { x: 190, y: 500 },
        { x: 340, y: 410 },
        { x: 560, y: 470 },
        { x: 760, y: 350 },
        { x: 950, y: 425 },
        { x: 1365, y: 425 }
      ]
    ],
    pads: BUILD_PADS,
    enemyPool: ['flyer', 'spider', 'wizard', 'monster'],
    intro: 'The forest bends hide mixed waves and late flyers.'
  },
  {
    id: 9,
    name: 'Storm Crown',
    theme: 'storm',
    difficulty: 'hard',
    lives: 14,
    coins: 165,
    maxWave: 9,
    path: STORM_CROWN_PATH,
    alternatePaths: [
      [
        { x: 0, y: 520 },
        { x: 220, y: 520 },
        { x: 410, y: 410 },
        { x: 610, y: 500 },
        { x: 800, y: 395 },
        { x: 1035, y: 465 },
        { x: 1365, y: 465 }
      ]
    ],
    pads: shiftPads(BUILD_PADS, -8),
    enemyPool: ['knight', 'wizard', 'flyer', 'monster', 'runner'],
    intro: 'Elite mixed waves arrive under storm cover.'
  },
  {
    id: 10,
    name: 'Citadel Heart',
    theme: 'citadel',
    difficulty: 'boss',
    lives: 12,
    coins: 210,
    maxWave: 10,
    path: [
      { x: 0, y: 285 },
      { x: 225, y: 285 },
      { x: 410, y: 360 },
      { x: 590, y: 320 },
      { x: 760, y: 435 },
      { x: 935, y: 435 },
      { x: 1120, y: 535 },
      { x: 1365, y: 535 }
    ],
    alternatePaths: [
      [
        { x: 0, y: 515 },
        { x: 200, y: 515 },
        { x: 370, y: 420 },
        { x: 560, y: 470 },
        { x: 745, y: 355 },
        { x: 960, y: 400 },
        { x: 1365, y: 260 }
      ]
    ],
    pads: BUILD_PADS,
    enemyPool: ['knight', 'wizard', 'monster', 'flyer', 'spider'],
    boss: 'boss',
    intro: 'The final boss pushes through the citadel road.'
  }
];

export function getCampaignLevel(id: number): CampaignLevel {
  return CAMPAIGN_LEVELS.find((level) => level.id === id) ?? CAMPAIGN_LEVELS[0];
}

export function createCampaignWave(level: CampaignLevel, wave: number): WaveSpawn[] {
  const baseCount = 4 + wave + Math.floor(level.id / 2);
  const cadence = Math.max(280, 760 - wave * 34 - level.id * 14);
  const spawns: WaveSpawn[] = [];

  for (let i = 0; i < baseCount; i += 1) {
    const poolIndex = (i + wave + level.id) % level.enemyPool.length;
    let type = level.enemyPool[poolIndex];

    if (wave >= 3 && i === Math.floor(baseCount / 2) && level.enemyPool.includes('brute')) {
      type = 'brute';
    }

    if (wave >= 4 && i % 5 === 4 && level.enemyPool.includes('caster')) {
      type = 'caster';
    }

    if (level.boss && wave === level.maxWave && i === baseCount - 1) {
      type = level.boss;
    }

    spawns.push({
      id: `level-${level.id}-wave-${wave}-${i}`,
      type,
      delayMs: i * cadence
    });
  }

  return spawns;
}
