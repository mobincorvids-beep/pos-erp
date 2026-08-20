import { Navigate } from 'react-router-dom';
import { useAdminAuth } from '../context/AdminAuthContext';
import { Loading } from '../../components/Loading';

export function AdminProtectedRoute({ children }) {
  const { admin, initializing } = useAdminAuth();
  if (initializing) return <Loading label="Restoring admin session…" />;
  if (!admin) return <Navigate to="/admin/login" replace />;
  return children;
}
