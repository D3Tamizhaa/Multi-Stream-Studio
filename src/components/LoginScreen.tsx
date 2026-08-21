import { LockKeyhole, Radio } from 'lucide-react'
import { useState } from 'react'

interface LoginScreenProps {
  onLogin: (
    username: string,
    password: string,
  ) => boolean
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  function submit(event: React.FormEvent) {
    event.preventDefault()

    const name = username.trim()

    if (!name || !password) {
      setError('Enter your username and password.')
      return
    }

    const success = onLogin(name, password)

    if (!success) {
      setError('Incorrect username or password.')
      return
    }

    setError('')
  }

  return (
    <main className="login-page">
      <form className="login-card" onSubmit={submit}>
        <div className="login-logo">
          <Radio size={30} />
        </div>

        <h1>Multi Stream Studio</h1>
        <p>Sign in to your production workspace.</p>

        <label>
          Username
          <input
            value={username}
            onChange={(event) => {
              setUsername(event.target.value)
              setError('')
            }}
            placeholder="Username"
            autoComplete="username"
          />
        </label>

        <label>
          Password
          <input
            value={password}
            onChange={(event) => {
              setPassword(event.target.value)
              setError('')
            }}
            placeholder="Password"
            type="password"
            autoComplete="current-password"
          />
        </label>

        {error && (
          <div className="login-error" role="alert">
            {error}
          </div>
        )}

        <button
          className="primary-button login-button"
          type="submit"
        >
          <LockKeyhole size={16} />
          Login / Sign in
        </button>

        <small>
          Use the credentials configured in Settings → Authorization.
        </small>
      </form>
    </main>
  )
}
