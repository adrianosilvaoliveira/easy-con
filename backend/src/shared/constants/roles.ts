import { RoleName } from '@prisma/client';

/** Perfis que podem ser atribuídos ao criar/editar usuários */
export const ASSIGNABLE_ROLES: RoleName[] = ['ADMINISTRADOR', 'OPERACIONAL'];

export const ROLE_LABELS: Record<RoleName, string> = {
  ADMINISTRADOR: 'Administrador',
  OPERACIONAL: 'Operacional',
  FARMACIA: 'Farmácia (legado)',
  ESTOQUE: 'Estoque (legado)',
  AUDITOR: 'Auditor (legado)',
  VISUALIZADOR: 'Visualizador (legado)',
};

export const ROLE_DESCRIPTIONS: Record<RoleName, string> = {
  ADMINISTRADOR: 'Acesso total ao sistema, usuários e configurações',
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
