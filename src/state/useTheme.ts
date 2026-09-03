import { useCallback, useEffect, useState } from 'react';

/**
 * Тема оформления. `system` — не «светлая по умолчанию», а отдельное
 * состояние: следовать настройке операционной системы и переключаться
 * вместе с ней, в том числе прямо во время работы.
 */
export type ThemePreference = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'uztm-theme';

function isPreference(value: unknown): value is ThemePreference {
  return value === 'system' || value === 'light' || value === 'dark';
}

function readStored(): ThemePreference {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return isPreference(raw) ? raw : 'system';
  } catch {
    // Недоступное хранилище (приватный режим, запрет на куки) не должно
    // мешать открыть приложение — просто следуем системе.
    return 'system';
  }
}

/**
 * Выбор темы и его применение к документу.
 *
 * Дизайн-система читает тему с корня документа: `data-theme="dark"` и
 * `data-theme="light"` — явный выбор, отсутствие атрибута — «как в системе»
 * (тогда работает медиазапрос `prefers-color-scheme` внутри токенов).
 * Поэтому «системная» тема здесь не подставляет своё значение, а снимает
 * атрибут: гадать за медиазапрос и держать его значение в состоянии
 * пришлось бы синхронно с системой, а он умеет это сам.
 */
export function useTheme() {
  const [theme, setThemeState] = useState<ThemePreference>(readStored);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', theme);
    }

    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      // Тема — предпочтение, а не данные пользователя: не сохранилась,
      // значит в следующий раз откроется системная. Это не повод падать.
    }
  }, [theme]);

  const setTheme = useCallback((next: ThemePreference) => setThemeState(next), []);

  return { theme, setTheme };
}
