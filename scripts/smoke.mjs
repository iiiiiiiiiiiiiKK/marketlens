/**
 * Production smoke check: loads a deployed URL in Chromium and verifies that real
 * market data renders (BTC price visible, no console errors, no horizontal overflow).
 *
 * Usage:
 *   node scripts/smoke.mjs https://user.github.io/marketlens/ [--proxy http://127.0.0.1:7890]
 */
import { chromium } from 'playwright';

const url = process.argv[2];
if (!url) {
  console.error('usage: node scripts/smoke.mjs <url> [--proxy <proxyUrl>]');
  process.exit(2);
}
const proxyIndex = process.argv.indexOf('--proxy');
const proxy = proxyIndex > 0 ? process.argv[proxyIndex + 1] : '';
const base = url.replace(/\/+$/, '');

const browser = await chromium.launch({
  ...(proxy ? { proxy: { server: proxy, bypass: '127.0.0.1,localhost' } } : {}),
});
const errors = [];
const results = [];

async function check(name, viewport, path, assertions) {
  const context = await browser.newContext({ viewport });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(`${name}: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error' && !/WebSocket|wss:|429|418/.test(message.text())) {
      errors.push(`${name}: console ${message.text()}`);
    }
  });

  const started = Date.now();
  await page.goto(`${base}/${path}`, { waitUntil: 'load', timeout: 45_000 });
  await page.getByText('BTC/USDT').first().waitFor({ timeout: 45_000 });
  const detail = await assertions(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  results.push({ name, ok: overflow <= 1, ms: Date.now() - started, detail, overflow });
  await context.close();
}

await check('desktop dashboard', { width: 1440, height: 900 }, '#/markets', async (page) => {
  const text = await page.locator('main').innerText();
  const price = text.match(/\d{2},\d{3}\.\d{2}/)?.[0] ?? 'none';
  const sources = await page.getByText(/Binance Spot/).count();
  return `btc price ${price}, source badges ${sources}`;
});

await check('desktop pair', { width: 1440, height: 900 }, '#/pair/binance-spot/BTCUSDT', async (page) => {
  const canvas = await page.locator('[data-testid="chart-canvas"] canvas').count();
  const price = await page.getByTestId('chart-last-price').innerText();
  return `canvases ${canvas}, last ${price}`;
});

await check('mobile dashboard', { width: 390, height: 844 }, '#/markets', async (page) => {
  const tabs = await page.getByTestId('mobile-tabbar').isVisible();
  return `tab bar visible ${tabs}`;
});

await browser.close();

for (const result of results) {
  console.log(
    `${result.ok ? 'PASS' : 'FAIL'} ${result.name.padEnd(18)} ${String(result.ms).padStart(6)}ms  overflow=${result.overflow}px  ${result.detail}`,
  );
}
if (errors.length > 0) {
  console.log('\nPage errors:');
  for (const error of errors) console.log(' -', error);
}
const failed = results.filter((result) => !result.ok).length + errors.length;
process.exit(failed === 0 ? 0 : 1);
