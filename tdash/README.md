# tdash

React 18 and Vite dashboard for Tixmo. It lives in the `projectTixmo` monorepo next to the API (`../tixmoapi2`). Clone the repo root, not this folder.

## Requirements

- Node.js `>=24.21.0 <25` (see `.nvmrc` at the repo root).
- A running API for anything beyond static pages. See the root `README.md` and `docs/LOCAL_SETUP_NATIVE.md`.

## Commands

Run from the repo root (or drop `--prefix tdash` inside this folder):

```bash
npm ci --prefix tdash                 # install from the lockfile
cp tdash/.env.example tdash/.env      # defaults to VITE_API_URL=/api/v1
npm --prefix tdash run dev            # Vite dev server on http://localhost:5173
npm --prefix tdash test -- --run      # Vitest, single run
npm --prefix tdash run design:guard   # design-system guard
npm --prefix tdash run build          # production build plus policy-page and robots checks
```

`npm run dev` from the repo root starts the API and the dashboard together, and tries to start Docker services first. Without Docker use `npm run dev -- --no-services`.

The dev server proxies `/api` to `http://localhost:3000`, so start the API first. Sign in with the seeded demo owner from `docs/MARKET_DEMO_DATA.md` after `npm run demo:market`.

## Notes

- npm 11 may warn that esbuild's install script is not covered by `allowScripts`. That is expected; see `docs/vendor-import-local.md`.
- `VITE_*` variables are inlined at build time. Optional ones are documented in `tdash/.env.example`.
- Design system rules: `docs/dashboard-design-system.md`.
