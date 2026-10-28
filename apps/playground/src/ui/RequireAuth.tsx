import { Navigate, Outlet } from 'react-router-dom'
import { useStore } from './AppStore'
import { DataNotLoaded } from './DataNotLoaded'

/**
 * Gate for the app routes: once the initial session check has resolved, send
 * signed-out visitors to /login; otherwise render the app. Waiting on
 * `authReady` avoids bouncing a logged-in user to /login before the check runs.
 * When the backend is unreachable we show "data not loaded" (with retry) rather
 * than bouncing to /login, which would wrongly look like a sign-out.
 */
export function RequireAuth() {
  const { authed, authReady, dataError, retryData } = useStore()
  if (!authReady) return null
  if (dataError && !authed) return <DataNotLoaded fullscreen onRetry={retryData} />
  if (!authed) return <Navigate to="/login" replace />
  return <Outlet />
}
