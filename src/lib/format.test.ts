import { describe, expect, it } from 'vitest';
import {
  formatAge,
  formatCompact,
  formatPercent,
  formatPrice,
  formatQuantity,
  formatRatioAsPercent,
  median,
  midPrice,
  priceDecimals,
  spreadPercent,
} from './format';

describe('priceDecimals', () => {
  it('scales precision with magnitude', () => {
    expect(priceDecimals(65000)).toBe(2);
    expect(priceDecimals(120.5)).toBe(2);
    expect(priceDecimals(12.3456)).toBe(3);
    expect(priceDecimals(0.5231)).toBe(4);
    expect(priceDecimals(0.00001234)).toBe(8);
  });

  it('handles nonsense input', () => {
    expect(priceDecimals(0)).toBe(2);
    expect(priceDecimals(Number.NaN)).toBe(2);
  });
});

describe('formatPrice', () => {
  it('formats with locale grouping', () => {
    expect(formatPrice(65000.5, 'en')).toBe('65,000.50');
  });

  it('returns an em dash for missing data instead of 0', () => {
    expect(formatPrice(null)).toBe('—');
    expect(formatPrice(undefined)).toBe('—');
    expect(formatPrice(Number.NaN)).toBe('—');
  });
});

describe('formatPercent', () => {
  it('keeps the sign explicit', () => {
    expect(formatPercent(1.234)).toBe('+1.23%');
    expect(formatPercent(-1.234)).toBe('-1.23%');
    expect(formatPercent(0)).toBe('0.00%');
  });

  it('handles null', () => {
    expect(formatPercent(null)).toBe('—');
  });
});

describe('formatRatioAsPercent', () => {
  it('converts funding ratios to percent', () => {
    expect(formatRatioAsPercent(0.0001)).toBe('+0.0100%');
    expect(formatRatioAsPercent(-0.00025)).toBe('-0.0250%');
  });

  it('handles null funding', () => {
    expect(formatRatioAsPercent(null)).toBe('—');
  });
});

describe('formatCompact', () => {
  it('uses suffixes per language', () => {
    expect(formatCompact(1_500_000_000, 'en')).toBe('1.50B');
    expect(formatCompact(1_500_000_000, 'zh')).toBe('1.50十亿');
    expect(formatCompact(2500, 'en')).toBe('2.50K');
    expect(formatCompact(0, 'en')).toBe('0');
  });

  it('handles null', () => {
    expect(formatCompact(null)).toBe('—');
  });
});

describe('formatQuantity', () => {
  it('shortens big numbers', () => {
    expect(formatQuantity(2_500_000)).toBe('2.50M');
    expect(formatQuantity(1500)).toBe('1500.00');
  });
});

describe('spreads and medians', () => {
  it('computes mid price only with both sides', () => {
    expect(midPrice(100, 102)).toBe(101);
    expect(midPrice(null, 102)).toBeNull();
    expect(midPrice(0, 102)).toBeNull();
  });

  it('computes spread in percent of mid', () => {
    expect(spreadPercent(100, 102)).toBeCloseTo(1.9802, 3);
    expect(spreadPercent(102, 100)).toBeNull();
    expect(spreadPercent(null, 100)).toBeNull();
  });

  it('computes the median for odd and even counts', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([])).toBeNull();
  });
});

describe('formatAge', () => {
  const now = 1_700_000_000_000;

  it('renders relative ages in both languages', () => {
    expect(formatAge(now - 500, now, 'en')).toBe('just now');
    expect(formatAge(now - 12_000, now, 'en')).toBe('12s ago');
    expect(formatAge(now - 180_000, now, 'zh')).toBe('3 分钟前');
    expect(formatAge(now - 7_200_000, now, 'en')).toBe('2h ago');
  });

  it('handles missing timestamps', () => {
    expect(formatAge(null, now)).toBe('—');
  });
});
