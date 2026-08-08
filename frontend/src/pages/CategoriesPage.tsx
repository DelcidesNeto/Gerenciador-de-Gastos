import { useEffect, useState, type FormEvent } from 'react';
import { ApiError } from '../services/apiClient';
import {
  addCategory,
  deleteCategory,
  listCategoriesWithUsage,
  renameCategory,
  type CategoryWithUsage,
} from '../services/expenseService';

export function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryWithUsage[]>([]);
  const [newName, setNewName] = useState('');
  const [editingFrom, setEditingFrom] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const res = await listCategoriesWithUsage();
      setCategories(res.categories);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao carregar categorias');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refresh();
  }, []);

  async function onCreate(e: FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setSaving(true);
    setError('');
    try {
      const res = await addCategory(name);
      setCategories(res.categories);
      setNewName('');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao criar categoria');
    } finally {
      setSaving(false);
    }
  }

  function startEdit(item: CategoryWithUsage) {
    setEditingFrom(item.name);
    setEditingName(item.name);
    document.getElementById('category-form')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  function cancelEdit() {
    setEditingFrom(null);
    setEditingName('');
  }

  async function onSaveEdit(e: FormEvent) {
    e.preventDefault();
    if (!editingFrom) return;
    const to = editingName.trim();
    if (!to) return;
    setSaving(true);
    setError('');
    try {
      const res = await renameCategory(editingFrom, to);
      setCategories(res.categories);
      cancelEdit();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao editar categoria');
    } finally {
      setSaving(false);
    }
  }

  async function onDelete(item: CategoryWithUsage) {
    if (item.expenseCount > 0) {
      setError(
        `Não é possível excluir "${item.name}": existem ${item.expenseCount} gasto(s) vinculado(s).`,
      );
      return;
    }
    if (!confirm(`Excluir a categoria "${item.name}"?`)) return;
    setError('');
    try {
      const res = await deleteCategory(item.name);
      setCategories(res.categories);
      if (editingFrom === item.name) cancelEdit();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Erro ao excluir categoria');
    }
  }

  return (
    <div className="stack">
      <header className="page-header">
        <div>
          <h1>Categorias</h1>
          <p>
            Crie, edite e organize as categorias dos seus gastos. Só é possível excluir categorias
            sem gastos vinculados.
          </p>
        </div>
      </header>

      {error ? <div className="alert">{error}</div> : null}

      <section className="panel" id="category-form">
        <h2>{editingFrom ? 'Editar categoria' : 'Nova categoria'}</h2>
        {editingFrom ? (
          <form className="row" onSubmit={(e) => void onSaveEdit(e)} style={{ marginTop: '1rem' }}>
            <div className="field" style={{ flex: 1, minWidth: 180 }}>
              <label htmlFor="edit-category">Nome</label>
              <input
                id="edit-category"
                required
                maxLength={80}
                value={editingName}
                onChange={(e) => setEditingName(e.target.value)}
              />
            </div>
            <button className="btn" type="submit" disabled={saving} style={{ alignSelf: 'end' }}>
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
            <button
              className="btn btn-secondary"
              type="button"
              style={{ alignSelf: 'end' }}
              onClick={cancelEdit}
            >
              Cancelar
            </button>
          </form>
        ) : (
          <form className="row" onSubmit={(e) => void onCreate(e)} style={{ marginTop: '1rem' }}>
            <div className="field" style={{ flex: 1, minWidth: 180 }}>
              <label htmlFor="new-category">Nome</label>
              <input
                id="new-category"
                required
                maxLength={80}
                placeholder="Ex.: Pets, Assinaturas..."
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <button
              className="btn"
              type="submit"
              disabled={saving || !newName.trim()}
              style={{ alignSelf: 'end' }}
            >
              {saving ? 'Criando...' : 'Criar categoria'}
            </button>
          </form>
        )}
      </section>

      <section className="panel">
        <h2>Suas categorias</h2>
        {loading ? <p className="muted">Carregando...</p> : null}
        {!loading && categories.length === 0 ? (
          <div className="empty">Nenhuma categoria cadastrada.</div>
        ) : (
          <div className="table-wrap">
            <table className="data">
              <thead>
                <tr>
                  <th>Nome</th>
                  <th>Gastos vinculados</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {categories.map((item) => {
                  const canDelete = item.expenseCount === 0;
                  return (
                    <tr key={item.name}>
                      <td>{item.name}</td>
                      <td>
                        {item.expenseCount === 0
                          ? 'Nenhum'
                          : `${item.expenseCount} gasto(s)`}
                      </td>
                      <td>
                        <div className="table-actions">
                          <button
                            className="btn btn-secondary btn-sm"
                            type="button"
                            onClick={() => startEdit(item)}
                          >
                            Editar
                          </button>
                          <button
                            className="btn btn-danger btn-sm"
                            type="button"
                            disabled={!canDelete}
                            title={
                              canDelete
                                ? 'Excluir categoria'
                                : 'Há gastos vinculados a esta categoria'
                            }
                            onClick={() => void onDelete(item)}
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
