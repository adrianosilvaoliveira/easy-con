import { Navigate } from 'react-router-dom';

/** Rota legada — cadastro de produtos em Cadastros */
export function ProductsPage() {
  return <Navigate to="/cadastros?aba=produtos" replace />;
}
