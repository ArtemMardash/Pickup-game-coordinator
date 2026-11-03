# Pickup Game Coordinator

A React + TypeScript app built with Vite.

## Getting started

```bash
npm install
npm run dev
```

Dev server runs at http://localhost:5173.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the dev server with HMR |
| `npm run build` | Type-check and build for production into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run lint` | Run Oxlint |

## Project structure

```
index.html        HTML entry point
src/main.tsx      React root
src/App.tsx       App shell
src/index.css     Global styles
public/           Static assets served as-is
```

## Tooling notes

- Uses `@vitejs/plugin-react` (Oxc-based transform).
- The React Compiler is not enabled. See the [React Compiler docs](https://react.dev/learn/react-compiler/installation) to add it.
- To enable type-aware lint rules, install `oxlint-tsgolint` and set `options.typeAware` to `true` in `.oxlintrc.json`.
