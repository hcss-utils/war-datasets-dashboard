import { useState } from 'react';
import { checkCredentials, setAuthenticated } from './auth';
import './LoginScreen.css';

export default function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (checkCredentials(username, password)) {
      setAuthenticated();
      setError(false);
      onSuccess();
    } else {
      setError(true);
    }
  };

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={handleSubmit}>
        <div className="login-brand">
          <img src="rubase_logo.svg" alt="RuBase" className="login-logo" />
        </div>
        <h1 className="login-title">War Datasets Dashboard</h1>
        <p className="login-subtitle">Sign in to access the dashboard</p>

        <label className="login-field">
          <span>Username</span>
          <input
            type="text"
            autoComplete="username"
            value={username}
            onChange={(e) => { setUsername(e.target.value); setError(false); }}
            autoFocus
          />
        </label>

        <label className="login-field">
          <span>Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(false); }}
          />
        </label>

        {error && <div className="login-error">Invalid username or password</div>}

        <button type="submit" className="login-button">Sign in</button>
      </form>
    </div>
  );
}
