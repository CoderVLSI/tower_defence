import Phaser from 'phaser';
import './style.css';
import { ARENA_HEIGHT, ARENA_WIDTH } from './game/sim/arena';
import { GameScene } from './game/scenes/GameScene';
import { CAMPAIGN_LEVELS, getCampaignLevel } from './game/sim/campaignLevels';
import { getEnemyLibrary, getHeroLibrary } from './game/ui/library';
import { getHeroById, getHeroRoster, type HeroId } from './game/sim/heroes';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Missing app root');
}

let selectedHeroId: HeroId = 'shadow-sneaker';
let selectedLevelId = 1;
const heroRoster = getHeroRoster();
const menuAudio = {
  buttonClick: new Audio('/assets/audio/ui/ui-button-click-01.mp3'),
  levelSelect: new Audio('/assets/audio/ui/ui-level-select-01.mp3')
};

for (const audio of Object.values(menuAudio)) {
  audio.preload = 'auto';
}

function playMenuAudio(kind: keyof typeof menuAudio, volume: number): void {
  const clip = menuAudio[kind].cloneNode(true) as HTMLAudioElement;
  clip.volume = volume;
  void clip.play().catch(() => undefined);
}

app.innerHTML = `
  <div class="shell">
    <div class="hud top-left">
      <div class="stat">
        <span class="label resource-label"><span class="resource-icon heart" aria-hidden="true"></span>Lives</span>
        <span id="lives-value" class="value">20</span>
      </div>
      <div class="stat">
        <span class="label">Wave</span>
        <span id="wave-value" class="value">1 / 8</span>
      </div>
    </div>
    <div class="hud top-center">
      <div class="wave-badge">Kingdom Rush Style Arena</div>
      <div id="wave-status" class="wave-status">Hold the road</div>
    </div>
    <div class="hud top-right">
      <div class="stat coins">
        <span class="label resource-label"><span class="resource-icon gold" aria-hidden="true"></span>Coins</span>
        <span id="coins-value" class="value">180</span>
      </div>
      <button id="next-wave-btn" class="chip-button">Call Wave</button>
    </div>
    <div id="game-root" class="game-root"></div>
    <section id="main-menu" class="main-menu">
      <div id="home-view" class="menu-home">
        <div class="menu-art" aria-hidden="true">
          <div class="menu-tower tower-red"></div>
          <div class="menu-champion"></div>
          <div class="menu-tower tower-blue"></div>
        </div>
        <div class="menu-kicker">Tower Battles</div>
        <h1>Hold The Emerald Road</h1>
        <p>
          Build enchanted towers, command your champion, and stop enemy waves before they cross the arena.
        </p>
        <div class="menu-actions">
          <button id="play-btn" class="primary-button">Play</button>
          <button id="how-btn" class="secondary-button">How to Play</button>
          <button id="library-btn" class="secondary-button">Library</button>
        </div>
        <div class="hero-select">
          <div class="hero-select-title">Choose Champion</div>
          <div id="hero-select-grid" class="hero-select-grid"></div>
        </div>
      </div>
      <div id="campaign-screen" class="campaign-screen" hidden>
        <div class="campaign-map-head">
          <button id="campaign-back-btn" class="secondary-button compact-button">Back</button>
          <div>
            <div class="hero-select-title">Campaign</div>
            <h2>Choose Your Battle</h2>
          </div>
          <button id="start-level-btn" class="primary-button compact-button">Start Level</button>
        </div>
        <div class="campaign-map-wrap">
          <div id="campaign-grid" class="campaign-map" aria-label="Campaign map"></div>
          <aside class="campaign-brief">
            <span id="campaign-selected-number">Level 1</span>
            <h3 id="campaign-selected-title">Greenroad Gate</h3>
            <p id="campaign-selected-copy">Stop the raiders before they learn the road.</p>
          </aside>
        </div>
      </div>
      <div id="how-panel" class="how-panel" hidden>
        <span>Click a glowing pad, choose a tower, press Call Wave, and move the champion with WASD.</span>
      </div>
      <div id="library-panel" class="library-panel" hidden>
        <div class="library-tabs" role="tablist" aria-label="Game library">
          <button class="library-tab active" data-library-tab="enemies" type="button">Enemies</button>
          <button class="library-tab" data-library-tab="heroes" type="button">Heroes</button>
        </div>
        <div id="enemy-library" class="library-grid"></div>
        <div id="hero-library" class="library-grid" hidden></div>
      </div>
    </section>
    <div id="build-menu" class="build-menu" hidden></div>
    <div class="combat-bar">
      <div class="hero-frame">
        <div id="hero-portrait" class="hero-portrait shadow-sneaker" aria-hidden="true"></div>
        <div class="hero-readout">
          <div id="hero-name" class="hero-name">Shadow Sneaker</div>
          <div id="hero-role" class="hero-role">Assassin champion</div>
          <div id="hero-status" class="hero-status">Ready</div>
          <div class="hp-track" aria-label="Hero health">
            <span id="hero-hp-fill" class="hp-fill"></span>
          </div>
          <div class="recovery-track" aria-label="Hero recovery">
            <span id="hero-recovery-fill" class="recovery-fill"></span>
          </div>
          <div id="hero-special-track" class="special-track" aria-label="Shadow Sneaker special">
            <span id="hero-special-fill" class="special-fill"></span>
          </div>
        </div>
      </div>
      <button class="ability-slot empty" aria-label="Empty ability slot" disabled></button>
      <button class="ability-slot fire" data-spell="fire" aria-label="Fireball spell"><span class="ability-label">Fire</span></button>
      <button class="ability-slot strike" data-spell="reinforce" aria-label="Reinforcements spell"><span class="ability-label">Guard</span></button>
      <button class="ability-slot frost" data-spell="frost" aria-label="Frost spell"><span class="ability-label">Frost</span></button>
      <button class="ability-slot storm" data-spell="storm" aria-label="Arcane storm spell"><span class="ability-label">Storm</span></button>
    </div>
    <section id="end-panel" class="end-panel" hidden>
      <div id="end-kicker" class="end-kicker">Battle Complete</div>
      <h2 id="end-title">Victory</h2>
      <p id="end-copy">The road is secure.</p>
      <button id="restart-btn" class="primary-button">Restart</button>
    </section>
  </div>
`;

