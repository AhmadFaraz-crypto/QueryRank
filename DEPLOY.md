# Deploying QueryRank to Google Cloud (GCP)

QueryRank ships as a **single container** (built by the root `Dockerfile`) that
serves the SPA **and** the API on one port, and runs database migrations on
boot. The cleanest GCP setup is:

- **Cloud Run** — runs the container (serverless, auto-HTTPS, scales to zero)
- **Cloud SQL for PostgreSQL** — the managed database
- **Artifact Registry** — stores the built image (handled by Cloud Build)

Everything below uses the `gcloud` CLI. Replace the `UPPER_CASE` placeholders.

## 0. Prerequisites

```bash
gcloud auth login
gcloud config set project PROJECT_ID
gcloud config set run/region REGION        # e.g. us-central1

# Enable the APIs this deployment uses
gcloud services enable \
  run.googleapis.com \
  sqladmin.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com
```

## 1. Create the database (Cloud SQL)

```bash
# A small Postgres 16 instance (db-f1-micro is the cheapest; size up as needed)
gcloud sql instances create queryrank-db \
  --database-version=POSTGRES_16 \
  --tier=db-f1-micro \
  --region=REGION

# The database + an app user. Pre-creating the DB avoids needing CREATEDB.
gcloud sql databases create queryrank --instance=queryrank-db
gcloud sql users create queryrank --instance=queryrank-db --password='DB_PASSWORD'

# Note the connection name — looks like PROJECT_ID:REGION:queryrank-db
gcloud sql instances describe queryrank-db --format='value(connectionName)'
```

Call that value `INSTANCE_CONNECTION_NAME` below.

## 2. Store secrets (recommended)

```bash
# APP_SECRET: a long random string (signs sessions, encrypts stored tokens)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))" \
  | gcloud secrets create APP_SECRET --data-file=-

# If using Google sign-in / live GSC+GA4:
printf 'YOUR_GOOGLE_CLIENT_SECRET' | gcloud secrets create GOOGLE_CLIENT_SECRET --data-file=-
# If using password-reset emails (Resend):
printf 'YOUR_RESEND_API_KEY' | gcloud secrets create RESEND_API_KEY --data-file=-
```

(You can also pass these as plain `--set-env-vars` instead of Secret Manager.)

## 3. Deploy to Cloud Run (builds from the Dockerfile)

`gcloud run deploy --source .` builds the image with Cloud Build, pushes it to
Artifact Registry, and deploys — one command.

```bash
gcloud run deploy queryrank \
  --source . \
  --platform managed \
  --allow-unauthenticated \
  --add-cloudsql-instances INSTANCE_CONNECTION_NAME \
  --set-env-vars "NODE_ENV=production" \
  --set-env-vars "ALLOWED_EMAIL=you@example.com" \
  --set-env-vars "DATABASE_URL=postgres://queryrank:DB_PASSWORD@localhost/queryrank?host=/cloudsql/INSTANCE_CONNECTION_NAME" \
  --set-env-vars "GOOGLE_CLIENT_ID=YOUR_GOOGLE_CLIENT_ID" \
  --set-secrets "APP_SECRET=APP_SECRET:latest" \
  --set-secrets "GOOGLE_CLIENT_SECRET=GOOGLE_CLIENT_SECRET:latest"
```

Notes:

- **Port:** Cloud Run sets `PORT` (8080); the server reads `process.env.PORT`, so
  no change needed.
- **Cloud SQL:** `--add-cloudsql-instances` mounts the instance at
  `/cloudsql/INSTANCE_CONNECTION_NAME`, which the `DATABASE_URL` points at via a
  unix socket (no public IP required). The `@localhost` in the URL is just a
  placeholder so the URL parses — the real connection uses the `?host=` socket
  path.
- **Migrations** run automatically on boot and are idempotent.
- Drop the Google/Resend lines if you only want email+password sign-in and CSV
  import.

## 4. Set the public URL, then redeploy

The OAuth redirect and password-reset links need the app's real URL. After the
first deploy, grab it and set `OAUTH_REDIRECT_BASE`:

```bash
SERVICE_URL=$(gcloud run services describe queryrank --format='value(status.url)')
echo "$SERVICE_URL"   # e.g. https://queryrank-xxxxx-uc.a.run.app

gcloud run services update queryrank \
  --update-env-vars "OAUTH_REDIRECT_BASE=$SERVICE_URL"
```

## 5. Update Google OAuth (only if using Google)

In the [Google Cloud Console](https://console.cloud.google.com) → **APIs &
Services → Credentials → your OAuth client**, add these **Authorized redirect
URIs** (replace with your `SERVICE_URL`):

```
https://queryrank-xxxxx-uc.a.run.app/api/auth/google/callback
https://queryrank-xxxxx-uc.a.run.app/api/connections/google/callback
```

Also enable **Search Console API** and the **Analytics Admin + Data APIs** if you
connect GSC/GA4, and add your account under **OAuth consent screen → Test users**
while the app is in testing.

## 6. Open it

Visit the `SERVICE_URL` and sign in — **Continue with Google**, or **Create an
account** with your `ALLOWED_EMAIL` and a password.

---

## Cost & scaling notes

- **Cloud Run** scales to zero — you pay only while handling requests. First
  request after idle has a short cold start (the server boots + checks
  migrations).
- **Cloud SQL** is the main always-on cost; `db-f1-micro` is the cheapest tier.
- QueryRank is **single-user** (`ALLOWED_EMAIL`), so a tiny instance is plenty.

## Troubleshooting

- **Can't connect to the DB:** confirm `--add-cloudsql-instances` matches the
  `host=/cloudsql/...` in `DATABASE_URL`, and that the `queryrank` user/password
  are correct.
- **Secure-cookie / login loop:** make sure you're on the `https://…run.app` URL
  (not a custom HTTP origin) — production sessions require HTTPS, which Cloud Run
  provides.
- **Redirect URI mismatch on Google sign-in:** the Console redirect URIs must
  exactly match `OAUTH_REDIRECT_BASE` + the callback paths from step 5.

## Alternatives

The same container also runs on **Render**, **Railway**, or **Fly.io**, or on any
VM with Docker via `docker compose up` (the repo's `docker-compose.yml` starts
Postgres too). Pick whichever fits — the image is portable.
