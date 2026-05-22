import { Navigate } from 'react-router-dom';

/** Rota legada — produtos integrados ao Estoque */
export function ProductsPage() {
  return <Navigate to="/estoque?aba=produtos" replace />;
}
