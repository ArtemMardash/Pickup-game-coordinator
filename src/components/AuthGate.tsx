import { useState } from 'react'
import type { FormEvent } from 'react'
import { useAuth } from '../state/authContext'
import { Button } from './ui/Button'
import styles from './AuthGate.module.css'

type Mode = 'login' | 'register'

/**
 * Blocks the dashboard until a session exists.
 */
export function AuthGate() {
  const { login, register } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const isRegister = mode === 'register'

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    setBusy(true)
    try {
      if (isRegister) {
        await register(username, email, password)
      } else {
        await login(email, password)
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Something went wrong')
    } finally {
      setBusy(false)
    }
  }

  function switchMode() {
    setMode(isRegister ? 'login' : 'register')
    setError(null)
    setPassword('')
  }

  return (
    <div className={styles.screen}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <span className={styles.logo} aria-hidden="true">
            ⚡
          </span>
          <span className={styles.brandName}>Pickup Game</span>
        </div>

        <p className={styles.tagline}>
          {isRegister
            ? 'Create an account to join games near you.'
            : 'Sign in to find and join games near you.'}
        </p>

        <form className={styles.form} onSubmit={handleSubmit}>
          {isRegister && (
            <label className={styles.field}>
              <span className={styles.label}>Username</span>
              <input
                className={styles.input}
                type="text"
                name="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                autoComplete="username"
                required
                minLength={3}
                maxLength={50}
              />
            </label>
          )}

          <label className={styles.field}>
            <span className={styles.label}>Email</span>
            <input
              className={styles.input}
              type="email"
              name="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Password</span>
            <input
              className={styles.input}
              type="password"
              name="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              required
              minLength={8}
            />
          </label>

          {error && (
            <p className={styles.error} role="alert">
              {error}
            </p>
          )}

          <div className={styles.submit}>
            <Button type="submit" size="lg" fullWidth disabled={busy}>
              {busy ? 'Working…' : isRegister ? 'Create account' : 'Sign in'}
            </Button>
          </div>
        </form>

        <p className={styles.switch}>
          {isRegister ? 'Already have an account?' : "Don't have an account?"}{' '}
          <button type="button" className={styles.switchButton} onClick={switchMode}>
            {isRegister ? 'Sign in' : 'Create one'}
          </button>
        </p>
      </div>
    </div>
  )
}
