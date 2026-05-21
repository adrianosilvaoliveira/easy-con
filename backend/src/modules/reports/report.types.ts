export interface ReportColumn {
  header: string;
  key: string;
}

export interface ReportPreview {
  title: string;
  subtitle: string;
  columns: ReportColumn[];
  rows: Record<string, string | number>[];
  generatedAt: string;
}
