# QueryRank — single production image: builds the SPA and serves it from the
# Hono API server, so the whole app runs from one container on one port.
#
#   docker compose up        # (compose builds this and starts Postgres too)

# ---- base: Node + pnpm -------------------------------------------------------
FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app

# ---- deps: install the whole workspace (cached on manifests) -----------------
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY packages/adapters/package.json ./packages/adapters/
COPY packages/cli/package.json ./packages/cli/
COPY apps/playground/package.json ./apps/playground/
COPY apps/server/package.json ./apps/server/
RUN pnpm install --frozen-lockfile

# ---- build: compile the SPA --------------------------------------------------
FROM deps AS build
COPY . .
RUN pnpm --filter @queryrank/playground build

# ---- runtime -----------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=3000
# The server (tsx) + its workspace deps + the built SPA all come from the build
# stage. The server serves playground/dist (see STATIC_DIR in index.ts).
COPY --from=build /app /app
WORKDIR /app/apps/server
EXPOSE 3000
# `start` = tsx src/index.ts — runs migrations on boot, then serves UI + API.
CMD ["pnpm", "start"]
