# Changelog

All notable changes to QueryRank are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and the project aims to
follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

Each released version is published as a container image at
`ghcr.io/ahmadfaraz-crypto/queryrank`. Self-hosters: read this file before
upgrading — new environment variables and any breaking changes are noted per
release.

## [Unreleased]

### Added

- Self-hosted API (Hono + Drizzle + Postgres): Google OAuth **and**
  email/password auth with a password-reset flow (Resend).
- Live **Google Search Console** and **Google Analytics 4** connections —
  per-card date ranges drive the fetch, with period-over-period deltas; OAuth
  tokens encrypted at rest.
- **CSV import** (no keys), including multi-section GA4 "overview" exports; a
  dedicated **Leads overview** template.
- Dashboard **designer** (charts / templates / layers, themes, preview, publish)
  and Postgres-backed dashboard persistence.
- `queryrank` CLI (`templates`, `render`).
- Deployment: single-container `Dockerfile`, `docker-compose.prod.yml` (pulls the
  published image), and a [Google Cloud guide](./DEPLOY.md).

<!--
Template for the next release — move Unreleased items here and date it:

## [0.1.0] - YYYY-MM-DD

### Added
### Changed
### Fixed
### Removed
-->
