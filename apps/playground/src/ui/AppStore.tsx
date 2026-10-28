import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { DASH_TEMPLATES, sampleMyDashboard, type Dashboard } from './data/dashboards'
import { clearLiveRanges, defaultBlocks, type BlockConfig } from './viz/engine'
import { defaultTheme, type Theme } from './viz/theme'
import {
  resolveLiveSources,
  fetchLiveRange,
  setLiveSourcePref,
  type LiveState,
} from './liveData'
import { applyDatasets, type ImportedDataset } from './dataImport'
import { datasetsApi } from './datasetsApi'

const DS_KEY = 'qr.datasets'
const DS_ACTIVE_KEY = 'qr.activeDataset'

// --- Server persistence (only used when a real session exists) -------------
interface DashboardRow {
  id: string
  name: string
  config: Partial<Dashboard>
  updatedAt: string | null
}

/** The persisted part of a dashboard (everything except its id/updated stamp). */
function toConfig(d: Dashboard) {
  return {
    n: d.n,
    d: d.d,
    cat: d.cat,
    sub: d.sub,
    theme: d.theme,
    blocks: d.blocks,
    themeState: d.themeState,
  }
}

function fromRow(r: DashboardRow): Dashboard {
  return {
    ...r.config,
    id: r.id,
    n: r.name ?? r.config.n ?? 'Untitled dashboard',
    updated: r.updatedAt ? Date.parse(r.updatedAt) : Date.now(),
  } as Dashboard
}

const dashApi = {
  list: () => fetch('/api/dashboards', { credentials: 'include' }),
  create: (d: Dashboard) =>
    fetch('/api/dashboards', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: d.n, config: toConfig(d) }),
    }),
  update: (id: string, d: Dashboard) =>
    fetch(`/api/dashboards/${id}`, {
      method: 'PUT',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: d.n, config: toConfig(d) }),
    }),
}

interface StoreValue {
  templates: Dashboard[]
  mine: Dashboard[]
  active: Dashboard | null
  /** Open a dashboard in the designer. Templates are copied to "my dashboards". */
  openDesigner: (
    dash: Dashboard,
    opts?: { isTemplate?: boolean; themeName?: string | null },
  ) => void
  /** Persist the designer's current blocks + theme back to the active dashboard. */
  saveActive: (blocks: BlockConfig[], theme: Theme) => void
  newBlank: () => void
  // auth
  authed: boolean
  authReady: boolean
  user: { name: string; email: string; ws: string }
  signOut: () => void
  /** Email + password sign-in. Rejects with a user-facing message on failure. */
  loginWithPassword: (email: string, password: string) => Promise<void>
  /** Create the owner account with a password. Rejects with a message on failure. */
  registerWithPassword: (name: string, email: string, password: string) => Promise<void>
  /** Request a password-reset email. Always resolves (no account enumeration). */
  requestPasswordReset: (email: string) => Promise<void>
  /** Set a new password from a one-time token. Rejects if the link is invalid. */
  resetPassword: (token: string, password: string) => Promise<void>
  /** Bumped whenever live source data is (re)loaded into the chart engine. */
  liveVersion: number
  /** Re-fetch live data for connected sources (e.g. after connecting one). */
  refreshLiveData: () => void
  /** Connected sources + their site/property options (for the preview picker). */
  liveState: LiveState
  /** True when a signed-in session couldn't load its data (API unreachable). */
  dataError: boolean
  /** Retry loading the workspace after a data-load failure. */
  retryData: () => void
  /** Switch which Search Console site / GA4 property the templates pull from. */
  selectLiveSource: (source: 'gsc' | 'ga4', value: string) => void
  /** Ensure a connected source's data for one window (days) is loaded. */
  ensureLiveRange: (kind: 'gsc' | 'ga4', days: number) => void
  /** Retry a failed (source, window) fetch. */
  retryLiveRange: (kind: 'gsc' | 'ga4', days: number) => void
  /** Fetch status of a (source, window): loading / loaded / error / not-started. */
  liveRangeStatus: (kind: 'gsc' | 'ga4', days: number) => 'loading' | 'loaded' | 'error' | undefined
  // imported file datasets (no-keys path)
  datasets: ImportedDataset[]
  activeDatasetId: string | null
  /** Save a parsed dataset, make it active, and render from it. */
  importDataset: (ds: ImportedDataset) => void
  /** Switch the active dataset (null → back to dummy/live). */
  useDataset: (id: string | null) => void
  removeDataset: (id: string) => void
}

const StoreContext = createContext<StoreValue | null>(null)

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext)
  if (!ctx) throw new Error('useStore must be used within <AppStoreProvider>')
  return ctx
}

