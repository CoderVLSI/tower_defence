import Phaser from 'phaser';

export type GeneratedTextureKeys = {
  hero: string;
  towers: {
    blaster: string;
    laser: string;
    forge: string;
  };
  enemies: {
    grunt: string;
    runner: string;
    brute: string;
  };
  projectiles: {
    blaster: string;
    laser: string;
    forge: string;
  };
};

export const GENERATED_TEXTURES: GeneratedTextureKeys = {
  hero: 'sheet-hero-champion',
  towers: {
    blaster: 'sheet-tower-blaster',
    laser: 'sheet-tower-laser',
    forge: 'sheet-tower-forge'
  },
  enemies: {
    grunt: 'sheet-enemy-grunt',
    runner: 'sheet-enemy-runner',
    brute: 'sheet-enemy-brute'
  },
  projectiles: {
    blaster: 'sheet-projectile-blaster',
    laser: 'sheet-projectile-laser',
    forge: 'sheet-projectile-forge'
  }
};

export function ensureGeneratedTextures(scene: Phaser.Scene): GeneratedTextureKeys {
  if (!scene.textures.exists(GENERATED_TEXTURES.hero)) {
    addSheet(scene, GENERATED_TEXTURES.hero, 128, 128, 4, (ctx, frame) => drawHero(ctx, frame));
    addSheet(scene, GENERATED_TEXTURES.towers.blaster, 96, 128, 4, (ctx, frame) =>
      drawTower(ctx, frame, { core: '#c85d55', trim: '#ffd5af', gem: '#fff5df', type: 'blaster' })
    );
    addSheet(scene, GENERATED_TEXTURES.towers.laser, 96, 128, 4, (ctx, frame) =>
      drawTower(ctx, frame, { core: '#66ddff', trim: '#dcfdff', gem: '#ffffff', type: 'laser' })
    );
    addSheet(scene, GENERATED_TEXTURES.towers.forge, 96, 128, 4, (ctx, frame) =>
      drawTower(ctx, frame, { core: '#ffa85c', trim: '#ffebbb', gem: '#fff1cc', type: 'forge' })
    );
    addSheet(scene, GENERATED_TEXTURES.enemies.grunt, 128, 128, 4, (ctx, frame) =>
      drawEnemy(ctx, frame, { body: '#dce6f7', visor: '#22334d', weapon: '#6d4b2a', crest: '#b74e4e', scale: 1 })
    );
    addSheet(scene, GENERATED_TEXTURES.enemies.runner, 128, 128, 4, (ctx, frame) =>
      drawEnemy(ctx, frame, { body: '#ffbf77', visor: '#3d2c21', weapon: '#845731', crest: '#ffefb1', scale: 0.84 })
    );
    addSheet(scene, GENERATED_TEXTURES.enemies.brute, 128, 128, 4, (ctx, frame) =>
      drawEnemy(ctx, frame, { body: '#b88cff', visor: '#2a1a4b', weapon: '#6f4128', crest: '#ffd6a7', scale: 1.22 })
    );
    addSheet(scene, GENERATED_TEXTURES.projectiles.blaster, 64, 64, 4, (ctx, frame) =>
      drawProjectile(ctx, frame, { core: '#fff0a6', glow: '#ffb347', shape: 'bolt' })
    );
    addSheet(scene, GENERATED_TEXTURES.projectiles.laser, 80, 64, 4, (ctx, frame) =>
      drawProjectile(ctx, frame, { core: '#ffffff', glow: '#66ddff', shape: 'lance' })
    );
    addSheet(scene, GENERATED_TEXTURES.projectiles.forge, 64, 64, 4, (ctx, frame) =>
      drawProjectile(ctx, frame, { core: '#ffe0a1', glow: '#ff8f45', shape: 'ember' })
    );
  }

  ensureAnimations(scene);
  return GENERATED_TEXTURES;
}

