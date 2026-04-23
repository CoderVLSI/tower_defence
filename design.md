# Tower Battles Design

## Purpose

Tower Battles is a browser-based 2D tower-defense game built around a compact fantasy arena. The player builds towers on fixed pads, calls enemy waves, controls a champion with WASD, and casts spells to stop enemies before they cross the road.

This document is the top-level source of truth for the current game design, runtime structure, gameplay data, asset inventory, known issues, and future plan.

## Current Game Snapshot

- Genre: 2D fantasy tower defense with light hero-control combat.
- Runtime: Vite, TypeScript, Phaser 3.
- Main screen: playable canvas with DOM HUD, menu overlay, contextual pad popovers, and combat bar.
- Session shape: short wave-defense run with 8 waves.
- Primary player verbs:
  - Start the battle from the main menu.
- Click glowing pads to open a visual tower picker.
- Choose a tower from the pad picker to build it.
- Click a placed tower pad to inspect tower stats, upgrade it, or sell it.
  - Press Call Wave to start enemy waves.
  - Move the hero with WASD.
  - Cast spells from the combat bar.
- Current hero: Shadow Sneaker.
- Current tower types: Blaster, Laser, Forge.
- Current enemy types: Grunt, Runner, Brute, Guard, Flyer, Caster.

## Project Structure

```text
.
|-- index.html
|-- package.json
|-- vite.config.ts
|-- src
|   |-- main.ts
|   |-- style.css
|   `-- game
|       |-- scenes
|       |   `-- GameScene.ts
|       |-- sim
|       |   |-- arena.ts
|       |   |-- combat.ts
|       |   `-- waves.ts
|       `-- render
|           |-- generatedTextures.ts
|           `-- imagegenAtlas.ts
|-- public
|   `-- assets
|       |-- audio
|       |-- enemy-types-sheet.png
|       |-- fantasy-sprite-atlas-clean.png
|       |-- hero-direction-atlas-clean.png
|       |-- hud-resource-icons.png
|       |-- plain-arena.png
|       |-- reinforcements-sheet.png
|       `-- tower-direction-atlas-clean.png
|-- scripts
|   `-- playtest.mjs
`-- tests
    |-- arena.test.ts
    |-- combat.test.ts
    `-- waves.test.ts
```

## Runtime Architecture

### DOM Shell

`src/main.ts` creates the HTML structure around the game:

- Top-left HUD: lives and wave count.
- Top-center HUD: arena label and wave status.
- Top-right HUD: coins and Call Wave button.
- Main menu: title, play button, how-to panel.
- Build picker: contextual tower-choice popover anchored to empty build pads.
- Tower management panel: contextual popover anchored to occupied build pads.
- Combat bar: hero portrait, hero health, special meter, and spell buttons.
- Phaser root: `#game-root`, where the canvas is mounted.

The DOM shell owns layout and high-level UI presentation. Phaser owns gameplay simulation and rendering.

### Phaser Scene

`src/game/scenes/GameScene.ts` is the main runtime scene. It currently handles:

- Asset preloading.
- Arena drawing and background image placement.
- Build pad creation and interaction.
- Tower creation, targeting, cooldowns, projectiles, beams, and support effects.
- Enemy spawning, path movement, health, rewards, and life loss.
- Hero creation, movement, combat, health, respawn, and special attack.
- Spell selection and spell casting.
- Reinforcement allies.
- Audio playback with generated-audio fallback.
- DOM UI refresh.

This file is the largest part of the project and is the main candidate for future decomposition.

### Simulation Helpers

The `src/game/sim` folder contains pure data and helper logic:

- `arena.ts`: arena size, path points, build pads, lookup helpers.
- `combat.ts`: tower definitions, range checks, targeting helpers, tint helpers.
- `waves.ts`: enemy stat table and wave generation.

These files are easier to test than the scene and should remain the first place for deterministic gameplay rules.

## Game Data

### Arena

- Width: `1365`
- Height: `768`
- Enemy path:
  - `(0, 316)`
  - `(230, 318)`
  - `(405, 382)`
  - `(570, 354)`
  - `(735, 438)`
  - `(925, 438)`
  - `(1085, 522)`
  - `(1365, 522)`

### Build Pads

| Pad | Position | Slot |
| --- | --- | --- |
| `pad-1` | `(300, 450)` | `bottom-lane` |
| `pad-2` | `(515, 222)` | `top-lane` |
| `pad-3` | `(620, 542)` | `bottom-lane` |
| `pad-4` | `(820, 305)` | `center` |
| `pad-5` | `(1000, 635)` | `right-flank` |

### Towers

| Tower | Cost | Damage | Range | Cooldown | Role |
| --- | ---: | ---: | ---: | ---: | --- |
| Blaster | 50 | 20 | 170 | 600 ms | Fast single-target tower |
| Laser | 100 | 34 | 210 | 950 ms | Heavy beam tower |
| Forge | 150 | 0 | 150 | 3000 ms | Support and income tower |

