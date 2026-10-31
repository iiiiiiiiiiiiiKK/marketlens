import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Delta, ErrorState, Segmented } from './ui';
import { reasonMessageKey } from '../lib/reasons';
import { FundingPanel } from './FundingPanel';
import { useSettings } from '../store/settings';

describe('Delta', () => {
  it('renders an explicit sign and arrow', () => {
    const { container } = render(<Delta value={2.5} />);
    expect(container.textContent).toContain('+2.50%');
    expect(container.textContent).toContain('▲');
  });

  it('marks declines with a down arrow', () => {
    const { container } = render(<Delta value={-1.25} />);
    expect(container.textContent).toContain('-1.25%');
    expect(container.textContent).toContain('▼');
  });

  it('renders an em dash for missing values', () => {
    const { container } = render(<Delta value={null} />);
    expect(container.textContent).toBe('—');
  });
});

describe('reasonMessageKey', () => {
  it('maps transport failures to user-facing reasons', () => {
    expect(reasonMessageKey('timeout')).toBe('error.api.reason.timeout');
    expect(reasonMessageKey('http-429')).toBe('error.api.reason.http-429');
    expect(reasonMessageKey('http-503')).toBe('error.api.reason.http');
    expect(reasonMessageKey(null)).toBe('error.api.reason.unknown');
  });
});

describe('ErrorState', () => {
  it('explains the failure and offers a retry', () => {
    useSettings.setState({ lang: 'en' });
    render(<ErrorState reason="network" exchange="Binance Spot" />);
    expect(screen.getByText(/Data unavailable — Binance Spot/)).toBeInTheDocument();
    expect(screen.getByText(/network request failed/i)).toBeInTheDocument();
  });
});

describe('Segmented', () => {
  it('exposes the active option as selected', () => {
    render(
      <Segmented
        options={[
          { value: 'a', label: 'A' },
          { value: 'b', label: 'B' },
        ]}
        value="b"
        onChange={() => {}}
        ariaLabel="test"
      />,
    );
    expect(screen.getByRole('tab', { name: 'B' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'A' })).toHaveAttribute('aria-selected', 'false');
  });
});

describe('FundingPanel', () => {
  it('states that spot markets have no funding rate instead of inventing one', () => {
    useSettings.setState({ lang: 'en' });
    render(<FundingPanel exchange="binance-spot" rawSymbol="BTCUSDT" symbol="BTC/USDT" />);
    expect(screen.getByText(/Funding rates only exist for perpetual futures markets/i)).toBeInTheDocument();
    expect(screen.getByText(/not fixed income/i)).toBeInTheDocument();
  });
});
