import Phaser from 'phaser';
import './style.css';
import { ARENA_HEIGHT, ARENA_WIDTH } from './game/sim/arena';
import { GameScene } from './game/scenes/GameScene';

const app = document.querySelector<HTMLDivElement>('#app');

if (!app) {
  throw new Error('Missing app root');
}

app.innerHTML = `
  <div class="shell">
    <div class="hud top-left">
      <div class="stat">
        <span class="label">Lives</span>
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
        <span class="label">Coins</span>
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
      </div>
      <div id="how-panel" class="how-panel" hidden>
        <span>Buy towers from the shop, click glowing pads to build, press Call Wave, and move the champion with WASD.</span>
      </div>
    </section>
    <aside class="shop">
      <div class="shop-title">Towers</div>
      <button class="shop-card active" data-tower="blaster">
        <span>Blaster</span>
        <strong>50</strong>
      </button>
      <button class="shop-card" data-tower="laser">
        <span>Laser</span>
        <strong>100</strong>
      </button>
      <button class="shop-card" data-tower="forge">
        <span>Forge</span>
        <strong>150</strong>
      </button>
      <div class="shop-copy">
        <div id="selection-name" class="selection-name">Blaster</div>
        <p id="selection-copy">
          Fast bolt tower with steady damage. Click a glowing pad to build.
        </p>
      </div>
    </aside>
    <div class="combat-bar">
      <div class="hero-frame">
        <div class="hero-portrait" aria-hidden="true"></div>
        <div class="hero-readout">
          <div class="hero-name">Shadow Sneaker</div>
          <div id="hero-status" class="hero-status">Ready</div>
          <div class="hp-track" aria-label="Hero health">
            <span id="hero-hp-fill" class="hp-fill"></span>
          </div>
          <div class="special-track" aria-label="Shadow Sneaker special">
            <span id="hero-special-fill" class="special-fill"></span>
          </div>
        </div>
      </div>
      <button class="ability-slot empty" aria-label="Empty ability slot" disabled></button>
      <button class="ability-slot fire" data-spell="fire" aria-label="Fireball spell"></button>
      <button class="ability-slot strike" data-spell="reinforce" aria-label="Reinforcements spell"></button>
      <button class="ability-slot frost" data-spell="frost" aria-label="Frost spell"></button>
      <button class="ability-slot storm" data-spell="storm" aria-label="Arcane storm spell"></button>
    </div>
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
const howPanel = document.querySelector<HTMLElement>('#how-panel');

playButton?.addEventListener('click', () => {
  menu?.classList.add('hidden');
  window.dispatchEvent(new CustomEvent('tower-battles:start-game'));
});

howButton?.addEventListener('click', () => {
  if (howPanel) {
    howPanel.hidden = !howPanel.hidden;
  }
});