const gameContainer = document.querySelector<HTMLDivElement>('#game-root');

if (!gameContainer) {
  throw new Error('Missing game container');
}

new Phaser.Game({
  type: Phaser.AUTO,
  parent: gameContainer,
  width: ARENA_WIDTH,
  height: ARENA_HEIGHT,
  backgroundColor: '#183830',
  scene: [GameScene],
  render: {
    pixelArt: false,
    antialias: true
  },
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH
  }
});

const menu = document.querySelector<HTMLElement>('#main-menu');
const homeView = document.querySelector<HTMLElement>('#home-view');
const campaignScreen = document.querySelector<HTMLElement>('#campaign-screen');
const playButton = document.querySelector<HTMLButtonElement>('#play-btn');
const startLevelButton = document.querySelector<HTMLButtonElement>('#start-level-btn');
const campaignBackButton = document.querySelector<HTMLButtonElement>('#campaign-back-btn');
const howButton = document.querySelector<HTMLButtonElement>('#how-btn');
const libraryButton = document.querySelector<HTMLButtonElement>('#library-btn');
const howPanel = document.querySelector<HTMLElement>('#how-panel');
const libraryPanel = document.querySelector<HTMLElement>('#library-panel');
const enemyLibrary = document.querySelector<HTMLElement>('#enemy-library');
const heroLibrary = document.querySelector<HTMLElement>('#hero-library');
const heroSelectGrid = document.querySelector<HTMLElement>('#hero-select-grid');
const heroPortrait = document.querySelector<HTMLElement>('#hero-portrait');
const heroName = document.querySelector<HTMLElement>('#hero-name');
const heroRole = document.querySelector<HTMLElement>('#hero-role');
const heroSpecialTrack = document.querySelector<HTMLElement>('#hero-special-track');
const campaignGrid = document.querySelector<HTMLElement>('#campaign-grid');
const campaignSelectedNumber = document.querySelector<HTMLElement>('#campaign-selected-number');
const campaignSelectedTitle = document.querySelector<HTMLElement>('#campaign-selected-title');
const campaignSelectedCopy = document.querySelector<HTMLElement>('#campaign-selected-copy');

