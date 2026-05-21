import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface ThemeState {
  darkMode: boolean;
  toggleDarkMode: () => void;
  setDarkMode: (value: boolean) => void;
}

function applyDarkClass(dark: boolean) {
  document.documentElement.classList.toggle('dark', dark);
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set, get) => ({
      darkMode: false,
      toggleDarkMode: () => {
        const next = !get().darkMode;
        applyDarkClass(next);
        set({ darkMode: next });
      },
      setDarkMode: (value) => {
        applyDarkClass(value);
        set({ darkMode: value });
      },
    }),
    {
      name: 'con-theme',
      onRehydrateStorage: () => (state) => {
        if (state) applyDarkClass(state.darkMode);
      },
    }
  )
);
