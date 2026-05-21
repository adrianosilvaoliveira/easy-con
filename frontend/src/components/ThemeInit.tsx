import { useEffect } from 'react';
import { useThemeStore } from '@/stores/themeStore';

export function ThemeInit() {
  const darkMode = useThemeStore((s) => s.darkMode);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  return null;
}
