import Phaser from 'phaser';

export const IMAGEGEN_ATLAS_KEY = 'imagegen-fantasy-atlas';
export const HERO_DIRECTION_ATLAS_KEY = 'imagegen-hero-direction-atlas';
export const TOWER_DIRECTION_ATLAS_KEY = 'imagegen-tower-direction-atlas';

export const IMAGEGEN_FRAMES = {
  heroIdle: [0, 1, 2, 3],
  heroAttack: [8, 9, 10, 11],
  towerBlaster: [16, 17, 18, 19],
  towerLaser: [24, 25, 26, 27],
  towerForge: [32, 33, 34, 35],
  projectileBlaster: [40, 41, 42, 43],
  projectileLaser: [44, 45, 46, 47],
  projectileForge: [48, 49, 50, 51],
  heroSlash: [52, 53, 54, 55],
  enemyGrunt: [56, 57, 58, 59],
  enemyRunner: [60, 61, 62, 63]
} as const;

export const HERO_DIRECTION_FRAMES = {
  downIdle: [0, 1, 2, 3],
  downAttack: [4, 5, 6, 7],
  rightIdle: [8, 9, 10, 11],
  rightAttack: [12, 13, 14, 15],
  upIdle: [16, 17, 18, 19],
  upAttack: [20, 21, 22, 23],
  leftIdle: [24, 25, 26, 27],
  leftAttack: [28, 29, 30, 31]
} as const;

export const TOWER_DIRECTION_FRAMES = {
  blasterIdle: [0, 1, 2, 3],
  blasterFire: [4, 5, 6, 7],
  laserIdle: [8, 9, 10, 11],
  laserFire: [12, 13, 14, 15],
  forgeIdle: [16, 17, 18, 19],
  forgeActive: [20, 21, 22, 23]
} as const;

export function ensureImagegenAtlasAnimations(scene: Phaser.Scene): void {
  createAnimation(scene, 'hero-idle', IMAGEGEN_ATLAS_KEY, IMAGEGEN_FRAMES.heroIdle, 7);
  createAnimation(scene, 'hero-attack', IMAGEGEN_ATLAS_KEY, IMAGEGEN_FRAMES.heroAttack, 14, 0);
  createAnimation(scene, 'tower-blaster-idle', IMAGEGEN_ATLAS_KEY, IMAGEGEN_FRAMES.towerBlaster, 7);
  createAnimation(scene, 'tower-laser-idle', IMAGEGEN_ATLAS_KEY, IMAGEGEN_FRAMES.towerLaser, 8);
  createAnimation(scene, 'tower-forge-idle', IMAGEGEN_ATLAS_KEY, IMAGEGEN_FRAMES.towerForge, 6);
  createAnimation(scene, 'projectile-blaster-fly', IMAGEGEN_ATLAS_KEY, IMAGEGEN_FRAMES.projectileBlaster, 14);
  createAnimation(scene, 'projectile-laser-fly', IMAGEGEN_ATLAS_KEY, IMAGEGEN_FRAMES.projectileLaser, 18);
  createAnimation(scene, 'projectile-forge-fly', IMAGEGEN_ATLAS_KEY, IMAGEGEN_FRAMES.projectileForge, 13);
  createAnimation(scene, 'hero-slash-fx', IMAGEGEN_ATLAS_KEY, IMAGEGEN_FRAMES.heroSlash, 18, 0);
  createAnimation(scene, 'enemy-grunt-walk', IMAGEGEN_ATLAS_KEY, IMAGEGEN_FRAMES.enemyGrunt, 8);
  createAnimation(scene, 'enemy-runner-walk', IMAGEGEN_ATLAS_KEY, IMAGEGEN_FRAMES.enemyRunner, 12);
  createAnimation(scene, 'enemy-brute-walk', IMAGEGEN_ATLAS_KEY, IMAGEGEN_FRAMES.enemyGrunt, 6);

  if (scene.textures.exists(HERO_DIRECTION_ATLAS_KEY)) {
    createAnimation(scene, 'hero-idle-down', HERO_DIRECTION_ATLAS_KEY, HERO_DIRECTION_FRAMES.downIdle, 7);
    createAnimation(scene, 'hero-attack-down', HERO_DIRECTION_ATLAS_KEY, HERO_DIRECTION_FRAMES.downAttack, 14, 0);
    createAnimation(scene, 'hero-idle-right', HERO_DIRECTION_ATLAS_KEY, HERO_DIRECTION_FRAMES.rightIdle, 7);
    createAnimation(scene, 'hero-attack-right', HERO_DIRECTION_ATLAS_KEY, HERO_DIRECTION_FRAMES.rightAttack, 14, 0);
    createAnimation(scene, 'hero-idle-up', HERO_DIRECTION_ATLAS_KEY, HERO_DIRECTION_FRAMES.upIdle, 7);
    createAnimation(scene, 'hero-attack-up', HERO_DIRECTION_ATLAS_KEY, HERO_DIRECTION_FRAMES.upAttack, 14, 0);
    createAnimation(scene, 'hero-idle-left', HERO_DIRECTION_ATLAS_KEY, HERO_DIRECTION_FRAMES.leftIdle, 7);
    createAnimation(scene, 'hero-attack-left', HERO_DIRECTION_ATLAS_KEY, HERO_DIRECTION_FRAMES.leftAttack, 14, 0);
  }
}

function createAnimation(
  scene: Phaser.Scene,
  key: string,
  texture: string,
  frames: readonly number[],
  frameRate: number,
  repeat = -1
): void {
  if (scene.anims.exists(key)) {
    scene.anims.remove(key);
  }

  scene.anims.create({
    key,
    frames: frames.map((frame) => ({ key: texture, frame })),
    frameRate,
    repeat
  });
}