export function AppStoreProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate()
  const idc = useRef(0)
  // True once a real server session is confirmed — gates all persistence so the
  // app still works fully in demo/offline mode (no session → in-memory only).
  const serverBacked = useRef(false)
  const saveTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [mine, setMine] = useState<Dashboard[]>(() => [
    sampleMyDashboard(defaultBlocks()),
  ])
  const [active, setActive] = useState<Dashboard | null>(null)

  const cloneBlocks = (blocks: BlockConfig[]): BlockConfig[] =>
    blocks.map((b) => ({
      ...JSON.parse(JSON.stringify(b)),
      id: `b${Date.now()}-${idc.current++}`,
    }))

  const openDesigner = useCallback(
    async (
      dash: Dashboard,
      opts: { isTemplate?: boolean; themeName?: string | null } = {},
    ) => {
      let target: Dashboard
      if (opts.isTemplate) {
        target = {
          ...dash,
          id: `d${Date.now()}-${idc.current++}`,
          sub: dash.d,
          theme: opts.themeName ?? dash.theme,
          themeState: null,
          blocks: cloneBlocks(dash.blocks),
          updated: Date.now(),
        }
        // Persist the new copy so it survives a refresh; fall back to local-only.
        if (serverBacked.current) {
          try {
            const res = await dashApi.create(target)
            if (res.ok) target = fromRow(await res.json())
          } catch {
            /* keep the local copy */
          }
        }
        setMine((prev) => [...prev, target])
      } else {
        target = opts.themeName
          ? { ...dash, theme: opts.themeName, themeState: null }
          : dash
        if (opts.themeName)
          setMine((prev) => prev.map((d) => (d.id === target.id ? target : d)))
      }
      setActive(target)
      navigate('/designer')
    },
    [navigate],
  )

  const saveActive = useCallback((blocks: BlockConfig[], theme: Theme) => {
    setActive((cur) => {
      if (!cur) return cur
      const updated: Dashboard = {
        ...cur,
        blocks,
        themeState: theme,
        updated: Date.now(),
      }
      setMine((prev) => prev.map((d) => (d.id === cur.id ? updated : d)))
      // Debounced persistence: the designer calls this on every edit.
      if (serverBacked.current) {
        clearTimeout(saveTimer.current)
        saveTimer.current = setTimeout(() => {
          void dashApi.update(updated.id, updated).catch(() => {})
        }, 700)
      }
      return updated
    })
  }, [])

  const [authed, setAuthed] = useState(false)
  // False until the initial /api/auth/me session check resolves, so the route
  // guard doesn't bounce a logged-in user to /login before the check finishes.
  const [authReady, setAuthReady] = useState(false)
  const [user, setUser] = useState({ name: '', email: '', ws: '' })
  const signOut = useCallback(() => {
    void fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(
      () => {},
    )
    setAuthed(false)
  }, [])

  const [liveVersion, setLiveVersion] = useState(0)
  const [liveState, setLiveState] = useState<LiveState>({ injected: false })
  // Per-(source, window) fetch status, so each card shows a loader / live data /
  // "data not loaded" for its own date range. Keyed `${kind}|${days}`. The ref
  // mirrors the state for synchronous dedupe (many cards request the same range).
  type RangeStatus = 'loading' | 'loaded' | 'error'
  const [rangeStatus, setRangeStatus] = useState<Record<string, RangeStatus>>({})
  const statusRef = useRef<Record<string, RangeStatus>>({})
  const rangeKey = (kind: 'gsc' | 'ga4', days: number) => `${kind}|${days}`
  const setStatus = useCallback((key: string, val: RangeStatus | undefined) => {
    const next = { ...statusRef.current }
    if (val) next[key] = val
    else delete next[key]
    statusRef.current = next
    setRangeStatus(next)
  }, [])
  // True when a signed-in session couldn't load its data from the backend
  // (API unreachable). Drives the "data not loaded" state instead of dummy.
  const [dataError, setDataError] = useState(false)

  // Re-discover connected sources (not their data — cards fetch the windows they
  // need). Clears the registry + per-range status so stale data never lingers.
  const refreshLiveData = useCallback(async () => {
    clearLiveRanges()
    statusRef.current = {}
    setRangeStatus({})
    setLiveState(await resolveLiveSources())
    setLiveVersion((v) => v + 1)
  }, [])

  // Ensure a connected source's data for one window is loaded (once). Cards call
  // this for their current date range; dedupes via the status ref.
  const ensureLiveRange = useCallback(
    async (kind: 'gsc' | 'ga4', days: number) => {
      const src = liveState[kind]
      if (!src || src.error || !src.selected) return
      const key = rangeKey(kind, days)
      const cur = statusRef.current[key]
      if (cur === 'loading' || cur === 'loaded') return
      setStatus(key, 'loading')
      const ok = await fetchLiveRange(kind, src.connId, src.selected, days)
      setStatus(key, ok ? 'loaded' : 'error')
      setLiveVersion((v) => v + 1)
    },
    [liveState, setStatus],
  )

  // Retry one failed (source, window) — clears its error and re-fetches.
  const retryLiveRange = useCallback(
    (kind: 'gsc' | 'ga4', days: number) => {
      setStatus(rangeKey(kind, days), undefined)
      void ensureLiveRange(kind, days)
    },
    [ensureLiveRange, setStatus],
  )

  const liveRangeStatus = useCallback(
    (kind: 'gsc' | 'ga4', days: number): RangeStatus | undefined =>
      rangeStatus[rangeKey(kind, days)],
    [rangeStatus],
  )

  // Switch the site/property the templates pull from: remember it, re-resolve
  // (which clears cached windows), and let the cards re-fetch for their ranges.
  const selectLiveSource = useCallback(
    (source: 'gsc' | 'ga4', value: string) => {
      setLiveSourcePref(source, value)
      void refreshLiveData()
    },
    [refreshLiveData],
  )

  // --- imported file datasets (the no-keys path) ----------------------------
  const [datasets, setDatasets] = useState<ImportedDataset[]>([])
  const [activeDatasetId, setActiveDatasetId] = useState<string | null>(null)

  const persistDatasets = useCallback((list: ImportedDataset[], activeId: string | null) => {
    try {
      localStorage.setItem(DS_KEY, JSON.stringify(list))
      if (activeId) localStorage.setItem(DS_ACTIVE_KEY, activeId)
      else localStorage.removeItem(DS_ACTIVE_KEY)
    } catch {
      /* storage unavailable — stays in memory for this session */
    }
  }, [])

  // Restore imported datasets on first load and render them all. GSC + GA4
  // imports fill disjoint metrics, so every stored dataset is applied together.
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(DS_KEY) || '[]') as ImportedDataset[]
      if (!saved.length) return
      setDatasets(saved)
      setActiveDatasetId(localStorage.getItem(DS_ACTIVE_KEY))
      applyDatasets(saved)
      setLiveVersion((v) => v + 1)
    } catch {
      /* ignore corrupt storage */
    }
  }, [])

  const importDataset = useCallback(
    (ds: ImportedDataset) => {
      setDatasets((prev) => {
        const list = [...prev.filter((d) => d.id !== ds.id), ds]
        persistDatasets(list, ds.id)
        applyDatasets(list)
        setLiveVersion((v) => v + 1)
        if (serverBacked.current) datasetsApi.create(ds).catch(() => {})
        return list
      })
      setActiveDatasetId(ds.id)
    },
    [persistDatasets],
  )

  // Toggle all imports on (any id) or off (null → back to dummy/live).
  const useDataset = useCallback(
    (id: string | null) => {
      setActiveDatasetId(id)
      setDatasets((prev) => {
        applyDatasets(id ? prev : [])
        persistDatasets(prev, id)
        return prev
      })
      setLiveVersion((v) => v + 1)
    },
    [persistDatasets],
  )

  const removeDataset = useCallback(
    (id: string) => {
      setDatasets((prev) => {
        const list = prev.filter((d) => d.id !== id)
        persistDatasets(list, list.length ? activeDatasetId : null)
        applyDatasets(list)
        setLiveVersion((v) => v + 1)
        if (serverBacked.current) datasetsApi.remove(id).catch(() => {})
        if (!list.length) setActiveDatasetId(null)
        return list
      })
    },
    [activeDatasetId, persistDatasets],
  )

  // Load everything that belongs to a signed-in session: saved dashboards,
  // live source data, and imported datasets. Shared by the initial session
  // check and the email/password sign-in + register paths.
  const loadWorkspace = useCallback(async () => {
    serverBacked.current = true
    // Track whether the user's own dashboards actually loaded. If the backend
    // is unreachable we surface a "data not loaded" state rather than leave the
    // in-memory sample on screen looking like real data.
    let loaded = false
    try {
      const res = await dashApi.list()
      if (res.ok) {
        loaded = true
        const rows = (await res.json()) as DashboardRow[]
        if (rows.length) {
          setMine(rows.map(fromRow))
        } else {
          // First login: seed a sample dashboard and persist it.
          const sample = sampleMyDashboard(defaultBlocks())
          const created = await dashApi.create(sample)
          if (created.ok) setMine([fromRow(await created.json())])
        }
      }
    } catch {
      /* backend unreachable — flagged via dataError below */
    }
    setDataError(!loaded)
    if (!loaded) return
    // Discover connected sources; cards fetch the windows they need on render.
    try {
      setLiveState(await resolveLiveSources())
      setLiveVersion((v) => v + 1)
    } catch {
      /* no live sources */
    }
    // Load imported datasets and re-apply the active one (loadLiveData cleared
    // the registry above).
    try {
      const dres = await datasetsApi.list()
      if (dres.ok) {
        const list = (await dres.json()) as ImportedDataset[]
        if (list.length) {
          setDatasets(list)
          setActiveDatasetId(localStorage.getItem(DS_ACTIVE_KEY) ?? list[list.length - 1].id)
          applyDatasets(list)
          setLiveVersion((v) => v + 1)
        }
      }
    } catch {
      /* fall back to localStorage datasets */
    }
  }, [])

  // Email + password sign-in. Throws with a server message on failure so the
  // form can surface it; on success, hydrates the workspace and enters the app.
  const loginWithPassword = useCallback(
    async (email: string, password: string) => {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Sign in failed.')
      setUser({ name: body.name || body.email || email, email: body.email || email, ws: '' })
      setAuthed(true)
      await loadWorkspace()
      navigate('/dashboards')
    },
    [navigate, loadWorkspace],
  )

  const registerWithPassword = useCallback(
    async (name: string, email: string, password: string) => {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Could not create your account.')
      setUser({ name: body.name || name, email: body.email || email, ws: '' })
      setAuthed(true)
      await loadWorkspace()
      navigate('/dashboards')
    },
    [navigate, loadWorkspace],
  )

  // Forgot flow: ask for a reset link. Always resolves (the server answers the
  // same whether or not the account exists), so the UI never leaks existence.
  const requestPasswordReset = useCallback(async (email: string) => {
    await fetch('/api/auth/password/request', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    }).catch(() => {})
  }, [])

  // Set a new password from a one-time token. Throws with a server message
  // (expired/used/invalid) so the reset form can show it.
  const resetPassword = useCallback(async (token: string, password: string) => {
    const res = await fetch('/api/auth/password/reset', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, password }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(body.error || 'Could not reset your password.')
  }, [])

  // Check the server session and, if one exists, hydrate the workspace from
  // Postgres. Distinguishes three outcomes so the UI never shows dummy data in
  // place of real data: 401 → logged out (route guard → /login); network error
  // or 5xx → backend unreachable (dataError → "data not loaded"); ok → signed in.
  const checkSession = useCallback(async () => {
    setDataError(false)
    try {
      const r = await fetch('/api/auth/me', { credentials: 'include' })
      if (r.status === 401) {
        // Genuinely not signed in — the guard will send us to /login.
        setAuthed(false)
        setAuthReady(true)
        return
      }
      if (!r.ok) {
        setDataError(true)
        setAuthReady(true)
        return
      }
      const u = (await r.json()) as { name?: string; email?: string }
      if (!u?.email) {
        setAuthReady(true)
        return
      }
      setUser({ name: u.name || u.email, email: u.email, ws: '' })
      setAuthed(true)
      setAuthReady(true)
      await loadWorkspace()
    } catch {
      // Network error — server unreachable. Show "data not loaded", not /login.
      setDataError(true)
      setAuthReady(true)
    }
  }, [loadWorkspace])

  useEffect(() => {
    void checkSession()
  }, [checkSession])

  // Retry after a "data not loaded" error (backend came back). Re-runs the
  // whole session check so it recovers both the signed-out-looking server-down
  // case and a post-login dashboards failure.
  const retryData = useCallback(() => {
    void checkSession()
  }, [checkSession])

  const newBlank = useCallback(async () => {
    const d: Dashboard = {
      id: `d${Date.now()}-${idc.current++}`,
      n: 'Untitled dashboard',
      d: 'A blank dashboard',
      cat: 'Custom',
      sub: 'Start by adding charts or metrics',
      theme: 'Clean',
      themeState: defaultTheme(),
      blocks: [],
      updated: Date.now(),
    }
    let target = d
    if (serverBacked.current) {
      try {
        const res = await dashApi.create(d)
        if (res.ok) target = fromRow(await res.json())
      } catch {
        /* keep the local blank */
      }
    }
    setMine((prev) => [...prev, target])
    setActive(target)
    navigate('/designer')
  }, [navigate])

  return (
    <StoreContext.Provider
      value={{
        templates: DASH_TEMPLATES,
        mine,
        active,
        openDesigner,
        saveActive,
        newBlank,
        authed,
        authReady,
        user,
        signOut,
        loginWithPassword,
        registerWithPassword,
        requestPasswordReset,
        resetPassword,
        liveVersion,
        refreshLiveData,
        liveState,
        dataError,
        retryData,
        selectLiveSource,
        ensureLiveRange,
        retryLiveRange,
        liveRangeStatus,
        datasets,
        activeDatasetId,
        importDataset,
        useDataset,
        removeDataset,
      }}
    >
      {children}
    </StoreContext.Provider>
  )
}
