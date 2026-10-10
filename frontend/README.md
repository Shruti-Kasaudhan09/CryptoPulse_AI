# frontend/

React + Tailwind + Recharts dashboard (Phases 17–19) in `cryptopulse-dashboard/`.

```bash
cd cryptopulse-dashboard
npm install
npm run dev      # http://localhost:5173 (proxies /api to localhost:8000)
npm test         # vitest
npm run build    # production build in dist/
```

Pages: **Dashboard** (`/`), **Why this prediction?** (`/why`),
**Model Arena** (`/arena`), **Backtest** (`/backtest`). The selected coin is
in the URL (`?coin=ETH`), so any view can be linked directly.

- Every card handles loading (skeleton), error (message + fix hint + retry)
  and empty states.
- Dark "market terminal" theme with bundled fonts (works offline on demo day).
- Direction and status are never shown by colour alone (▲/▼ + words).
- Responsive down to phone width.

In production set `VITE_API_URL` to the backend URL (see `.env.example`).
