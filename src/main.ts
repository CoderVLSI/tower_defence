import Phaser from 'phaser';
import './style.css';
import { ARENA_HEIGHT, ARENA_WIDTH } from './game/sim/arena';
import { GameScene } from './game/scenes/GameScene';
import { getEnemyLibrary, getHeroLibrary } from './game/ui/library';
import { getHeroById, getHeroRoster, type HeroId } from './game/sim/heroes';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Missing app root');
}

let selectedHeroId: HeroId = 'shadow-sneaker';
const heroRoster = getHeroRoster();

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
const playButton = document.querySelector<HTMLButtonElement>('#play-btn');
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

if (enemyLibrary) {
  enemyLibrary.innerHTML = getEnemyLibrary()
    .map(
      (enemy) => `
        <article class="library-card enemy-card">
          <span class="library-sprite enemy-sprite" style="--frame: ${enemy.frame}" aria-hidden="true"></span>
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
    syncSelectedHeroUi();
  });
});

syncSelectedHeroUi();

playButton?.addEventListener('click', () => {
  menu?.classList.add('hidden');
  window.dispatchEvent(new CustomEvent('tower-battles:start-game', { detail: { heroId: selectedHeroId } }));
});

howButton?.addEventListener('click', () => {
  if (howPanel) {
    howPanel.hidden = !howPanel.hidden;
  }
});

libraryButton?.addEventListener('click', () => {
  if (libraryPanel) {
    libraryPanel.hidden = !libraryPanel.hidden;
  }
});

document.querySelectorAll<HTMLButtonElement>('[data-library-tab]').forEach((button) => {
  button.addEventListener('click', () => {
    setLibraryTab(button.dataset.libraryTab === 'heroes' ? 'heroes' : 'enemies');
  });
});

document.querySelector<HTMLButtonElement>('#restart-btn')?.addEventListener('click', () => {
  window.location.reload();
});
