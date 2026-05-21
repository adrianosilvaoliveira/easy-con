export const ASSIGNABLE_ROLES = ['ADMINISTRADOR', 'OPERACIONAL'] as const;

export type AssignableRole = (typeof ASSIGNABLE_ROLES)[number];

export const ROLE_LABELS: Record<string, string> = {
  ADMINISTRADOR: 'Administrador',
  OPERACIONAL: 'Operacional',
  FARMACIA: 'Farmácia',
  ESTOQUE: 'Estoque',
  AUDITOR: 'Auditor',
  VISUALIZADOR: 'Visualizador',
};

export function getRoleLabel(roleName: string): string {
  return ROLE_LABELS[roleName] ?? roleName;
}
