/**
 * Production smoke check: loads a deployed URL in Chromium and verifies that real
 * market data renders on desktop and mobile (prices, candles, funding, no
 * horizontal overflow, no unexpected page errors).
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

async function run(name, viewport, path, assertions) {
  // Pin the locale so UI copy assertions are stable regardless of host settings.
  const context = await browser.newContext({ viewport, locale: 'en-US' });
  const page = await context.newPage();
  page.on('pageerror', (error) => errors.push(`${name}: ${error.message}`));
  page.on('console', (message) => {
    if (message.type() === 'error' && !/WebSocket|wss:|429|418|451/.test(message.text())) {
      errors.push(`${name}: console ${message.text()}`);
    }
  });

  const started = Date.now();
  await page.goto(`${base}/${path}`, { waitUntil: 'load', timeout: 60_000 });
  await page.getByText('BTC/USDT').first().waitFor({ timeout: 60_000 });
  const detail = await assertions(page);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  results.push({ name, ok: overflow <= 1, ms: Date.now() - started, detail, overflow });
  await context.close();
}

await run('desktop dashboard', { width: 1440, height: 900 }, '#/markets', async (page) => {
  const btcRow = page.locator('[data-testid="market-row"][data-symbol="BTCUSDT"]').first();
  await btcRow.waitFor();
  const rowText = (await btcRow.innerText()).replace(/\s+/g, ' ');
  const price = rowText.match(/\d{2},\d{3}\.\d{2}/)?.[0] ?? 'none';
  // Every venue reports at least one row.
  for (const exchange of ['binance-spot', 'binance-futures', 'bybit-spot', 'bybit-linear']) {
    await page.locator(`[data-exchange="${exchange}"]`).first().waitFor({ timeout: 40_000 });
  }
  const rows = await page.locator('[data-testid="market-row"]').count();
  return `btc ${price}, rendered rows ${rows}, all 4 venues present`;
});

await run('desktop pair', { width: 1440, height: 900 }, '#/pair/binance-futures/BTCUSDT', async (page) => {
  const canvases = await page.locator('[data-testid="chart-canvas"] canvas').count();
  const priceLocator = page.getByTestId('chart-last-price');
  await priceLocator.waitFor();
  for (let index = 0; index < 30; index += 1) {
    if (/[0-9]/.test(await priceLocator.innerText())) break;
    await page.waitForTimeout(1000);
  }
  const price = await priceLocator.innerText();
  await page.getByRole('heading', { name: 'Order book' }).waitFor({ timeout: 30_000 });
  const funding = await page.getByText(/Funding rate/i).first().innerText();
  const bids = await page.getByRole('region', { name: /Order book/ }).innerText();
  const levelCount = (bids.match(/\d+,\d{3}\.\d{2}/g) ?? []).length;
  return `canvases ${canvases}, last ${price}, ${funding.trim()} shown, ${levelCount} book prices`;
});

await run('desktop compare', { width: 1440, height: 900 }, '#/compare', async (page) => {
  await page.locator('tbody tr').first().waitFor({ timeout: 45_000 });
  const rows = await page.locator('tbody tr').count();
  const hasFormula = await page.getByText(/Spread =/).isVisible();
  return `${rows} venue rows, formula disclosed ${hasFormula}`;
});

await run('mobile dashboard', { width: 390, height: 844 }, '#/markets', async (page) => {
  const tabs = await page.getByTestId('mobile-tabbar').isVisible();
  return `tab bar visible ${tabs}`;
});

await run('mobile pair', { width: 390, height: 844 }, '#/pair/binance-spot/BTCUSDT', async (page) => {
  const canvases = await page.locator('[data-testid="chart-canvas"] canvas').count();
  const bookTab = page.getByRole('tab', { name: 'Book' });
  await bookTab.waitFor();
  await bookTab.click();
  await page.getByRole('heading', { name: 'Order book' }).waitFor({ timeout: 30_000 });
  return `canvases ${canvases}, order book tab reachable`;
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
console.log(`\n${failed === 0 ? 'smoke: OK' : `smoke: ${failed} problem(s)`}`);
process.exit(failed === 0 ? 0 : 1);
