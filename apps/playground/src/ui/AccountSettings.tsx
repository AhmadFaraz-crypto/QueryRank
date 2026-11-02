import { useEffect, useState } from 'react'
import { useStore } from './AppStore'
import styles from './AccountSettings.module.scss'

/**
 * Account settings modal: update your display name and change (or set) your
 * password. Opened from the profile menu in the sidebar.
 */
export function AccountSettings({ onClose }: { onClose: () => void }) {
  const { user, updateName, changePassword } = useStore()

  const [name, setName] = useState(user.name)
  const [savingName, setSavingName] = useState(false)
  const [nameMsg, setNameMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [savingPw, setSavingPw] = useState(false)
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null)

  // Close on Escape.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  async function saveName(e: React.FormEvent) {
    e.preventDefault()
    const nm = name.trim()
    if (!nm || nm === user.name || savingName) return
    setSavingName(true)
    setNameMsg(null)
    try {
      await updateName(nm)
      setNameMsg({ ok: true, text: 'Name updated.' })
    } catch (err) {
      setNameMsg({ ok: false, text: err instanceof Error ? err.message : 'Could not update your name.' })
    } finally {
      setSavingName(false)
    }
  }

  async function savePassword(e: React.FormEvent) {
    e.preventDefault()
    if (savingPw) return
    setPwMsg(null)
    if (next.length < 8) {
      setPwMsg({ ok: false, text: 'New password must be at least 8 characters.' })
      return
    }
    if (next !== confirm) {
      setPwMsg({ ok: false, text: 'The new passwords don’t match.' })
      return
    }
    setSavingPw(true)
    try {
      await changePassword(user.hasPassword ? current : undefined, next)
      setPwMsg({ ok: true, text: user.hasPassword ? 'Password changed.' : 'Password set.' })
      setCurrent('')
      setNext('')
      setConfirm('')
    } catch (err) {
      setPwMsg({ ok: false, text: err instanceof Error ? err.message : 'Could not change your password.' })
    } finally {
      setSavingPw(false)
    }
  }

  return (
    <div className={styles.overlay} onMouseDown={onClose}>
      <div
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-label="Account settings"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <header className={styles.head}>
          <h2>Account settings</h2>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.9" viewBox="0 0 24 24">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </header>

        <div className={styles.body}>
          {/* Profile */}
          <form className={styles.section} onSubmit={saveName}>
            <h3>Profile</h3>
            <label className={styles.field}>
              <span>Display name</span>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
            </label>
            <label className={styles.field}>
              <span>Email</span>
              <input type="email" value={user.email} readOnly className={styles.readonly} />
              <small>Your email is used to sign in and can’t be changed here.</small>
            </label>
            {nameMsg && <p className={nameMsg.ok ? styles.okMsg : styles.errMsg}>{nameMsg.text}</p>}
            <div className={styles.actions}>
              <button type="submit" className={styles.primary} disabled={savingName || !name.trim() || name.trim() === user.name}>
                {savingName ? 'Saving…' : 'Save name'}
              </button>
            </div>
          </form>

          <div className={styles.divider} />

          {/* Password */}
          <form className={styles.section} onSubmit={savePassword}>
            <h3>{user.hasPassword ? 'Change password' : 'Set a password'}</h3>
            {!user.hasPassword && (
              <p className={styles.note}>
                Your account signs in with Google. Set a password to also sign in with email.
              </p>
            )}
            {user.hasPassword && (
              <label className={styles.field}>
                <span>Current password</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={current}
                  onChange={(e) => setCurrent(e.target.value)}
                />
              </label>
            )}
            <label className={styles.field}>
              <span>New password</span>
              <input
                type="password"
                autoComplete="new-password"
                value={next}
                onChange={(e) => setNext(e.target.value)}
                placeholder="At least 8 characters"
              />
            </label>
            <label className={styles.field}>
              <span>Confirm new password</span>
              <input
                type="password"
                autoComplete="new-password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
              />
            </label>
            {pwMsg && <p className={pwMsg.ok ? styles.okMsg : styles.errMsg}>{pwMsg.text}</p>}
            <div className={styles.actions}>
              <button type="submit" className={styles.primary} disabled={savingPw || !next || !confirm}>
                {savingPw ? 'Saving…' : user.hasPassword ? 'Change password' : 'Set password'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