Current targeting rule: towers target the furthest-progressed enemy within range.

Tower management:

- Placed towers start at level 1 and can be upgraded to level 3.
- Placed towers show an `L1`, `L2`, or `L3` badge above the tower.
- The occupied-pad panel shows damage, range, and attack rate.
- Upgrade increases damage, range, and attack rate.
- Forge upgrades increase its coin output and production rate.
- Sell refunds 70% of tower investment, including paid upgrade costs.

### Hero

Current hero: Shadow Sneaker.

Known behavior:

- Moves with WASD.
- Clamped inside the arena.
- Auto-attacks nearby enemies.
- Charges special meter through attacks.
- Auto-casts special when full and enemies are alive.
- Special attack teleports behind the strongest enemy, backstabs it, then returns.
- Has health, world-space health bar, special bar, and respawn timer.
- When defeated, stays down for a 30-second recovery cooldown shown in the bottom-left hero frame.
- Regenerates health after 15 seconds without taking damage.
- The hero portrait grays out while recovering and glows while health regeneration is active.

Current hero values:

| Property | Value |
| --- | ---: |
| Health | 100 |
| Special max | 100 |
| Speed | 210 |
| Attack range | 120 |
| Attack damage | 24 |
| Attack cooldown | 650 ms |
| Respawn cooldown | 30 seconds |
| Regen delay | 15 seconds without damage |
| Regen rate | 6 health per second |

### Enemies

| Enemy | Speed | Health | Reward | Size | Damage |
| --- | ---: | ---: | ---: | ---: | ---: |
| Grunt | 52 | 64 | 10 | 18 | 8 |
| Runner | 88 | 44 | 12 | 14 | 6 |
| Brute | 40 | 150 | 24 | 24 | 16 |
| Guard | 46 | 104 | 18 | 20 | 10 |
| Flyer | 104 | 58 | 16 | 15 | 7 |
| Caster | 48 | 82 | 20 | 18 | 12 |

### Waves

Current wave generator:

- Enemy count is `5 + waveIndex`.
- Wave 1 starts with 6 enemies.
- Runners begin at wave 3.
- Brutes are intended to begin at wave 4.
- Guards begin at wave 5.
- Flyers begin at wave 6.
- Casters begin at wave 7.
- From wave 5 onward, the final spawn is forced to Runner.
- Spawn delay is `i * max(380, 760 - waveIndex * 40)`.

Known issue: wave 5 currently does not include a Brute because later Guard assignment can overwrite the Brute slot. The existing unit test expects a Brute on wave 5.

### Resources

| Resource | Starting Value | Notes |
| --- | ---: | --- |
| Coins | 180 | Used to build towers; enemy kills add rewards. |
| Lives | 20 | Reduced when enemies reach the end of the path. |
| Waves | 8 | Current maximum wave count. |

### Spells

| Spell | Cooldown | Current Effect |
| --- | ---: | --- |
| Fire | 5200 ms | Area damage, 92 radius, 52 damage |
| Reinforce | 7800 ms | Spawns two allied soldiers and triggers a small area pulse |
| Frost | 6100 ms | Area damage, 115 radius, 24 damage, temporary enemy tint |
| Storm | 7600 ms | Area damage, 170 radius, 34 damage |

## Assets

### Image Assets

Current important assets under `public/assets`:

- `plain-arena.png`: primary arena background.
- `painted-arena.png`: alternate arena art.
- `menu-background.png`: menu background art.
- `fantasy-sprite-atlas.png` and `fantasy-sprite-atlas-clean.png`: shared fantasy sprites.
- `hero-direction-atlas.png` and `hero-direction-atlas-clean.png`: directional hero sprites.
- `tower-direction-atlas.png` and `tower-direction-atlas-clean.png`: directional tower sprites.
- `enemy-types-sheet.png`: enemy type sprites.
- `reinforcements-sheet.png`: reinforcement sprites.
- `hud-resource-icons.png`: resource icons.
- `spell-icons.png`: spell icons.

The game has procedural fallback textures in `src/game/render/generatedTextures.ts` if sprite assets are unavailable.

### Audio Assets

Current SFX files:

- `hero-teleport-01.mp3`
- `hero-backstab-01.mp3`
- `enemy-hit-01.mp3`
- `reinforcements-summon-01.mp3`

The scene falls back to procedural WebAudio tones if loaded audio is missing.

## UI Design

The UI uses DOM overlays around the Phaser canvas:

- Main menu is shown first and hides when Play is clicked.
- Empty build pads open a contextual tower picker with visual tower choices and costs.
- Tower picker choices are disabled when the player cannot afford them.
- Occupied build pads open a compact tower management panel with stats, Upgrade, and Sell.
- Combat bar sits near the bottom and shows hero state plus spells.
- The bottom-left hero frame shows the 30-second recovery countdown while the hero is defeated.
- A recovery bar fills during hero respawn, and the hero frame highlights health regeneration.
- HUD values are updated from `GameScene.refreshUi()`.

