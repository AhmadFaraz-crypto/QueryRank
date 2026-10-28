# QueryRank

A fully customizable, open-source **data template builder**. Create and manage
templates powered by different data sources — Google Search Console (GSC), Google
Analytics 4 (GA4), and more in the future.

> **Status: self-hostable and real.** Run it on your own Postgres (see
> [Backend & self-hosting](#backend--self-hosting)). Sign in with **Google** or
> **email + password** (with a password-reset flow). **Google Search Console**
> and **Google Analytics 4** connect over OAuth and stream live data straight
> into the dashboard charts — each card pulls the date range you pick (last
> 7 / 14 / 28 / 30 / 90 days, 12 months, or a custom window), with
> period-over-period deltas. Integration tokens are **encrypted at rest**, and
> **dashboards persist to the database**. No keys? Import GSC/GA4 CSV exports and
> everything renders the same way. When a source can't be reached, cards show a
> clear **"data not loaded"** state — never stale or made-up numbers.

## Tech stack

- [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- [Vite](https://vite.dev/) (playground app)
- [Sass](https://sass-lang.com/) with CSS Modules (`*.module.scss`)
- [Vitest](https://vitest.dev/) for testing
- [ESLint](https://eslint.org/) + [Prettier](https://prettier.io/)
- [pnpm workspaces](https://pnpm.io/workspaces) monorepo

## Monorepo structure

```
data-templates/
├── packages/            # reusable / distributable
│   ├── adapters/        #   Google Search Console + GA4 API clients (used by the server)
│   └── cli/             #   the `queryrank` command — render templates to images, and more
└── apps/                # deployables
    ├── playground/      #   the React app — dashboards, templates, designer, CSV import
    └── server/          #   self-hosted API: auth (Google + password) + Postgres (bring your own)
```

### Workspace responsibilities

| Package                 | Purpose                                                                          |
| ----------------------- | -------------------------------------------------------------------------------- |
| `@queryrank/adapters`   | GSC/GA4 REST clients (`gscQuery`, `ga4RunReport`, …) + OAuth scopes              |
| `@queryrank/cli`        | The `queryrank` CLI — `templates`, `render <template>` (PNG/PDF), extensible     |
| `@queryrank/playground` | The product UI — React 19 SPA (chart engine, templates, designer, import)        |
| `@queryrank/server`     | Self-hosted API — auth (Google + email/password), Postgres, connections, imports |

Everything is consumed directly from TypeScript source inside the monorepo, so
there is no package build step during development.

## Requirements

- [Node.js](https://nodejs.org/) `>= 20`
- [pnpm](https://pnpm.io/) `>= 9` (this repo is set up with pnpm 10)

Enable pnpm via Corepack if you don't have it:

```bash
corepack enable
```

## Installation

```bash
# Clone the repository
git clone <your-repo-url> data-templates
cd data-templates

# Install all workspace dependencies
pnpm install
```

## Development

Start the playground app (Vite dev server):

```bash
pnpm dev
```

Then open the URL printed in the terminal (default: http://localhost:5173).

## Backend & self-hosting

QueryRank is **self-hosted and privacy-first**: you run it, you point it at
**your own Postgres**, and — for Google data sources — you bring **your own
Google OAuth app**. No analytics data or credentials ever leave your
infrastructure. Sign-in is single-user: only the email you configure
(`ALLOWED_EMAIL`) may register or log in — either with **Google** or with
**email + password**. Google is optional; the email/password flow works on its
own, so you can run the app and import CSVs without any Google setup.

### 1. Start Postgres

```bash
docker compose up -d        # starts Postgres on localhost:5433
```

(Or use any Postgres you already run — just update `DATABASE_URL`.)

### 2. Configure the server

```bash
cp apps/server/.env.example apps/server/.env
# Generate a secret for signing sessions / encrypting tokens:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Edit `apps/server/.env` and set `APP_SECRET` (the value above) and
`ALLOWED_EMAIL` (the only email allowed to register / sign in).

That's enough to start: you can register that email with a password and import
CSVs right away. Google OAuth (step 3) is **optional** — add it only to sign in
with Google or to connect live GSC/GA4 data.

**Password reset (optional).** The forgot-password flow emails a one-time link
via [Resend](https://resend.com). Set `RESEND_API_KEY` and `EMAIL_FROM` in
`.env` to enable it. If they're unset, email/password sign-in still works; in
development the reset link is printed to the server console instead of emailed.

### 3. Register your own Google OAuth app (optional)

Skip this if you only need email/password + CSV import. To sign in with Google
or connect live GSC/GA4 data, register an OAuth app:

At <https://console.cloud.google.com> → **APIs & Services → Credentials →
Create credentials → OAuth client ID** (type: _Web application_). Add **both**
authorized redirect URIs — one for sign-in, one for connecting Search Console:

```
http://localhost:5173/api/auth/google/callback
http://localhost:5173/api/connections/google/callback
```

Paste the resulting `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` into
`apps/server/.env`.

To pull data, enable the relevant Google APIs for the project (APIs & Services →
Library): **Google Search Console API** for GSC, and **Google Analytics Admin
API** + **Google Analytics Data API** for GA4. While your OAuth app is in
“testing”, add your Google account under **OAuth consent screen → Test users**.

Then on the Data sources page click **Connect Search Console** or **Connect
Analytics 4** — both use the single redirect URI above (the provider is carried
in the OAuth `state`). QueryRank stores each refresh token **encrypted**
(AES-256-GCM) and fetches the date window each card is set to (default: the last
28 days, with the matching previous period for deltas). Live data flows straight
into the dashboards — the matching template goes live, and everything else stays
on sample data until its own source is connected.

### 4. Run it

```bash
pnpm dev:all        # run the SPA (:5173) and the API (:3000) together
```

On first start the server **creates the database and its tables automatically**
— you don't run any database commands. (Auto-creating the database needs a role
with `CREATEDB`; the Docker setup has it. If yours doesn't, create the empty
database once — e.g. `createdb queryrank` — and the server will do the rest.)

Open http://localhost:5173 and sign in — **Continue with Google**, or create an
account with your `ALLOWED_EMAIL` and a password at **Create an account**.

> Nothing secret lives in the repo: `.env` is git-ignored, and each self-hoster
> supplies their own database and OAuth credentials.

### Environment variables

All server configuration lives in `apps/server/.env` (copy from `.env.example`):

| Variable               | Required | Default                 | Description                                                                                                                      |
| ---------------------- | -------- | ----------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `DATABASE_URL`         | Yes      | —                       | Postgres connection string. Docker default: `postgres://queryrank:queryrank@localhost:5433/queryrank`.                           |
| `APP_SECRET`           | Yes      | —                       | Long random string — signs session cookies and encrypts stored OAuth tokens (AES-256-GCM).                                       |
| `ALLOWED_EMAIL`        | Yes      | —                       | The only email allowed to register / sign in (single-user).                                                                      |
| `PORT`                 | No       | `3000`                  | Port the API server listens on.                                                                                                  |
| `OAUTH_REDIRECT_BASE`  | No       | `http://localhost:5173` | Public origin used to build OAuth redirect URIs and the password-reset link. Set to your domain in production.                   |
| `GOOGLE_CLIENT_ID`     | No       | —                       | Google OAuth client ID. Needed only for Google sign-in and connecting GSC/GA4.                                                   |
| `GOOGLE_CLIENT_SECRET` | No       | —                       | Google OAuth client secret (pairs with `GOOGLE_CLIENT_ID`).                                                                      |
| `RESEND_API_KEY`       | No       | —                       | [Resend](https://resend.com) API key — enables password-reset emails. Unset → reset link is logged to the server console in dev. |
| `EMAIL_FROM`           | No       | —                       | Verified sender for reset emails, e.g. `QueryRank <noreply@yourdomain.com>`.                                                     |

Only the three **Required** vars are needed to run (email/password sign-in + CSV
import). Add Google for live data, and Resend for password-reset emails.

## Available scripts

Run these from the repository root:

| Command             | Description                                     |
| ------------------- | ----------------------------------------------- |
| `pnpm dev`          | Start the playground (SPA) dev server           |
| `pnpm dev:server`   | Start the API server only                       |
| `pnpm dev:all`      | Start the SPA and API together                  |
| `pnpm cli <cmd>`    | Run the `queryrank` CLI (`templates`, `render`) |
| `pnpm db:push`      | (dev) push schema changes without a migration   |
| `pnpm db:studio`    | Open Drizzle Studio against your database       |
| `pnpm build`        | Type-check and build the playground app         |
| `pnpm preview`      | Preview the production build                    |
| `pnpm test`         | Run all unit tests once (Vitest)                |
| `pnpm test:watch`   | Run tests in watch mode                         |
| `pnpm lint`         | Lint the whole repo with ESLint                 |
| `pnpm format`       | Format the codebase with Prettier               |
| `pnpm format:check` | Check formatting without writing                |
| `pnpm typecheck`    | Type-check every package and the app            |

You can also target a single package, e.g.:

```bash
pnpm --filter @queryrank/playground test
```

## Dashboards, templates & the designer

QueryRank ships with ready-made dashboard **templates** (SEO/Search Console and
GA4). Open one from the gallery to **Preview** it, then **Edit** to open the
**designer**. The designer's left sidebar has three panels:

- **Charts** — drag or double-click a chart type onto the canvas.
- **Templates** — drop in a whole pre-built block group.
- **Layers** — reorder, duplicate, or delete the blocks on the canvas.

Pick colors/typography from the **Theme** panel, switch desktop/mobile, and use
**Preview** for a read-only view or **Publish** to save it to your dashboards.
Edits **auto-save to Postgres** as you work; each saved dashboard stores its
block + theme configuration as JSON in the `dashboards.config` column. There is
no separate on-disk template file format — templates are defined in the chart
engine and rendered from live, imported, or sample data.

## Extending the project

- **Add a data source:** add a REST client in `packages/adapters` (see
  `gsc.ts` / `ga4.ts` for the shape — a query function plus its OAuth scope),
  add a service under `apps/server/src/<source>/`, wire it into
  `apps/server/src/routes/connections.ts` and a connect card on the Data sources
  page, then map its metrics into the chart engine in
  `apps/playground/src/ui/liveData.ts`.
- **Add a CLI command:** create a file under `packages/cli/src/commands` that
  exports a `register(program)` function, then add it to the `COMMANDS` registry
  in `packages/cli/src/index.ts`.

## Contributing

Contributions are welcome! See [CONTRIBUTING.md](./CONTRIBUTING.md) for local
setup, coding standards, the pre-PR checklist, and step-by-step guides for adding
a data source, a dashboard template, or a CLI command.

## License

[MIT](./LICENSE)
