import { chromium } from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';

const baseUrl = process.env.PLAYTEST_URL ?? 'http://127.0.0.1:4173';
const outDir = path.resolve('artifacts', 'playtest');
const browserCandidates = [
  process.env.PLAYWRIGHT_BROWSER_PATH,
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
  'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe'
].filter(Boolean);

const pads = {
  blaster: { x: 300, y: 450 },
  laser: { x: 515, y: 222 },
  forge: { x: 820, y: 305 }
};

await fs.mkdir(outDir, { recursive: true });

const executablePath = await firstExistingPath(browserCandidates);
const browser = await chromium.launch({
  headless: true,
  executablePath,
  args: ['--no-sandbox']
});
const page = await browser.newPage({
  viewport: { width: 1600, height: 980 },
  deviceScaleFactor: 1
});

page.on('console', (msg) => {
  if (msg.type() === 'error') {
    console.error(`[browser-console] ${msg.text()}`);
  }
});
page.on('pageerror', (error) => {
  console.error(`[page-error] ${error.stack ?? error.message}`);
});

await page.goto(baseUrl, { waitUntil: 'networkidle' });
await page.waitForSelector('#game-root canvas');
await page.waitForSelector('#main-menu');

async function clickCanvasPoint(worldX, worldY) {
  const canvas = await page.locator('#game-root canvas').boundingBox();
  if (!canvas) throw new Error('Canvas not found');
  const scaleX = canvas.width / 1365;
  const scaleY = canvas.height / 768;
  await page.mouse.click(canvas.x + worldX * scaleX, canvas.y + worldY * scaleY);
}

await page.screenshot({ path: path.join(outDir, '01-main-menu.png'), fullPage: true });
await page.getByRole('button', { name: /^Play$/i }).click();
await page.waitForSelector('#campaign-screen:not([hidden])');
await page.screenshot({ path: path.join(outDir, '01-campaign-map.png'), fullPage: true });
await page.getByRole('button', { name: /^Start 1$/i }).click();
await page.waitForTimeout(400);
await page.screenshot({ path: path.join(outDir, '02-boot.png'), fullPage: true });

await buildTower('Blaster', pads.blaster, '02-pad-picker.png');
await openTowerPanel(pads.blaster, '02-tower-management.png');
await page.getByRole('button', { name: /Upgrade/i }).click();
await page.waitForTimeout(220);
await page.screenshot({ path: path.join(outDir, '02-tower-upgraded.png'), fullPage: true });
await page.getByRole('button', { name: /Sell/i }).click();
await page.waitForTimeout(220);
await buildTower('Laser', pads.laser);

await page.screenshot({ path: path.join(outDir, '03-built-towers.png'), fullPage: true });

await page.getByRole('button', { name: /Call Wave/i }).click();
await page.waitForTimeout(3200);
await page.screenshot({ path: path.join(outDir, '04-wave-active.png'), fullPage: true });

await page.getByRole('button', { name: /Reinforcements spell/i }).click();
await clickCanvasPoint(260, 316);
await page.waitForTimeout(500);
await page.screenshot({ path: path.join(outDir, '05-spell-cast.png'), fullPage: true });

await page.keyboard.down('KeyD');
await page.keyboard.down('KeyS');
await page.waitForTimeout(1200);
await page.keyboard.up('KeyD');
await page.keyboard.up('KeyS');
await page.waitForTimeout(1600);

const waveText = (await page.locator('#wave-status').textContent())?.trim();
const heroText = (await page.locator('#hero-status').textContent())?.trim();
const coins = (await page.locator('#coins-value').textContent())?.trim();
const lives = (await page.locator('#lives-value').textContent())?.trim();
const layout = await page.evaluate(() => ({
  innerWidth,
  innerHeight,
  scrollWidth: document.documentElement.scrollWidth,
  scrollHeight: document.documentElement.scrollHeight,
  bodyScrollWidth: document.body.scrollWidth,
  bodyScrollHeight: document.body.scrollHeight
}));

await page.screenshot({ path: path.join(outDir, '06-hero-engaged.png'), fullPage: true });

console.log(
  JSON.stringify(
    {
      baseUrl,
      screenshots: [
        path.join(outDir, '01-main-menu.png'),
        path.join(outDir, '01-campaign-map.png'),
        path.join(outDir, '02-boot.png'),
        path.join(outDir, '02-pad-picker.png'),
        path.join(outDir, '02-tower-management.png'),
        path.join(outDir, '02-tower-upgraded.png'),
        path.join(outDir, '03-built-towers.png'),
        path.join(outDir, '04-wave-active.png'),
        path.join(outDir, '05-spell-cast.png'),
        path.join(outDir, '06-hero-engaged.png')
      ],
      waveText,
      heroText,
      coins,
      lives,
      layout
    },
    null,
    2
  )
);

await browser.close();

async function buildTower(name, pad, pickerScreenshot) {
  await clickCanvasPoint(pad.x, pad.y);
  await page.waitForSelector('#build-menu:not([hidden])');
  if (pickerScreenshot) {
    await page.screenshot({ path: path.join(outDir, pickerScreenshot), fullPage: true });
  }
  await page.getByRole('button', { name: new RegExp(`Build ${name}`, 'i') }).click();
  await page.waitForTimeout(180);
}

async function openTowerPanel(pad, screenshot) {
  await clickCanvasPoint(pad.x, pad.y);
  await page.waitForSelector('#build-menu:not([hidden])');
  await page.screenshot({ path: path.join(outDir, screenshot), fullPage: true });
}

async function firstExistingPath(candidates) {
  for (const candidate of candidates) {
    try {
      await fs.access(candidate);
      return candidate;
    } catch {
      // Keep looking.
    }
  }

  return undefined;
}
