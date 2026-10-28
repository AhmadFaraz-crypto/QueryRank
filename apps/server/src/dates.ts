// Shared date-window helpers for the analytics adapters. Windows end 2 full
// days ago (accounting for the ~2-day reporting lag) and span `days` days, with
// a matching previous window of the same length for period-over-period deltas.

export const fmtDate = (d: Date) => d.toISOString().slice(0, 10)

/** The last `days` full days, ending ~2 days ago for the reporting lag. */
export function lastN(days: number): { startDate: string; endDate: string } {
  const span = Math.max(1, Math.floor(days))
  const end = new Date(Date.now() - 2 * 86_400_000)
  const start = new Date(end.getTime() - (span - 1) * 86_400_000)
  return { startDate: fmtDate(start), endDate: fmtDate(end) }
}

/** The default window: last 28 days. */
export const last28 = () => lastN(28)

/** The window of the same length immediately preceding `r`. */
export function prevRange(r: { startDate: string; endDate: string }): {
  startDate: string
  endDate: string
} {
  const start = new Date(`${r.startDate}T00:00:00Z`)
  const end = new Date(`${r.endDate}T00:00:00Z`)
  const spanMs = end.getTime() - start.getTime()
  const endPrev = new Date(start.getTime() - 86_400_000)
  const startPrev = new Date(endPrev.getTime() - spanMs)
  return { startDate: fmtDate(startPrev), endDate: fmtDate(endPrev) }
}