const campaignNodePositions = [
  { x: 16.8, y: 32.8 },
  { x: 36.1, y: 24.1 },
  { x: 49.2, y: 38.5 },
  { x: 69.5, y: 33.2 },
  { x: 86.4, y: 33.7 },
  { x: 12.8, y: 76.2 },
  { x: 31.5, y: 80.6 },
  { x: 49.2, y: 78.2 },
  { x: 69.4, y: 74.8 },
  { x: 88.8, y: 82.4 }
];

function syncSelectedHeroUi(): void {
  const hero = getHeroById(selectedHeroId);
  if (heroPortrait) {
    heroPortrait.className = `hero-portrait ${hero.portraitClass}`;
  }
  if (heroName) {
    heroName.textContent = hero.name;
  }
  if (heroRole) {
    heroRole.textContent = hero.role;
  }
  if (heroSpecialTrack) {
    heroSpecialTrack.setAttribute('aria-label', `${hero.name} special`);
    heroSpecialTrack.style.setProperty('--special-color', hero.specialColor);
  }
  document.querySelectorAll<HTMLButtonElement>('[data-hero-select]').forEach((button) => {
    button.classList.toggle('active', button.dataset.heroSelect === selectedHeroId);
  });
}

function syncSelectedLevelUi(): void {
  const level = getCampaignLevel(selectedLevelId);
  document.querySelectorAll<HTMLButtonElement>('[data-level-select]').forEach((button) => {
    button.classList.toggle('active', Number(button.dataset.levelSelect) === selectedLevelId);
  });
  if (campaignSelectedNumber) campaignSelectedNumber.textContent = `Level ${level.id} - ${level.difficulty.toUpperCase()}`;
  if (campaignSelectedTitle) campaignSelectedTitle.textContent = level.name;
  if (campaignSelectedCopy) campaignSelectedCopy.textContent = level.intro;
  if (startLevelButton) startLevelButton.textContent = `Start ${level.id}`;
}

function setLibraryTab(tab: 'enemies' | 'heroes'): void {
  document.querySelectorAll<HTMLButtonElement>('[data-library-tab]').forEach((item) => {
    item.classList.toggle('active', item.dataset.libraryTab === tab);
  });
  if (enemyLibrary) enemyLibrary.hidden = tab !== 'enemies';
  if (heroLibrary) heroLibrary.hidden = tab !== 'heroes';
}

if (heroSelectGrid) {
  heroSelectGrid.innerHTML = heroRoster
    .map(
      (hero) => `
        <button class="hero-choice ${hero.id === selectedHeroId ? 'active' : ''}" type="button" data-hero-select="${hero.id}">
          <span class="library-sprite hero-library-portrait ${hero.portraitClass}" aria-hidden="true"></span>
          <span class="hero-choice-copy">
            <strong>${hero.name}</strong>
            <span>${hero.specialName}</span>
          </span>
        </button>
      `
    )
    .join('');
}

if (campaignGrid) {
  campaignGrid.innerHTML = CAMPAIGN_LEVELS.map(
    (level, index) => `
      <button class="campaign-node theme-${level.theme} ${level.id === selectedLevelId ? 'active' : ''}" style="--x: ${campaignNodePositions[index].x}%; --y: ${campaignNodePositions[index].y}%;" type="button" data-level-select="${level.id}" aria-label="Level ${level.id}: ${level.name}">
        <strong>${level.id}</strong>
        <span>${level.difficulty}</span>
      </button>
    `
  ).join('');
}

