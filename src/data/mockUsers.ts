import type { User } from '@/types';

/**
 * Тестовые учётные записи для демонстрации входа — не настоящие
 * учётные данные. См. README.
 */
export const MOCK_USERS: User[] = [
  {
    login: 'ivanov',
    password: '1234',
    name: 'Иванов Алексей Сергеевич',
    email: 'ivanov@uztm.ru',
    role: 'Инженер',
  },
  {
    login: 'petrova',
    password: '1234',
    name: 'Петрова Ольга Николаевна',
    email: 'petrova@uztm.ru',
    role: 'Инженер',
  },
  {
    login: 'admin',
    password: 'admin',
    name: 'Смирнов Павел Игоревич',
    email: 'admin@uztm.ru',
    role: 'Администратор + инженер',
  },
];
