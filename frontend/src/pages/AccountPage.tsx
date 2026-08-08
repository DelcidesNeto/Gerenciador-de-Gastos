import { useState, type FormEvent } from 'react';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../services/apiClient';
import { changePassword, updateProfile } from '../services/authService';

export function AccountPage() {
  const { user, setUser } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [profileMsg, setProfileMsg] = useState('');
  const [passwordMsg, setPasswordMsg] = useState('');
  const [error, setError] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  async function onSaveProfile(e: FormEvent) {
    e.preventDefault();
    setError('');
    setProfileMsg('');
    setSavingProfile(true);
    try {
      const res = await updateProfile({ name, email });
      setUser(res.user);
      setProfileMsg('Dados atualizados com sucesso.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao atualizar perfil');
    } finally {
      setSavingProfile(false);
    }
  }

  async function onChangePassword(e: FormEvent) {
    e.preventDefault();
    setError('');
    setPasswordMsg('');
    if (newPassword !== confirmPassword) {
      setError('A confirmação da nova senha não confere');
      return;
    }
    setSavingPassword(true);
    try {
      await changePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setPasswordMsg('Senha alterada com sucesso.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao alterar senha');
    } finally {
      setSavingPassword(false);
    }
  }

  if (!user) return null;

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <h1>Minha conta</h1>
          <p>Atualize seu nome, e-mail e senha.</p>
        </div>
      </header>

      {error ? <div className="alert">{error}</div> : null}

      <section className="panel">
        <h2>Dados pessoais</h2>
        {profileMsg ? <p className="muted" style={{ marginTop: '0.5rem' }}>{profileMsg}</p> : null}
        <form className="stack" onSubmit={(e) => void onSaveProfile(e)} style={{ marginTop: '1rem' }}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="name">Nome</label>
              <input
                id="name"
                required
                minLength={2}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="email">E-mail</label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>
          <div className="row">
            <span className="badge">
              Perfil: {user.role === 'admin' ? 'Administrador' : 'Usuário'}
            </span>
            <button className="btn" type="submit" disabled={savingProfile}>
              {savingProfile ? 'Salvando...' : 'Salvar dados'}
            </button>
          </div>
        </form>
      </section>

      <section className="panel">
        <h2>Alterar senha</h2>
        {passwordMsg ? <p className="muted" style={{ marginTop: '0.5rem' }}>{passwordMsg}</p> : null}
        <form className="stack" onSubmit={(e) => void onChangePassword(e)} style={{ marginTop: '1rem' }}>
          <div className="form-grid">
            <div className="field">
              <label htmlFor="currentPassword">Senha atual</label>
              <input
                id="currentPassword"
                type="password"
                required
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="newPassword">Nova senha (mín. 8)</label>
              <input
                id="newPassword"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="confirmPassword">Confirmar nova senha</label>
              <input
                id="confirmPassword"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
          </div>
          <button className="btn" type="submit" disabled={savingPassword}>
            {savingPassword ? 'Salvando...' : 'Alterar senha'}
          </button>
        </form>
      </section>
    </div>
  );
}
