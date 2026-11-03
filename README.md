# Pickup Game Coordinator

Dashboard for discovering, organizing, and joining local pickup sports games.

## Getting started

```bash
npm install
npm run dev
```

Runs at http://localhost:5173.

| Command | Description |
| --- | --- |
| `npm run dev` | Dev server with HMR |
| `npm run build` | Type-check and build to `dist/` |
| `npm run preview` | Serve the production build |
| `npm run lint` | Oxlint |

## Structure

```
src/App.tsx             App shell and split layout
src/types.ts            Domain types and sport catalogue
src/data/seed.ts        Sample games
src/state/useGames.ts   Game data access
src/lib/                Formatting and derived helpers
src/components/         Feature components
src/components/ui/      Button, Pill, Combobox, FillMeter
```

Plain CSS Modules over the tokens in `src/index.css`. No UI framework.

## Not built yet

- Search, filter, and sort render but do nothing
- No persistence — seed data resets on refresh
- The map is a placeholder illustration
- Desktop only (1440px), no auth