import type { MarketTicker } from '../lib/types';

export function makeTicker(overrides: Partial<MarketTicker> = {}): MarketTicker {
  const exchange = overrides.exchange ?? 'binance-spot';
  const rawSymbol = overrides.rawSymbol ?? 'BTCUSDT';
  return {
    exchange,
    kind: 'spot',
    id: `${exchange}:${rawSymbol}`,
    rawSymbol,
    symbol: 'BTC/USDT',
    base: 'BTC',
    quote: 'USDT',
    price: 65000,
    changePercent24h: 1.5,
    high24h: 66000,
    low24h: 64000,
    volume24h: 1200,
    quoteVolume24h: 78_000_000,
    bid: 64999,
    ask: 65001,
    fundingRate: null,
    nextFundingTime: null,
    markPrice: null,
    timestamp: 1_700_000_000_000,
    fetchedAt: 1_700_000_000_500,
    ...overrides,
  };
}

export const SAMPLE_TICKERS: MarketTicker[] = [
  makeTicker({ exchange: 'binance-spot', rawSymbol: 'BTCUSDT', price: 65000, changePercent24h: 2.1, quoteVolume24h: 900_000_000 }),
  makeTicker({ exchange: 'bybit-spot', rawSymbol: 'BTCUSDT', price: 65010, changePercent24h: 2.0, quoteVolume24h: 400_000_000, bid: 65009, ask: 65011 }),
  makeTicker({
    exchange: 'binance-futures',
    kind: 'futures',
    rawSymbol: 'BTCUSDT',
    price: 65020,
    changePercent24h: 2.05,
    quoteVolume24h: 1_500_000_000,
    fundingRate: 0.0001,
    nextFundingTime: 1_700_003_600_000,
    markPrice: 65018,
  }),
  makeTicker({
    exchange: 'bybit-linear',
    kind: 'futures',
    rawSymbol: 'BTCUSDT',
    price: 65005,
    changePercent24h: 1.98,
    quoteVolume24h: 700_000_000,
    fundingRate: -0.0002,
    nextFundingTime: 1_700_003_600_000,
  }),
  makeTicker({ exchange: 'binance-spot', rawSymbol: 'ETHUSDT', base: 'ETH', symbol: 'ETH/USDT', price: 3200, changePercent24h: -1.2, quoteVolume24h: 500_000_000 }),
  makeTicker({ exchange: 'binance-spot', rawSymbol: 'SOLUSDT', base: 'SOL', symbol: 'SOL/USDT', price: 150, changePercent24h: 5.4, quoteVolume24h: 200_000_000 }),
  makeTicker({ exchange: 'binance-spot', rawSymbol: 'BTCUSDC', base: 'BTC', symbol: 'BTC/USDC', quote: 'USDC', price: 64950, changePercent24h: 2.0, quoteVolume24h: 10_000_000 }),
];

/** Raw Binance spot /api/v3/exchangeInfo payload subset. */
export const BINANCE_EXCHANGE_INFO = {
  symbols: [
    { symbol: 'BTCUSDT', status: 'TRADING', baseAsset: 'BTC', quoteAsset: 'USDT' },
    { symbol: 'ETHUSDT', status: 'TRADING', baseAsset: 'ETH', quoteAsset: 'USDT' },
    { symbol: 'DELISTEDUSDT', status: 'BREAK', baseAsset: 'DELISTED', quoteAsset: 'USDT' },
  ],
};

/** Raw Binance spot /api/v3/ticker/24hr payload subset. */
export const BINANCE_TICKERS = [
  {
    symbol: 'BTCUSDT',
    lastPrice: '65000.10',
    priceChangePercent: '2.100',
    highPrice: '66000.00',
    lowPrice: '64000.00',
    volume: '1200.5',
    quoteVolume: '78000000.00',
    bidPrice: '65000.00',
    askPrice: '65000.20',
    closeTime: 1_700_000_000_000,
  },
  {
    symbol: 'ETHUSDT',
    lastPrice: '3200.55',
    priceChangePercent: '-1.200',
    highPrice: '3300.00',
    lowPrice: '3100.00',
    volume: '8000.0',
    quoteVolume: '25000000.00',
    bidPrice: '3200.50',
    askPrice: '3200.60',
    closeTime: 1_700_000_000_000,
  },
  {
    symbol: 'DELISTEDUSDT',
    lastPrice: '0.00000001',
    priceChangePercent: '0',
    highPrice: '0',
    lowPrice: '0',
    volume: '0',
    quoteVolume: '0',
    bidPrice: '0',
    askPrice: '0',
    closeTime: 1_700_000_000_000,
  },
];

export const BYBIT_TICKERS = {
  retCode: 0,
  retMsg: 'OK',
  result: {
    category: 'spot',
    list: [
      {
        symbol: 'BTCUSDT',
        bid1Price: '65000',
        bid1Size: '1',
        ask1Price: '65002',
        ask1Size: '1',
        lastPrice: '65001',
        prevPrice24h: '63700',
        // Bybit reports ratios: 0.02 == 2%
        price24hPcnt: '0.0204',
        highPrice24h: '66000',
        lowPrice24h: '63000',
        turnover24h: '400000000',
        volume24h: '6100',
      },
      {
        symbol: 'UNKNOWNUSDT',
        lastPrice: '1',
        price24hPcnt: '0',
        volume24h: '0',
        turnover24h: '0',
      },
    ],
  },
};

export const BYBIT_INSTRUMENTS = {
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

export const BINANCE_KLINES = [
  [1_700_000_000_000, '64000', '64500', '63900', '64400', '100', 1_700_003_599_999],
  [1_700_003_600_000, '64400', '65100', '64300', '65000', '120', 1_700_007_199_999],
];

export const BYBIT_KLINES = {
  retCode: 0,
  retMsg: 'OK',
  result: {
    category: 'spot',
    symbol: 'BTCUSDT',
    // newest first
    list: [
      ['1700003600000', '64400', '65100', '64300', '65000', '120', '7800000'],
      ['1700000000000', '64000', '64500', '63900', '64400', '100', '6400000'],
    ],
  },
};

export const BINANCE_DEPTH = {
  lastUpdateId: 1,
  bids: [
    ['64999', '1.5'],
    ['64998', '2.5'],
    ['64997', '0.5'],
  ],
  asks: [
    ['65003', '1.0'],
    ['65005', '0.75'],
    ['65010', '3.0'],
  ],
};
