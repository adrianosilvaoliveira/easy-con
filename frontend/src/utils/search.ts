/** Remove acentos e padroniza para comparação aproximada */
export function normalizeSearchText(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '');
}

export function fuzzyScore(
  query: string,
  fields: (string | null | undefined)[]
): number {
  const q = normalizeSearchText(query.trim());
  if (!q) return 0;

  const normalized = fields.map((f) => (f ? normalizeSearchText(f) : ''));

  for (const value of normalized) {
    if (!value) continue;
    if (value === q) return 100;
    if (value.startsWith(q)) return 80;
    if (value.includes(q)) return 60;
  }

  const qParts = q.split(/\s+/).filter(Boolean);
  if (qParts.length > 1) {
    const allMatch = normalized.some(
      (value) => value && qParts.every((part) => value.includes(part))
    );
    if (allMatch) return 40;
  }

  return 0;
}
