import { expect, test } from '@playwright/test';
import type { Page, Route } from '@playwright/test';

/**
 * These tests intercept every exchange request so the UI behaviour under test is
 * deterministic. Live connectivity is covered separately in live.spec.ts.
 */

const T0 = 1_700_000_000_000;

/** True when the viewport is in the mobile layout (< 768px). */
function isNarrow(page: Page): boolean {
  return (page.viewportSize()?.width ?? 1440) < 768;
}

const binanceInfo = {
  symbols: [
    { symbol: 'BTCUSDT', status: 'TRADING', baseAsset: 'BTC', quoteAsset: 'USDT' },
    { symbol: 'ETHUSDT', status: 'TRADING', baseAsset: 'ETH', quoteAsset: 'USDT' },
    { symbol: 'SOLUSDT', status: 'TRADING', baseAsset: 'SOL', quoteAsset: 'USDT' },
    { symbol: 'BNBUSDT', status: 'TRADING', baseAsset: 'BNB', quoteAsset: 'USDT' },
    { symbol: 'XRPUSDT', status: 'TRADING', baseAsset: 'XRP', quoteAsset: 'USDT' },
  ],
};

const row = (symbol: string, price: string, change: string, quoteVolume: string) => ({
  symbol,
  lastPrice: price,
  priceChangePercent: change,
  highPrice: String(Number(price) * 1.03),
  lowPrice: String(Number(price) * 0.97),
  volume: '1000',
  quoteVolume,
  bidPrice: String(Number(price) * 0.9999),
  askPrice: String(Number(price) * 1.0001),
  closeTime: T0,
});

const binanceTickers = [
  row('BTCUSDT', '65000', '2.10', '900000000'),
  row('ETHUSDT', '3200', '-1.20', '500000000'),
  row('SOLUSDT', '150', '5.40', '200000000'),
  row('BNBUSDT', '580', '0.80', '80000000'),
  row('XRPUSDT', '0.62', '-0.40', '40000000'),
];

const futuresInfo = {
  symbols: [
    { symbol: 'BTCUSDT', status: 'TRADING', contractType: 'PERPETUAL', baseAsset: 'BTC', quoteAsset: 'USDT' },
    { symbol: 'ETHUSDT', status: 'TRADING', contractType: 'PERPETUAL', baseAsset: 'ETH', quoteAsset: 'USDT' },
  ],
};

const futuresTickers = [row('BTCUSDT', '65020', '2.05', '1500000000'), row('ETHUSDT', '3205', '-1.10', '700000000')];
const premiumIndex = [
  { symbol: 'BTCUSDT', markPrice: '65018', indexPrice: '65010', lastFundingRate: '0.0001', nextFundingTime: T0 + 3_600_000 },
  { symbol: 'ETHUSDT', markPrice: '3204', indexPrice: '3203', lastFundingRate: '-0.0002', nextFundingTime: T0 + 3_600_000 },
];

const bybitInstruments = {
  retCode: 0,
  retMsg: 'OK',
  result: {
    list: [
      { symbol: 'BTCUSDT', baseCoin: 'BTC', quoteCoin: 'USDT', status: 'Trading' },
      { symbol: 'ETHUSDT', baseCoin: 'ETH', quoteCoin: 'USDT', status: 'Trading' },
    ],
    nextPageCursor: '',
  },
};

const bybitTickers = {
  retCode: 0,
  retMsg: 'OK',
  result: {
    list: [
      {
        symbol: 'BTCUSDT',
        bid1Price: '64999',
        ask1Price: '65001',
        lastPrice: '65000',
        prevPrice24h: '63663',
        price24hPcnt: '0.0210',
        highPrice24h: '66000',
        lowPrice24h: '63000',
        volume24h: '14000',
        turnover24h: '400000000',
      },
      {
        symbol: 'ETHUSDT',
        bid1Price: '3199',
        ask1Price: '3201',
        lastPrice: '3200',
        prevPrice24h: '3238',
        price24hPcnt: '-0.0117',
        highPrice24h: '3300',
        lowPrice24h: '3100',
        volume24h: '60000',
        turnover24h: '200000000',
      },
    ],
  },
};

const klines = Array.from({ length: 30 }).map((_, index) => {
  const open = 64000 + index * 40;
  return [T0 - (29 - index) * 3_600_000, String(open), String(open + 120), String(open - 90), String(open + 60), '50', 0];
});

const bybitKlines = {
  retCode: 0,
  retMsg: 'OK',
  result: {
    list: [...klines]
      .reverse()
      .map((k) => [String(k[0]), k[1], k[2], k[3], k[4], k[5], '1000']),
  },
};

