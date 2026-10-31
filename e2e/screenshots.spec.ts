import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';

/**
 * Captures the README screenshots from the real application (live exchange data).
 * Run with:  npx playwright test --project=screenshots
 */

const OUT = 'docs/screenshots';

test.describe.configure({ mode: 'serial' });

test.beforeAll(() => {
  mkdirSync(OUT, { recursive: true });
});

test('capture desktop views', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/markets');
  await expect(page.getByText('BTC/USDT').first()).toBeVisible({ timeout: 40_000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/01-dashboard.png` });

  await page.goto('/#/futures');
  await expect(page.getByText('BTC/USDT').first()).toBeVisible({ timeout: 40_000 });
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/02-futures-funding.png` });

  await page.goto('/#/pair/binance-futures/BTCUSDT');
  await expect(page.getByTestId('chart-canvas')).toBeVisible();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/03-pair-chart.png` });

  await page.goto('/#/compare');
  await expect(page.getByRole('heading', { name: 'Exchange comparison', level: 1 })).toBeVisible();
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/04-compare.png` });

  await page.goto('/#/markets');
  await expect(page.getByText('BTC/USDT').first()).toBeVisible({ timeout: 40_000 });
  await page.getByRole('button', { name: 'Add to watchlist' }).first().click();
  await page.goto('/#/watchlist');
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/05-watchlist.png` });

  await page.goto('/#/settings');
  await page.waitForTimeout(600);
  await page.screenshot({ path: `${OUT}/06-settings.png` });
});

test('capture light theme', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/#/markets');
  await expect(page.getByText('BTC/USDT').first()).toBeVisible({ timeout: 40_000 });
  await page.getByRole('button', { name: /Toggle theme/ }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/07-light-theme.png` });
  await page.getByRole('button', { name: /Toggle theme/ }).click();
});

test('capture mobile views', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/markets');
  await expect(page.getByText('BTC/USDT').first()).toBeVisible({ timeout: 40_000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${OUT}/08-mobile-dashboard.png` });

  await page.goto('/#/pair/binance-spot/BTCUSDT');
  await expect(page.getByTestId('chart-canvas')).toBeVisible();
  await page.waitForTimeout(2500);
  await page.screenshot({ path: `${OUT}/09-mobile-pair.png` });

  await page.getByRole('tab', { name: 'Book' }).click();
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/10-mobile-orderbook.png` });
});
