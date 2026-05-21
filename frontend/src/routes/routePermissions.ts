/** Permissão mínima para acessar cada rota do app */
export const ROUTE_PERMISSIONS = {
  dashboard: 'dashboard:READ',
  cadastros: 'settings:READ',
  produtos: 'products:READ',
  estoque: 'stock:READ',
  entradas: 'movements:READ',
  saidas: 'movements:READ',
  transferencias: 'movements:READ',
  inventario: 'inventory:READ',
  vencimentos: 'batches:READ',
  relatorios: 'reports:READ',
  usuarios: 'users:READ',
} as const;