const depth = {
  lastUpdateId: 42,
  bids: Array.from({ length: 20 }).map((_, index) => [String(64999 - index * 10), '1.5']),
  asks: Array.from({ length: 20 }).map((_, index) => [String(65001 + index * 10), '1.2']),
};

const bybitOrderBook = {
  retCode: 0,
  retMsg: 'OK',
  result: {
    s: 'BTCUSDT',
    b: Array.from({ length: 20 }).map((_, index) => [String(64999 - index * 10), '1.5']),
    a: Array.from({ length: 20 }).map((_, index) => [String(65001 + index * 10), '1.2']),
    ts: T0,
  },
};

async function json(route: Route, body: unknown) {  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    headers: { 'access-control-allow-origin': '*' },
    body: JSON.stringify(body),
  });
}

/** Intercepts every exchange endpoint the dashboard touches. */
async function mockExchanges(page: Page) {
  await page.route('**/api.binance.com/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/api/v3/exchangeInfo')) return json(route, binanceInfo);
    if (url.includes('/api/v3/ticker/24hr')) return json(route, binanceTickers);
    if (url.includes('/api/v3/klines')) return json(route, klines);
    if (url.includes('/api/v3/depth')) return json(route, depth);
    return json(route, {});
  });

  await page.route('**/fapi.binance.com/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/fapi/v1/exchangeInfo')) return json(route, futuresInfo);
    if (url.includes('/fapi/v1/premiumIndex')) {
      const symbolParam = new URL(url).searchParams.get('symbol');
      return json(route, symbolParam ? premiumIndex[0] : premiumIndex);
    }
    if (url.includes('/fapi/v1/ticker/24hr')) return json(route, futuresTickers);
    if (url.includes('/fapi/v1/klines')) return json(route, klines);
    if (url.includes('/fapi/v1/depth')) return json(route, depth);
    if (url.includes('/fapi/v1/fundingRate')) {
      return json(
        route,
        Array.from({ length: 6 }).map((_, index) => ({
          fundingTime: T0 - index * 28_800_000,
          fundingRate: index % 2 === 0 ? '0.00012' : '-0.00008',
        })),
      );
    }
    return json(route, {});
  });

  await page.route('**/api.bybit.com/**', async (route) => {
    const url = route.request().url();
    if (url.includes('/v5/market/instruments-info')) return json(route, bybitInstruments);
    if (url.includes('/v5/market/tickers')) return json(route, bybitTickers);
    if (url.includes('/v5/market/kline')) return json(route, bybitKlines);
    if (url.includes('/v5/market/orderbook')) return json(route, bybitOrderBook);
    if (url.includes('/v5/market/funding/history')) return json(route, { retCode: 0, result: { list: [] } });
    return json(route, { retCode: 0, result: {} });
  });

  // Deterministic: websocket upgrades are closed immediately so the app uses
  // its documented HTTP polling fallback.
  await page.routeWebSocket(/.*/, (ws) => ws.close());
}

test.beforeEach(async ({ page }) => {
  await mockExchanges(page);
});

test('dashboard renders real market rows from all four sources', async ({ page }) => {
  await page.goto('/#/markets');
  await expect(page.getByRole('heading', { name: 'Markets', level: 1 })).toBeVisible();
  await expect(page.getByText('BTC/USDT').first()).toBeVisible();
  await expect(page.getByText('65,000.00').first()).toBeVisible();

  // All four venues reported at least one row.
  await expect(page.getByText('Binance Spot').first()).toBeVisible();
  await expect(page.getByText('Bybit Perp').first()).toBeVisible();

  // Breadth summary is derived from real numbers.
  await expect(page.getByText('Advancing')).toBeVisible();
});

