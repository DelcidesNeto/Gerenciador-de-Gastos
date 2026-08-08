import { useState, type FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../services/apiClient';

export function RegisterPage() {
  const { user, register, loading } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  if (!loading && user) return <Navigate to="/" replace />;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await register(name, email, password);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível criar a conta');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-card stack" onSubmit={(e) => void onSubmit(e)}>
        <div>
          <div className="brand">Criar conta</div>
          <p className="subtitle">Comece a organizar sua vida financeira.</p>
        </div>
        {error ? <div className="alert">{error}</div> : null}
        <div className="field">
          <label htmlFor="name">Nome</label>
          <input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="field">
          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="password">Senha (mín. 8 caracteres)</label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <button className="btn" type="submit" disabled={saving}>
          {saving ? 'Criando...' : 'Cadastrar'}
        </button>
        <p className="muted">
          Já tem conta? <Link to="/login">Entrar</Link>
        </p>
      </form>
    </div>
  );
}
