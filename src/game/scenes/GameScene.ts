import Phaser from 'phaser';
import { ARENA_HEIGHT, ARENA_WIDTH, BUILD_PADS, ENEMY_PATH } from '../sim/arena';
import {
  TOWER_DEFS,
  getHeroTarget,
  getTowerShot,
  getTowerTint,
  pointInRange,
  type TowerKind
} from '../sim/combat';
import { ensureGeneratedTextures } from '../render/generatedTextures';
import {
  HERO_DIRECTION_ATLAS_KEY,
  HERO_DIRECTION_FRAMES,
  IMAGEGEN_ATLAS_KEY,
  IMAGEGEN_FRAMES,
  TOWER_DIRECTION_ATLAS_KEY,
  TOWER_DIRECTION_FRAMES,
  ensureImagegenAtlasAnimations
} from '../render/imagegenAtlas';
import { createWave, getEnemyStats, type EnemyType } from '../sim/waves';

type HeroDirection = 'down' | 'right' | 'up' | 'left';

type TowerState = {
  padId: string;
  kind: TowerKind;
  sprite: Phaser.GameObjects.Container;
  cooldown: number;
  radius: Phaser.GameObjects.Arc;
  direction: HeroDirection;
  aura?: Phaser.GameObjects.Arc;
};

type EnemyState = {
  id: string;
  type: EnemyType;
  sprite: Phaser.GameObjects.Container;
  hpFill: Phaser.GameObjects.Rectangle;
  hp: number;
  maxHp: number;
  speed: number;
  reward: number;
  pathIndex: number;
  progress: number;
  size: number;
  attackCooldown: number;
  alive: boolean;
};

type AllyState = {
  sprite: Phaser.GameObjects.Container;
  hpFill: Phaser.GameObjects.Rectangle;
  hp: number;
  maxHp: number;
  attackCooldown: number;
  alive: boolean;
};

type ProjectileState = {
  sprite: Phaser.GameObjects.Sprite;
  targetId: string;
  damage: number;
  speed: number;
  kind: TowerKind;
};

type SupportProjectileState = {
  sprite: Phaser.GameObjects.Sprite;
  target: Phaser.Math.Vector2;
  speed: number;
};

type BeamState = {
  graphic: Phaser.GameObjects.Graphics;
  ttl: number;
};

type SpellKind = 'fire' | 'reinforce' | 'frost' | 'storm';

export class GameScene extends Phaser.Scene {
  private selectedTower: TowerKind = 'blaster';
  private coins = 180;
  private lives = 20;
  private wave = 0;
  private maxWave = 8;
  private gameStarted = false;
  private waveInFlight = false;
  private pendingSpawns = 0;
  private waveCooldown = 0;
  private statusText = 'Hold the road';
  private heroText = 'Champion ready';
  private heroTargetCooldown = 0;
  private selectedDescription = TOWER_DEFS.blaster.description;

  private cursors!: {
    up: Phaser.Input.Keyboard.Key;
    down: Phaser.Input.Keyboard.Key;
    left: Phaser.Input.Keyboard.Key;
    right: Phaser.Input.Keyboard.Key;
  };

  private hero!: Phaser.GameObjects.Container;
  private heroRange!: Phaser.GameObjects.Arc;
  private heroSlash!: Phaser.GameObjects.Arc;
  private heroHpFill!: Phaser.GameObjects.Rectangle;
  private heroSpecialFill!: Phaser.GameObjects.Rectangle;
  private heroHp = 100;
  private heroMaxHp = 100;
  private heroSpecial = 0;
  private heroSpecialMax = 100;
  private heroRespawnTimer = 0;
  private heroSpeed = 210;
  private heroRangeValue = 120;
  private useImagegenArt = false;
  private useDirectionalHero = false;
  private useDirectionalTowers = false;
  private heroDirection: HeroDirection = 'down';
  private heroIsAttacking = false;

  private towers: TowerState[] = [];
  private enemies: EnemyState[] = [];
  private allies: AllyState[] = [];
  private projectiles: ProjectileState[] = [];
  private supportProjectiles: SupportProjectileState[] = [];
  private beams: BeamState[] = [];
  private buildPads = new Map<string, Phaser.GameObjects.Container>();
  private selectedSpell?: SpellKind;
  private spellCooldowns: Record<SpellKind, number> = {
    fire: 0,
    reinforce: 0,
    frost: 0,
    storm: 0
  };

  preload(): void {
    this.load.spritesheet(IMAGEGEN_ATLAS_KEY, '/assets/fantasy-sprite-atlas-clean.png', {
      frameWidth: 128,
      frameHeight: 128
    });
    this.load.spritesheet(HERO_DIRECTION_ATLAS_KEY, '/assets/hero-direction-atlas-clean.png', {
      frameWidth: 128,
      frameHeight: 128
    });
    this.load.spritesheet(TOWER_DIRECTION_ATLAS_KEY, '/assets/tower-direction-atlas-clean.png', {
      frameWidth: 128,
      frameHeight: 128
    });
    this.load.spritesheet('reinforcements-sheet', '/assets/reinforcements-sheet.png', {
      frameWidth: 128,
      frameHeight: 128
    });
    this.load.image('plain-arena', '/assets/plain-arena.png');
    this.load.audio('sfx-teleport', '/assets/audio/sfx/hero-teleport-01.mp3');
    this.load.audio('sfx-stab', '/assets/audio/sfx/hero-backstab-01.mp3');
    this.load.audio('sfx-hit', '/assets/audio/sfx/enemy-hit-01.mp3');
    this.load.audio('sfx-reinforce', '/assets/audio/sfx/reinforcements-summon-01.mp3');
  }

  create(): void {
    this.useImagegenArt = this.textures.exists(IMAGEGEN_ATLAS_KEY);
    this.useDirectionalHero = this.textures.exists(HERO_DIRECTION_ATLAS_KEY);
    this.useDirectionalTowers = this.textures.exists(TOWER_DIRECTION_ATLAS_KEY);
    if (this.useImagegenArt) {
      ensureImagegenAtlasAnimations(this);
    } else {
      ensureGeneratedTextures(this);
    }
    this.createArena();
    this.createBuildPads();
    this.createHero();
    this.setupInput();
    this.setupUi();
    this.refreshUi();
  }

  update(_: number, delta: number): void {
    const dt = delta / 1000;
    this.handleHeroMovement(dt);
    this.updateWave(delta);
    this.updateEnemies(dt);
    this.updateTowers(delta);
    this.updateProjectiles(dt);
    this.updateSupportProjectiles(dt);
    this.updateBeams(delta);
    this.updateAllies(delta, dt);
    this.updateEnemyCombat(delta);
    this.updateHeroCombat(delta);
    this.tryAutoHeroSpecial();
    this.updateSpellCooldowns(delta);
    this.refreshUi();
  }

  private createArena(): void {
    const g = this.add.graphics();
    g.setDepth(-2);

    if (this.textures.exists('plain-arena')) {
      this.add
        .image(ARENA_WIDTH / 2, ARENA_HEIGHT / 2, 'plain-arena')
        .setDisplaySize(ARENA_WIDTH, ARENA_HEIGHT)
        .setDepth(-3);
    } else {
      g.fillGradientStyle(0x2f8f6d, 0x4cb08d, 0x3d9f7d, 0x52b594, 1);
      g.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

      for (let i = 0; i < 65; i += 1) {
        const x = 50 + i * 20;
        const y = 80 + (i * 37) % 620;
        g.fillStyle(0x65bf7d, 0.18);
        g.fillEllipse(x, y, 26, 12);
      }
    }

    this.drawRoad(g);
    if (!this.textures.exists('plain-arena')) {
      this.drawCrystals(g);
      this.drawTrees(g);
    }
  }

