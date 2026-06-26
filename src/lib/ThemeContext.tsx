import React, { createContext, useContext, useEffect, useState } from 'react';

type Theme = 'dark' | 'light';

interface ThemeContextType {
  theme: Theme;
  toggleTheme: () => void;
  isLight: boolean;
}

const ThemeContext = createContext<ThemeContextType>({
  theme: 'dark',
  toggleTheme: () => {},
  isLight: false,
});

const THEME_KEY = 'hubportal_theme';
const THEME_BROADCAST_KEY = 'hubportal_theme_broadcast';

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    try {
      return (localStorage.getItem(THEME_KEY) as Theme) || 'dark';
    } catch {
      return 'dark';
    }
  });

  // Aplica a classe no <html> e sincroniza páginas públicas via localStorage broadcast
  const applyTheme = (t: Theme) => {
    const html = document.documentElement;
    if (t === 'light') {
      html.classList.add('light');
    } else {
      html.classList.remove('light');
    }
    // Broadcast para as outras abas/páginas públicas
    try {
      localStorage.setItem(THEME_KEY, t);
      localStorage.setItem(THEME_BROADCAST_KEY, String(Date.now()));
    } catch {}
  };

  // Aplica o tema ao montar
  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // Escuta mudanças de outras abas (ex: página pública aberta em paralelo)
  useEffect(() => {
    const handleStorage = (e: StorageEvent) => {
      if (e.key === THEME_BROADCAST_KEY) {
        const saved = localStorage.getItem(THEME_KEY) as Theme;
        if (saved && saved !== theme) {
          setTheme(saved);
        }
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => {
      const next: Theme = prev === 'dark' ? 'light' : 'dark';
      applyTheme(next);
      return next;
    });
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, isLight: theme === 'light' }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}

/**
 * Hook para páginas públicas: apenas lê o tema salvo e aplica sem toggle.
 * Sincroniza automaticamente se o usuário mudar o tema no portal em outra aba.
 */
export function usePublicTheme() {
  useEffect(() => {
    const saved = localStorage.getItem(THEME_KEY) as Theme | null;
    const apply = (t: Theme) => {
      if (t === 'light') {
        document.documentElement.classList.add('light');
      } else {
        document.documentElement.classList.remove('light');
      }
    };

    apply(saved || 'dark');

    const handleStorage = (e: StorageEvent) => {
      if (e.key === THEME_BROADCAST_KEY) {
        const current = localStorage.getItem(THEME_KEY) as Theme;
        apply(current || 'dark');
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);
}
