import Phaser from 'phaser';
import { ARENA_HEIGHT, ARENA_WIDTH } from '../sim/arena';
import { createCampaignWave, getCampaignLevel, type CampaignLevel } from '../sim/campaignLevels';
import {
  TOWER_DEFS,
  getHeroTarget,
  getTowerShot,
  getTowerTint,
  pointInRange,
  type TowerKind
} from '../sim/combat';
import { HERO_RESPAWN_SECONDS, getHeroRecoveryProgress, getHeroRegen, getHeroRespawnLabel } from '../sim/hero';
import { getHeroById, type HeroId, type HeroProfile } from '../sim/heroes';
import { getMatchOutcome, type MatchOutcome } from '../sim/matchState';
import { ensureGeneratedTextures } from '../render/generatedTextures';
import {
  EMBER_DIRECTION_ATLAS_KEY,
  FROST_DIRECTION_ATLAS_KEY,
  HERO_DIRECTION_ATLAS_KEY,
  HERO_DIRECTION_FRAMES,
  IMAGEGEN_ATLAS_KEY,
  IMAGEGEN_FRAMES,
  TOWER_DIRECTION_ATLAS_KEY,
  TOWER_DIRECTION_FRAMES,
  ensureImagegenAtlasAnimations
} from '../render/imagegenAtlas';
import { getSpellEffectProfile } from '../render/spellEffects';
import { getEnemyStats, type EnemyType } from '../sim/waves';
import { getBuildMenuState, type BuildMenuState } from '../ui/buildMenu';
import { MAX_TOWER_LEVEL, getSellValue, getTowerManagementState, getTowerStats, getUpgradeCost } from '../ui/towerManagement';

type HeroDirection = 'down' | 'right' | 'up' | 'left';
type TerrainPalette = {
  overlay: number;
  overlayAlpha: number;
  detail: number;
  detailAlpha: number;
  roadEdge: number;
  roadBase: number;
  roadCenter: number;
  roadBorder: number;
};

const ENEMY_TYPES: EnemyType[] = ['grunt', 'runner', 'brute', 'guard', 'flyer', 'caster'];
const CAMPAIGN_ENEMY_TYPES: EnemyType[] = ['spider', 'wizard', 'knight', 'monster', 'boss'];
const ENEMY_TYPE_SHEET_KEY = 'enemy-types-sheet';
const CAMPAIGN_ENEMY_SHEET_KEY = 'campaign-enemies-sheet';
const LEVEL_ARENA_KEY_PREFIX = 'level-arena';

type TowerState = {
  padId: string;
  kind: TowerKind;
  level: number;
  sprite: Phaser.GameObjects.Container;
  levelLabel: Phaser.GameObjects.Text;
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
  path: { x: number; y: number }[];
  pathIndex: number;
  progress: number;
  size: number;
  attackCooldown: number;
  attackLock: number;
  specialCooldown: number;
  spawnedMinions: boolean;
  slowUntil: number;
  alive: boolean;
};

