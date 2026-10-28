# Contributing to QueryRank

Thanks for your interest in improving QueryRank! This guide covers how to set up
the project, the conventions we follow, and how to get a change merged.

QueryRank is a **self-hosted, privacy-first** data-template builder. Keep that in
mind when contributing: a user's analytics data and credentials should never
leave their own infrastructure.

## Ways to contribute

- **Report a bug** — open an issue with steps to reproduce, what you expected,
  and what happened (screenshots help for UI issues).
- **Fix a bug or build a feature** — see the workflow below.
- **Add a data source** — a new adapter (Shopify, Stripe, …). See
  [Adding a data source](#adding-a-data-source).
- **Add a dashboard template** — a new layout in the gallery. See
  [Adding a dashboard template](#adding-a-dashboard-template).
- **Improve docs** — the README, this guide, or inline comments.

For anything large or potentially contentious, please open an issue to discuss
the approach before investing a lot of time.

## Requirements

- [Node.js](https://nodejs.org/) `>= 20`
- [pnpm](https://pnpm.io/) `>= 9` (enable with `corepack enable`)
- Postgres — the repo's `docker compose up -d` starts one on port `5433`

## Getting started

```bash
pnpm install          # install all workspace dependencies
docker compose up -d  # start Postgres (or point DATABASE_URL at your own)
cp apps/server/.env.example apps/server/.env   # then fill in APP_SECRET + ALLOWED_EMAIL
pnpm dev:all          # run the SPA (:5173) and the API (:3000) together
```

See the [README](./README.md#backend--self-hosting) for full backend setup and
the environment-variable reference. The only vars you need to run locally are
`DATABASE_URL`, `APP_SECRET`, and `ALLOWED_EMAIL`; Google OAuth and Resend are
optional.

> **Note:** everything is consumed directly from TypeScript source inside the
> monorepo — there is no package build step during development.

## Repository layout

| Path                                        | What lives here                                                          |
| ------------------------------------------- | ------------------------------------------------------------------------ |
| `apps/playground/`                          | The React 19 + Vite SPA — chart engine, dashboards, designer, CSV import |
| `apps/server/`                              | Hono + Drizzle + Postgres API — auth, connections, dashboards, datasets  |
| `packages/adapters/`                        | GSC/GA4 REST clients (`gscQuery`, `ga4RunReport`) + OAuth scopes         |
| `packages/cli/`                             | The `queryrank` CLI (`templates`, `render`)                              |
| `apps/playground/src/ui/viz/engine.ts`      | The chart engine — block config, data resolution, SVG rendering          |
| `apps/playground/src/ui/data/dashboards.ts` | Built-in dashboard templates                                             |
| `apps/server/src/db/schema.ts`              | Drizzle schema; migrations in `apps/server/drizzle/`                     |

## Development workflow

1. Fork the repo and create a branch from `main`
   (`git checkout -b fix/preview-footer` or `feat/stripe-adapter`).
2. Make your change, following the [coding standards](#coding-standards).
3. Run the [pre-PR checks](#before-you-open-a-pr).
4. Commit with a clear, present-tense message
   (e.g. `fix: keep New/Returning users distinct on CSV import`).
5. Push and open a pull request. Describe **what** changed and **why**; link any
   related issue; include before/after screenshots for UI changes.

Keep PRs focused — one logical change per PR is much easier to review than a
large mixed one.

## Before you open a PR

Run these from the repo root and make sure they all pass:

```bash
pnpm typecheck    # tsc --noEmit across every package
pnpm lint         # ESLint (0 errors)
pnpm test         # Vitest unit tests
pnpm format       # Prettier — format your changes
```

- **Typecheck and lint must be clean** (no errors). The repo currently has a few
  pre-existing `react-refresh/only-export-components` warnings — don't add new
  ones to otherwise component-only files.
- **Add or update tests** when you change behavior, especially in pure logic like
  the CSV importer (`apps/playground/src/ui/dataImport.test.ts`) or the chart
  engine (`apps/playground/src/ui/viz/engine.test.ts`).

You can target a single package, e.g. `pnpm --filter @queryrank/playground test`.

## Coding standards

- **TypeScript everywhere**, strict. Avoid `any` where a real type is reasonable.
- **Styling is SCSS + CSS Modules** (`*.module.scss`) with design tokens from
  `apps/playground/src/styles/index.scss`. **No Tailwind, no component UI kits.**
  Match the surrounding file's conventions (naming, comment density, idioms).
- **Charts** are drawn by an imperative vanilla-SVG engine (`viz/engine.ts`) via
  refs — not a charting library. New visual types extend the engine.
- Write code that reads like the code around it. Prefer small, well-named helpers
  over clever one-liners.
- Don't add a dependency without a clear reason — the adapters and CLI are kept
  dependency-light on purpose (e.g. OAuth and email use `fetch`, not SDKs) so
  self-hosters can audit what leaves their server.

## Product principles

- **Privacy first.** Data and credentials stay on the user's infrastructure.
  Don't add code that sends analytics data to third parties.
- **No mock integrations.** This is an open-source product — every "Connect"
  flow and data source must be a **real** connection. Never ship fake/demo
  connect buttons or hard-coded fake live data. Sample data shown in templates is
  clearly synthetic and only a preview until a real source is connected or a CSV
  is imported.
- **Never commit secrets.** `.env` is git-ignored; use `.env.example` (no real
  values) to document new variables.

## Adding a data source

To add e.g. a Stripe or Shopify source, follow the pattern GSC/GA4 use:

1. **Adapter** — add a REST client in `packages/adapters/` (see `gsc.ts` /
   `ga4.ts`): a query function plus its OAuth scope. Keep it `fetch`-based and
   dependency-free.
2. **Service** — add `apps/server/src/<source>/service.ts` that shapes the raw
   API response into an overview (`totals`, `series`, breakdowns).
3. **Route** — wire it into `apps/server/src/routes/connections.ts` (list,
   authorize, callback, overview).
4. **Connect card** — add a card on the Data sources page
   (`apps/playground/src/ui/DataSources.tsx`).
5. **Map metrics** — in `apps/playground/src/ui/liveData.ts`, map the source's
   metrics onto engine metric names (`applyX`), and add any new metric names to
   `apps/playground/src/data/metrics.ts` + dummy baselines in `viz/engine.ts`.

## Adding a dashboard template

Templates are entries in `DASH_TEMPLATES` in
`apps/playground/src/ui/data/dashboards.ts`. Use the `N` / `M` / `B` helpers to
build blocks. Each template should have its **own distinct layout and chart mix**
— avoid cloning an existing one. Reference an existing GA4/GSC template for the
three-row "proper cards" structure, and give it a valid theme preset name.

## Database changes

Schema lives in `apps/server/src/db/schema.ts`. After editing it:

```bash
pnpm --filter @queryrank/server db:generate   # creates a migration in apps/server/drizzle/
```

**Commit the generated migration** alongside your schema change. The server
applies pending migrations automatically on boot, so no manual migrate step is
needed to run locally.

## Reporting security issues

Please **do not** open a public issue for security vulnerabilities. Instead,
report them privately to the maintainers so they can be addressed before
disclosure.

## License

By contributing, you agree that your contributions will be licensed under the
project's [MIT License](./LICENSE).