End states:

- If lives reach 0, the run ends in Defeat and the game shows a Restart overlay.
- If wave 8 is cleared while lives remain, the run ends in Victory and the game shows a Restart overlay.
- Restart reloads the game state from the beginning.

Design direction:

- Keep the playfield readable.
- Use compact controls rather than large marketing sections.
- Keep HUD, contextual popovers, and combat bar stable while the canvas scales.
- Prefer icon-backed buttons and resource symbols for fast scanning.

## Testing And Verification

### Unit Tests

Run:

```bash
npm test
```

Coverage today:

- Arena bounds, pad lookup, and path lookup.
- Tower targeting, hero targeting, range checks, and tower definitions.
- Wave count, enemy mix, and enemy stat scaling.
- Build pad tower picker state and affordability.
- Tower management stats, upgrade cost, max-level state, and sell value.
- Hero respawn cooldown, countdown label formatting, and delayed health regeneration.
- Match outcome selection for playing, victory, and defeat.

Current result:

- `arena.test.ts`: passing.
- `combat.test.ts`: passing.
- `waves.test.ts`: failing because wave 5 lacks the expected Brute.

### Build

Run:

```bash
npm run build
```

Current result:

- Build passes.
- Vite warns that the main JavaScript chunk is larger than 500 kB after minification.

### Browser Playtest

Run a preview server, then:

```bash
npm run playtest
```

The playtest script expects a local server at `http://127.0.0.1:4173` unless `PLAYTEST_URL` is set. It captures screenshots into `artifacts/playtest`.

## Current Git State Notes

At the time this document was created, the working tree had uncommitted changes in:

- `src/game/scenes/GameScene.ts`
- `src/game/sim/waves.ts`
- `src/main.ts`
- `src/style.css`

And untracked assets:

- `public/assets/enemy-types-sheet.png`
- `public/assets/hud-resource-icons.png`

Future work should avoid overwriting those changes unless they are intentionally part of the next task.

## Known Issues

1. Wave 5 Brute expectation is broken.
   - The generator assigns Brute, then Guard logic can overwrite the same spawn.
   - Fix by defining explicit priority rules or preserving boss/special slots after assignment.

2. `GameScene.ts` is carrying many responsibilities.
   - It handles simulation orchestration, rendering, UI binding, audio, spells, hero logic, towers, enemies, and allies.
   - Future feature work should split logic when it meaningfully reduces risk.

3. Main bundle is large.
   - Phaser dominates the bundle.
   - This is acceptable for now, but later builds may benefit from manual chunking or lazy loading menu/game code.

4. Some gameplay labels are inconsistent.
   - The reinforcement status text says "Bare soldiers joined the fight"; this likely should be "Brave soldiers joined the fight" or another intentional phrase.

5. Enemy and spell balance is early-stage.
   - Later waves introduce more types, but there is no separate tuning table for progression difficulty.

## Forward Plan

### Phase 1: Stabilize Current Game

- Fix wave generation so tests pass and enemy priority is explicit.
- Add tests for wave 4 through wave 8 enemy composition.
- Run unit tests, production build, and browser playtest.
- Confirm all current assets load correctly.

### Phase 2: Improve GameScene Boundaries

Split only where it reduces real complexity:

- Move DOM lookup and UI refresh into a small UI adapter.
- Move spell data and spell execution helpers into a focused spell module.
- Move tower and enemy runtime types into shared local files if they become reused.
- Keep Phaser-specific object creation near the scene unless a helper has a clear boundary.

### Phase 3: Balance And Progression

- Define target difficulty per wave.
- Tune enemy health, speed, damage, and rewards.
- Tune tower prices, damage, cooldowns, and ranges.
- Tune spell cooldowns and effects.
- Add win, loss, restart, and final-wave states.

### Phase 4: UX And Presentation

- Improve tower selection feedback.
- Add cooldown indicators that communicate time remaining.
- Add clearer build-denied feedback for occupied pads and low coins.
- Add enemy entrance and death effects where readability allows.
- Check responsive layout at desktop and mobile-like viewports.

### Phase 5: Content Expansion

- Add more tower upgrades or tower levels.
- Add enemy modifiers or elite variants.
- Add hero ability selection if the single hero loop remains fun.
- Add map variants only after the current arena loop feels complete.

### Phase 6: Save And Meta Systems

Only add these after the core run is stable:

- Local high score or best wave.
- Simple settings for audio and fullscreen.
- Optional persistent unlocks.

## Design Principles

- Keep the first screen playable, not a marketing page.
- Preserve playfield clarity over decorative UI.
- Put deterministic rules in pure modules and test them.
- Keep Phaser object lifecycle ownership obvious.
- Add new abstractions only when they reduce complexity.
- Prefer focused tests for gameplay rules before changing scene behavior.
- Treat this document as living: update it when game data, architecture, assets, or roadmap meaningfully changes.
