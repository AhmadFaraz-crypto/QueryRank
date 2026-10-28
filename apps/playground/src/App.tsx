import { lazy, Suspense } from 'react'
import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { AppShell } from './ui/AppShell'
import { AppStoreProvider } from './ui/AppStore'
import { Gallery } from './ui/Gallery'
import { DataSources } from './ui/DataSources'
import { RenderPage } from './ui/RenderPage'
import { RequireAuth } from './ui/RequireAuth'
import { Login } from './ui/auth/Login'
import { Register } from './ui/auth/Register'
import { Forgot } from './ui/auth/Forgot'
import { Reset } from './ui/auth/Reset'

// Code-split the designer (and the chart engine) out of the initial bundle.
const Designer = lazy(() => import('./ui/Designer').then((m) => ({ default: m.Designer })))

// One store shared by the auth pages and the app, so signing in on /login
// carries straight into the guarded routes.
function Providered() {
  return (
    <AppStoreProvider>
      <Outlet />
    </AppStoreProvider>
  )
}

export function App() {
  return (
    <Routes>
      {/* Public, chrome-less render target for the CLI (no auth shell). */}
      <Route
        path="render"
        element={
          <AppStoreProvider>
            <RenderPage />
          </AppStoreProvider>
        }
      />

      <Route element={<Providered />}>
        {/* Public auth pages */}
        <Route path="login" element={<Login />} />
        <Route path="register" element={<Register />} />
        <Route path="forgot" element={<Forgot />} />
        <Route path="reset" element={<Reset />} />

        {/* Everything else requires a session */}
        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route index element={<Navigate to="/dashboards" replace />} />
            <Route path="dashboards" element={<Gallery />} />
            <Route
              path="designer"
              element={
                <Suspense fallback={null}>
                  <Designer />
                </Suspense>
              }
            />
            <Route path="data" element={<DataSources />} />
            <Route path="*" element={<Navigate to="/dashboards" replace />} />
          </Route>
        </Route>
      </Route>
    </Routes>
  )
}
