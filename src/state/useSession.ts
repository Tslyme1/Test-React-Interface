import { useCallback, useState } from 'react';
import type { ProjectMode, User } from '@/types';
import { MOCK_USERS } from '@/data/mockUsers';

const STORAGE_KEY = 'uztm-session';

/**
 * Режим работы лежит отдельным ключом, а не внутри записи сессии.
 *
 * Внутри неё он оказался бы частью учётной записи, а это не так: режим —
 * настройка рабочего места, и меняют его из «Профиля» посреди работы.
 * Отдельный ключ заодно не ломает уже сохранённые сессии: у них просто
 * нет этого ключа, и берётся значение по умолчанию.
 */
const MODE_KEY = 'uztm-mode';

function readSession(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

function readMode(): ProjectMode {
  try {
    return localStorage.getItem(MODE_KEY) === 'simplified' ? 'simplified' : 'engineering';
  } catch {
    return 'engineering';
  }
}

/**
 * Мок-авторизация: демонстрационный вход без реальной проверки пароля
 * на сервере. См. README — учётные данные тестовые.
 */
export function useSession() {
  const [user, setUser] = useState<User | null>(() => readSession());
  const [mode, setModeState] = useState<ProjectMode>(() => readMode());

  /**
   * Режим переживает перезагрузку. Раньше он жил состоянием `App` и
   * сбрасывался на инженерный при каждом обновлении страницы — то есть
   * выбор, сделанный при входе или в «Профиле», держался ровно до F5.
   */
  const setMode = useCallback((next: ProjectMode) => {
    setModeState(next);
    try {
      localStorage.setItem(MODE_KEY, next);
    } catch {
      /* Приватный режим: выбор доживёт до перезагрузки в памяти. */
    }
  }, []);

  /**
   * Пароль не проверяется — вход демонстрационный (см. «Что здесь мок»
   * в `CLAUDE.md`). Незнакомый логин заводит пользователя на месте:
   * это стенд, и упереться в «нет такой учётной записи» здесь значило бы
   * закрыть вход тому, кто просто хочет посмотреть.
   */
  const login = useCallback(
    (login: string, password: string, nextMode?: ProjectMode): string | null => {
      if (!login.trim() || !password) return 'Введите логин и пароль';

      const known = MOCK_USERS.find((u) => u.login === login || u.email === login);
      const next: User = known ?? {
        login,
        password,
        name: login,
        email: '',
        role: 'Инженер',
      };

      if (nextMode) setMode(nextMode);
      setUser(next);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return null;
    },
    [setMode]
  );

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { user, mode, setMode, login, logout };
}
