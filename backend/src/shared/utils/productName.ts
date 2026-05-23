/** Nome de produto sempre em maiúsculas (padrão do sistema). */
export function normalizeProductName(name: string): string {
  return name.trim().toLocaleUpperCase('pt-BR');
}
