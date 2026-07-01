import { RoleName } from '@prisma/client';

/** Perfis que podem ser atribuídos ao criar/editar usuários */
export const ASSIGNABLE_ROLES: RoleName[] = ['ADMINISTRADOR', 'GERENCIA', 'OPERACIONAL'];

export const ROLE_LABELS: Record<RoleName, string> = {
  ADMINISTRADOR: 'Administrador',
  GERENCIA: 'Gerência',
  OPERACIONAL: 'Operacional',
  FARMACIA: 'Farmácia (legado)',
  ESTOQUE: 'Estoque (legado)',
  AUDITOR: 'Auditor (legado)',
  VISUALIZADOR: 'Visualizador (legado)',
};

export const ROLE_DESCRIPTIONS: Record<RoleName, string> = {
  ADMINISTRADOR: 'Acesso total ao sistema, usuários e configurações',
  GERENCIA: 'Supervisão operacional: exclusões, auditoria e operação completa do estoque',
  OPERACIONAL: 'Operação diária: entradas, saídas, estoque, cadastros e relatórios',
  FARMACIA: 'Perfil legado — migrar para Operacional',
  ESTOQUE: 'Perfil legado — migrar para Operacional',
  AUDITOR: 'Perfil legado — somente leitura e auditoria',
  VISUALIZADOR: 'Perfil legado — somente visualização',
};

/** Permissões do perfil Operacional */
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

/** Permissões do perfil Gerência (operacional + exclusões e auditoria) */
export const GERENCIA_PERMISSIONS = [
  ...OPERACIONAL_PERMISSIONS,
  'products:DELETE',
  'stock:DELETE',
  'batches:DELETE',
  'audit:READ',
] as const;

export const ROLE_DEFAULT_PERMISSIONS: Record<
  Extract<RoleName, 'OPERACIONAL' | 'GERENCIA'>,
  readonly string[]
> = {
  OPERACIONAL: OPERACIONAL_PERMISSIONS,
  GERENCIA: GERENCIA_PERMISSIONS,
};
