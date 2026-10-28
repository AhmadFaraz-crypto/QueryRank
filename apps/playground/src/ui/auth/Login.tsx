import { useEffect, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../AppStore'
import {
  AuthShell,
  useGoogleSignIn,
  MailIc,
  LockIc,
  EyeIc,
  ArrowIc,
  emailOk,
} from './AuthShell'
import styles from '../Auth.module.scss'

export function Login() {
  const { loginWithPassword } = useStore()
  const signInWithGoogle = useGoogleSignIn()
  const [notice, setNotice] = useState('')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<{ email?: boolean; pw?: boolean }>({})

  useEffect(() => {
    const q = new URLSearchParams(window.location.search)
    const p = q.get('auth')
    if (p === 'forbidden') setNotice('That Google account isn’t allowed on this instance.')
    else if (p === 'error') setNotice('Google sign-in failed. Please try again.')
    else if (q.get('reset') === '1') setNotice('Password updated — sign in with your new password.')
  }, [])

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const eBad = !emailOk(email)
    const pBad = pw.trim().length < 1
    setErr({ email: eBad, pw: pBad })
    if (eBad || pBad) return
    setNotice('')
    setBusy(true)
    try {
      await loginWithPassword(email.trim(), pw)
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Sign in failed.')
      setBusy(false)
    }
  }

  return (
    <AuthShell>
      {notice ? <div className={styles.notice}>{notice}</div> : null}
      <form className={styles.view} onSubmit={submit} noValidate>
        <h1>Welcome back</h1>
        <p className={styles.lead}>Sign in to your QueryRank workspace.</p>

        <div className={styles.sso} style={{ gridTemplateColumns: '1fr' }}>
          <button type="button" onClick={signInWithGoogle}>
            <span className={styles.ic} style={{ background: '#EA4335' }}>
              G
            </span>
            Continue with Google
          </button>
        </div>

        <div className={styles.or}>or sign in with email</div>

        <div className={`${styles.f} ${err.email ? styles.err : ''}`}>
          <label>Work email</label>
          <div className={styles.inp}>
            <input type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            <MailIc />
          </div>
          <div className={styles.msg}>
            ⚠ <span>Enter a valid email address</span>
          </div>
        </div>

        <div className={`${styles.f} ${err.pw ? styles.err : ''}`}>
          <label>
            Password
            <Link to="/forgot">Forgot password?</Link>
          </label>
          <div className={styles.inp}>
            <input
              type={showPw ? 'text' : 'password'}
              placeholder="Your password"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
            />
            <LockIc />
            <button type="button" className={styles.eye} onClick={() => setShowPw((s) => !s)} aria-label="Toggle password">
              <EyeIc shown={showPw} />
            </button>
          </div>
          <div className={styles.msg}>
            ⚠ <span>Enter your password</span>
          </div>
        </div>

        <button className={styles.go} type="submit" disabled={busy}>
          <span>{busy ? 'Signing in…' : 'Sign in'}</span>
          {busy ? null : <ArrowIc />}
        </button>

        <p className={styles.alt}>
          New to QueryRank? <Link to="/register">Create an account</Link>
        </p>
      </form>
    </AuthShell>
  )
}
