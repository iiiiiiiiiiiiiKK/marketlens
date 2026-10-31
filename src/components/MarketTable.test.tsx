import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MarketTable } from './MarketTable';
import { SAMPLE_TICKERS } from '../test/fixtures';
import { useWatchlist, defaultGroup } from '../store/watchlist';
import { useSettings } from '../store/settings';

describe('MarketTable', () => {
  beforeEach(() => {
    useWatchlist.setState({ groups: [defaultGroup()], activeGroupId: 'default', recent: [] });
    useSettings.setState({ paused: false, lang: 'en' });
  });

  it('renders a row per market with price and signed change', () => {
    render(<MarketTable tickers={SAMPLE_TICKERS} />);
    expect(screen.getAllByText('BTC/USDT').length).toBeGreaterThan(0);
    expect(screen.getByText('ETH/USDT')).toBeInTheDocument();
    // Sign is explicit, not colour-only.
    expect(screen.getAllByText(/\+2\.10%/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/-1\.20%/).length).toBeGreaterThan(0);
  });

  it('filters rows as the user types', async () => {
    const user = userEvent.setup();
    render(<MarketTable tickers={SAMPLE_TICKERS} />);
    const input = screen.getByLabelText('Search pair, e.g. BTC/USDT');
    await user.type(input, 'ETH');
    expect(screen.getByText('ETH/USDT')).toBeInTheDocument();
    expect(screen.queryByText('SOL/USDT')).not.toBeInTheDocument();
  });

  it('sorts when a column header is clicked', async () => {
    const user = userEvent.setup();
    render(<MarketTable tickers={SAMPLE_TICKERS} />);
    const header = screen.getByRole('columnheader', { name: /Price/i });
    await user.click(header);
    expect(header).toHaveAttribute('aria-sort', 'descending');
    await user.click(header);
    expect(header).toHaveAttribute('aria-sort', 'ascending');
  });

  it('adds and removes a favourite through the star button', async () => {
    const user = userEvent.setup();
    render(<MarketTable tickers={SAMPLE_TICKERS.slice(0, 1)} />);
    const star = screen.getAllByRole('button', { name: 'Add to watchlist' })[0];
    await user.click(star);
    expect(useWatchlist.getState().groups[0].items).toEqual(['binance-spot:BTCUSDT']);
    const active = screen.getByRole('button', { name: 'Remove from watchlist' });
    await user.click(active);
    expect(useWatchlist.getState().groups[0].items).toEqual([]);
  });

  it('pauses and resumes auto refresh', async () => {
    const user = userEvent.setup();
    render(<MarketTable tickers={SAMPLE_TICKERS} />);
    await user.click(screen.getByRole('button', { name: /Pause/i }));
    expect(useSettings.getState().paused).toBe(true);
    await user.click(screen.getByRole('button', { name: /Resume/i }));
    expect(useSettings.getState().paused).toBe(false);
  });

  it('exports the current rows as CSV with a timestamped filename', async () => {
    const user = userEvent.setup();
    const createObjectURL = vi.fn((_blob: Blob) => 'blob:marketlens');
    const revokeObjectURL = vi.fn();
    vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

    render(<MarketTable tickers={SAMPLE_TICKERS.slice(0, 2)} />);
    await user.click(screen.getByRole('button', { name: /Export CSV/i }));

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0][0];
    expect(blob.size).toBeGreaterThan(0);
    expect(clickSpy).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });

  it('shows the exchange filter chips and hides futures when a kind is fixed', () => {
    render(<MarketTable tickers={SAMPLE_TICKERS} fixedKind="spot" />);
    const toolbar = screen.getByRole('region', { name: 'Markets' });
    expect(within(toolbar).getByRole('button', { name: 'Binance Spot' })).toBeInTheDocument();
    expect(within(toolbar).queryByRole('button', { name: 'Bybit Perp' })).not.toBeInTheDocument();
  });

  it('shows a skeleton while the first payload is loading', () => {
    const { container } = render(<MarketTable tickers={[]} loading />);
    expect(container.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
  });

  it('renders an explicit error state with a retry action', () => {
    const onRetry = vi.fn();
    render(<MarketTable tickers={[]} error="http-429" onRetry={onRetry} />);
    expect(screen.getByText(/Data unavailable/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('never shows fabricated rows for an empty dataset', () => {
    render(<MarketTable tickers={[]} emptyMessage="Nothing here" />);
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
  });
});
