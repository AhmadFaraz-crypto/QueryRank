/**
 * Unix-socket support for postgres.js (e.g. Google Cloud SQL from Cloud Run,
 * where the DB is reached at `/cloudsql/INSTANCE`). postgres.js can't take the
 * socket path from the URL: it ignores a `?host=` query param for connecting and
 * instead forwards it to the server as a startup parameter (which errors with
 * `unrecognized configuration parameter "host"`). So we pull the socket path out
 * of the URL, pass it as the `host` OPTION, and hand postgres.js a cleaned URL.
 *
 * Example socket URL:
 *   postgres://user:pass@localhost/db?host=/cloudsql/project:region:instance
 *
 * Returns the URL unchanged (and no options) for ordinary TCP connections.
 */
export function pgConnection(databaseUrl: string): {
  url: string
  options: { host?: string }
} {
  try {
    const u = new URL(databaseUrl)
    const host = u.searchParams.get('host')
    if (host && host.startsWith('/')) {
      u.searchParams.delete('host')
      return { url: u.toString(), options: { host } }
    }
  } catch {
    /* not a parseable URL — pass it through unchanged */
  }
  return { url: databaseUrl, options: {} }
}
