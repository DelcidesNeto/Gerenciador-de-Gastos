import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { AccountPage } from './pages/AccountPage';
import { AdminUsersPage } from './pages/AdminUsersPage';
import { CategoriesPage } from './pages/CategoriesPage';
import { DashboardPage } from './pages/DashboardPage';
import { ExpensesPage } from './pages/ExpensesPage';
import { InvestmentDetailPage } from './pages/InvestmentDetailPage';
import { InvestmentsPage } from './pages/InvestmentsPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';

const basename = (import.meta.env.BASE_URL || '/').replace(/\/$/, '') || '/';

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter basename={basename === '/' ? undefined : basename}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/cadastro" element={<RegisterPage />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/gastos" element={<ExpensesPage />} />
              <Route path="/categorias" element={<CategoriesPage />} />
              <Route path="/investimentos" element={<InvestmentsPage />} />
              <Route path="/investimentos/:id" element={<InvestmentDetailPage />} />
              <Route path="/conta" element={<AccountPage />} />
              <Route path="/admin/usuarios" element={<AdminUsersPage />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
