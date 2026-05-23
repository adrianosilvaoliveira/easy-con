import { Navigate } from 'react-router-dom';

/** Rota legada — produtos em Estoque */
export function ProductsPage() {
  return <Navigate to="/estoque" replace />;
}
