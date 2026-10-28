import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '../AppStore'
import { AuthShell, MailIc, ArrowIc, Check, emailOk } from './AuthShell'
import styles from '../Auth.module.scss'

export function Forgot() {
  const { requestPasswordReset } = useStore()
  const [email, setEmail] = useState('')
  const [err, setErr] = useState(false)
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!emailOk(email)) {
      setErr(true)
      return
    }
    setErr(false)
    setBusy(true)
    // The server always answers the same, so we always land on the sent screen —
    // that's deliberate: it never reveals whether the account exists.
    await requestPasswordReset(email.trim())
    setSent(true)
  }

  return (
    <AuthShell>
      {sent ? (
        <div className={styles.view}>
          <span className={styles.sentIc} aria-hidden="true">
            <Check />
          </span>
          <h1>Check your inbox</h1>
          <p className={styles.lead}>
            If an account exists for <b>{email}</b>, we’ve sent a link to reset your
            password. It expires in 30 minutes.
          </p>
          <button className={styles.go} type="button" onClick={() => setSent(false)}>
            <span>Use a different email</span>
          </button>
          <p className={styles.alt}>
            Remembered it? <Link to="/login">Back to sign in</Link>
          </p>
        </div>
      ) : (
        <form className={styles.view} onSubmit={submit} noValidate>
          <h1>Reset your password</h1>
          <p className={styles.lead}>
            Enter the email on your account and we’ll send a link to set a new password.
          </p>

          <div className={`${styles.f} ${err ? styles.err : ''}`}>
            <label>Work email</label>
            <div className={styles.inp}>
              <input type="email" placeholder="you@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              <MailIc />
            </div>
            <div className={styles.msg}>
              ⚠ <span>Enter a valid email address</span>
            </div>
          </div>

          <button className={styles.go} type="submit" disabled={busy}>
            <span>{busy ? 'Sending…' : 'Send reset link'}</span>
            {busy ? null : <ArrowIc />}
          </button>

          <p className={styles.alt}>
            Remembered it? <Link to="/login">Back to sign in</Link>
          </p>
        </form>
      )}
    </AuthShell>
  )
}
