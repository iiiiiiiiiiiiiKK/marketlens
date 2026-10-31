import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './App';
import { loadPersistedSettings } from './store/settings';
import { loadWatchlist } from './store/watchlist';

// Hydrate local preferences before the first paint so the UI never flashes the
// wrong theme/language combination.
loadPersistedSettings();
loadWatchlist();

const container = document.getElementById('root');
if (!container) throw new Error('Root container #root is missing');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
