import { useEffect, useId, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import styles from './AppLayout.module.css';

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, isAdmin, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuTitleId = useId();

  const links = [
    { to: '/', label: 'Painel', end: true },
    { to: '/gastos', label: 'Gastos' },
    { to: '/categorias', label: 'Categorias' },
    { to: '/investimentos', label: 'Investimentos' },
    { to: '/conta', label: 'Conta' },
    ...(isAdmin ? [{ to: '/admin/usuarios', label: 'Usuários', end: undefined as boolean | undefined }] : []),
  ];

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    if (!menuOpen) return;

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [menuOpen]);

  return (
    <div className="app-shell">
      <aside className={styles.nav}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>Finanças</span>
          <span className={styles.brandSub}>Gastos & Investimentos</span>
        </div>
        <nav className={styles.links}>
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.end}
              className={({ isActive }) => (isActive ? styles.active : undefined)}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className={styles.footer}>
          <div className={styles.user}>
            {user?.name}
            {isAdmin ? <span className={styles.roleTag}>Admin</span> : null}
          </div>
          <button type="button" className="btn btn-secondary" onClick={toggleTheme}>
            Tema {theme === 'light' ? 'escuro' : 'claro'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => void logout()}>
            Sair
          </button>
        </div>
      </aside>

      <div className={styles.content}>
        <header className={styles.mobileTop}>
          <div className={styles.mobileLeading}>
            <button
              type="button"
              className={styles.menuButton}
              aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
              aria-expanded={menuOpen}
              aria-controls="menu-navegacao-mobile"
              onClick={() => setMenuOpen((open) => !open)}
            >
              <span className={`${styles.menuIcon} ${menuOpen ? styles.menuIconOpen : ''}`} aria-hidden>
                <span />
                <span />
                <span />
              </span>
            </button>
            <div>
              <div className={styles.mobileBrand}>Finanças</div>
              <div className={styles.mobileUser}>{user?.name}</div>
            </div>
          </div>
          <div className={styles.mobileActions}>
            <button type="button" className="btn btn-secondary btn-sm" onClick={toggleTheme}>
              {theme === 'light' ? 'Escuro' : 'Claro'}
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => void logout()}>
              Sair
            </button>
          </div>
        </header>

        <div
          className={`${styles.drawerRoot} ${menuOpen ? styles.drawerOpen : ''}`}
          id="menu-navegacao-mobile"
        >
          <button
            type="button"
            className={styles.drawerBackdrop}
            aria-label="Fechar menu"
            tabIndex={menuOpen ? 0 : -1}
            onClick={() => setMenuOpen(false)}
          />
          <nav className={styles.drawerPanel} aria-labelledby={menuTitleId}>
            <div className={styles.drawerHeader}>
              <span id={menuTitleId} className={styles.drawerTitle}>
                Menu
              </span>
              {isAdmin ? <span className={styles.roleTag}>Admin</span> : null}
            </div>
            <div className={styles.drawerLinks}>
              {links.map((l) => (
                <NavLink
                  key={l.to}
                  to={l.to}
                  end={l.end}
                  className={({ isActive }) => (isActive ? styles.active : undefined)}
                  onClick={() => setMenuOpen(false)}
                >
                  {l.label}
                </NavLink>
              ))}
            </div>
          </nav>
        </div>

        <div className="main-area">{children}</div>
      </div>
    </div>
  );
}
