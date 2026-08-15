import { LockKeyhole, Radio } from 'lucide-react'
import { useState } from 'react'

interface LoginScreenProps {
  onLogin: (username: string) => void
}

export function LoginScreen({ onLogin }: LoginScreenProps) {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')

  function submit(event: React.FormEvent) {
    event.preventDefault()
    onLogin(username.trim() || 'User')
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
            onChange={(event) => setUsername(event.target.value)}
            placeholder="Username"
            autoComplete="username"
          />
        </label>

        <label>
          Password
          <input
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Password"
            type="password"
            autoComplete="current-password"
          />
        </label>

        <button className="primary-button login-button" type="submit">
          <LockKeyhole size={16} />
          Login / Sign in
        </button>

        <small>Local prototype authentication</small>
      </form>
    </main>
  )
}