  private drawRoad(g: Phaser.GameObjects.Graphics): void {
    const drawPolyline = (width: number, color: number, alpha: number) => {
      g.lineStyle(width, color, alpha);
      for (let i = 1; i < ENEMY_PATH.length; i += 1) {
        const a = ENEMY_PATH[i - 1];
        const b = ENEMY_PATH[i];
        g.lineBetween(a.x, a.y, b.x, b.y);
      }
      for (const point of ENEMY_PATH) {
        g.fillStyle(color, alpha);
        g.fillCircle(point.x, point.y, width / 2);
      }
    };

    drawPolyline(106, 0x6b5a32, 0.36);
    drawPolyline(88, 0xc99f4f, 0.96);
    drawPolyline(58, 0xe1c16f, 0.66);

    g.lineStyle(3, 0x7d6233, 0.28);
    for (let i = 0; i < ENEMY_PATH.length - 1; i += 1) {
      const a = ENEMY_PATH[i];
      const b = ENEMY_PATH[i + 1];
      const angle = Math.atan2(b.y - a.y, b.x - a.x);
      const normalX = Math.cos(angle + Math.PI / 2);
      const normalY = Math.sin(angle + Math.PI / 2);
      g.lineBetween(a.x + normalX * 41, a.y + normalY * 41, b.x + normalX * 41, b.y + normalY * 41);
      g.lineBetween(a.x - normalX * 41, a.y - normalY * 41, b.x - normalX * 41, b.y - normalY * 41);
    }
  }

  private drawCrystals(g: Phaser.GameObjects.Graphics): void {
    const crystals = [
      { x: 435, y: 570, s: 0.9 },
      { x: 835, y: 76, s: 0.85 },
      { x: 1075, y: 76, s: 0.82 }
    ];

    for (const crystal of crystals) {
      const scale = crystal.s;
      g.fillStyle(0x76f1ff, 0.25);
      g.fillCircle(crystal.x, crystal.y + 16, 42 * scale);
      g.fillStyle(0x74d2ff, 1);
      g.beginPath();
      g.moveTo(crystal.x, crystal.y - 42 * scale);
      g.lineTo(crystal.x + 20 * scale, crystal.y - 8 * scale);
      g.lineTo(crystal.x + 10 * scale, crystal.y + 36 * scale);
      g.lineTo(crystal.x - 12 * scale, crystal.y + 30 * scale);
      g.lineTo(crystal.x - 22 * scale, crystal.y - 10 * scale);
      g.closePath();
      g.fillPath();
      g.fillStyle(0xbefbff, 0.95);
      g.fillTriangle(
        crystal.x - 14 * scale,
        crystal.y + 18 * scale,
        crystal.x,
        crystal.y - 28 * scale,
        crystal.x + 10 * scale,
        crystal.y + 12 * scale
      );
    }
  }

  private drawTrees(g: Phaser.GameObjects.Graphics): void {
    const trees = [
      { x: 330, y: 38, color: 0xff78ad },
      { x: 1180, y: 84, color: 0x91ea6b }
    ];

    for (const tree of trees) {
      g.fillStyle(0x7b4d35, 1);
      g.fillRect(tree.x - 8, tree.y, 16, 28);
      g.fillStyle(tree.color, 1);
      g.fillCircle(tree.x, tree.y - 8, 28);
    }
  }

  private createBuildPads(): void {
    for (const pad of BUILD_PADS) {
      const container = this.add.container(pad.x, pad.y);
      const shadow = this.add.ellipse(0, 15, 88, 32, 0x000000, 0.2);
      const base = this.add.circle(0, 0, 44, 0x6d746b, 0.95);
      base.setStrokeStyle(4, 0xd9c279, 0.86);
      const inner = this.add.circle(0, -2, 31, 0xa9b0a2, 0.92);
      inner.setStrokeStyle(2, 0x5e654f, 0.42);
      const glow = this.add.circle(0, -2, 54, 0x76f1ff, 0.06);
      glow.setStrokeStyle(2, 0xffd86b, 0.42);
      const spark = this.add.circle(24, 14, 5, 0xff6b5f, 0.9);

      container.add([shadow, glow, base, inner, spark]);
      container.setSize(88, 88);
      container.setInteractive({ useHandCursor: true });
      container.on('pointerover', () => glow.setFillStyle(0x76f1ff, 0.22));
      container.on('pointerout', () => glow.setFillStyle(0x76f1ff, 0.06));
      container.on('pointerdown', () => {
        if (this.selectedSpell) {
          this.castSelectedSpellAt(pad.x, pad.y);
          return;
        }

        this.tryBuildTower(pad.id);
      });
      this.buildPads.set(pad.id, container);
    }
  }

  private createHero(): void {
    const shadow = this.add.ellipse(0, 28, 44, 18, 0x000000, 0.18);
    const sprite = this.add
      .sprite(0, 0, this.getHeroTexture(), this.getHeroFrame())
      .setDisplaySize(this.useImagegenArt ? 84 : 92, this.useImagegenArt ? 84 : 92);
    this.playHeroIdle(sprite);
    const hpBack = this.add.rectangle(-28, -54, 56, 6, 0x140b12, 0.95).setOrigin(0, 0.5);
    hpBack.setStrokeStyle(1, 0xffffff, 0.45);
    this.heroHpFill = this.add.rectangle(-28, -54, 56, 6, 0x7dff7a, 1).setOrigin(0, 0.5);
    const specialBack = this.add.rectangle(-28, -45, 56, 4, 0x160724, 0.95).setOrigin(0, 0.5);
    specialBack.setStrokeStyle(1, 0xe6b8ff, 0.35);
    this.heroSpecialFill = this.add.rectangle(-28, -45, 0, 4, 0xc56bff, 1).setOrigin(0, 0.5);
    this.hero = this.add.container(720, 400, [shadow, sprite, hpBack, this.heroHpFill, specialBack, this.heroSpecialFill]);
    this.hero.setDepth(6);
    this.heroRange = this.add.circle(this.hero.x, this.hero.y, this.heroRangeValue, 0xff8ad8, 0.05);
    this.heroRange.setStrokeStyle(2, 0xff8ad8, 0.18);
    this.heroSlash = this.add.circle(this.hero.x, this.hero.y, 18, 0xffffff, 0);
  }

  private getHeroTexture(): string {
    if (this.useDirectionalHero) {
      return HERO_DIRECTION_ATLAS_KEY;
    }

    return this.useImagegenArt ? IMAGEGEN_ATLAS_KEY : 'sheet-hero-champion';
  }

  private getHeroFrame(): number {
    if (this.useDirectionalHero) {
      return HERO_DIRECTION_FRAMES.downIdle[0];
    }

    return this.useImagegenArt ? IMAGEGEN_FRAMES.heroIdle[0] : 0;
  }

