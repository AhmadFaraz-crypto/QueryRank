import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useStore } from '../AppStore'
import { AuthShell, LockIc, EyeIc, ArrowIc } from './AuthShell'
import styles from '../Auth.module.scss'

// 0–3: weak / fair / strong — mirrors the register strength meter.
function pwScore(v: string): number {
  let s = 0
  if (v.length >= 8) s++
  if (/[A-Z]/.test(v) && /[a-z]/.test(v)) s++
  if (/\d/.test(v) || /[^\w\s]/.test(v)) s++
  return Math.min(3, s)
}
const STRENGTH = ['Too short', 'Weak', 'Fair', 'Strong']

export function Reset() {
  const { resetPassword } = useStore()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  const [pw, setPw] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState('')
  const [err, setErr] = useState<{ pw?: boolean; confirm?: boolean }>({})
  const score = pwScore(pw)

  // A link without a token can't reset anything — send them back to /forgot.
  if (!token) {
    return (
      <AuthShell>
        <div className={styles.view}>
          <h1>Reset link invalid</h1>
          <p className={styles.lead}>
            This link is missing its token. Request a new one to continue.
          </p>
          <Link className={styles.go} to="/forgot">
            <span>Request a new link</span>
            <ArrowIc />
          </Link>
          <p className={styles.alt}>
            Remembered it? <Link to="/login">Back to sign in</Link>
          </p>
        </div>
      </AuthShell>
    )
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const next = { pw: pw.length < 8, confirm: confirm !== pw || !confirm }
    setErr(next)
    if (next.pw || next.confirm) return
    setNotice('')
    setBusy(true)
    try {
      await resetPassword(token, pw)
      navigate('/login?reset=1')
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'Could not reset your password.')
      setBusy(false)
    }
  }

  return (
    <AuthShell>
      {notice ? <div className={styles.notice}>{notice}</div> : null}
      <form className={styles.view} onSubmit={submit} noValidate>
        <h1>Set a new password</h1>
        <p className={styles.lead}>Choose a strong password you don’t use anywhere else.</p>

        <div className={`${styles.f} ${err.pw ? styles.err : ''}`}>
          <label>New password</label>
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
          <span>{busy ? 'Updating…' : 'Update password'}</span>
          {busy ? null : <ArrowIc />}
        </button>

        <p className={styles.alt}>
          Remembered it? <Link to="/login">Back to sign in</Link>
        </p>
      </form>
    </AuthShell>
  )
}
