export const ASSIGNABLE_ROLES = ['ADMINISTRADOR', 'GERENCIA', 'OPERACIONAL'] as const;

export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

/** Ordem de exibição no formulário de usuários */
export const ROLE_SELECT_OPTIONS: AssignableRole[] = ['OPERACIONAL', 'GERENCIA', 'ADMINISTRADOR'];

export const ROLE_LABELS: Record<string, string> = {
  ADMINISTRADOR: 'Administrador',
  GERENCIA: 'Gerência',
  OPERACIONAL: 'Operacional',
  FARMACIA: 'Farmácia',
  ESTOQUE: 'Estoque',
  AUDITOR: 'Auditor',
  VISUALIZADOR: 'Visualizador',
};

export function getRoleLabel(roleName: string): string {
  return ROLE_LABELS[roleName] ?? roleName;
}
