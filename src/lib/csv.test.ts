import { describe, expect, it } from 'vitest';
import { buildCsv, csvFilename } from './csv';
import { SAMPLE_TICKERS } from '../test/fixtures';

describe('buildCsv', () => {
  it('writes a localised header row', () => {
    const csv = buildCsv(SAMPLE_TICKERS.slice(0, 1), 'en');
    const header = csv.split('\r\n')[0];
    expect(header).toContain('Exchange');
    expect(header).toContain('Last price');
    expect(header).toContain('Exchange timestamp (ISO)');
    expect(header).toContain('Received at (ISO)');
  });

  it('writes one row per ticker with source and timestamps', () => {
    const csv = buildCsv(SAMPLE_TICKERS.slice(0, 3), 'en');
    const lines = csv.split('\r\n');
    expect(lines).toHaveLength(4);
    expect(lines[1]).toContain('binance-spot');
    expect(lines[1]).toContain('https://api.binance.com');
    // ISO timestamp of the exchange close time
    expect(lines[1]).toContain(new Date(1_700_000_000_000).toISOString());
  });

  it('keeps per-row timestamps distinct rather than faking a snapshot', () => {
    const csv = buildCsv(SAMPLE_TICKERS.slice(0, 2).map((ticker, index) => ({ ...ticker, fetchedAt: 1_700_000_000_000 + index })), 'en');
    const lines = csv.split('\r\n');
    const firstFetched = lines[1].split(',')[13];
    const secondFetched = lines[2].split(',')[13];
    expect(firstFetched).not.toBe(secondFetched);
  });

  it('escapes separators inside values', () => {
    const csv = buildCsv(
      [{ ...SAMPLE_TICKERS[0], symbol: 'BTC,USDT' }],
      'en',
    );
    expect(csv).toContain('"BTC,USDT"');
  });

  it('uses localised headers in Chinese', () => {
    const csv = buildCsv(SAMPLE_TICKERS.slice(0, 1), 'zh');
    expect(csv.split('\r\n')[0]).toContain('交易所');
  });

  it('omits funding values for spot rows', () => {
    const csv = buildCsv([SAMPLE_TICKERS[0]], 'en');
    const row = csv.split('\r\n')[1].split(',');
    expect(row[10]).toBe('');
  });
});

describe('csvFilename', () => {
  it('stamps the kind and time', () => {
    const name = csvFilename('spot', new Date('2024-05-01T10:20:30.000Z'));
    expect(name).toBe('marketlens-spot-2024-05-01_10-20-30.csv');
  });
});