type AllyState = {
  sprite: Phaser.GameObjects.Container;
  hpFill: Phaser.GameObjects.Rectangle;
  hp: number;
  maxHp: number;
  attackCooldown: number;
  attackLock: number;
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
type AudioCue =
  | 'teleport'
  | 'stab'
  | 'hit'
  | 'reinforce'
  | 'campaignStart'
  | 'waveWarning'
  | 'bossRoar'
  | 'wizardHeal'
  | 'towerBlaster'
  | 'towerLaser'
  | 'towerForge'
  | 'towerUpgrade'
  | 'heroFaint'
  | 'victoryReveal';

export class GameScene extends Phaser.Scene {
  private selectedTower: TowerKind = 'blaster';
  private coins = 180;
  private lives = 20;
  private wave = 0;
  private maxWave = 8;
  private gameStarted = false;
  private matchOutcome: MatchOutcome = 'playing';
  private waveInFlight = false;
  private pendingSpawns = 0;
  private waveCooldown = 0;
  private statusText = 'Hold the road';
  private heroText = 'Champion ready';
  private heroTargetCooldown = 0;
  private activeLevel: CampaignLevel = getCampaignLevel(1);
  private selectedHeroId: HeroId = 'shadow-sneaker';
  private selectedHero: HeroProfile = getHeroById('shadow-sneaker');

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
  private heroSecondsSinceDamage = 0;
  private heroSpeed = this.selectedHero.speed;
  private heroRangeValue = this.selectedHero.range;
  private useImagegenArt = false;
  private useDirectionalHero = false;
  private useDirectionalTowers = false;
  private heroDirection: HeroDirection = 'down';
  private heroIsAttacking = false;
  private currentMusic?: Phaser.Sound.BaseSound;

  private towers: TowerState[] = [];
  private enemies: EnemyState[] = [];
  private allies: AllyState[] = [];
  private projectiles: ProjectileState[] = [];
  private supportProjectiles: SupportProjectileState[] = [];
  private beams: BeamState[] = [];
  private buildPads = new Map<string, Phaser.GameObjects.Container>();
  private selectedSpell?: SpellKind;
  private activeBuildPadId?: string;
  private activeTowerPadId?: string;
  private spellCooldowns: Record<SpellKind, number> = {
    fire: 0,
    reinforce: 0,
    frost: 0,
    storm: 0
  };

  private get activePath() {
    return this.activeLevel.path;
  }

  private get activePaths() {
    return [this.activeLevel.path, ...(this.activeLevel.alternatePaths ?? [])];
  }

  private get activePads() {
    return this.activeLevel.pads;
  }

  preload(): void {
    this.load.spritesheet(IMAGEGEN_ATLAS_KEY, '/assets/fantasy-sprite-atlas-clean.png', {
      frameWidth: 128,
      frameHeight: 128
    });
    this.load.spritesheet(HERO_DIRECTION_ATLAS_KEY, '/assets/hero-direction-atlas-clean.png', {
      frameWidth: 128,
      frameHeight: 128
    });
    this.load.spritesheet(EMBER_DIRECTION_ATLAS_KEY, '/assets/ember-direction-atlas-clean.png', {
      frameWidth: 128,
      frameHeight: 128
    });
    this.load.spritesheet(FROST_DIRECTION_ATLAS_KEY, '/assets/frost-direction-atlas-clean.png', {
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
    this.load.spritesheet(ENEMY_TYPE_SHEET_KEY, '/assets/enemy-types-sheet.png', {
      frameWidth: 128,
      frameHeight: 128
    });
    this.load.spritesheet(CAMPAIGN_ENEMY_SHEET_KEY, '/assets/campaign-enemies-sheet.png', {
      frameWidth: 128,
      frameHeight: 128
    });
    for (let levelId = 1; levelId <= 10; levelId += 1) {
      this.load.image(this.getLevelArenaKey(levelId), `/assets/level-arena-${String(levelId).padStart(2, '0')}.png`);
    }
    this.load.image('plain-arena', '/assets/plain-arena.png');
    this.load.audio('sfx-teleport', '/assets/audio/sfx/hero-teleport-01.mp3');
    this.load.audio('sfx-stab', '/assets/audio/sfx/hero-backstab-01.mp3');
    this.load.audio('sfx-hit', '/assets/audio/sfx/enemy-hit-01.mp3');
    this.load.audio('sfx-reinforce', '/assets/audio/sfx/reinforcements-summon-01.mp3');
    this.load.audio('sfx-campaign-start', '/assets/audio/sfx/campaign-level-start-01.mp3');
    this.load.audio('sfx-wave-warning', '/assets/audio/sfx/campaign-wave-warning-01.mp3');
    this.load.audio('sfx-boss-roar', '/assets/audio/sfx/boss-intro-roar-01.mp3');
    this.load.audio('sfx-wizard-heal', '/assets/audio/sfx/wizard-heal-01.mp3');
    this.load.audio('sfx-tower-blaster', '/assets/audio/sfx/tower-blaster-shot-01.mp3');
    this.load.audio('sfx-tower-laser', '/assets/audio/sfx/tower-laser-shot-01.mp3');
    this.load.audio('sfx-tower-forge', '/assets/audio/sfx/tower-forge-shot-01.mp3');
    this.load.audio('sfx-tower-upgrade', '/assets/audio/sfx/tower-upgrade-01.mp3');
    this.load.audio('sfx-hero-faint', '/assets/audio/sfx/hero-faint-01.mp3');
    this.load.audio('ui-victory-reveal', '/assets/audio/ui/ui-victory-screen-show-01.mp3');
    this.load.audio('voice-shadow-sneaker-ready', '/assets/audio/voice/hero-shadow-ready-01.mp3');
    this.load.audio('voice-shadow-sneaker-special', '/assets/audio/voice/hero-shadow-special-01.mp3');
    this.load.audio('voice-shadow-sneaker-faint', '/assets/audio/voice/hero-shadow-faint-01.mp3');
    this.load.audio('voice-shadow-sneaker-respawn', '/assets/audio/voice/hero-shadow-respawn-01.mp3');
    this.load.audio('voice-ember-knight-ready', '/assets/audio/voice/hero-ember-ready-01.mp3');
    this.load.audio('voice-ember-knight-special', '/assets/audio/voice/hero-ember-special-01.mp3');
    this.load.audio('voice-ember-knight-faint', '/assets/audio/voice/hero-ember-faint-01.mp3');
    this.load.audio('voice-ember-knight-respawn', '/assets/audio/voice/hero-ember-respawn-01.mp3');
    this.load.audio('voice-frost-oracle-ready', '/assets/audio/voice/hero-frost-ready-01.mp3');
    this.load.audio('voice-frost-oracle-special', '/assets/audio/voice/hero-frost-special-01.mp3');
    this.load.audio('voice-frost-oracle-faint', '/assets/audio/voice/hero-frost-faint-01.mp3');
    this.load.audio('voice-frost-oracle-respawn', '/assets/audio/voice/hero-frost-respawn-01.mp3');
    this.load.audio('voice-announcer-victory', '/assets/audio/voice/announcer-victory-01.mp3');
    for (let levelId = 1; levelId <= 10; levelId += 1) {
      this.load.audio(`music-level-${levelId}`, `/assets/audio/music/level-music-${String(levelId).padStart(2, '0')}.mp3`);
    }
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
    this.ensureEnemyTypeAnimations();
    this.ensureCampaignEnemyAnimations();
    this.createArena();
    this.createBuildPads();
    this.createHero();
    this.setupInput();
    this.setupUi();
    this.applyHeroProfile(this.selectedHeroId);
    this.refreshUi();
  }

  update(_: number, delta: number): void {
    if (this.matchOutcome !== 'playing') {
      this.refreshUi();
      return;
    }

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
    this.updateEnemySpecials(delta);
    this.updateHeroCombat(delta);
    this.tryAutoHeroSpecial();
    this.updateSpellCooldowns(delta);
    this.checkMatchOutcome();
    this.refreshUi();
  }

  private createArena(): void {
    const g = this.add.graphics();
    g.setDepth(-2);
    const palette = this.getTerrainPalette();
    const generatedArenaKey = this.getLevelArenaKey(this.activeLevel.id);

    if (this.textures.exists(generatedArenaKey)) {
      this.add
        .image(ARENA_WIDTH / 2, ARENA_HEIGHT / 2, generatedArenaKey)
        .setDisplaySize(ARENA_WIDTH, ARENA_HEIGHT)
        .setDepth(-3);
    } else if (this.textures.exists('plain-arena')) {
      this.add
        .image(ARENA_WIDTH / 2, ARENA_HEIGHT / 2, 'plain-arena')
        .setDisplaySize(ARENA_WIDTH, ARENA_HEIGHT)
        .setDepth(-3);
      this.add
        .rectangle(ARENA_WIDTH / 2, ARENA_HEIGHT / 2, ARENA_WIDTH, ARENA_HEIGHT, palette.overlay, palette.overlayAlpha)
        .setDepth(-2.9);
    } else {
      g.fillGradientStyle(palette.overlay, palette.detail, palette.overlay, palette.detail, 1);
      g.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);

      for (let i = 0; i < 65; i += 1) {
        const x = 50 + i * 20;
        const y = 80 + (i * 37) % 620;
        g.fillStyle(0x65bf7d, 0.18);
        g.fillEllipse(x, y, 26, 12);
      }
    }

    if (!this.textures.exists(generatedArenaKey)) {
      this.drawThemeBackdrop(g, palette);
      this.drawThemeDetails(g, palette);
    }
    this.drawRoad(g);
    if (!this.textures.exists('plain-arena')) {
      this.drawCrystals(g);
      this.drawTrees(g);
    }
  }

  private getLevelArenaKey(levelId: number): string {
    return `${LEVEL_ARENA_KEY_PREFIX}-${String(levelId).padStart(2, '0')}`;
  }

  private getTerrainPalette(): TerrainPalette {
    return {
      meadow: {
        overlay: 0x46a867,
        overlayAlpha: 0.16,
        detail: 0xa7da64,
        detailAlpha: 0.18,
        roadEdge: 0x6b5a32,
        roadBase: 0xc99f4f,
        roadCenter: 0xe1c16f,
        roadBorder: 0x7d6233
      },
      ruins: {
        overlay: 0x8d8066,
        overlayAlpha: 0.32,
        detail: 0xb8b09a,
        detailAlpha: 0.22,
        roadEdge: 0x5d5948,
        roadBase: 0xa8966b,
        roadCenter: 0xc6b889,
        roadBorder: 0x6b624c
      },
      marsh: {
        overlay: 0x1d6f63,
        overlayAlpha: 0.4,
        detail: 0x49b7a6,
        detailAlpha: 0.24,
        roadEdge: 0x4d5235,
        roadBase: 0x8d8151,
        roadCenter: 0xb0a365,
        roadBorder: 0x3d4b35
      },
      canyon: {
        overlay: 0xb86235,
        overlayAlpha: 0.44,
        detail: 0xf1a052,
        detailAlpha: 0.2,
        roadEdge: 0x793c25,
        roadBase: 0xc97843,
        roadCenter: 0xe6a260,
        roadBorder: 0x67351f
      },
      snow: {
        overlay: 0xb9ecff,
        overlayAlpha: 0.5,
        detail: 0xffffff,
        detailAlpha: 0.28,
        roadEdge: 0x6d8590,
        roadBase: 0xaac3c9,
        roadCenter: 0xe6f4f7,
        roadBorder: 0x7e9aa6
      },
      graveyard: {
        overlay: 0x4d5a55,
        overlayAlpha: 0.5,
        detail: 0x9a9f8a,
        detailAlpha: 0.18,
        roadEdge: 0x34352e,
        roadBase: 0x77705e,
        roadCenter: 0x9c9277,
        roadBorder: 0x34352e
      },
      lava: {
        overlay: 0x7b2c1d,
        overlayAlpha: 0.58,
        detail: 0xff8b24,
        detailAlpha: 0.26,
        roadEdge: 0x3f241d,
        roadBase: 0x7f5a3c,
        roadCenter: 0xb27b4a,
        roadBorder: 0x2c1c18
      },
      forest: {
        overlay: 0x246e32,
        overlayAlpha: 0.36,
        detail: 0x6bc458,
        detailAlpha: 0.22,
        roadEdge: 0x4b5c2e,
        roadBase: 0x9d8b47,
        roadCenter: 0xd0bb68,
        roadBorder: 0x536434
      },
      storm: {
        overlay: 0x384b82,
        overlayAlpha: 0.52,
        detail: 0x91b4ff,
        detailAlpha: 0.2,
        roadEdge: 0x323a53,
        roadBase: 0x777f98,
        roadCenter: 0xaab4cf,
        roadBorder: 0x2e3550
      },
      citadel: {
        overlay: 0x4a4652,
        overlayAlpha: 0.66,
        detail: 0xb8b0a0,
        detailAlpha: 0.22,
        roadEdge: 0x23232b,
        roadBase: 0x6f6f78,
        roadCenter: 0xb1aca0,
        roadBorder: 0x26262e
      }
    }[this.activeLevel.theme];
  }

  private drawThemeBackdrop(g: Phaser.GameObjects.Graphics, palette: TerrainPalette): void {
    if (this.activeLevel.theme === 'citadel') {
      g.fillStyle(0x3a3940, 0.4);
      g.fillRoundedRect(150, 88, 1060, 560, 18);
      g.lineStyle(2, 0x1f2027, 0.2);
      for (let x = 190; x < 1190; x += 92) g.lineBetween(x, 100, x, 635);
      for (let y = 120; y < 625; y += 72) g.lineBetween(165, y, 1195, y);
      return;
    }

    if (this.activeLevel.theme === 'snow') {
      g.fillStyle(0xffffff, 0.22);
      g.fillRoundedRect(80, 75, 1180, 575, 22);
    }

    if (this.activeLevel.theme === 'lava') {
      g.fillStyle(0xff6a1a, 0.28);
      for (let i = 0; i < 6; i += 1) {
        const x = 110 + i * 215;
        const y = 120 + ((i * 113) % 430);
        g.fillEllipse(x, y, 120, 38);
      }
    }

    if (this.activeLevel.theme === 'marsh') {
      g.fillStyle(0x2ab29b, 0.24);
      for (let i = 0; i < 8; i += 1) {
        g.fillEllipse(135 + i * 150, 130 + ((i * 79) % 480), 118, 48);
      }
    }

    if (this.activeLevel.theme === 'canyon') {
      g.fillStyle(0x7b3c24, 0.24);
      for (let i = 0; i < 7; i += 1) {
        g.fillRoundedRect(70 + i * 190, 95 + ((i * 97) % 500), 150, 34, 12);
      }
    }

    if (this.activeLevel.theme === 'storm') {
      g.fillStyle(0x0e142b, 0.22);
      g.fillRect(0, 0, ARENA_WIDTH, ARENA_HEIGHT);
      g.lineStyle(4, palette.detail, 0.18);
      for (let i = 0; i < 5; i += 1) {
        const x = 160 + i * 230;
        g.lineBetween(x, 70, x + 35, 130);
        g.lineBetween(x + 35, 130, x - 15, 180);
      }
    }
  }

  private drawThemeDetails(g: Phaser.GameObjects.Graphics, palette: TerrainPalette): void {
    g.fillStyle(palette.detail, palette.detailAlpha);
    for (let i = 0; i < 14; i += 1) {
      const x = 130 + ((i * 173 + this.activeLevel.id * 61) % 1100);
      const y = 110 + ((i * 97 + this.activeLevel.id * 43) % 520);
      g.fillEllipse(x, y, 34 + (i % 3) * 8, 16 + (i % 2) * 8);
    }
  }

  private drawRoad(g: Phaser.GameObjects.Graphics): void {
    const palette = this.getTerrainPalette();
    const generatedArenaKey = this.getLevelArenaKey(this.activeLevel.id);
    const hasGeneratedArena = this.textures.exists(generatedArenaKey);
    const roadScale = hasGeneratedArena ? 0.48 : 1;
    const drawPolyline = (path: { x: number; y: number }[], width: number, color: number, alpha: number) => {
      g.lineStyle(width, color, alpha);
      for (let i = 1; i < path.length; i += 1) {
        const a = path[i - 1];
        const b = path[i];
        g.lineBetween(a.x, a.y, b.x, b.y);
      }
      for (const point of path) {
        g.fillStyle(color, alpha);
        g.fillCircle(point.x, point.y, width / 2);
      }
    };

    for (const [index, path] of this.activePaths.entries()) {
      const laneAlpha = hasGeneratedArena && index > 0 ? 0.55 : 1;
      drawPolyline(path, 108 * roadScale, palette.roadEdge, (hasGeneratedArena ? 0.24 : 0.42) * laneAlpha);
      drawPolyline(path, 82 * roadScale, palette.roadBase, (hasGeneratedArena ? 0.38 : 0.98) * laneAlpha);
      drawPolyline(path, 48 * roadScale, palette.roadCenter, (hasGeneratedArena ? 0.16 : 0.72) * laneAlpha);

      g.lineStyle(2, palette.roadBorder, (hasGeneratedArena ? 0.2 : 0.3) * laneAlpha);
      const borderOffset = 38 * roadScale;
      for (let i = 0; i < path.length - 1; i += 1) {
        const a = path[i];
        const b = path[i + 1];
        const angle = Math.atan2(b.y - a.y, b.x - a.x);
        const normalX = Math.cos(angle + Math.PI / 2);
        const normalY = Math.sin(angle + Math.PI / 2);
        g.lineBetween(a.x + normalX * borderOffset, a.y + normalY * borderOffset, b.x + normalX * borderOffset, b.y + normalY * borderOffset);
        g.lineBetween(a.x - normalX * borderOffset, a.y - normalY * borderOffset, b.x - normalX * borderOffset, b.y - normalY * borderOffset);
      }
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
    for (const pad of this.activePads) {
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

        this.showBuildMenuForPad(pad.id);
      });
      this.buildPads.set(pad.id, container);
    }
  }

  private createHero(): void {
    const shadow = this.add.ellipse(0, 32, 38, 14, 0x000000, 0.14);
    const heroDisplaySize = this.getHeroDisplaySize();
    const sprite = this.add
      .sprite(0, -10, this.getHeroTexture(), this.getHeroFrame())
      .setDisplaySize(heroDisplaySize, heroDisplaySize);
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
    if (this.selectedHero.spriteSet === 'shadow-directional' && this.useDirectionalHero) {
      return HERO_DIRECTION_ATLAS_KEY;
    }

    if (this.selectedHero.spriteSet === 'ember-directional' && this.textures.exists(EMBER_DIRECTION_ATLAS_KEY)) {
      return EMBER_DIRECTION_ATLAS_KEY;
    }

    if (this.selectedHero.spriteSet === 'frost-directional' && this.textures.exists(FROST_DIRECTION_ATLAS_KEY)) {
      return FROST_DIRECTION_ATLAS_KEY;
    }

    return this.useImagegenArt ? IMAGEGEN_ATLAS_KEY : 'sheet-hero-champion';
  }

  private getHeroFrame(): number {
    if (this.selectedHero.spriteSet === 'shadow-directional' && this.useDirectionalHero) {
      return HERO_DIRECTION_FRAMES.downIdle[0];
    }

    if (this.selectedHero.spriteSet === 'ember-directional' && this.textures.exists(EMBER_DIRECTION_ATLAS_KEY)) {
      return HERO_DIRECTION_FRAMES.downIdle[0];
    }

    if (this.selectedHero.spriteSet === 'frost-directional' && this.textures.exists(FROST_DIRECTION_ATLAS_KEY)) {
      return HERO_DIRECTION_FRAMES.downIdle[0];
    }

    return this.useImagegenArt ? IMAGEGEN_FRAMES.heroIdle[0] : 0;
  }

  private getHeroDisplaySize(): number {
    return this.selectedHero.spriteSet === 'shadow-directional' ? 82 : 88;
  }

  private getReinforcementDisplaySize(): number {
    return Math.max(84, this.getHeroDisplaySize() - 2);
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
    if (CAMPAIGN_ENEMY_TYPES.includes(type) && this.textures.exists(CAMPAIGN_ENEMY_SHEET_KEY)) {
      return CAMPAIGN_ENEMY_SHEET_KEY;
    }

    if (this.textures.exists(ENEMY_TYPE_SHEET_KEY)) {
      return ENEMY_TYPE_SHEET_KEY;
    }

    if (this.useImagegenArt) {
      return IMAGEGEN_ATLAS_KEY;
    }

    return {
      grunt: 'sheet-enemy-grunt',
      runner: 'sheet-enemy-runner',
      brute: 'sheet-enemy-brute',
      guard: 'sheet-enemy-grunt',
      flyer: 'sheet-enemy-runner',
      caster: 'sheet-enemy-grunt',
      spider: 'sheet-enemy-runner',
      wizard: 'sheet-enemy-grunt',
      knight: 'sheet-enemy-brute',
      monster: 'sheet-enemy-brute',
      boss: 'sheet-enemy-brute'
    }[type];
  }

  private getEnemyFrame(type: EnemyType): number {
    if (CAMPAIGN_ENEMY_TYPES.includes(type) && this.textures.exists(CAMPAIGN_ENEMY_SHEET_KEY)) {
      return CAMPAIGN_ENEMY_TYPES.indexOf(type) * 4;
    }

    if (this.textures.exists(ENEMY_TYPE_SHEET_KEY)) {
      return ENEMY_TYPES.indexOf(type) * 4;
    }

    if (!this.useImagegenArt) {
      return 0;
    }

    return type === 'runner' || type === 'flyer' ? IMAGEGEN_FRAMES.enemyRunner[0] : IMAGEGEN_FRAMES.enemyGrunt[0];
  }

  private getEnemyAnimation(type: EnemyType): string {
    return `enemy-${type}-walk`;
  }

  private ensureEnemyTypeAnimations(): void {
    if (!this.textures.exists(ENEMY_TYPE_SHEET_KEY)) {
      return;
    }

    for (const type of ENEMY_TYPES) {
      const start = ENEMY_TYPES.indexOf(type) * 4;
      if (this.anims.exists(this.getEnemyAnimation(type))) {
        this.anims.remove(this.getEnemyAnimation(type));
      }
      this.anims.create({
        key: this.getEnemyAnimation(type),
        frames: [0, 1, 2, 3].map((offset) => ({ key: ENEMY_TYPE_SHEET_KEY, frame: start + offset })),
        frameRate: type === 'runner' || type === 'flyer' ? 12 : type === 'brute' ? 6 : 8,
        repeat: -1
      });
    }
  }

  private ensureCampaignEnemyAnimations(): void {
    if (!this.textures.exists(CAMPAIGN_ENEMY_SHEET_KEY)) {
      return;
    }

    for (const type of CAMPAIGN_ENEMY_TYPES) {
      const start = CAMPAIGN_ENEMY_TYPES.indexOf(type) * 4;
      if (this.anims.exists(this.getEnemyAnimation(type))) {
        this.anims.remove(this.getEnemyAnimation(type));
      }
      this.anims.create({
        key: this.getEnemyAnimation(type),
        frames: [0, 1, 2, 3].map((offset) => ({ key: CAMPAIGN_ENEMY_SHEET_KEY, frame: start + offset })),
        frameRate: type === 'spider' ? 12 : type === 'boss' ? 5 : 7,
        repeat: -1
      });
    }
  }

  private applyHeroProfile(heroId: HeroId): void {
    this.selectedHeroId = heroId;
    this.selectedHero = getHeroById(heroId);
    this.heroMaxHp = this.selectedHero.maxHp;
    this.heroHp = Math.min(this.heroMaxHp, Math.max(this.heroHp, this.heroMaxHp));
    this.heroSpeed = this.selectedHero.speed;
    this.heroRangeValue = this.selectedHero.range;
    this.heroTargetCooldown = 0;
    this.heroSpecial = Math.min(this.heroSpecial, this.heroSpecialMax);
    this.heroText = 'Ready';

    const sprite = this.getHeroSprite();
    if (sprite) {
      const heroDisplaySize = this.getHeroDisplaySize();
      sprite.setTexture(this.getHeroTexture(), this.getHeroFrame());
      sprite.setDisplaySize(heroDisplaySize, heroDisplaySize);
      sprite.setFlipX(false);
      this.playHeroIdle(sprite);
    }

    if (this.heroRange) {
      this.heroRange.setRadius(this.heroRangeValue);
    }

    if (this.heroSpecialFill) {
      this.heroSpecialFill.setFillStyle(Phaser.Display.Color.HexStringToColor(this.selectedHero.specialColor).color, 1);
    }

    const heroName = document.querySelector<HTMLElement>('#hero-name');
    const heroRole = document.querySelector<HTMLElement>('#hero-role');
    const heroPortrait = document.querySelector<HTMLElement>('#hero-portrait');
    const heroSpecialTrack = document.querySelector<HTMLElement>('#hero-special-track');
    if (heroName) {
      heroName.textContent = this.selectedHero.name;
    }
    if (heroRole) {
      heroRole.textContent = this.selectedHero.role;
    }
    if (heroPortrait) {
      heroPortrait.className = `hero-portrait ${this.selectedHero.portraitClass}`;
    }
    if (heroSpecialTrack) {
      heroSpecialTrack.setAttribute('aria-label', `${this.selectedHero.name} special`);
      heroSpecialTrack.style.setProperty('--special-color', this.selectedHero.specialColor);
    }

    this.updateHeroWorldBars();
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

    if (this.selectedHero.spriteSet.endsWith('directional')) {
      sprite.play(this.getHeroDirectionalAnimationKey('idle'), true);
      return;
    }

    sprite.play('hero-idle', true);
  }

  private playHeroAttack(sprite = this.getHeroSprite()): void {
    if (!sprite) {
      return;
    }

    if (this.selectedHero.spriteSet.endsWith('directional')) {
      sprite.play(this.getHeroDirectionalAnimationKey('attack'), true);
      return;
    }

    sprite.play('hero-attack', true);
  }

  private getHeroDirectionalAnimationKey(mode: 'idle' | 'attack'): string {
    return `hero-${mode}-${this.heroDirection}-${this.selectedHero.id}`;
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
    const nextWaveButton = document.querySelector<HTMLButtonElement>('#next-wave-btn');
    const spellButtons = document.querySelectorAll<HTMLButtonElement>('.ability-slot[data-spell]');
    const buildMenu = document.querySelector<HTMLElement>('#build-menu');

    nextWaveButton?.addEventListener('click', () => {
      if (!this.waveInFlight && this.wave < this.maxWave && this.gameStarted && this.matchOutcome === 'playing') {
        this.startWave();
      }
    });

    for (const button of spellButtons) {
      button.addEventListener('click', () => this.selectSpell(button.dataset.spell as SpellKind));
    }

    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.selectedSpell && !this.isPointerOverBuildPad(pointer.worldX, pointer.worldY)) {
        this.castSelectedSpellAt(pointer.worldX, pointer.worldY);
        return;
      }

      if (!this.selectedSpell && !this.isPointerOverBuildPad(pointer.worldX, pointer.worldY)) {
        this.hideBuildMenu();
      }
    });

    buildMenu?.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      const buildButton = target.closest<HTMLButtonElement>('[data-build-tower]');
      if (buildButton && this.activeBuildPadId && !buildButton.disabled) {
        this.resumeAudioContext();
        this.tryBuildTower(this.activeBuildPadId, buildButton.dataset.buildTower as TowerKind);
        return;
      }

      const actionButton = target.closest<HTMLButtonElement>('[data-tower-action]');
      if (!actionButton || !this.activeTowerPadId || actionButton.disabled) {
        return;
      }

      if (actionButton.dataset.towerAction === 'sell') {
        this.resumeAudioContext();
        this.sellTower(this.activeTowerPadId);
        return;
      }

      if (actionButton.dataset.towerAction === 'upgrade') {
        this.resumeAudioContext();
        this.upgradeTower(this.activeTowerPadId);
      }
    });

    window.addEventListener('tower-battles:start-game', ((event: Event) => {
      const detail = (event as CustomEvent<{ heroId?: HeroId; levelId?: number }>).detail;
      const heroId = detail?.heroId ?? 'shadow-sneaker';
      this.applyCampaignLevel(detail?.levelId ?? 1);
      this.applyHeroProfile(heroId);
      this.gameStarted = true;
      this.statusText = `${this.activeLevel.name}: ${this.activeLevel.intro}`;
      this.playLevelMusic();
      this.playProceduralSfx('campaignStart');
      this.time.delayedCall(220, () => this.playHeroVoice('ready'));
    }) as EventListener);
  }

  private applyCampaignLevel(levelId: number): void {
    this.activeLevel = getCampaignLevel(levelId);
    this.children.removeAll(true);
    this.hideBuildMenu();
    this.buildPads.clear();
    this.towers = [];
    this.enemies = [];
    this.allies = [];
    this.projectiles = [];
    this.supportProjectiles = [];
    this.beams = [];
    this.coins = this.activeLevel.coins;
    this.lives = this.activeLevel.lives;
    this.maxWave = this.activeLevel.maxWave;
    this.wave = 0;
    this.pendingSpawns = 0;
    this.waveInFlight = false;
    this.matchOutcome = 'playing';
    this.selectedSpell = undefined;
    this.heroRespawnTimer = 0;
    this.heroSpecial = 0;
    this.stopLevelMusic();
    this.createArena();
    this.createBuildPads();
    this.createHero();
  }

  private showBuildMenuForPad(padId: string): void {
    const tower = this.towers.find((item) => item.padId === padId);
    if (tower) {
      this.renderTowerManagementMenu(tower);
      return;
    }

    const state = getBuildMenuState({
      padId,
      occupiedPadIds: this.towers.map((tower) => tower.padId),
      coins: this.coins
    });

    this.renderBuildMenu(state);
  }

  private renderBuildMenu(state: BuildMenuState): void {
    const menu = document.querySelector<HTMLElement>('#build-menu');
    if (!menu) {
      return;
    }

    if (!state.open) {
      this.statusText = 'That pad is already occupied';
      this.hideBuildMenu();
      return;
    }

    const pad = this.activePads.find((item) => item.id === state.padId);
    if (!pad) {
      this.hideBuildMenu();
      return;
    }

    this.activeBuildPadId = state.padId;
    this.activeTowerPadId = undefined;
    menu.innerHTML = `
      <div class="build-menu-title">Choose Tower</div>
      <div class="build-menu-options">
        ${state.options
          .map(
            (option) => `
              <button
                class="build-option ${option.kind}"
                data-build-tower="${option.kind}"
                ${option.canAfford ? '' : 'disabled'}
                aria-label="Build ${option.label} for ${option.cost} coins"
                title="${option.description}"
              >
                <span class="build-option-art" aria-hidden="true"></span>
                <span class="build-option-name">${option.label}</span>
                <strong>${option.cost}</strong>
              </button>
            `
          )
          .join('')}
      </div>
    `;

    this.positionPadMenu(menu, pad, 58);
    menu.hidden = false;
  }

  private renderTowerManagementMenu(tower: TowerState): void {
    const menu = document.querySelector<HTMLElement>('#build-menu');
    const pad = this.activePads.find((item) => item.id === tower.padId);
    if (!menu || !pad) {
      return;
    }

    const state = getTowerManagementState({
      kind: tower.kind,
      level: tower.level,
      coins: this.coins
    });
    const upgradeLabel = state.upgradeCost === null ? 'Max Level' : `Upgrade ${state.upgradeCost}`;

    this.activeBuildPadId = undefined;
    this.activeTowerPadId = tower.padId;
    menu.innerHTML = `
      <div class="build-menu-title">${state.title} L${state.level}</div>
      <div class="tower-stats">
        <span>Damage <strong>${state.stats.damage}</strong></span>
        <span>Range <strong>${state.stats.range}</strong></span>
        <span>Rate <strong>${(1000 / state.stats.cooldownMs).toFixed(1)}/s</strong></span>
      </div>
      <div class="tower-actions">
        <button class="tower-action upgrade" data-tower-action="upgrade" ${state.canUpgrade ? '' : 'disabled'}>
          ${upgradeLabel}
        </button>
        <button class="tower-action sell" data-tower-action="sell">
          Sell ${state.sellValue}
        </button>
      </div>
    `;

    this.positionPadMenu(menu, pad, 70);
    menu.hidden = false;
  }

  private positionPadMenu(menu: HTMLElement, pad: { x: number; y: number }, yOffset: number): void {
    const shell = document.querySelector<HTMLElement>('.shell');
    const canvasRect = this.game.canvas.getBoundingClientRect();
    const shellRect = shell?.getBoundingClientRect() ?? { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
    const scaleX = canvasRect.width / ARENA_WIDTH;
    const scaleY = canvasRect.height / ARENA_HEIGHT;
    const x = canvasRect.left - shellRect.left + pad.x * scaleX;
    const y = canvasRect.top - shellRect.top + pad.y * scaleY - yOffset;

    menu.style.left = `${Phaser.Math.Clamp(x, 132, shellRect.width - 132)}px`;
    menu.style.top = `${Phaser.Math.Clamp(y, 118, shellRect.height - 92)}px`;
  }

  private hideBuildMenu(): void {
    const menu = document.querySelector<HTMLElement>('#build-menu');
    this.activeBuildPadId = undefined;
    this.activeTowerPadId = undefined;
    if (menu) {
      menu.hidden = true;
      menu.innerHTML = '';
    }
  }

  private tryBuildTower(padId: string, kind = this.selectedTower): void {
    if (this.towers.some((tower) => tower.padId === padId)) {
      this.statusText = 'That pad is already occupied';
      this.hideBuildMenu();
      return;
    }

    const def = TOWER_DEFS[kind];
    const stats = getTowerStats(kind, 1);
    if (this.coins < def.cost) {
      this.statusText = 'Not enough coins';
      return;
    }

    const pad = this.activePads.find((item) => item.id === padId);
    if (!pad) {
      return;
    }

    this.coins -= def.cost;
    this.selectedTower = kind;
    const sprite = this.createTowerSprite(pad.x, pad.y - 12, kind);
    const levelLabel = this.createTowerLevelLabel(pad.x, pad.y - 72, 1);
    const radius = this.add.circle(pad.x, pad.y - 12, stats.range, getTowerTint(kind), 0.04);
    radius.setStrokeStyle(2, getTowerTint(kind), 0.14);
    radius.setVisible(false);
    const aura =
      kind === 'forge'
        ? this.add.circle(pad.x, pad.y - 12, def.range, 0xffc46c, 0.04).setStrokeStyle(2, 0xffc46c, 0.18)
        : undefined;

    if (aura) {
      aura.setDepth(1);
    }

    this.towers.push({
      padId,
      kind,
      level: 1,
      sprite,
      levelLabel,
      cooldown: Phaser.Math.Between(0, 220),
      radius,
      direction: 'down',
      aura
    });

    const padSprite = this.buildPads.get(padId);
    padSprite?.setAlpha(0.7);
    this.statusText = `${def.kind[0].toUpperCase()}${def.kind.slice(1)} tower online`;
    this.hideBuildMenu();
  }

  private createTowerLevelLabel(x: number, y: number, level: number): Phaser.GameObjects.Text {
    return this.add
      .text(x, y, `L${level}`, {
        fontFamily: 'Inter, Segoe UI, sans-serif',
        fontSize: '15px',
        fontStyle: '900',
        color: '#1f1708',
        backgroundColor: '#f6c454',
        padding: { x: 6, y: 2 }
      })
      .setOrigin(0.5)
      .setDepth(9);
  }

  private sellTower(padId: string): void {
    const tower = this.towers.find((item) => item.padId === padId);
    if (!tower) {
      return;
    }

    this.coins += getSellValue(tower.kind, tower.level);
    tower.sprite.destroy();
    tower.levelLabel.destroy();
    tower.radius.destroy();
    tower.aura?.destroy();
    this.towers = this.towers.filter((item) => item !== tower);
    this.buildPads.get(padId)?.setAlpha(1);
    this.statusText = `${tower.kind[0].toUpperCase()}${tower.kind.slice(1)} tower sold`;
    this.hideBuildMenu();
  }

  private upgradeTower(padId: string): void {
    const tower = this.towers.find((item) => item.padId === padId);
    if (!tower || tower.level >= MAX_TOWER_LEVEL) {
      return;
    }

    const upgradeCost = getUpgradeCost(tower.kind, tower.level);
    if (upgradeCost === null || this.coins < upgradeCost) {
      this.statusText = 'Not enough coins';
      this.renderTowerManagementMenu(tower);
      return;
    }

    this.coins -= upgradeCost;
    tower.level += 1;
    const stats = getTowerStats(tower.kind, tower.level);
    tower.radius.setRadius(stats.range);
    tower.levelLabel.setText(`L${tower.level}`);
    this.pulseCircle(tower.sprite.x, tower.sprite.y, 0xffe06f);
    this.statusText = `${tower.kind[0].toUpperCase()}${tower.kind.slice(1)} upgraded to level ${tower.level}`;
    this.playProceduralSfx('towerUpgrade');
    this.renderTowerManagementMenu(tower);
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
    const spawns = createCampaignWave(this.activeLevel, this.wave);
    this.pendingSpawns = spawns.length;
    this.waveInFlight = true;
    this.statusText = `Wave ${this.wave} incoming`;
    this.playProceduralSfx('waveWarning');

    for (const spawn of spawns) {
      this.time.delayedCall(spawn.delayMs, () => {
        this.spawnEnemy(spawn.id, spawn.type);
        this.pendingSpawns -= 1;
      });
    }
  }

  private spawnEnemy(id: string, type: EnemyType, x?: number, y?: number): void {
    const stats = getEnemyStats(type);
    const displaySize = this.getEnemyDisplaySize(type);
    const shadow = this.add.ellipse(0, 24, Math.max(34, displaySize * 0.5), Math.max(14, displaySize * 0.18), 0x000000, 0.18);
    const image = this.add
      .sprite(0, 0, this.getEnemyTexture(type), this.getEnemyFrame(type))
      .setDisplaySize(displaySize, displaySize);
    image.play(this.getEnemyAnimation(type));
    const hpBack = this.add.rectangle(-24, -42, 48, 6, 0x170909, 0.95).setOrigin(0, 0.5);
    hpBack.setStrokeStyle(1, 0xffffff, 0.38);
    const hpFill = this.add.rectangle(-24, -42, 48, 6, 0xf15b4e, 1).setOrigin(0, 0.5);
    const route = x === undefined || y === undefined ? this.getEnemyRoute(id) : this.getClosestRoute(x, y);
    const start = route[0];
    const sprite = this.add.container(x ?? start.x, y ?? start.y, [shadow, image, hpBack, hpFill]);
    sprite.setDepth(6);
    if (type === 'boss') {
      this.playProceduralSfx('bossRoar');
      this.pulseCircle(sprite.x, sprite.y, 0xff5d3d);
    }

    this.enemies.push({
      id,
      type,
      sprite,
      hpFill,
      hp: stats.maxHealth,
      maxHp: stats.maxHealth,
      speed: stats.speed,
      reward: stats.reward,
      path: route,
      pathIndex: 1,
      progress: 0,
      size: stats.size,
      attackCooldown: Phaser.Math.Between(250, 650),
      attackLock: 0,
      specialCooldown: Phaser.Math.Between(1200, 2400),
      spawnedMinions: false,
      slowUntil: 0,
      alive: true
    });
  }

  private getEnemyDisplaySize(type: EnemyType): number {
    if (type === 'boss') return 124;
    if (type === 'monster') return 104;
    if (type === 'knight' || type === 'brute') return 86;
    if (type === 'flyer' || type === 'wizard') return 76;
    return 68;
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

  private checkMatchOutcome(): void {
    if (this.matchOutcome !== 'playing') {
      return;
    }

    const outcome = getMatchOutcome({
      lives: this.lives,
      wave: this.wave,
      maxWave: this.maxWave,
      waveInFlight: this.waveInFlight,
      pendingSpawns: this.pendingSpawns,
      aliveEnemies: this.enemies.filter((enemy) => enemy.alive).length
    });

    if (outcome === 'playing') {
      return;
    }

    this.matchOutcome = outcome;
    this.waveInFlight = false;
    this.hideBuildMenu();
    this.statusText = outcome === 'victory' ? 'Victory. The arena is secured.' : 'Defeat. The road was overrun.';
    this.stopLevelMusic();
    this.showEndPanel(outcome);
  }

  private showEndPanel(outcome: Exclude<MatchOutcome, 'playing'>): void {
    const panel = document.querySelector<HTMLElement>('#end-panel');
    const kicker = document.querySelector<HTMLElement>('#end-kicker');
    const title = document.querySelector<HTMLElement>('#end-title');
    const copy = document.querySelector<HTMLElement>('#end-copy');

    if (!panel || !kicker || !title || !copy) {
      return;
    }

    panel.classList.toggle('defeat', outcome === 'defeat');
    kicker.textContent = outcome === 'victory' ? 'Arena Secured' : 'Road Lost';
    title.textContent = outcome === 'victory' ? 'Victory' : 'Defeat';
    copy.textContent =
      outcome === 'victory'
        ? 'All waves are cleared. Your defenses held the Emerald Road.'
        : 'Enemies broke through the defenses. Restart and rebuild the line.';
    panel.hidden = false;
    if (outcome === 'victory') {
      this.playProceduralSfx('victoryReveal');
      this.time.delayedCall(180, () => this.playAnnouncerVoice('victory'));
    }
  }

  private updateEnemies(dt: number): void {
    for (const enemy of this.enemies) {
      if (!enemy.alive) {
        continue;
      }

      const target = enemy.path[enemy.pathIndex];
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
      const slowed = enemy.slowUntil > this.time.now;
      const step = enemy.speed * (slowed ? 0.46 : 1) * dt;

      if (distance <= step) {
        enemy.sprite.setPosition(target.x, target.y);
        enemy.pathIndex += 1;
      } else {
        enemy.sprite.setPosition(enemy.sprite.x + (dx / distance) * step, enemy.sprite.y + (dy / distance) * step);
      }

      const image = enemy.sprite.list[1] as Phaser.GameObjects.Sprite | undefined;
      if (image) {
        image.flipX = dx < 0;
        image.rotation = enemy.attackLock > 0 ? 0 : Math.atan2(dy, dx) * 0.08;
        if (!slowed && image.tintTopLeft !== 0xffffff) {
          image.clearTint();
        }
        if (enemy.attackLock <= 0 && !image.anims.isPlaying) {
          image.play(this.getEnemyAnimation(enemy.type), true);
        }
      }

      enemy.progress = (enemy.pathIndex - 1) + Math.min(0.99, step / Math.max(distance, 1));
    }

    this.enemies = this.enemies.filter((enemy) => enemy.alive);
  }

  private getEnemyRoute(id: string): { x: number; y: number }[] {
    const routes = this.activePaths;
    if (routes.length <= 1) {
      return routes[0];
    }

    const hash = [...id].reduce((total, char) => total + char.charCodeAt(0), 0);
    return routes[hash % routes.length];
  }

  private getClosestRoute(x: number, y: number): { x: number; y: number }[] {
    return this.activePaths
      .map((path) => ({
        path,
        distance: Math.hypot(path[0].x - x, path[0].y - y)
      }))
      .sort((left, right) => left.distance - right.distance)[0].path;
  }

  private updateTowers(delta: number): void {
    const combatEnemies = this.enemies.map((enemy) => ({
      id: enemy.id,
      x: enemy.sprite.x,
      y: enemy.sprite.y,
      progress: enemy.progress
    }));

    for (const tower of this.towers) {
      const towerStats = getTowerStats(tower.kind, tower.level);
      tower.cooldown -= delta * this.getForgeMultiplier(tower);

      const occupiedPad = this.activePads.find((pad) => pad.id === tower.padId);
      if (!occupiedPad) {
        continue;
      }

      const facingTarget = combatEnemies
        .filter((enemy) => pointInRange({ x: occupiedPad.x, y: occupiedPad.y - 12 }, enemy, towerStats.range))
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
          tower.cooldown = towerStats.cooldownMs;
          this.coins += 10 + (tower.level - 1) * 5;
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
          range: towerStats.range,
          damage: towerStats.damage,
          kind: tower.kind
        },
        combatEnemies
      );

      if (!shot) {
        continue;
      }

      tower.cooldown = towerStats.cooldownMs;

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
    this.playProceduralSfx(kind === 'blaster' ? 'towerBlaster' : kind === 'laser' ? 'towerLaser' : 'towerForge');
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
      .map((tower) => this.activePads.find((pad) => pad.id === tower.padId))
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
    const sourcePad = this.activePads.find((pad) => pad.id === tower.padId);
    if (!sourcePad || tower.kind === 'forge') {
      return 1;
    }

    const boosted = this.towers.some((candidate) => {
      if (candidate.kind !== 'forge') {
        return false;
      }
      const forgePad = this.activePads.find((pad) => pad.id === candidate.padId);
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
      ally.attackLock = Math.max(0, ally.attackLock - delta);
      const target = this.getNearestEnemy(ally.sprite.x, ally.sprite.y, 150);
      if (!target) {
        this.setActorCombatPose(ally.sprite, false);
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
        this.setActorCombatPose(ally.sprite, false);
        ally.sprite.setPosition(ally.sprite.x + (dx / distance) * 70 * dt, ally.sprite.y + (dy / distance) * 70 * dt);
        continue;
      }

      this.setActorCombatPose(ally.sprite, true, dx);
      if (ally.attackCooldown <= 0) {
        ally.attackCooldown = 760;
        ally.attackLock = 360;
        this.damageEnemy(target, 14);
        this.playProceduralSfx('stab');
        this.actorAttackPulse(ally.sprite, dx, dy);
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
      enemy.attackLock = Math.max(0, enemy.attackLock - delta);
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

      if (heroDistance <= (enemy.type === 'caster' ? 112 : 58) && this.heroHp > 0) {
        enemy.attackCooldown = 900;
        enemy.attackLock = 420;
        this.setActorCombatPose(enemy.sprite, true, this.hero.x - enemy.sprite.x);
        this.damageHero(getEnemyStats(enemy.type).damage);
        this.playProceduralSfx('hit');
        this.actorAttackPulse(enemy.sprite, this.hero.x - enemy.sprite.x, this.hero.y - enemy.sprite.y);
        continue;
      }

      if (ally && allyDistance <= 46) {
        enemy.attackCooldown = 900;
        enemy.attackLock = 420;
        this.setActorCombatPose(enemy.sprite, true, ally.sprite.x - enemy.sprite.x);
        this.damageAlly(ally, getEnemyStats(enemy.type).damage + 2);
        this.playProceduralSfx('hit');
        this.actorAttackPulse(enemy.sprite, ally.sprite.x - enemy.sprite.x, ally.sprite.y - enemy.sprite.y);
      } else if (enemy.attackLock <= 0) {
        this.setActorCombatPose(enemy.sprite, false);
      }
    }
  }

  private updateEnemySpecials(delta: number): void {
    for (const enemy of this.enemies) {
      if (!enemy.alive) {
        continue;
      }

      enemy.specialCooldown -= delta;
      if (enemy.type === 'wizard' && enemy.specialCooldown <= 0) {
        enemy.specialCooldown = 2600;
        const wounded = this.enemies
          .filter(
            (candidate) =>
              candidate.alive &&
              candidate !== enemy &&
              candidate.hp < candidate.maxHp &&
              pointInRange({ x: enemy.sprite.x, y: enemy.sprite.y }, { x: candidate.sprite.x, y: candidate.sprite.y }, 150)
          )
          .sort((left, right) => left.hp / left.maxHp - right.hp / right.maxHp)[0];
        if (wounded) {
          wounded.hp = Math.min(wounded.maxHp, wounded.hp + 28);
          wounded.hpFill.width = 48 * Phaser.Math.Clamp(wounded.hp / wounded.maxHp, 0, 1);
          this.pulseCircle(wounded.sprite.x, wounded.sprite.y, 0x8beaff);
          this.statusText = 'Wizard healed the push';
          this.playProceduralSfx('wizardHeal');
        }
      }
    }
  }

  private setActorCombatPose(actor: Phaser.GameObjects.Container, locked: boolean, dx = 1): void {
    const image = actor.list[1] as Phaser.GameObjects.Sprite | undefined;
    if (!image) {
      return;
    }

    image.flipX = dx < 0;
    image.rotation = locked ? (dx < 0 ? -0.18 : 0.18) : 0;
    if (locked) {
      image.anims.pause();
      image.setFrame(image.frame.name);
    } else {
      image.anims.resume();
    }
  }

  private actorAttackPulse(actor: Phaser.GameObjects.Container, dx: number, dy: number): void {
    const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    const startX = actor.x;
    const startY = actor.y;
    this.tweens.add({
      targets: actor,
      x: startX + (dx / distance) * 12,
      y: startY + (dy / distance) * 8,
      duration: 70,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => actor.setPosition(startX, startY)
    });
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
      this.createFireSpellFx(targetX, targetY);
      this.damageEnemiesInRadius(targetX, targetY, 92, 52, 0xff6f28);
      this.statusText = 'Fireball scorched the target zone';
      return;
    }

    if (kind === 'reinforce') {
      this.spellCooldowns.reinforce = 7800;
      this.createReinforceSpellFx(targetX, targetY);
      this.spawnReinforcements(targetX, targetY);
      this.statusText = 'Bare soldiers joined the fight';
      return;
    }

    if (kind === 'frost') {
      this.spellCooldowns.frost = 6100;
      this.createFrostSpellFx(targetX, targetY);
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
    this.createStormSpellFx(targetX, targetY);
    this.damageEnemiesInRadius(targetX, targetY, 170, 34, 0xc476ff);
    this.statusText = 'Arcane storm cracked the target zone';
  }

  private createFireSpellFx(x: number, y: number): void {
    const profile = getSpellEffectProfile('fire');
    const ring = this.add.circle(x, y, 18, profile.color, 0.22).setDepth(10);
    ring.setStrokeStyle(5, profile.accent, 0.8);
    this.tweens.add({
      targets: ring,
      scaleX: 4.6,
      scaleY: 4.6,
      alpha: 0,
      duration: 260,
      ease: 'Cubic.easeOut',
      onComplete: () => ring.destroy()
    });

    const scorch = this.add.ellipse(x, y + 8, 48, 20, 0x451506, 0.34).setDepth(4);
    this.tweens.add({
      targets: scorch,
      scaleX: 3.1,
      scaleY: 2.2,
      alpha: 0,
      duration: 650,
      onComplete: () => scorch.destroy()
    });

    for (let i = 0; i < profile.burstCount; i += 1) {
      const ember = this.add.circle(x, y, Phaser.Math.Between(4, 8), i % 2 === 0 ? profile.color : profile.accent, 0.9).setDepth(11);
      const angle = (Math.PI * 2 * i) / profile.burstCount + Phaser.Math.FloatBetween(-0.18, 0.18);
      const distance = Phaser.Math.Between(44, 112);
      this.tweens.add({
        targets: ember,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance * 0.7,
        alpha: 0,
        scaleX: 0.2,
        scaleY: 0.2,
        duration: Phaser.Math.Between(220, 320),
        ease: 'Quad.easeOut',
        onComplete: () => ember.destroy()
      });
    }
  }

  private createReinforceSpellFx(x: number, y: number): void {
    const profile = getSpellEffectProfile('reinforce');
    const sigil = this.add.star(x, y, 8, 18, 44, profile.accent, 0.26).setDepth(9);
    sigil.setStrokeStyle(3, profile.color, 0.9);
    this.tweens.add({
      targets: sigil,
      angle: 80,
      scaleX: 1.4,
      scaleY: 1.4,
      alpha: 0,
      duration: 520,
      ease: 'Cubic.easeOut',
      onComplete: () => sigil.destroy()
    });

    const offsets = [
      { x: -24, y: 16 },
      { x: 24, y: -12 }
    ];

    for (const offset of offsets) {
      const beam = this.add.rectangle(x + offset.x, y + offset.y - 48, 18, 118, profile.accent, 0.18).setDepth(8);
      beam.setStrokeStyle(2, profile.color, 0.75);
      this.tweens.add({
        targets: beam,
        alpha: 0,
        scaleX: 0.5,
        duration: 420,
        onComplete: () => beam.destroy()
      });
    }
  }

  private createFrostSpellFx(x: number, y: number): void {
    const profile = getSpellEffectProfile('frost');
    const ring = this.add.circle(x, y, 20, profile.color, 0.16).setDepth(10);
    ring.setStrokeStyle(4, profile.accent, 0.85);
    this.tweens.add({
      targets: ring,
      scaleX: 5.2,
      scaleY: 5.2,
      alpha: 0,
      duration: 320,
      ease: 'Quad.easeOut',
      onComplete: () => ring.destroy()
    });

    const mist = this.add.ellipse(x, y + 10, 54, 26, profile.color, 0.18).setDepth(5);
    this.tweens.add({
      targets: mist,
      scaleX: 3.4,
      scaleY: 2.6,
      alpha: 0,
      duration: 700,
      onComplete: () => mist.destroy()
    });

    for (let i = 0; i < profile.burstCount; i += 1) {
      const shard = this.add.rectangle(x, y, 6, Phaser.Math.Between(18, 30), i % 2 === 0 ? profile.accent : profile.color, 0.92).setDepth(11);
      shard.setRotation((Math.PI * 2 * i) / profile.burstCount);
      const angle = (Math.PI * 2 * i) / profile.burstCount;
      const distance = Phaser.Math.Between(50, 118);
      this.tweens.add({
        targets: shard,
        x: x + Math.cos(angle) * distance,
        y: y + Math.sin(angle) * distance * 0.75,
        alpha: 0,
        duration: Phaser.Math.Between(260, 360),
        ease: 'Quad.easeOut',
        onComplete: () => shard.destroy()
      });
    }
  }

  private createStormSpellFx(x: number, y: number): void {
    const profile = getSpellEffectProfile('storm');
    const aura = this.add.circle(x, y, 26, profile.color, 0.12).setDepth(9);
    aura.setStrokeStyle(3, profile.accent, 0.65);
    this.tweens.add({
      targets: aura,
      scaleX: 4.8,
      scaleY: 4.8,
      alpha: 0,
      duration: 520,
      onComplete: () => aura.destroy()
    });

    for (let i = 0; i < profile.burstCount; i += 1) {
      const strikeX = x + Phaser.Math.Between(-70, 70);
      const strikeY = y + Phaser.Math.Between(-58, 58);
      const bolt = this.add.graphics().setDepth(11);
      const topY = strikeY - Phaser.Math.Between(90, 130);
      bolt.lineStyle(5, profile.accent, 0.92);
      bolt.beginPath();
      bolt.moveTo(strikeX, topY);
      bolt.lineTo(strikeX - 12, strikeY - 34);
      bolt.lineTo(strikeX + 10, strikeY - 8);
      bolt.lineTo(strikeX - 6, strikeY + 24);
      bolt.strokePath();
      this.tweens.add({
        targets: bolt,
        alpha: 0,
        duration: 180 + i * 40,
        delay: i * 70,
        onComplete: () => bolt.destroy()
      });

      const impact = this.add.star(strikeX, strikeY + 8, 6, 8, 20, profile.color, 0.32).setDepth(10);
      this.tweens.add({
        targets: impact,
        scaleX: 1.8,
        scaleY: 1.8,
        alpha: 0,
        duration: 260,
        delay: i * 70,
        onComplete: () => impact.destroy()
      });
    }
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
    const reinforcementDisplaySize = this.getReinforcementDisplaySize();

    for (const offset of offsets) {
      const shadow = this.add.ellipse(0, 22, 28, 10, 0x000000, 0.14);
      const image = this.add
        .sprite(0, -8, this.getReinforcementTexture(), offset.frame)
        .setDisplaySize(reinforcementDisplaySize, reinforcementDisplaySize);
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
        attackLock: 0,
        alive: true
      });
    }

    this.damageEnemiesInRadius(x, y, 68, 0, 0x8cff9d);
    this.playProceduralSfx('reinforce');
  }

  private isPointerOverBuildPad(x: number, y: number): boolean {
    return this.activePads.some((pad) => pointInRange({ x: pad.x, y: pad.y }, { x, y }, 48));
  }

  private tryAutoHeroSpecial(): void {
    if (
      this.selectedHero.autoSpecial &&
      this.heroRespawnTimer <= 0 &&
      this.heroHp > 0 &&
      this.heroSpecial >= this.heroSpecialMax &&
      this.enemies.some((enemy) => enemy.alive)
    ) {
      this.castHeroSpecial();
    }
  }

  private castHeroSpecial(): void {
    if (this.heroRespawnTimer > 0 || this.heroHp <= 0 || this.heroSpecial < this.heroSpecialMax) {
      return;
    }

    if (this.selectedHeroId === 'ember-knight') {
      this.castEmberKnightSpecial();
      return;
    }

    if (this.selectedHeroId === 'frost-oracle') {
      this.castFrostOracleSpecial();
      return;
    }

    this.castShadowSneakerSpecial();
  }

  private castShadowSneakerSpecial(): void {
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
    this.playHeroVoice('special');
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
    this.heroText = 'Execution backstab';
    this.statusText = `${this.selectedHero.name} vanished behind the strongest enemy`;
  }

  private castEmberKnightSpecial(): void {
    this.heroSpecial = 0;
    this.playHeroVoice('special');
    this.playHeroAttack();
    this.createEmberSpecialFx(this.hero.x, this.hero.y);
    this.damageEnemiesInRadius(this.hero.x, this.hero.y, 128, 72, 0xff8a38);
    for (const enemy of this.enemies) {
      if (enemy.alive && pointInRange({ x: this.hero.x, y: this.hero.y }, { x: enemy.sprite.x, y: enemy.sprite.y }, 128)) {
        enemy.attackLock = Math.max(enemy.attackLock, 580);
      }
    }
    this.heroHp = Math.min(this.heroMaxHp, this.heroHp + 24);
    this.updateHeroWorldBars();
    this.time.delayedCall(280, () => this.playHeroIdle());
    this.heroText = 'Molten burst';
    this.statusText = `${this.selectedHero.specialName} blasted the frontline`;
  }

  private castFrostOracleSpecial(): void {
    const target = this.enemies
      .filter((enemy) => enemy.alive)
      .sort((left, right) => {
        if (right.progress !== left.progress) {
          return right.progress - left.progress;
        }

        return right.hp - left.hp;
      })[0];

    if (!target) {
      return;
    }

    this.heroSpecial = 0;
    this.playHeroVoice('special');
    this.playHeroAttack();
    this.createFrostSpecialFx(target.sprite.x, target.sprite.y);
    this.damageEnemiesInRadius(target.sprite.x, target.sprite.y, 140, 58, 0x79d8ff);
    for (const enemy of this.enemies) {
      if (enemy.alive && pointInRange({ x: target.sprite.x, y: target.sprite.y }, { x: enemy.sprite.x, y: enemy.sprite.y }, 140)) {
        enemy.slowUntil = this.time.now + 3200;
        const image = enemy.sprite.list[1] as Phaser.GameObjects.Sprite | undefined;
        image?.setTint(0x9befff);
      }
    }
    this.time.delayedCall(280, () => this.playHeroIdle());
    this.heroText = 'Freeze burst';
    this.statusText = `${this.selectedHero.specialName} locked the road in ice`;
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

  private createEmberSpecialFx(x: number, y: number): void {
    for (let i = 0; i < 3; i += 1) {
      const ring = this.add.circle(x, y, 28 + i * 10, 0xff8a38, 0.18).setDepth(10);
      ring.setStrokeStyle(5 - i, i === 0 ? 0xfff1ad : 0xff8a38, 0.9);
      this.tweens.add({
        targets: ring,
        scaleX: 2.3 + i * 0.35,
        scaleY: 2.3 + i * 0.35,
        alpha: 0,
        duration: 260 + i * 70,
        onComplete: () => ring.destroy()
      });
    }

    for (let i = 0; i < 12; i += 1) {
      const spark = this.add.star(x, y, 4, 4, 10, i % 2 === 0 ? 0xfff1ad : 0xff7b22, 0.88).setDepth(11);
      const angle = (Math.PI * 2 * i) / 12;
      this.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * Phaser.Math.Between(60, 112),
        y: y + Math.sin(angle) * Phaser.Math.Between(40, 86),
        alpha: 0,
        angle: Phaser.Math.Between(-70, 70),
        duration: 260,
        onComplete: () => spark.destroy()
      });
    }
  }

  private createFrostSpecialFx(x: number, y: number): void {
    const halo = this.add.circle(x, y, 26, 0x79d8ff, 0.16).setDepth(10);
    halo.setStrokeStyle(4, 0xe8fbff, 0.92);
    this.tweens.add({
      targets: halo,
      scaleX: 4.2,
      scaleY: 4.2,
      alpha: 0,
      duration: 360,
      onComplete: () => halo.destroy()
    });

    for (let i = 0; i < 9; i += 1) {
      const shard = this.add.triangle(x, y, 0, 24, 10, 0, 20, 24, 0xe8fbff, 0.9).setDepth(11);
      shard.setAngle((360 / 9) * i);
      this.tweens.add({
        targets: shard,
        x: x + Math.cos((Math.PI * 2 * i) / 9) * Phaser.Math.Between(48, 102),
        y: y + Math.sin((Math.PI * 2 * i) / 9) * Phaser.Math.Between(48, 102),
        alpha: 0,
        duration: 300,
        onComplete: () => shard.destroy()
      });
    }
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
    if (this.heroRespawnTimer > 0 || this.heroHp <= 0) {
      return;
    }

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
      if (this.heroHp < this.heroMaxHp && this.heroSecondsSinceDamage >= 15) {
        this.heroText = 'Regenerating';
        return;
      }
      this.heroText = 'Patrolling';
      return;
    }

    const enemy = this.enemies.find((item) => item.id === target.id);
    if (!enemy) {
      return;
    }

    this.heroTargetCooldown = this.selectedHero.attackCooldownMs;
    const startX = this.hero.x;
    const startY = this.hero.y;
    const dx = enemy.sprite.x - this.hero.x;
    const dy = enemy.sprite.y - this.hero.y;
    const distance = Math.max(1, Math.sqrt(dx * dx + dy * dy));
    this.heroDirection = this.getDirectionFromVector(dx, dy);
    const lungeDistance = this.selectedHero.attackStyle === 'ranged' ? 12 : 26;
    const lungeX = this.hero.x + (dx / distance) * lungeDistance;
    const lungeY = this.hero.y + (dy / distance) * lungeDistance;
    this.damageEnemy(enemy, this.selectedHero.attackDamage);
    this.heroSpecial = Math.min(this.heroSpecialMax, this.heroSpecial + this.selectedHero.specialGain);
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
    if (this.selectedHeroId === 'frost-oracle') {
      const bolt = this.add.circle(enemy.sprite.x, enemy.sprite.y, 22, 0x79d8ff, 0.24).setDepth(9);
      bolt.setStrokeStyle(3, 0xe8fbff, 0.92);
      this.tweens.add({
        targets: bolt,
        scaleX: 1.7,
        scaleY: 1.7,
        alpha: 0,
        duration: 180,
        onComplete: () => bolt.destroy()
      });
    } else if (this.useImagegenArt) {
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
    this.heroText = `Struck ${enemy.type}`;
  }

  private handleHeroMovement(dt: number): void {
    if (this.heroRespawnTimer > 0) {
      this.heroRespawnTimer -= dt;
      if (this.heroRespawnTimer <= 0) {
        this.heroRespawnTimer = 0;
        this.heroHp = Math.ceil(this.heroMaxHp * 0.65);
        this.heroSecondsSinceDamage = 0;
        this.hero.setAlpha(1);
        this.hero.setPosition(720, 400);
        this.heroText = 'Returned';
        this.statusText = `${this.selectedHero.name} returned to the fight`;
        this.playHeroVoice('respawn');
      } else {
        this.heroText = getHeroRespawnLabel(this.heroRespawnTimer);
      }
      this.updateHeroWorldBars();
      return;
    }

    this.updateHeroRegeneration(dt);

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
      sprite.y = -10 + Math.sin(this.time.now / 150) * 3;
    }

    this.updateHeroWorldBars();
  }

  private updateHeroRegeneration(dt: number): void {
    if (this.heroHp <= 0 || this.heroHp >= this.heroMaxHp) {
      return;
    }

    this.heroSecondsSinceDamage += dt;
    const nextHp = getHeroRegen({
      hp: this.heroHp,
      maxHp: this.heroMaxHp,
      secondsSinceDamage: this.heroSecondsSinceDamage,
      dt
    });

    if (nextHp > this.heroHp) {
      this.heroHp = nextHp;
      this.heroText = 'Regenerating';
    }
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

    this.heroSecondsSinceDamage = 0;
    this.heroHp = Math.max(0, this.heroHp - damage);
    this.updateHeroWorldBars();
    this.tweens.add({
      targets: this.hero,
      alpha: 0.62,
      yoyo: true,
      duration: 70
    });

    if (this.heroHp > 0) {
      this.heroText = 'Under attack';
      return;
    }

    this.heroRespawnTimer = HERO_RESPAWN_SECONDS;
    this.hero.setAlpha(0.35);
    this.heroText = getHeroRespawnLabel(this.heroRespawnTimer);
    this.statusText = 'The hero was knocked down';
    this.playProceduralSfx('heroFaint');
    this.time.delayedCall(120, () => this.playHeroVoice('faint'));
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
      if (enemy.type === 'boss' && !enemy.spawnedMinions && enemy.hp <= enemy.maxHp * 0.55) {
        enemy.spawnedMinions = true;
        this.spawnEnemy(`boss-spider-left-${this.time.now}`, 'spider', enemy.sprite.x - 38, enemy.sprite.y + 18);
        this.spawnEnemy(`boss-spider-right-${this.time.now}`, 'spider', enemy.sprite.x + 38, enemy.sprite.y - 12);
        this.statusText = 'The boss spawned spiders';
      }
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
    const waveBadge = document.querySelector('.wave-badge');
    const waveStatus = document.querySelector('#wave-status');
    const heroStatus = document.querySelector('#hero-status');
    const heroFrame = document.querySelector<HTMLElement>('.hero-frame');
    const heroHpFill = document.querySelector<HTMLElement>('#hero-hp-fill');
    const heroRecoveryFill = document.querySelector<HTMLElement>('#hero-recovery-fill');
    const heroSpecialFill = document.querySelector<HTMLElement>('#hero-special-fill');
    const nextWaveButton = document.querySelector<HTMLButtonElement>('#next-wave-btn');

    if (coinsValue) coinsValue.textContent = `${this.coins}`;
    if (livesValue) livesValue.textContent = `${this.lives}`;
    if (waveValue) waveValue.textContent = `${Math.max(1, this.wave)} / ${this.maxWave}`;
    if (waveBadge) waveBadge.textContent = `Level ${this.activeLevel.id}: ${this.activeLevel.name}`;
    if (waveStatus) waveStatus.textContent = this.statusText;
    if (heroStatus) heroStatus.textContent = this.heroText;
    if (heroFrame) {
      heroFrame.classList.toggle('recovering', this.heroRespawnTimer > 0);
      heroFrame.classList.toggle(
        'regenerating',
        this.heroRespawnTimer <= 0 && this.heroHp > 0 && this.heroHp < this.heroMaxHp && this.heroSecondsSinceDamage >= 15
      );
    }
    if (heroHpFill) heroHpFill.style.width = `${Phaser.Math.Clamp(this.heroHp / this.heroMaxHp, 0, 1) * 100}%`;
    if (heroRecoveryFill) {
      heroRecoveryFill.style.width = `${getHeroRecoveryProgress(this.heroRespawnTimer) * 100}%`;
      heroRecoveryFill.parentElement?.classList.toggle('active', this.heroRespawnTimer > 0);
    }
    if (heroSpecialFill) {
      heroSpecialFill.style.width = `${Phaser.Math.Clamp(this.heroSpecial / this.heroSpecialMax, 0, 1) * 100}%`;
    }
    if (nextWaveButton) {
      nextWaveButton.disabled =
        !this.gameStarted || this.waveInFlight || this.wave >= this.maxWave || this.lives <= 0 || this.matchOutcome !== 'playing';
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

  private playProceduralSfx(
    kind:
      | 'teleport'
      | 'stab'
      | 'hit'
      | 'reinforce'
      | 'campaignStart'
      | 'waveWarning'
      | 'bossRoar'
      | 'wizardHeal'
      | 'towerBlaster'
      | 'towerLaser'
      | 'towerForge'
      | 'towerUpgrade'
      | 'heroFaint'
      | 'victoryReveal'
  ): void {
    const key = {
      teleport: 'sfx-teleport',
      stab: 'sfx-stab',
      hit: 'sfx-hit',
      reinforce: 'sfx-reinforce',
      campaignStart: 'sfx-campaign-start',
      waveWarning: 'sfx-wave-warning',
      bossRoar: 'sfx-boss-roar',
      wizardHeal: 'sfx-wizard-heal',
      towerBlaster: 'sfx-tower-blaster',
      towerLaser: 'sfx-tower-laser',
      towerForge: 'sfx-tower-forge',
      towerUpgrade: 'sfx-tower-upgrade',
      heroFaint: 'sfx-hero-faint',
      victoryReveal: 'ui-victory-reveal'
    }[kind];

    if (this.cache.audio.exists(key)) {
      const volume = {
        hit: 0.28,
        bossRoar: 0.42,
        campaignStart: 0.34,
        waveWarning: 0.34,
        wizardHeal: 0.32,
        towerBlaster: 0.24,
        towerLaser: 0.22,
        towerForge: 0.24,
        towerUpgrade: 0.34,
        heroFaint: 0.4,
        victoryReveal: 0.45,
        teleport: 0.36,
        stab: 0.36,
        reinforce: 0.36
      }[kind];
      this.sound.play(key, { volume });
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
      reinforce: { start: 440, end: 660, duration: 0.16, volume: 0.055, type: 'triangle' as OscillatorType },
      campaignStart: { start: 520, end: 760, duration: 0.22, volume: 0.052, type: 'triangle' as OscillatorType },
      waveWarning: { start: 280, end: 520, duration: 0.18, volume: 0.055, type: 'square' as OscillatorType },
      bossRoar: { start: 90, end: 55, duration: 0.32, volume: 0.075, type: 'sawtooth' as OscillatorType },
      wizardHeal: { start: 620, end: 980, duration: 0.2, volume: 0.05, type: 'sine' as OscillatorType },
      towerBlaster: { start: 520, end: 280, duration: 0.08, volume: 0.04, type: 'square' as OscillatorType },
      towerLaser: { start: 920, end: 620, duration: 0.1, volume: 0.036, type: 'sawtooth' as OscillatorType },
      towerForge: { start: 360, end: 520, duration: 0.1, volume: 0.04, type: 'triangle' as OscillatorType },
      towerUpgrade: { start: 420, end: 840, duration: 0.18, volume: 0.05, type: 'triangle' as OscillatorType },
      heroFaint: { start: 240, end: 80, duration: 0.22, volume: 0.06, type: 'sawtooth' as OscillatorType },
      victoryReveal: { start: 360, end: 720, duration: 0.28, volume: 0.055, type: 'triangle' as OscillatorType }
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

  private playHeroVoice(line: 'ready' | 'special' | 'faint' | 'respawn'): void {
    const key = `voice-${this.selectedHeroId}-${line}`;
    if (this.cache.audio.exists(key)) {
      this.sound.play(key, { volume: 0.42 });
    }
  }

  private playAnnouncerVoice(line: 'victory'): void {
    const key = `voice-announcer-${line}`;
    if (this.cache.audio.exists(key)) {
      this.sound.play(key, { volume: 0.54 });
    }
  }

  private resumeAudioContext(): void {
    const sound = this.sound as Phaser.Sound.WebAudioSoundManager;
    sound.context?.resume().catch(() => undefined);
  }

  private playLevelMusic(): void {
    const key = `music-level-${this.activeLevel.id}`;
    if (!this.cache.audio.exists(key)) {
      return;
    }

    if (this.currentMusic?.key === key && this.currentMusic.isPlaying) {
      return;
    }

    this.stopLevelMusic();
    this.currentMusic = this.sound.add(key, { loop: true, volume: 0.22 });
    this.currentMusic.play();
  }

  private stopLevelMusic(): void {
    if (!this.currentMusic) {
      return;
    }

    this.currentMusic.stop();
    this.currentMusic.destroy();
    this.currentMusic = undefined;
  }
}
