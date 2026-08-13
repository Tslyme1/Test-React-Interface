import { test, expect } from '@playwright/test';
import { DEMO_USER, login, watchConsole } from './helpers';

test.describe('Вход', () => {
  test('экран входа собран и кнопка заблокирована до заполнения', async ({ page }) => {
    const console_ = watchConsole(page);
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Вход в систему' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'УЗТМ' })).toBeVisible();

    const submit = page.getByRole('button', { name: 'Войти' });
    await expect(submit).toBeDisabled();

    await page.getByLabel('Логин или почта').fill(DEMO_USER.login);
    await expect(submit).toBeDisabled();

    await page.getByLabel('Пароль').fill(DEMO_USER.password);
    await expect(submit).toBeEnabled();

    console_.assertClean();
  });

  test('вход ведёт к списку проектов и показывает имя пользователя', async ({ page }) => {
    const console_ = watchConsole(page);
    await login(page);

    // Шапка показывает фамилию — значит сессия долетела до оболочки.
    await expect(page.getByRole('button', { name: /Иванов/ })).toBeVisible();
    console_.assertClean();
  });

  test('сессия переживает перезагрузку страницы', async ({ page }) => {
    await login(page);
    await page.reload();

    await expect(page.getByRole('heading', { name: 'Проекты' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Вход в систему' })).toBeHidden();
  });

  test('выход возвращает на экран входа и очищает сессию', async ({ page }) => {
    await login(page);

    await page.getByRole('button', { name: /Иванов/ }).click();
    await page.getByRole('button', { name: 'Выйти' }).click();

    await expect(page.getByRole('heading', { name: 'Вход в систему' })).toBeVisible();

    // Перезагрузка не должна вернуть пользователя обратно внутрь.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Вход в систему' })).toBeVisible();
  });
});