  private getTowerTexture(kind: TowerKind): string {
    if (this.useDirectionalTowers) {
      return TOWER_DIRECTION_ATLAS_KEY;
    }

    if (this.useImagegenArt) {
      return IMAGEGEN_ATLAS_KEY;
    }

    return {
      blaster: 'sheet-tower-blaster',
      laser: 'sheet-tower-laser',
      forge: 'sheet-tower-forge'
    }[kind];
  }

  private getTowerFrame(kind: TowerKind): number {
    if (this.useDirectionalTowers) {
      return this.getTowerDirectionFrame(kind, 'down', false);
    }

    if (!this.useImagegenArt) {
      return 0;
    }

    return {
      blaster: IMAGEGEN_FRAMES.towerBlaster[0],
      laser: IMAGEGEN_FRAMES.towerLaser[0],
      forge: IMAGEGEN_FRAMES.towerForge[0]
    }[kind];
  }

  private getTowerDirectionFrame(kind: TowerKind, direction: HeroDirection, active: boolean): number {
    const index = { down: 0, right: 1, up: 2, left: 3 }[direction];

    if (kind === 'blaster') {
      return (active ? TOWER_DIRECTION_FRAMES.blasterFire : TOWER_DIRECTION_FRAMES.blasterIdle)[index];
    }

    if (kind === 'laser') {
      return (active ? TOWER_DIRECTION_FRAMES.laserFire : TOWER_DIRECTION_FRAMES.laserIdle)[index];
    }

    return (active ? TOWER_DIRECTION_FRAMES.forgeActive : TOWER_DIRECTION_FRAMES.forgeIdle)[index];
  }

  private getEnemyTexture(type: EnemyType): string {
    if (this.useImagegenArt) {
      return IMAGEGEN_ATLAS_KEY;
    }

    return {
      grunt: 'sheet-enemy-grunt',
      runner: 'sheet-enemy-runner',
      brute: 'sheet-enemy-brute'
    }[type];
  }

  private getEnemyFrame(type: EnemyType): number {
    if (!this.useImagegenArt) {
      return 0;
    }

    return type === 'runner' ? IMAGEGEN_FRAMES.enemyRunner[0] : IMAGEGEN_FRAMES.enemyGrunt[0];
  }

  private getReinforcementTexture(): string {
    return this.textures.exists('reinforcements-sheet') ? 'reinforcements-sheet' : this.getHeroTexture();
  }

  private getProjectileTexture(kind: TowerKind): string {
    if (this.useImagegenArt) {
      return IMAGEGEN_ATLAS_KEY;
    }

    return {
      blaster: 'sheet-projectile-blaster',
      laser: 'sheet-projectile-laser',
      forge: 'sheet-projectile-forge'
    }[kind];
  }

  private getProjectileFrame(kind: TowerKind): number {
    if (!this.useImagegenArt) {
      return 0;
    }

    return {
      blaster: IMAGEGEN_FRAMES.projectileBlaster[0],
      laser: IMAGEGEN_FRAMES.projectileLaser[0],
      forge: IMAGEGEN_FRAMES.projectileForge[0]
    }[kind];
  }

  private getHeroSprite(): Phaser.GameObjects.Sprite | undefined {
    return this.hero?.list[1] as Phaser.GameObjects.Sprite | undefined;
  }

  private getDirectionFromVector(dx: number, dy: number): HeroDirection {
    if (Math.abs(dx) > Math.abs(dy)) {
      return dx >= 0 ? 'right' : 'left';
    }

    return dy >= 0 ? 'down' : 'up';
  }

  private playHeroIdle(sprite = this.getHeroSprite()): void {
    if (!sprite) {
      return;
    }

    if (this.useDirectionalHero) {
      sprite.play(`hero-idle-${this.heroDirection}`, true);
      return;
    }

    sprite.play('hero-idle', true);
  }

  private playHeroAttack(sprite = this.getHeroSprite()): void {
    if (!sprite) {
      return;
    }

    if (this.useDirectionalHero) {
      sprite.play(`hero-attack-${this.heroDirection}`, true);
      return;
    }

    sprite.play('hero-attack', true);
  }

  private setupInput(): void {
    this.cursors = this.input.keyboard!.addKeys({
      up: Phaser.Input.Keyboard.KeyCodes.W,
      down: Phaser.Input.Keyboard.KeyCodes.S,
      left: Phaser.Input.Keyboard.KeyCodes.A,
      right: Phaser.Input.Keyboard.KeyCodes.D
    }) as typeof this.cursors;
  }

