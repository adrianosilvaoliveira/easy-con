import { Navigate } from 'react-router-dom';

/** Rota legada — cadastros operacionais em Configurações */
export function CadastrosPage() {
  return <Navigate to="/configuracoes/cadastros" replace />;
}
