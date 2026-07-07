/** Espelho do backend — permissões padrão do perfil Operacional */
export const OPERACIONAL_PERMISSIONS = [
  'dashboard:READ',
  'products:READ',
  'products:CREATE',
  'products:UPDATE',
  'stock:READ',
  'stock:CREATE',
  'stock:UPDATE',
  'settings:READ',
  'settings:CREATE',
  'settings:UPDATE',
  'movements:READ',
  'movements:CREATE',
  'movements:APPROVE',
  'inventory:READ',
  'inventory:CREATE',
  'inventory:UPDATE',
  'reports:READ',
  'reports:EXPORT',
  'batches:READ',
  'batches:CREATE',
  'batches:UPDATE',
] as const;

export const GERENCIA_PERMISSIONS = [
  ...OPERACIONAL_PERMISSIONS,
  'products:DELETE',
  'stock:DELETE',
  'movements:DELETE',
  'batches:DELETE',
  'audit:READ',
] as const;

export const ROLE_DEFAULT_PERMISSIONS = {
  OPERACIONAL: OPERACIONAL_PERMISSIONS,
  GERENCIA: GERENCIA_PERMISSIONS,
} as const;

export type NonAdminRole = keyof typeof ROLE_DEFAULT_PERMISSIONS;