  private setupUi(): void {
    const shopButtons = document.querySelectorAll<HTMLButtonElement>('.shop-card');
    const nextWaveButton = document.querySelector<HTMLButtonElement>('#next-wave-btn');
    const spellButtons = document.querySelectorAll<HTMLButtonElement>('.ability-slot[data-spell]');

    for (const button of shopButtons) {
      button.addEventListener('click', () => {
        const kind = button.dataset.tower as TowerKind;
        this.selectTower(kind);
      });
    }

    nextWaveButton?.addEventListener('click', () => {
      if (!this.waveInFlight && this.wave < this.maxWave && this.gameStarted) {
        this.startWave();
      }
    });

    for (const button of spellButtons) {
      button.addEventListener('click', () => this.selectSpell(button.dataset.spell as SpellKind));
    }

    document.querySelector<HTMLButtonElement>('#special-btn')?.addEventListener('click', () => this.castHeroSpecial());

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.selectedSpell && !this.isPointerOverBuildPad(pointer.worldX, pointer.worldY)) {
        this.castSelectedSpellAt(pointer.worldX, pointer.worldY);
      }
    });

    window.addEventListener('tower-battles:start-game', () => {
      this.gameStarted = true;
      this.statusText = 'Build towers, then call the first wave';
    });
  }

  private selectTower(kind: TowerKind): void {
    this.selectedTower = kind;
    this.selectedDescription = TOWER_DEFS[kind].description;
    document.querySelectorAll('.shop-card').forEach((button) => {
      button.classList.toggle('active', (button as HTMLButtonElement).dataset.tower === kind);
    });
    this.refreshUi();
  }

  private tryBuildTower(padId: string): void {
    if (this.towers.some((tower) => tower.padId === padId)) {
      this.statusText = 'That pad is already occupied';
      return;
    }

    const def = TOWER_DEFS[this.selectedTower];
    if (this.coins < def.cost) {
      this.statusText = 'Not enough coins';
      return;
    }

    const pad = BUILD_PADS.find((item) => item.id === padId);
    if (!pad) {
      return;
    }

    this.coins -= def.cost;
    const sprite = this.createTowerSprite(pad.x, pad.y - 12, this.selectedTower);
    const radius = this.add.circle(pad.x, pad.y - 12, def.range, getTowerTint(this.selectedTower), 0.04);
    radius.setStrokeStyle(2, getTowerTint(this.selectedTower), 0.14);
    radius.setVisible(false);
    const aura =
      this.selectedTower === 'forge'
        ? this.add.circle(pad.x, pad.y - 12, def.range, 0xffc46c, 0.04).setStrokeStyle(2, 0xffc46c, 0.18)
        : undefined;

    if (aura) {
      aura.setDepth(1);
    }

    this.towers.push({
      padId,
      kind: this.selectedTower,
      sprite,
      cooldown: Phaser.Math.Between(0, 220),
      radius,
      direction: 'down',
      aura
    });

    const padSprite = this.buildPads.get(padId);
    padSprite?.setAlpha(0.7);
    this.statusText = `${def.kind[0].toUpperCase()}${def.kind.slice(1)} tower online`;
  }

  private createTowerSprite(x: number, y: number, kind: TowerKind): Phaser.GameObjects.Container {
    const textureMap = {
      blaster: 'sheet-tower-blaster',
      laser: 'sheet-tower-laser',
      forge: 'sheet-tower-forge'
    } as const;
    const animationMap = {
      blaster: 'tower-blaster-idle',
      laser: 'tower-laser-idle',
      forge: 'tower-forge-idle'
    } as const;
    const shadow = this.add.ellipse(0, 30, 42, 16, 0x000000, 0.18);
    const image = this.add.sprite(0, 0, this.getTowerTexture(kind), this.getTowerFrame(kind)).setDisplaySize(82, 82);
    if (!this.useDirectionalTowers) {
      image.play(animationMap[kind]);
    }
    const sprite = this.add.container(x, y, [shadow, image]);
    sprite.setDepth(5);
    return sprite;
  }

  private startWave(): void {
    this.wave += 1;
    const spawns = createWave(this.wave);
    this.pendingSpawns = spawns.length;
    this.waveInFlight = true;
    this.statusText = `Wave ${this.wave} incoming`;

    for (const spawn of spawns) {
      this.time.delayedCall(spawn.delayMs, () => {
        this.spawnEnemy(spawn.id, spawn.type);
        this.pendingSpawns -= 1;
      });
    }
  }

  private spawnEnemy(id: string, type: EnemyType): void {
    const stats = getEnemyStats(type);
    const textureMap = {
      grunt: 'sheet-enemy-grunt',
      runner: 'sheet-enemy-runner',
      brute: 'sheet-enemy-brute'
    } as const;
    const animationMap = {
      grunt: 'enemy-grunt-walk',
      runner: 'enemy-runner-walk',
      brute: 'enemy-brute-walk'
    } as const;
    const shadow = this.add.ellipse(0, 24, 34, 14, 0x000000, 0.18);
    const image = this.add
      .sprite(0, 0, this.getEnemyTexture(type), this.getEnemyFrame(type))
      .setDisplaySize(type === 'brute' ? 78 : 68, type === 'brute' ? 78 : 68);
    image.play(animationMap[type]);
    const hpBack = this.add.rectangle(-24, -42, 48, 6, 0x170909, 0.95).setOrigin(0, 0.5);
    hpBack.setStrokeStyle(1, 0xffffff, 0.38);
    const hpFill = this.add.rectangle(-24, -42, 48, 6, 0xf15b4e, 1).setOrigin(0, 0.5);
    const sprite = this.add.container(ENEMY_PATH[0].x, ENEMY_PATH[0].y, [shadow, image, hpBack, hpFill]);
    sprite.setDepth(6);

    this.enemies.push({
      id,
      type,
      sprite,
      hpFill,
      hp: stats.maxHealth,
      maxHp: stats.maxHealth,
      speed: stats.speed,
      reward: stats.reward,
      pathIndex: 1,
      progress: 0,
      size: stats.size,
      attackCooldown: Phaser.Math.Between(250, 650),
      alive: true
    });
  }

  private updateWave(delta: number): void {
    if (this.waveInFlight && this.pendingSpawns <= 0 && this.enemies.every((enemy) => !enemy.alive)) {
      this.waveInFlight = false;
      this.waveCooldown += delta;
      if (this.wave < this.maxWave) {
        this.statusText = 'Wave cleared. Hit Call Wave when ready.';
      } else {
        this.statusText = 'All waves cleared. Arena secured.';
      }
    }

    if (!this.waveInFlight && this.wave === 0) {
      this.statusText = 'Build towers, then call the first wave';
    }
  }

  private updateEnemies(dt: number): void {
    for (const enemy of this.enemies) {
      if (!enemy.alive) {
        continue;
      }

      const target = ENEMY_PATH[enemy.pathIndex];
      if (!target) {
        enemy.alive = false;
        enemy.sprite.destroy();
        this.lives = Math.max(0, this.lives - 1);
        this.statusText = 'An enemy slipped through';
        continue;
      }

      const dx = target.x - enemy.sprite.x;
      const dy = target.y - enemy.sprite.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const step = enemy.speed * dt;

      if (distance <= step) {
        enemy.sprite.setPosition(target.x, target.y);
        enemy.pathIndex += 1;
      } else {
        enemy.sprite.setPosition(enemy.sprite.x + (dx / distance) * step, enemy.sprite.y + (dy / distance) * step);
      }

      const image = enemy.sprite.list[1] as Phaser.GameObjects.Sprite | undefined;
      if (image) {
        image.rotation = Math.atan2(dy, dx) * 0.08;
      }

      enemy.progress = (enemy.pathIndex - 1) + Math.min(0.99, step / Math.max(distance, 1));
    }

    this.enemies = this.enemies.filter((enemy) => enemy.alive);
  }

  private updateTowers(delta: number): void {
    const combatEnemies = this.enemies.map((enemy) => ({
      id: enemy.id,
      x: enemy.sprite.x,
      y: enemy.sprite.y,
      progress: enemy.progress
    }));

    for (const tower of this.towers) {
      tower.cooldown -= delta * this.getForgeMultiplier(tower);

      const occupiedPad = BUILD_PADS.find((pad) => pad.id === tower.padId);
      if (!occupiedPad) {
        continue;
      }

      const facingTarget = combatEnemies
        .filter((enemy) => pointInRange({ x: occupiedPad.x, y: occupiedPad.y - 12 }, enemy, TOWER_DEFS[tower.kind].range))
        .sort((left, right) => right.progress - left.progress)[0];
      if (facingTarget) {
        this.faceTower(tower, facingTarget.x - occupiedPad.x, facingTarget.y - (occupiedPad.y - 12), false);
      }

      const hovered = pointInRange(
        { x: occupiedPad.x, y: occupiedPad.y },
        { x: this.input.activePointer.worldX, y: this.input.activePointer.worldY },
        42
      );
      tower.radius.setVisible(hovered);

      if (tower.kind === 'forge') {
        if (tower.cooldown <= 0) {
          tower.cooldown = TOWER_DEFS.forge.cooldownMs;
          this.coins += 10;
          this.setTowerFrame(tower, true);
          this.time.delayedCall(220, () => this.setTowerFrame(tower, false));
          this.launchSupportProjectile(occupiedPad.x, occupiedPad.y - 12);
          this.pulseCircle(occupiedPad.x, occupiedPad.y - 12, 0xffc46c);
          this.statusText = 'Forge minted bonus coins';
        }
        continue;
      }

      if (tower.cooldown > 0) {
        continue;
      }

      const shot = getTowerShot(
        {
          x: occupiedPad.x,
          y: occupiedPad.y - 12,
          range: TOWER_DEFS[tower.kind].range,
          damage: TOWER_DEFS[tower.kind].damage,
          kind: tower.kind
        },
        combatEnemies
      );

      if (!shot) {
        continue;
      }

      tower.cooldown = TOWER_DEFS[tower.kind].cooldownMs;

      const targetEnemy = this.enemies.find((enemy) => enemy.id === shot.targetId);
      if (targetEnemy) {
        this.faceTower(tower, targetEnemy.sprite.x - occupiedPad.x, targetEnemy.sprite.y - (occupiedPad.y - 12), true);
        this.time.delayedCall(220, () => this.setTowerFrame(tower, false));
      }

      this.launchTowerProjectile(tower.kind, occupiedPad.x, occupiedPad.y - 12, shot.targetId, shot.damage);
    }
  }

  private getTowerSprite(tower: TowerState): Phaser.GameObjects.Sprite | undefined {
    return tower.sprite.list[1] as Phaser.GameObjects.Sprite | undefined;
  }

  private faceTower(tower: TowerState, dx: number, dy: number, active: boolean): void {
    tower.direction = this.getDirectionFromVector(dx, dy);
    this.setTowerFrame(tower, active);
  }

  private setTowerFrame(tower: TowerState, active: boolean): void {
    if (!this.useDirectionalTowers) {
      return;
    }

    this.getTowerSprite(tower)?.setFrame(this.getTowerDirectionFrame(tower.kind, tower.direction, active));
  }

  private launchTowerProjectile(kind: TowerKind, x: number, y: number, targetId: string, damage: number): void {
    const textureMap = {
      blaster: 'sheet-projectile-blaster',
      laser: 'sheet-projectile-laser',
      forge: 'sheet-projectile-forge'
    } as const;
    const animationMap = {
      blaster: 'projectile-blaster-fly',
      laser: 'projectile-laser-fly',
      forge: 'projectile-forge-fly'
    } as const;
    const projectile = this.add.sprite(x, y, this.getProjectileTexture(kind), this.getProjectileFrame(kind));
    projectile.setDepth(8);
    projectile.setDisplaySize(kind === 'laser' ? 58 : 34, kind === 'laser' ? 42 : 34);
    projectile.play(animationMap[kind]);
    this.projectiles.push({
      sprite: projectile,
      targetId,
      damage,
      speed: kind === 'laser' ? 560 : 390,
      kind
    });
  }

  private launchSupportProjectile(x: number, y: number): void {
    const nearbyTower = this.towers
      .map((tower) => BUILD_PADS.find((pad) => pad.id === tower.padId))
      .filter((pad): pad is NonNullable<typeof pad> => Boolean(pad))
      .filter((pad) => pointInRange({ x, y }, { x: pad.x, y: pad.y - 12 }, TOWER_DEFS.forge.range))
      .sort((left, right) => left.x - right.x)[0];
    const target = nearbyTower ? new Phaser.Math.Vector2(nearbyTower.x, nearbyTower.y - 12) : new Phaser.Math.Vector2(x, y - 56);
    const sprite = this.add.sprite(x, y, this.getProjectileTexture('forge'), this.getProjectileFrame('forge'));
    sprite.setDepth(7);
    sprite.setDisplaySize(32, 32);
    sprite.play('projectile-forge-fly');
    this.supportProjectiles.push({ sprite, target, speed: 180 });
  }

  private getForgeMultiplier(tower: TowerState): number {
    const sourcePad = BUILD_PADS.find((pad) => pad.id === tower.padId);
    if (!sourcePad || tower.kind === 'forge') {
      return 1;
    }

    const boosted = this.towers.some((candidate) => {
      if (candidate.kind !== 'forge') {
        return false;
      }
      const forgePad = BUILD_PADS.find((pad) => pad.id === candidate.padId);
      return forgePad
        ? pointInRange(
            { x: forgePad.x, y: forgePad.y - 12 },
            { x: sourcePad.x, y: sourcePad.y - 12 },
            TOWER_DEFS.forge.range
          )
        : false;
    });

    return boosted ? 1.35 : 1;
  }

  private updateProjectiles(dt: number): void {
    for (const projectile of this.projectiles) {
      const enemy = this.enemies.find((item) => item.id === projectile.targetId);
      if (!enemy) {
        projectile.sprite.destroy();
        continue;
      }

      const dx = enemy.sprite.x - projectile.sprite.x;
      const dy = enemy.sprite.y - projectile.sprite.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const step = projectile.speed * dt;
      projectile.sprite.rotation = Math.atan2(dy, dx);

      if (distance <= step) {
        this.damageEnemy(enemy, projectile.damage);
        this.pulseCircle(enemy.sprite.x, enemy.sprite.y, projectile.kind === 'laser' ? 0x89f0ff : 0xfff4a0);
        if (projectile.kind === 'laser') {
          const beam = this.add.graphics();
          beam.lineStyle(3, 0x89f0ff, 0.85);
          beam.lineBetween(projectile.sprite.x, projectile.sprite.y, enemy.sprite.x, enemy.sprite.y);
          this.beams.push({ graphic: beam, ttl: TOWER_DEFS.laser.beamDurationMs ?? 140 });
        }
        projectile.sprite.destroy();
        continue;
      }

      projectile.sprite.setPosition(
        projectile.sprite.x + (dx / distance) * step,
        projectile.sprite.y + (dy / distance) * step
      );
    }

    this.projectiles = this.projectiles.filter((projectile) => projectile.sprite.active);
  }

  private updateSupportProjectiles(dt: number): void {
    for (const projectile of this.supportProjectiles) {
      const dx = projectile.target.x - projectile.sprite.x;
      const dy = projectile.target.y - projectile.sprite.y;
      const distance = Math.sqrt(dx * dx + dy * dy);
      const step = projectile.speed * dt;

      if (distance <= step) {
        this.pulseCircle(projectile.target.x, projectile.target.y, 0xffc46c);
        projectile.sprite.destroy();
        continue;
      }

      projectile.sprite.rotation += dt * 6;
      projectile.sprite.setPosition(
        projectile.sprite.x + (dx / distance) * step,
        projectile.sprite.y + (dy / distance) * step
      );
    }

    this.supportProjectiles = this.supportProjectiles.filter((projectile) => projectile.sprite.active);
  }

  private updateBeams(delta: number): void {
    for (const beam of this.beams) {
      beam.ttl -= delta;
      if (beam.ttl <= 0) {
        beam.graphic.destroy();
      }
    }

    this.beams = this.beams.filter((beam) => beam.graphic.active);
  }

  private updateAllies(delta: number, dt: number): void {
    for (const ally of this.allies) {
      if (!ally.alive) {
        continue;
      }

      ally.attackCooldown -= delta;
      const target = this.getNearestEnemy(ally.sprite.x, ally.sprite.y, 150);
      if (!target) {
        ally.sprite.y += Math.sin(this.time.now / 180 + ally.sprite.x) * dt * 8;
        continue;
      }

      const dx = target.sprite.x - ally.sprite.x;
      const dy = target.sprite.y - ally.sprite.y;
      const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
      const image = ally.sprite.list[1] as Phaser.GameObjects.Sprite | undefined;
      if (image) {
        image.flipX = dx < 0;
      }

      if (distance > 42) {
        ally.sprite.setPosition(ally.sprite.x + (dx / distance) * 70 * dt, ally.sprite.y + (dy / distance) * 70 * dt);
        continue;
      }

      if (ally.attackCooldown <= 0) {
        ally.attackCooldown = 760;
        this.damageEnemy(target, 14);
        this.playProceduralSfx('stab');
        this.tweens.add({
          targets: ally.sprite,
          x: ally.sprite.x + (dx / distance) * 10,
          y: ally.sprite.y + (dy / distance) * 10,
          duration: 70,
          yoyo: true
        });
      }
    }

    this.allies = this.allies.filter((ally) => ally.alive);
  }

  private updateEnemyCombat(delta: number): void {
    for (const enemy of this.enemies) {
      if (!enemy.alive) {
        continue;
      }

      enemy.attackCooldown -= delta;
      const heroDistance = Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, this.hero.x, this.hero.y);
      const ally = this.allies
        .filter((candidate) => candidate.alive)
        .sort(
          (left, right) =>
            Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, left.sprite.x, left.sprite.y) -
            Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, right.sprite.x, right.sprite.y)
        )[0];
      const allyDistance = ally ? Phaser.Math.Distance.Between(enemy.sprite.x, enemy.sprite.y, ally.sprite.x, ally.sprite.y) : Infinity;

      if (enemy.attackCooldown > 0) {
        continue;
      }

      if (heroDistance <= 58 && this.heroHp > 0) {
        enemy.attackCooldown = 900;
        this.damageHero(enemy.type === 'brute' ? 15 : 8);
        this.playProceduralSfx('hit');
        continue;
      }

      if (ally && allyDistance <= 46) {
        enemy.attackCooldown = 900;
        this.damageAlly(ally, enemy.type === 'brute' ? 18 : 10);
        this.playProceduralSfx('hit');
      }
    }
  }

  private updateSpellCooldowns(delta: number): void {
    for (const kind of Object.keys(this.spellCooldowns) as SpellKind[]) {
      this.spellCooldowns[kind] = Math.max(0, this.spellCooldowns[kind] - delta);
    }
  }

  private selectSpell(kind: SpellKind): void {
    if (!this.gameStarted) {
      this.statusText = 'Start the battle first';
      return;
    }

    if (this.spellCooldowns[kind] > 0) {
      this.statusText = 'Spell is recharging';
      return;
    }

    this.selectedSpell = this.selectedSpell === kind ? undefined : kind;
    this.statusText = this.selectedSpell ? `Click the map to cast ${kind}` : 'Spell cancelled';
    this.refreshUi();
  }

  private castSelectedSpellAt(x: number, y: number): void {
    if (!this.selectedSpell) {
      return;
    }

    this.castSpellAt(this.selectedSpell, x, y);
    this.selectedSpell = undefined;
    this.refreshUi();
  }

  private castSpellAt(kind: SpellKind, targetX: number, targetY: number): void {
    if (!this.gameStarted || this.spellCooldowns[kind] > 0) {
      return;
    }

    if (kind === 'fire') {
      this.spellCooldowns.fire = 5200;
      this.damageEnemiesInRadius(targetX, targetY, 92, 52, 0xff6f28);
      this.statusText = 'Fireball scorched the target zone';
      return;
    }

    if (kind === 'reinforce') {
      this.spellCooldowns.reinforce = 7800;
      this.spawnReinforcements(targetX, targetY);
      this.statusText = 'Bare soldiers joined the fight';
      return;
    }

    if (kind === 'frost') {
      this.spellCooldowns.frost = 6100;
      this.damageEnemiesInRadius(targetX, targetY, 115, 24, 0x8beaff);
      for (const enemy of this.enemies) {
        if (pointInRange({ x: targetX, y: targetY }, { x: enemy.sprite.x, y: enemy.sprite.y }, 115)) {
          const image = enemy.sprite.list[1] as Phaser.GameObjects.Sprite | undefined;
          image?.setTint(0x9befff);
          this.time.delayedCall(650, () => image?.clearTint());
        }
      }
      this.statusText = 'Frost burst hit the push';
      return;
    }

    this.spellCooldowns.storm = 7600;
    this.damageEnemiesInRadius(targetX, targetY, 170, 34, 0xc476ff);
    this.statusText = 'Arcane storm cracked the target zone';
  }

  private getNearestEnemy(x: number, y: number, radius: number): EnemyState | undefined {
    return this.enemies
      .filter((enemy) => enemy.alive && pointInRange({ x, y }, { x: enemy.sprite.x, y: enemy.sprite.y }, radius))
      .sort((left, right) => {
        const leftDistance = Phaser.Math.Distance.Between(x, y, left.sprite.x, left.sprite.y);
        const rightDistance = Phaser.Math.Distance.Between(x, y, right.sprite.x, right.sprite.y);
        return leftDistance - rightDistance;
      })[0];
  }

  private spawnReinforcements(x: number, y: number): void {
    const offsets = [
      { x: -24, y: 16, frame: 0 },
      { x: 24, y: -12, frame: 4 }
    ];

    for (const offset of offsets) {
      const shadow = this.add.ellipse(0, 20, 30, 12, 0x000000, 0.2);
      const image = this.add
        .sprite(0, 0, this.getReinforcementTexture(), offset.frame)
        .setDisplaySize(this.textures.exists('reinforcements-sheet') ? 58 : 54, this.textures.exists('reinforcements-sheet') ? 58 : 54);
      const hpBack = this.add.rectangle(-21, -34, 42, 5, 0x0b130b, 0.95).setOrigin(0, 0.5);
      hpBack.setStrokeStyle(1, 0xffffff, 0.35);
      const hpFill = this.add.rectangle(-21, -34, 42, 5, 0x74dc76, 1).setOrigin(0, 0.5);
      const sprite = this.add.container(
        Phaser.Math.Clamp(x + offset.x, 70, ARENA_WIDTH - 70),
        Phaser.Math.Clamp(y + offset.y, 70, ARENA_HEIGHT - 70),
        [shadow, image, hpBack, hpFill]
      );
      sprite.setDepth(6);
      this.allies.push({
        sprite,
        hpFill,
        hp: 58,
        maxHp: 58,
        attackCooldown: Phaser.Math.Between(120, 420),
        alive: true
      });
    }

    this.damageEnemiesInRadius(x, y, 68, 0, 0x8cff9d);
    this.playProceduralSfx('reinforce');
  }

  private isPointerOverBuildPad(x: number, y: number): boolean {
    return BUILD_PADS.some((pad) => pointInRange({ x: pad.x, y: pad.y }, { x, y }, 48));
  }

  private tryAutoHeroSpecial(): void {
    if (this.heroSpecial >= this.heroSpecialMax && this.enemies.some((enemy) => enemy.alive)) {
      this.castHeroSpecial();
    }
  }

  private castHeroSpecial(): void {
    if (this.heroSpecial < this.heroSpecialMax) {
      return;
    }

    const target = this.enemies
      .filter((enemy) => enemy.alive)
      .sort((left, right) => {
        if (right.hp !== left.hp) {
          return right.hp - left.hp;
        }

        return right.progress - left.progress;
      })[0];

    if (!target) {
      return;
    }

    this.heroSpecial = 0;
    const startX = this.hero.x;
    const startY = this.hero.y;
    const behindX = Phaser.Math.Clamp(target.sprite.x - 38, 90, ARENA_WIDTH - 140);
    const behindY = Phaser.Math.Clamp(target.sprite.y + 20, 90, ARENA_HEIGHT - 90);
    this.heroDirection = this.getDirectionFromVector(target.sprite.x - behindX, target.sprite.y - behindY);
    this.createTeleportFx(startX, startY, true);
    this.playProceduralSfx('teleport');
    this.hero.setPosition(behindX, behindY);
    this.createTeleportFx(behindX, behindY, false);
    this.playHeroAttack();
    this.createBackstabFx(target.sprite.x, target.sprite.y);
    this.pulseCircle(behindX, behindY, 0xc56bff);
    this.time.delayedCall(120, () => {
      this.damageEnemy(target, target.hp);
      this.pulseCircle(target.sprite.x, target.sprite.y, 0xffffff);
      this.playProceduralSfx('stab');
    });
    this.time.delayedCall(300, () => {
      this.createTeleportFx(this.hero.x, this.hero.y, true);
      this.playProceduralSfx('teleport');
      this.hero.setPosition(startX, startY);
      this.createTeleportFx(startX, startY, false);
      this.playHeroIdle();
    });
    this.heroText = 'Shadow Sneaker executed a backstab';
    this.statusText = 'Shadow Sneaker vanished behind the strongest enemy';
  }

  private createTeleportFx(x: number, y: number, departing: boolean): void {
    const ring = this.add.circle(x, y, departing ? 18 : 8, 0x9b5cff, 0.24);
    ring.setStrokeStyle(4, 0xf0d6ff, 0.7);
    ring.setDepth(10);
    this.tweens.add({
      targets: ring,
      scaleX: departing ? 3.2 : 4,
      scaleY: departing ? 1.5 : 2.3,
      alpha: 0,
      duration: departing ? 220 : 280,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy()
    });

    for (let i = 0; i < 9; i += 1) {
      const mote = this.add.circle(x, y, Phaser.Math.Between(3, 6), 0x2a0a44, 0.72);
      mote.setDepth(10);
      const angle = (Math.PI * 2 * i) / 9 + Phaser.Math.FloatBetween(-0.2, 0.2);
      const distance = Phaser.Math.Between(18, 50);
      this.tweens.add({
        targets: mote,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance * 0.55,
        alpha: 0,
        scaleX: 0.2,
        scaleY: 0.2,
        duration: 260,
        onComplete: () => mote.destroy()
      });
    }
  }

  private createBackstabFx(x: number, y: number): void {
    const slash = this.add.graphics();
    slash.setDepth(11);
    slash.lineStyle(8, 0xffffff, 0.95);
    slash.lineBetween(x - 34, y - 30, x + 32, y + 24);
    slash.lineStyle(4, 0xc56bff, 0.95);
    slash.lineBetween(x - 24, y + 24, x + 36, y - 28);
    this.tweens.add({
      targets: slash,
      alpha: 0,
      scaleX: 1.35,
      scaleY: 1.35,
      duration: 220,
      ease: 'Quad.easeOut',
      onComplete: () => slash.destroy()
    });

    const burst = this.add.star(x, y, 7, 8, 38, 0xfff6d6, 0.75);
    burst.setDepth(10);
    this.tweens.add({
      targets: burst,
      alpha: 0,
      angle: 80,
      scaleX: 1.45,
      scaleY: 1.45,
      duration: 200,
      onComplete: () => burst.destroy()
    });
  }

  private damageEnemiesInRadius(x: number, y: number, radius: number, damage: number, color: number): void {
    const marker = this.add.circle(x, y, radius, color, 0.16);
    marker.setStrokeStyle(4, color, 0.5);
    this.tweens.add({
      targets: marker,
      alpha: 0,
      scaleX: 1.25,
      scaleY: 1.25,
      duration: 260,
      onComplete: () => marker.destroy()
    });

    for (const enemy of [...this.enemies]) {
      if (enemy.alive && pointInRange({ x, y }, { x: enemy.sprite.x, y: enemy.sprite.y }, radius)) {
        if (damage > 0) {
          this.damageEnemy(enemy, damage);
        }
      }
    }
  }

  private updateHeroCombat(delta: number): void {
    this.heroTargetCooldown -= delta;
    this.heroRange.setPosition(this.hero.x, this.hero.y);
    this.heroSlash.setPosition(this.hero.x, this.hero.y);

    if (this.heroTargetCooldown > 0) {
      return;
    }

    const target = getHeroTarget(
      { x: this.hero.x, y: this.hero.y, range: this.heroRangeValue },
      this.enemies.map((enemy) => ({
        id: enemy.id,
        x: enemy.sprite.x,
        y: enemy.sprite.y,
        progress: enemy.progress
      }))
    );

    if (!target) {
      this.heroText = 'Champion patrolling';
      return;
    }

    const enemy = this.enemies.find((item) => item.id === target.id);
    if (!enemy) {
      return;
    }

    this.heroTargetCooldown = 650;
    const startX = this.hero.x;
    const startY = this.hero.y;
    const dx = enemy.sprite.x - this.hero.x;
    const dy = enemy.sprite.y - this.hero.y;
    const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    this.heroDirection = this.getDirectionFromVector(dx, dy);
    const lungeX = this.hero.x + (dx / distance) * 26;
    const lungeY = this.hero.y + (dy / distance) * 26;
    this.damageEnemy(enemy, 24);
    this.heroSpecial = Math.min(this.heroSpecialMax, this.heroSpecial + 14);
    const heroSprite = this.getHeroSprite();
    this.heroIsAttacking = true;
    this.playHeroAttack(heroSprite);
    this.time.delayedCall(260, () => {
      this.heroIsAttacking = false;
      this.playHeroIdle(heroSprite);
    });
    this.tweens.add({
      targets: this.hero,
      x: lungeX,
      y: lungeY,
      duration: 90,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => this.hero.setPosition(startX, startY)
    });
    if (this.useImagegenArt) {
      const slash = this.add.sprite(enemy.sprite.x, enemy.sprite.y, IMAGEGEN_ATLAS_KEY, IMAGEGEN_FRAMES.heroSlash[0]);
      slash.setDepth(9);
      slash.setDisplaySize(96, 96);
      slash.setRotation(Math.atan2(dy, dx));
      slash.play('hero-slash-fx');
      slash.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => slash.destroy());
    } else {
      const slash = this.add.graphics();
      slash.setDepth(9);
      slash.lineStyle(7, 0xffe8ff, 0.85);
      slash.beginPath();
      slash.arc(enemy.sprite.x, enemy.sprite.y, 38, -0.85, 0.85);
      slash.strokePath();
      this.tweens.add({
        targets: slash,
        alpha: 0,
        scaleX: 1.35,
        scaleY: 1.35,
        duration: 180,
        onComplete: () => slash.destroy()
      });
    }
    this.heroSlash.setFillStyle(0xff95df, 0.28);
    this.tweens.add({
      targets: this.heroSlash,
      alpha: 0,
      scaleX: 2.6,
      scaleY: 2.6,
      duration: 180,
      onStart: () => {
        this.heroSlash.setScale(1);
      }
    });
    this.heroText = `Champion struck ${enemy.type}`;
  }

  private handleHeroMovement(dt: number): void {
    if (this.heroRespawnTimer > 0) {
      this.heroRespawnTimer -= dt;
      if (this.heroRespawnTimer <= 0) {
        this.heroHp = Math.ceil(this.heroMaxHp * 0.65);
        this.hero.setAlpha(1);
        this.hero.setPosition(720, 400);
        this.statusText = 'Shadow Sneaker returned to the fight';
      }
      this.updateHeroWorldBars();
      return;
    }

    const direction = new Phaser.Math.Vector2(0, 0);
    if (this.cursors.left.isDown) direction.x -= 1;
    if (this.cursors.right.isDown) direction.x += 1;
    if (this.cursors.up.isDown) direction.y -= 1;
    if (this.cursors.down.isDown) direction.y += 1;

    direction.normalize();

    if (direction.lengthSq() > 0 && !this.heroIsAttacking) {
      this.heroDirection = this.getDirectionFromVector(direction.x, direction.y);
      this.playHeroIdle();
    }

    this.hero.x = Phaser.Math.Clamp(this.hero.x + direction.x * this.heroSpeed * dt, 90, ARENA_WIDTH - 140);
    this.hero.y = Phaser.Math.Clamp(this.hero.y + direction.y * this.heroSpeed * dt, 90, ARENA_HEIGHT - 90);
    const sprite = this.getHeroSprite();
    if (sprite) {
      sprite.y = Math.sin(this.time.now / 150) * 3;
    }

    this.updateHeroWorldBars();
  }

  private updateHeroWorldBars(): void {
    if (this.heroHpFill) {
      this.heroHpFill.width = 56 * Phaser.Math.Clamp(this.heroHp / this.heroMaxHp, 0, 1);
    }

    if (this.heroSpecialFill) {
      this.heroSpecialFill.width = 56 * Phaser.Math.Clamp(this.heroSpecial / this.heroSpecialMax, 0, 1);
    }
  }

  private damageHero(damage: number): void {
    if (this.heroRespawnTimer > 0) {
      return;
    }

    this.heroHp = Math.max(0, this.heroHp - damage);
    this.updateHeroWorldBars();
    this.tweens.add({
      targets: this.hero,
      alpha: 0.62,
      yoyo: true,
      duration: 70
    });

    if (this.heroHp > 0) {
      this.heroText = 'Shadow Sneaker under attack';
      return;
    }

    this.heroRespawnTimer = 2.2;
    this.hero.setAlpha(0.35);
    this.heroText = 'Shadow Sneaker recovering';
    this.statusText = 'The hero was knocked down';
  }

  private damageAlly(ally: AllyState, damage: number): void {
    ally.hp = Math.max(0, ally.hp - damage);
    ally.hpFill.width = 42 * Phaser.Math.Clamp(ally.hp / ally.maxHp, 0, 1);
    this.tweens.add({
      targets: ally.sprite,
      alpha: 0.64,
      yoyo: true,
      duration: 70
    });

    if (ally.hp > 0) {
      return;
    }

    ally.alive = false;
    this.pulseCircle(ally.sprite.x, ally.sprite.y, 0xffb36b);
    ally.sprite.destroy();
  }

  private damageEnemy(enemy: EnemyState, damage: number): void {
    enemy.hp -= damage;
    enemy.hpFill.width = 48 * Phaser.Math.Clamp(enemy.hp / enemy.maxHp, 0, 1);
    const firstChild = enemy.sprite.list[0];
    if (firstChild && 'setScale' in firstChild) {
      (firstChild as Phaser.GameObjects.Shape).setScale(1.06);
    }
    this.tweens.add({
      targets: enemy.sprite,
      alpha: 0.65,
      yoyo: true,
      duration: 70
    });

    if (enemy.hp > 0) {
      return;
    }

    enemy.alive = false;
    this.coins += enemy.reward;
    this.statusText = `${enemy.type} defeated`;
    this.pulseCircle(enemy.sprite.x, enemy.sprite.y, 0xff7d7d);
    enemy.sprite.destroy();
  }

  private pulseCircle(x: number, y: number, color: number): void {
    const pulse = this.add.circle(x, y, 16, color, 0.32);
    this.tweens.add({
      targets: pulse,
      scaleX: 2.6,
      scaleY: 2.6,
      alpha: 0,
      duration: 240,
      onComplete: () => pulse.destroy()
    });
  }

  private refreshUi(): void {
    const coinsValue = document.querySelector('#coins-value');
    const livesValue = document.querySelector('#lives-value');
    const waveValue = document.querySelector('#wave-value');
    const waveStatus = document.querySelector('#wave-status');
    const selectionName = document.querySelector('#selection-name');
    const selectionCopy = document.querySelector('#selection-copy');
    const heroStatus = document.querySelector('#hero-status');
    const heroHpFill = document.querySelector<HTMLElement>('#hero-hp-fill');
    const heroSpecialFill = document.querySelector<HTMLElement>('#hero-special-fill');
    const nextWaveButton = document.querySelector<HTMLButtonElement>('#next-wave-btn');

    if (coinsValue) coinsValue.textContent = `${this.coins}`;
    if (livesValue) livesValue.textContent = `${this.lives}`;
    if (waveValue) waveValue.textContent = `${Math.max(1, this.wave)} / ${this.maxWave}`;
    if (waveStatus) waveStatus.textContent = this.statusText;
    if (selectionName) selectionName.textContent = this.selectedTower[0].toUpperCase() + this.selectedTower.slice(1);
    if (selectionCopy) selectionCopy.textContent = this.selectedDescription;
    if (heroStatus) heroStatus.textContent = this.heroText;
    if (heroHpFill) heroHpFill.style.width = `${Phaser.Math.Clamp(this.heroHp / this.heroMaxHp, 0, 1) * 100}%`;
    if (heroSpecialFill) {
      heroSpecialFill.style.width = `${Phaser.Math.Clamp(this.heroSpecial / this.heroSpecialMax, 0, 1) * 100}%`;
    }
    if (nextWaveButton) {
      nextWaveButton.disabled = this.waveInFlight || this.wave >= this.maxWave || this.lives <= 0;
      nextWaveButton.textContent = this.wave >= this.maxWave ? 'Final Wave Done' : this.waveInFlight ? 'Wave Active' : 'Call Wave';
    }
    document.querySelectorAll<HTMLButtonElement>('.ability-slot[data-spell]').forEach((button) => {
      const spell = button.dataset.spell as SpellKind;
      const recharging = this.spellCooldowns[spell] > 0;
      button.disabled = !this.gameStarted || recharging;
      button.classList.toggle('cooldown', recharging);
      button.classList.toggle('selected', this.selectedSpell === spell);
    });
  }

  private playProceduralSfx(kind: 'teleport' | 'stab' | 'hit' | 'reinforce'): void {
    const key = {
      teleport: 'sfx-teleport',
      stab: 'sfx-stab',
      hit: 'sfx-hit',
      reinforce: 'sfx-reinforce'
    }[kind];

    if (this.cache.audio.exists(key)) {
      this.sound.play(key, { volume: kind === 'hit' ? 0.28 : 0.36 });
      return;
    }

    const sound = this.sound as Phaser.Sound.WebAudioSoundManager;
    const context = sound.context;
    if (!context) {
      return;
    }

    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.connect(gain);
    gain.connect(context.destination);

    const config = {
      teleport: { start: 780, end: 160, duration: 0.18, volume: 0.055, type: 'sawtooth' as OscillatorType },
      stab: { start: 360, end: 95, duration: 0.09, volume: 0.07, type: 'square' as OscillatorType },
      hit: { start: 150, end: 70, duration: 0.08, volume: 0.045, type: 'triangle' as OscillatorType },
      reinforce: { start: 440, end: 660, duration: 0.16, volume: 0.055, type: 'triangle' as OscillatorType }
    }[kind];

    oscillator.type = config.type;
    oscillator.frequency.setValueAtTime(config.start, now);
    oscillator.frequency.exponentialRampToValueAtTime(config.end, now + config.duration);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(config.volume, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + config.duration);
    oscillator.start(now);
    oscillator.stop(now + config.duration + 0.02);
  }
}
