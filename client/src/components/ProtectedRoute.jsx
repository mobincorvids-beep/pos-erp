import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loading } from './Loading';

export function ProtectedRoute({ children }) {
  const { user, initializing } = useAuth();
  if (initializing) return <Loading label="Restoring session…" />;
  if (!user) return <Navigate to="/login" replace />;
  return children;
}
