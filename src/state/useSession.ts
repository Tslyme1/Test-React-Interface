import { useCallback, useState } from 'react';
import type { User } from '@/types';
import { MOCK_USERS } from '@/data/mockUsers';

const STORAGE_KEY = 'uztm-session';

function readSession(): User | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

/**
 * Мок-авторизация: демонстрационный вход без реальной проверки пароля
 * на сервере. См. README — учётные данные тестовые.
 */
export function useSession() {
  const [user, setUser] = useState<User | null>(() => readSession());

  const login = useCallback((login: string, password: string): string | null => {
    if (!login.trim() || !password) return 'Введите логин и пароль';

    const known = MOCK_USERS.find((u) => u.login === login || u.email === login);
    const next: User = known ?? {
      login,
      password,
      name: login,
      email: '',
      role: 'Инженер',
    };

    setUser(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    return null;
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  return { user, login, logout };
}
