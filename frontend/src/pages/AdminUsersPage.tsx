import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ApiError } from '../services/apiClient';
import { deleteUser, listUsers, type User } from '../services/authService';
import { formatDate } from '../utils/format';

export function AdminUsersPage() {
  const { user, isAdmin } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const res = await listUsers();
      setUsers(res.users);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isAdmin) void refresh();
  }, [isAdmin]);

  if (!isAdmin) return <Navigate to="/" replace />;

  async function onDelete(target: User) {
    if (target.id === user?.id) return;
    if (!confirm(`Excluir o usuário "${target.name}" e todos os dados dele?`)) return;
    setError('');
    try {
      await deleteUser(target.id);
      await refresh();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir usuário');
    }
  }

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <h1>Usuários</h1>
          <p>Área administrativa — listar e excluir contas.</p>
        </div>
      </header>

      {error ? <div className="alert">{error}</div> : null}

      <section className="panel">
        <h2>Contas cadastradas</h2>
        {loading ? <p className="muted">Carregando...</p> : null}
        {!loading && users.length === 0 ? (
          <div className="empty">Nenhum usuário encontrado.</div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>E-mail</th>
                  <th>Perfil</th>
                  <th>Criado em</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {users.map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{item.email}</td>
                    <td>{item.role === 'admin' ? 'Administrador' : 'Usuário'}</td>
                    <td>{item.createdAt ? formatDate(item.createdAt.slice(0, 10)) : '—'}</td>
                    <td>
                      <div className="table-actions">
                        <button
                          className="btn btn-danger btn-sm"
                          type="button"
                          disabled={item.id === user?.id}
                          title={
                            item.id === user?.id
                              ? 'Você não pode excluir a própria conta aqui'
                              : 'Excluir usuário'
                          }
                          onClick={() => void onDelete(item)}
                        >
                          Excluir
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
