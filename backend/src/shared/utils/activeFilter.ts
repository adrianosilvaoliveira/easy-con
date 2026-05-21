/** Por padrão lista só ativos; com includeInactive=true retorna todos */
export function applyActiveFilter(
  includeInactive?: string
): { active?: boolean } | Record<string, never> {
  if (includeInactive === 'true') return {};
  return { active: true };
}