function ensureAnimations(scene: Phaser.Scene): void {
  createAnimation(scene, 'hero-idle', GENERATED_TEXTURES.hero, [0, 1, 2, 1], 6);
  createAnimation(scene, 'hero-attack', GENERATED_TEXTURES.hero, [2, 3, 2, 1], 12);
  createAnimation(scene, 'tower-blaster-idle', GENERATED_TEXTURES.towers.blaster, [0, 1, 2, 1], 5);
  createAnimation(scene, 'tower-laser-idle', GENERATED_TEXTURES.towers.laser, [0, 1, 2, 3], 6);
  createAnimation(scene, 'tower-forge-idle', GENERATED_TEXTURES.towers.forge, [0, 1, 2, 3], 5);
  createAnimation(scene, 'enemy-grunt-walk', GENERATED_TEXTURES.enemies.grunt, [0, 1, 2, 3], 8);
  createAnimation(scene, 'enemy-runner-walk', GENERATED_TEXTURES.enemies.runner, [0, 1, 2, 3], 12);
  createAnimation(scene, 'enemy-brute-walk', GENERATED_TEXTURES.enemies.brute, [0, 1, 2, 3], 6);
  createAnimation(scene, 'projectile-blaster-fly', GENERATED_TEXTURES.projectiles.blaster, [0, 1, 2, 3], 14);
  createAnimation(scene, 'projectile-laser-fly', GENERATED_TEXTURES.projectiles.laser, [0, 1, 2, 3], 18);
  createAnimation(scene, 'projectile-forge-fly', GENERATED_TEXTURES.projectiles.forge, [0, 1, 2, 3], 10);
}

function createAnimation(scene: Phaser.Scene, key: string, texture: string, frames: number[], frameRate: number): void {
  if (scene.anims.exists(key)) {
    return;
  }

  scene.anims.create({
    key,
    frames: frames.map((frame) => ({ key: texture, frame })),
    frameRate,
    repeat: -1
  });
}

