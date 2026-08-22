import { render, screen, waitFor } from '@testing-library/react';
import App from './App';

beforeEach(() => {
  global.fetch = jest.fn((url) => {
    const payload = url.includes('/stats/time-saved')
      ? { time_saved_percent: 0, estimated_manual_time_minutes: 0 }
      : url.includes('/stats/summary')
        ? { source_counts: {}, open_exceptions: 0, last_reconcile: null }
        : [];
    return Promise.resolve({ ok: true, json: () => Promise.resolve(payload) });
  });
});

afterEach(() => {
  delete global.fetch;
});

test('renders the finance controller dashboard', async () => {
  render(<App />);
  expect(screen.getByText('Reconciliation Agent')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Run Reconciliation' })).toBeInTheDocument();
  expect(screen.getByText('Ask the Data')).toBeInTheDocument();
  await waitFor(() => expect(global.fetch).toHaveBeenCalled());
});
