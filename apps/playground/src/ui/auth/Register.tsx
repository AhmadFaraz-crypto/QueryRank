import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../AppStore'
import {
  AuthShell,
  useGoogleSignIn,
  MailIc,
  LockIc,
  UserIc,
  EyeIc,
  ArrowIc,
  emailOk,
} from './AuthShell'
import styles from '../Auth.module.scss'

// 0–3: weak / fair / strong — drives the strength meter.
function pwScore(v: string): number {
  let s = 0
  if (v.length >= 8) s++
  if (/[A-Z]/.test(v) && /[a-z]/.test(v)) s++
  if (/\d/.test(v) || /[^\w\s]/.test(v)) s++
  return Math.min(3, s)
}
const STRENGTH = ['Too short', 'Weak', 'Fair', 'Strong']

export function Register() {
  const { registerWithPassword } = useStore()
  const signInWithGoogle = useGoogleSignIn()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [err, setErr] = useState<{ name?: boolean; email?: boolean; pw?: boolean; confirm?: boolean }>({})

  const score = pwScore(pw)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const next = {
      name: name.trim().length < 2,
      email: !emailOk(email),
      pw: pw.length < 8,
      confirm: confirm !== pw || !confirm,
    }
    setErr(next)
    if (next.name || next.email || next.pw || next.confirm) return
    setNotice('')
    setBusy(true)
    try {
      await registerWithPassword(name.trim(), email.trim(), pw)
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not create your account.')
      setBusy(false)
    }
  }

  return (
    <AuthShell>
      {notice ? <div className={styles.notice}>{notice}</div> : null}
      <form className={styles.view} onSubmit={submit} noValidate>
        <h1>Create your account</h1>
        <p className={styles.lead}>Start building dashboards in a couple of minutes.</p>

        <div className={styles.sso} style={{ gridTemplateColumns: '1fr' }}>
          <button type="button" onClick={signInWithGoogle}>
            <span className={styles.ic} style={{ background: '#EA4335' }}>
              G
            </span>
            Sign up with Google
          </button>
        </div>

        <div className={styles.or}>or sign up with email</div>

        <div className={`${styles.f} ${err.name ? styles.err : ''}`}>
          <label>Full name</label>
          <div className={styles.inp}>
            <input type="text" placeholder="Ada Lovelace" value={name} onChange={(e) => setName(e.target.value)} />
            <UserIc />
          </div>
          <div className={styles.msg}>
            ⚠ <span>Enter your name</span>
          </div>
        </div>

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
          <label>Password</label>
          <div className={styles.inp}>
            <input
              type={showPw ? 'text' : 'password'}
              placeholder="At least 8 characters"
              value={pw}
              onChange={(e) => setPw(e.target.value)}
            />
            <LockIc />
            <button type="button" className={styles.eye} onClick={() => setShowPw((s) => !s)} aria-label="Toggle password">
              <EyeIc shown={showPw} />
            </button>
          </div>
          {pw ? (
            <div className={styles.strength} data-score={score}>
              <i /> <i /> <i />
              <span>{STRENGTH[score]}</span>
            </div>
          ) : (
            <div className={styles.msg}>
              ⚠ <span>Use at least 8 characters</span>
            </div>
          )}
        </div>

        <div className={`${styles.f} ${err.confirm ? styles.err : ''}`}>
          <label>Confirm password</label>
          <div className={styles.inp}>
            <input
              type={showPw ? 'text' : 'password'}
              placeholder="Re-enter your password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            <LockIc />
          </div>
          <div className={styles.msg}>
            ⚠ <span>Passwords don’t match</span>
          </div>
        </div>

        <button className={styles.go} type="submit" disabled={busy}>
          <span>{busy ? 'Creating account…' : 'Create account'}</span>
          {busy ? null : <ArrowIc />}
        </button>

        <p className={styles.alt}>
          Already have an account? <Link to="/login">Sign in</Link>
        </p>
      </form>
    </AuthShell>
  )
}
