import { useThemeStore } from '@/stores/themeStore';

export const CHART_THEME = {
  light: {
    gridStroke: '#94a3b8',
    axisTick: { fontSize: 11, fill: '#334155' } as const,
    tooltipBg: '#ffffff',
    tooltipBorder: '#cbd5e1',
    tooltipColor: '#334155',
  },
  dark: {
    gridStroke: '#475569',
    axisTick: { fontSize: 11, fill: '#94a3b8' } as const,
    tooltipBg: '#1e293b',
    tooltipBorder: '#475569',
    tooltipColor: '#e2e8f0',
  },
} as const;

/** @deprecated use useChartTheme() */
export const CHART_GRID_STROKE = CHART_THEME.light.gridStroke;
/** @deprecated use useChartTheme() */
export const CHART_AXIS_TICK = CHART_THEME.light.axisTick;

export function useChartTheme() {
  const darkMode = useThemeStore((s) => s.darkMode);
  return darkMode ? CHART_THEME.dark : CHART_THEME.light;
}
