import { NavLink } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import styles from './AppLayout.module.css';

const links = [
  { to: '/', label: 'Painel', end: true },
  { to: '/gastos', label: 'Gastos' },
  { to: '/categorias', label: 'Categorias' },
  { to: '/investimentos', label: 'Investimentos' },
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();

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
          <div className={styles.user}>{user?.name}</div>
          <button type="button" className="btn btn-secondary" onClick={toggleTheme}>
            Tema {theme === 'light' ? 'escuro' : 'claro'}
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => void logout()}>
            Sair
          </button>
        </div>
      </aside>
      <div className="main-area">{children}</div>
      <nav className={styles.mobileNav}>
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
    </div>
  );
}