if (enemyLibrary) {
  enemyLibrary.innerHTML = getEnemyLibrary()
    .map(
      (enemy) => `
        <article class="library-card enemy-card">
          <span class="library-sprite ${enemy.frame >= 24 ? 'campaign-enemy-sprite' : 'enemy-sprite'}" style="--frame: ${enemy.frame >= 24 ? enemy.frame - 24 : enemy.frame}" aria-hidden="true"></span>
          <div>
            <h2>${enemy.name}</h2>
            <strong>${enemy.role}</strong>
            <p>${enemy.detail}</p>
            <div class="library-stats">
              <span>HP ${enemy.stats.hp}</span>
              <span>SPD ${enemy.stats.speed}</span>
              <span>DMG ${enemy.stats.damage}</span>
              <span>G ${enemy.stats.reward}</span>
            </div>
          </div>
        </article>
      `
    )
    .join('');
}

if (heroLibrary) {
  heroLibrary.innerHTML = getHeroLibrary()
    .map(
      (hero) => `
        <article class="library-card hero-card ${hero.status}">
          <span class="library-sprite hero-library-portrait ${hero.portraitClass}" aria-hidden="true"></span>
          <div>
            <h2>${hero.name}</h2>
            <strong>${hero.role}</strong>
            <p>${hero.detail}</p>
          </div>
        </article>
      `
    )
    .join('');
}

document.querySelectorAll<HTMLButtonElement>('[data-hero-select]').forEach((button) => {
  button.addEventListener('click', () => {
    selectedHeroId = (button.dataset.heroSelect as HeroId | undefined) ?? 'shadow-sneaker';
    playMenuAudio('buttonClick', 0.38);
    syncSelectedHeroUi();
  });
});

syncSelectedHeroUi();
document.querySelectorAll<HTMLButtonElement>('[data-level-select]').forEach((button) => {
  button.addEventListener('click', () => {
    selectedLevelId = Number(button.dataset.levelSelect ?? '1');
    playMenuAudio('levelSelect', 0.42);
    syncSelectedLevelUi();
  });
});

syncSelectedLevelUi();

playButton?.addEventListener('click', () => {
  playMenuAudio('buttonClick', 0.38);
  homeView?.setAttribute('hidden', '');
  if (campaignScreen) campaignScreen.hidden = false;
  howPanel?.setAttribute('hidden', '');
  libraryPanel?.setAttribute('hidden', '');
});

campaignBackButton?.addEventListener('click', () => {
  playMenuAudio('buttonClick', 0.34);
  if (campaignScreen) campaignScreen.hidden = true;
  homeView?.removeAttribute('hidden');
});

startLevelButton?.addEventListener('click', () => {
  playMenuAudio('buttonClick', 0.4);
  menu?.classList.add('hidden');
  window.dispatchEvent(new CustomEvent('tower-battles:start-game', { detail: { heroId: selectedHeroId, levelId: selectedLevelId } }));
});

howButton?.addEventListener('click', () => {
  playMenuAudio('buttonClick', 0.34);
  if (howPanel) {
    howPanel.hidden = !howPanel.hidden;
  }
});

libraryButton?.addEventListener('click', () => {
  playMenuAudio('buttonClick', 0.34);
  if (libraryPanel) {
    libraryPanel.hidden = !libraryPanel.hidden;
  }
});

document.querySelectorAll<HTMLButtonElement>('[data-library-tab]').forEach((button) => {
  button.addEventListener('click', () => {
    playMenuAudio('buttonClick', 0.3);
    setLibraryTab(button.dataset.libraryTab === 'heroes' ? 'heroes' : 'enemies');
  });
});

document.querySelector<HTMLButtonElement>('#restart-btn')?.addEventListener('click', () => {
  playMenuAudio('buttonClick', 0.42);
  window.location.reload();
});
