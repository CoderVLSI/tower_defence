export type Point = { x: number; y: number };

export type BuildPad = Point & {
  id: string;
  slot: 'top-lane' | 'center' | 'bottom-lane' | 'right-flank';
};

export const ARENA_WIDTH = 1365;
export const ARENA_HEIGHT = 768;

export const ENEMY_PATH: Point[] = [
  { x: 0, y: 316 },
  { x: 230, y: 318 },
  { x: 405, y: 382 },
  { x: 570, y: 354 },
  { x: 735, y: 438 },
  { x: 925, y: 438 },
  { x: 1085, y: 522 },
  { x: 1365, y: 522 }
];

export const BUILD_PADS: BuildPad[] = [
  { id: 'pad-1', x: 300, y: 450, slot: 'bottom-lane' },
  { id: 'pad-2', x: 515, y: 222, slot: 'top-lane' },
  { id: 'pad-3', x: 620, y: 542, slot: 'bottom-lane' },
  { id: 'pad-4', x: 820, y: 305, slot: 'center' },
  { id: 'pad-5', x: 1000, y: 635, slot: 'right-flank' }
];

export function getPadById(id: string): BuildPad | undefined {
  return BUILD_PADS.find((pad) => pad.id === id);
}

export function getPathPoint(index: number): Point {
  return ENEMY_PATH[Math.min(index, ENEMY_PATH.length - 1)];
}
