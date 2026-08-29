import { render, screen, waitFor } from '@testing-library/react';
import App from './App';
import CashForecast from './components/CashForecast';

beforeEach(() => {
  global.fetch = jest.fn((url) => {
    const payload = url.includes('/stats/time-saved')
      ? { time_saved_percent: 0, estimated_manual_time_minutes: 0 }
      : url.includes('/stats/summary')
        ? { source_counts: {}, open_exceptions: 0, last_reconcile: null }
        : url.includes('/stats/cash-forecast')
          ? { current_cash: 1000, expected_settlements: 2000, upcoming_expenses: 500, projected_balance: 2500, formula: 'current cash + expected settlements - upcoming expenses' }
          : [];
    return Promise.resolve({ ok: true, json: () => Promise.resolve(payload) });
  });
});

afterEach(() => {
  delete global.fetch;
});

test('renders the finance controller dashboard', async () => {
  render(<App />);
  expect(screen.getByText(/Good morning, Alex\./i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Run reconciliation/i })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /Open data assistant/i })).toBeInTheDocument();
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());
});

test('auto-calculates the cash forecast on mount without manual inputs', async () => {
  render(<CashForecast />);

  await waitFor(() => {
    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/stats/cash-forecast'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          current_cash: null,
          expected_settlements: null,
          upcoming_expenses: null,
        }),
      })
    );
  });

  expect(await screen.findByText(/Projected balance/i)).toBeInTheDocument();
  expect(screen.getAllByText(/₹2,500/i).length).toBeGreaterThan(0);
});