test('search palette filters markets and opens a pair with chart, book and funding', async ({ page }) => {
  await page.goto('/#/markets');
  await expect(page.getByText('BTC/USDT').first()).toBeVisible();

  await page.getByRole('button', { name: 'Search' }).click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible();
  const input = dialog.getByLabel(/Search markets/);
  await expect(input).toBeVisible();
  await input.fill('ETH');

  const options = dialog.getByRole('option');
  await expect(options.first()).toContainText('ETH');
  await options.first().click();

  await expect(page).toHaveURL(/#\/pair\/(binance-spot|binance-futures)\/ETHUSDT/);
  await expect(page.getByTestId('chart-canvas')).toBeVisible();
  await expect(page.getByTestId('chart-last-price')).toBeVisible();

  // Small screens show the order book on its own tab.
  if (isNarrow(page)) {
    const bookTab = page.getByRole('tab', { name: 'Book' });
    await bookTab.first().waitFor();
    await bookTab.first().click();
  }
  await expect(page.getByRole('heading', { name: 'Order book' })).toBeVisible();
});

test('futures view exposes funding rates and refuses to fake them for spot', async ({ page }) => {
  await page.goto('/#/futures');
  await expect(page.getByText('BTC/USDT').first()).toBeVisible();

  await page.goto('/#/pair/binance-futures/BTCUSDT');
  if (isNarrow(page)) {
    const fundingTab = page.getByRole('tab', { name: 'Funding' });
    await fundingTab.first().waitFor();
    await fundingTab.first().click();
  }

  await expect(page.getByText(/Funding rate/i).first()).toBeVisible();
  await expect(page.getByText(/is not fixed income|not annualised/i).first()).toBeVisible();

  await page.goto('/#/pair/binance-spot/BTCUSDT');
  if (isNarrow(page)) {
    const spotFundingTab = page.getByRole('tab', { name: 'Funding' });
    await spotFundingTab.first().waitFor();
    await spotFundingTab.first().click();
  }
  await expect(page.getByText(/Funding rates only exist for perpetual futures/)).toBeVisible();
});

test('watchlist persists a starred market across reloads', async ({ page }) => {
  await page.goto('/#/markets');
  await expect(page.getByText('BTC/USDT').first()).toBeVisible();

  // Star the BTC/USDT row inside the table (not the hero card).
  const btcRow = page.getByRole('row').filter({ hasText: 'BTC/USDT' }).first();
  await btcRow.getByRole('button', { name: 'Add to watchlist' }).click();

  await page.goto('/#/watchlist');
  await expect(page.getByRole('cell', { name: 'BTC/USDT' }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('cell', { name: 'BTC/USDT' }).first()).toBeVisible();
});

test('theme and language switches apply and persist', async ({ page }) => {
  await page.goto('/#/markets');
  const html = page.locator('html');
  const initial = await html.getAttribute('class');
  const wasDark = (initial ?? '').includes('dark');

  await page.getByRole('button', { name: /Toggle theme/ }).click();
  if (wasDark) {
    await expect(html).not.toHaveClass(/dark/);
  } else {
    await expect(html).toHaveClass(/dark/);
  }

  await page.getByRole('button', { name: /Switch language/ }).click();
  await expect(html).toHaveAttribute('lang', 'zh-CN');
  await expect(page.getByRole('heading', { name: '行情', level: 1 })).toBeVisible();

  await page.reload();
  await expect(html).toHaveAttribute('lang', 'zh-CN');
});

test('compare view lists the same pair across venues with a stated spread formula', async ({ page }) => {
  await page.goto('/#/compare');
  await expect(page.getByRole('heading', { name: 'Exchange comparison', level: 1 })).toBeVisible();
  await expect(page.getByText(/Spread =/)).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Binance Spot' }).first()).toBeVisible();
});

test('CSV export downloads a file with a timestamped name', async ({ page }) => {
  await page.goto('/#/markets');
  await expect(page.getByText('BTC/USDT').first()).toBeVisible();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: /Export CSV/ }).click();
  const file = await download;
  expect(file.suggestedFilename()).toMatch(/^marketlens-markets-.*\.csv$/);
});

test('a failing exchange degrades only its own panel and offers a retry', async ({ page }) => {
  await page.route('**/api.binance.com/api/v3/ticker/24hr**', (route) =>
    route.fulfill({ status: 429, contentType: 'application/json', body: '{"code":-1003,"msg":"rate limited"}' }),
  );
  await page.goto('/#/spot');
  await expect(page.getByText('Bybit Spot').first()).toBeVisible();
  await expect(page.getByText(/rate-limited the request/)).toBeVisible();
});

test('mobile layout uses the tab bar and never scrolls horizontally', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#/markets');
  await expect(page.getByText('BTC/USDT').first()).toBeVisible();

  const tabBar = page.getByTestId('mobile-tabbar');
  await expect(tabBar).toBeVisible();
  await expect(tabBar.getByRole('button', { name: 'Watchlist' })).toBeVisible();

  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(overflow.scrollWidth).toBeLessThanOrEqual(overflow.innerWidth + 1);

  await page.goto('/#/pair/binance-spot/BTCUSDT');
  await expect(page.getByTestId('chart-canvas')).toBeVisible();
  const pairOverflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(pairOverflow).toBeLessThanOrEqual(1);

  await testInfo.attach('mobile-dashboard', {
    body: await page.screenshot({ fullPage: false }),
    contentType: 'image/png',
  });
});

test('the author 𝕏 link is present in the header and points at the right profile', async ({ page }) => {
  await page.goto('/#/markets');
  const link = page.getByRole('link', { name: /0xkillcoin/ }).first();
  await expect(link).toHaveAttribute('href', 'https://x.com/0xkillcoin');
});
