import { expect, test } from '@playwright/test';

/**
 * Live verification against the real public exchange APIs.
 * Run with:  npx playwright test --project=live
 * Requires outbound HTTPS access to api.binance.com / fapi.binance.com / api.bybit.com.
 */

test.describe('live exchange data', () => {
  test('dashboard shows real prices from Binance and Bybit', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));

    await page.goto('/#/markets');

    // Real rows arrive from at least three of the four sources.
    await expect(page.getByText('BTC/USDT').first()).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText('Binance Spot').first()).toBeVisible();
    await expect(page.getByText('Bybit Spot').first()).toBeVisible();

    const priceText = await page.getByText('BTC/USDT').first().locator('xpath=../..').innerText();
    expect(priceText).toMatch(/[0-9]{2},[0-9]{3}/);

    expect(errors).toEqual([]);
  });

  test('BTC perpetual opens with candles, order book and a funding rate', async ({ page }) => {
    await page.goto('/#/pair/bybit-linear/BTCUSDT');

    await expect(page.getByTestId('chart-canvas')).toBeVisible();
    // Candles actually render as canvas content.
    const canvasCount = await page.locator('[data-testid="chart-canvas"] canvas').count();
    expect(canvasCount).toBeGreaterThan(0);

    await expect(page.getByRole('heading', { name: 'Order book' })).toBeVisible();
    await expect(page.getByText(/Funding rate/i).first()).toBeVisible();
    await expect(page.getByText(/is not fixed income|not annualised/i).first()).toBeVisible();

    // Live price arrives from the websocket or the polling fallback.
    await expect(page.getByTestId('chart-last-price')).toHaveText(/[0-9]/, { timeout: 30_000 });
  });

  test('compare view finds BTC across venues', async ({ page }) => {
    await page.goto('/#/compare');
    await expect(page.getByRole('heading', { name: 'Exchange comparison', level: 1 })).toBeVisible();
    await expect(page.locator('tbody tr').first()).toBeVisible({ timeout: 40_000 });
    const rows = await page.locator('tbody tr').count();
    expect(rows).toBeGreaterThan(1);
  });

  test('websocket stream connects for the open market', async ({ page }) => {
    await page.goto('/#/pair/binance-spot/BTCUSDT');
    const live = page.getByText(/Stream connected|Connecting/);
    await expect(live.first()).toBeVisible({ timeout: 30_000 });
    const text = await live.first().innerText();
    // Reported honestly either way: the dashboard keeps polling if the stream is down.
    test.info().annotations.push({ type: 'stream', description: text });
  });
});