function addSheet(
  scene: Phaser.Scene,
  key: string,
  frameWidth: number,
  frameHeight: number,
  frames: number,
  draw: (ctx: CanvasRenderingContext2D, frame: number) => void
): void {
  const canvas = document.createElement('canvas');
  canvas.width = frameWidth * frames;
  canvas.height = frameHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error(`Could not create sprite sheet ${key}`);
  }

  for (let frame = 0; frame < frames; frame += 1) {
    ctx.save();
    ctx.translate(frame * frameWidth, 0);
    draw(ctx, frame);
    ctx.restore();
  }

  const texture = scene.textures.addCanvas(key, canvas);
  if (!texture) {
    throw new Error(`Could not register sprite sheet ${key}`);
  }

  for (let frame = 0; frame < frames; frame += 1) {
    texture.add(frame, 0, frame * frameWidth, 0, frameWidth, frameHeight);
  }
}

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string, alpha = 1): void {
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function roundedRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string): void {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

function drawHero(ctx: CanvasRenderingContext2D, frame: number): void {
  const bob = [0, -3, 0, 2][frame];
  const slash = frame === 3;
  ellipse(ctx, 64, 102, 27, 9, '#000000', 0.2);
  roundedRect(ctx, 43, 61 + bob, 36, 38, 10, '#6b4131');
  ctx.fillStyle = '#7c3cff';
  ctx.beginPath();
  ctx.moveTo(38, 87 + bob);
  ctx.lineTo(64, 28 + bob);
  ctx.lineTo(91, 87 + bob);
  ctx.closePath();
  ctx.fill();
  ellipse(ctx, 64, 38 + bob, 21, 20, '#b764ff');
  ellipse(ctx, 64, 39 + bob, 15, 7, '#18263f');
  ellipse(ctx, 56, 38 + bob, 3, 3, '#f6d6b4');
  ellipse(ctx, 71, 38 + bob, 3, 3, '#f6d6b4');
  ctx.fillStyle = '#ffd966';
  ctx.beginPath();
  ctx.moveTo(64, 10 + bob);
  ctx.lineTo(56, 25 + bob);
  ctx.lineTo(72, 25 + bob);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.translate(slash ? 94 : 89, slash ? 52 + bob : 58 + bob);
  ctx.rotate(slash ? -0.72 : -0.18);
  roundedRect(ctx, -4, -24, 8, 48, 4, '#dce7ff');
  ctx.fillStyle = '#8dc9ff';
  ctx.beginPath();
  ctx.moveTo(0, -36);
  ctx.lineTo(10, -22);
  ctx.lineTo(-10, -22);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawTower(
  ctx: CanvasRenderingContext2D,
  frame: number,
  colors: { core: string; trim: string; gem: string; type: 'blaster' | 'laser' | 'forge' }
): void {
  const pulse = [0, -2, -4, -2][frame];
  ellipse(ctx, 48, 99, 26, 9, '#000000', 0.2);
  roundedRect(ctx, 24, 70, 48, 27, 10, '#41485d');
  ellipse(ctx, 48, 56 + pulse, 24, 24, colors.core);
  ctx.strokeStyle = colors.trim;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(48, 56 + pulse, 24, 24, 0, 0, Math.PI * 2);
  ctx.stroke();
  ellipse(ctx, 48, 56 + pulse, 8, 8, colors.gem);

  if (colors.type === 'blaster') {
    roundedRect(ctx, 35, 22 + pulse, 27, 18, 8, colors.core);
    roundedRect(ctx, 41, 10 + pulse, 14, 30, 5, colors.core);
    roundedRect(ctx, 46, 2 + pulse, 5, 24, 2, colors.trim);
  } else if (colors.type === 'laser') {
    roundedRect(ctx, 36, 13 + pulse, 24, 35, 10, colors.core);
    roundedRect(ctx, 42, 0 + pulse, 12, 27, 6, colors.trim);
    roundedRect(ctx, 46, 0 + pulse, 4, 22, 2, colors.gem);
    ellipse(ctx, 48, 12 + pulse, 14 + frame * 2, 14 + frame * 2, colors.gem, 0.12);
  } else {
    roundedRect(ctx, 29, 18 + pulse, 38, 27, 10, colors.core);
    roundedRect(ctx, 35, 8 + pulse, 8, 25, 3, colors.trim);
    roundedRect(ctx, 53, 8 + pulse, 8, 25, 3, colors.trim);
    ellipse(ctx, 48, 19 + pulse, 8 + frame, 8 + frame, colors.gem, 0.82);
  }
}

function drawEnemy(
  ctx: CanvasRenderingContext2D,
  frame: number,
  palette: { body: string; visor: string; weapon: string; crest: string; scale: number }
): void {
  const sway = [-3, 1, 3, -1][frame];
  const leg = [-4, 3, -2, 4][frame];
  const scale = palette.scale;
  ellipse(ctx, 57 + sway, 101, 23 * scale, 8, '#000000', 0.2);
  ellipse(ctx, 55 + sway, 47, 23 * scale, 18 * scale, palette.body);
  ellipse(ctx, 55 + sway, 46, 12 * scale, 8 * scale, palette.visor);
  ellipse(ctx, 50 + sway, 45, 3 * scale, 3 * scale, '#ffffff');
  ctx.fillStyle = palette.crest;
  ctx.beginPath();
  ctx.moveTo(55 + sway, 18);
  ctx.lineTo(44 + sway, 34);
  ctx.lineTo(66 + sway, 34);
  ctx.closePath();
  ctx.fill();
  roundedRect(ctx, 41 + sway, 62, 30 * scale, 30 * scale, 8, '#584031');
  roundedRect(ctx, 46 + sway - leg, 86, 8, 18, 4, palette.body);
  roundedRect(ctx, 62 + sway + leg, 86, 8, 18, 4, palette.body);
  ctx.save();
  ctx.translate(87 + sway, 57);
  ctx.rotate(0.25 + frame * 0.06);
  roundedRect(ctx, -4, -14, 8 * scale, 38 * scale, 3, palette.weapon);
  ctx.fillStyle = '#b68b59';
  ctx.beginPath();
  ctx.moveTo(0, -29);
  ctx.lineTo(12, -5);
  ctx.lineTo(-12, -5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawProjectile(
  ctx: CanvasRenderingContext2D,
  frame: number,
  palette: { core: string; glow: string; shape: 'bolt' | 'lance' | 'ember' }
): void {
  const pulse = 1 + frame * 0.12;
  ellipse(ctx, 32, 32, 24 * pulse, 16 * pulse, palette.glow, 0.16);

  if (palette.shape === 'lance') {
    ctx.fillStyle = palette.glow;
    ctx.beginPath();
    ctx.moveTo(8, 32);
    ctx.lineTo(54, 22);
    ctx.lineTo(72, 32);
    ctx.lineTo(54, 42);
    ctx.closePath();
    ctx.fill();
    roundedRect(ctx, 15, 28, 42, 8, 4, palette.core);
    return;
  }

  if (palette.shape === 'ember') {
    ellipse(ctx, 32, 32, 13 + frame, 13 + frame, palette.glow, 0.85);
    ellipse(ctx, 32, 32, 7, 7, palette.core);
    ctx.strokeStyle = palette.core;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(32, 32, 18 + frame * 2, frame, frame + Math.PI * 1.2);
    ctx.stroke();
    return;
  }

  ctx.fillStyle = palette.glow;
  ctx.beginPath();
  ctx.moveTo(12, 36);
  ctx.lineTo(34, 12);
  ctx.lineTo(30, 29);
  ctx.lineTo(52, 27);
  ctx.lineTo(30, 52);
  ctx.lineTo(35, 35);
  ctx.closePath();
  ctx.fill();
  ellipse(ctx, 32, 32, 7, 7, palette.core);
}
