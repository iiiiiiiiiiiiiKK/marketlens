import { describe, expect, it } from 'vitest';
import { MESSAGE_KEYS, MESSAGES, detectLang, translate } from './i18n';

describe('i18n', () => {
  it('keeps Chinese and English dictionaries in sync', () => {
    const enKeys = Object.keys(MESSAGES.en).sort();
    const zhKeys = Object.keys(MESSAGES.zh).sort();
    expect(zhKeys).toEqual(enKeys);
  });

  it('has no empty translations', () => {
    for (const key of MESSAGE_KEYS) {
      expect(MESSAGES.en[key].trim().length).toBeGreaterThan(0);
      expect(MESSAGES.zh[key].trim().length).toBeGreaterThan(0);
    }
  });

  it('interpolates placeholders', () => {
    expect(translate('en', 'markets.showing', { shown: 3, total: 9 })).toBe('Showing 3 of 9 markets');
    expect(translate('zh', 'markets.showing', { shown: 3, total: 9 })).toBe('显示 3 / 9 个市场');
  });

  it('leaves unknown placeholders untouched instead of printing undefined', () => {
    expect(translate('en', 'status.sourcesOk')).toContain('{ok}');
  });

  it('never mixes languages for the same key', () => {
    // Spot check a few labels that must be translated, not copied.
    expect(MESSAGES.zh['nav.watchlist']).toBe('自选');
    expect(MESSAGES.en['nav.watchlist']).toBe('Watchlist');
    expect(MESSAGES.zh['funding.title']).toBe('资金费率');
  });

  it('detects Chinese browsers', () => {
    const original = Object.getOwnPropertyDescriptor(window.navigator, 'language');
    Object.defineProperty(window.navigator, 'language', { value: 'zh-CN', configurable: true });
    expect(detectLang()).toBe('zh');
    Object.defineProperty(window.navigator, 'language', { value: 'en-GB', configurable: true });
    expect(detectLang()).toBe('en');
    if (original) Object.defineProperty(window.navigator, 'language', original);
  });
});
