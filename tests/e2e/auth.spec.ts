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

  test('вход ведёт к списку проектов и показывает имя пользователя в профиле', async ({ page }) => {
    const console_ = watchConsole(page);
    await login(page);

    // Имя — в «Профиле», не в шапке: там сессия долетела до раздела приложения.
    await page.getByRole('button', { name: 'Профиль' }).click();
    await expect(page.getByText(DEMO_USER.name)).toBeVisible();
    console_.assertClean();
  });

  test('сессия переживает перезагрузку страницы', async ({ page }) => {
    await login(page);
    await page.reload();

    await expect(page.getByRole('heading', { name: 'Проекты' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Вход в систему' })).toBeHidden();
  });

  test('режим работы выбирается при входе и задаёт форму нового проекта', async ({ page }) => {
    const console_ = watchConsole(page);
    await page.goto('/');

    // По умолчанию инженерный — форма открывается на нём.
    await expect(page.getByRole('radio', { name: 'Инженерный' })).toBeChecked();
    await page.getByRole('radio', { name: 'Упрощённый' }).check();

    await page.getByLabel('Логин или почта').fill(DEMO_USER.login);
    await page.getByLabel('Пароль').fill(DEMO_USER.password);
    await page.getByRole('button', { name: 'Войти' }).click();

    // Выбор долетел до создания проекта: окно упрощённого режима, а не
    // инженерное «Новый проект».
    await page.getByRole('button', { name: 'Новый проект' }).first().click();
    await expect(page.getByRole('dialog', { name: 'Выбор дробилки' })).toBeVisible();

    console_.assertClean();
  });

  test('выбранный при входе режим переживает перезагрузку', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('radio', { name: 'Упрощённый' }).check();
    await page.getByLabel('Логин или почта').fill(DEMO_USER.login);
    await page.getByLabel('Пароль').fill(DEMO_USER.password);
    await page.getByRole('button', { name: 'Войти' }).click();
    await expect(page.getByRole('heading', { name: 'Проекты' })).toBeVisible();

    await page.reload();

    /* Раньше режим жил состоянием `App` и сбрасывался на инженерный
       при каждом обновлении страницы — то есть выбор держался до F5. */
    await page.getByRole('button', { name: 'Новый проект' }).first().click();
    await expect(page.getByRole('dialog', { name: 'Выбор дробилки' })).toBeVisible();
  });

  test('вход открыт под любым логином и паролем — стенд, а не учётная запись', async ({ page }) => {
    await page.goto('/');
    await page.getByLabel('Логин или почта').fill('кто-угодно');
    await page.getByLabel('Пароль').fill('что-угодно');
    await page.getByRole('button', { name: 'Войти' }).click();

    await expect(page.getByRole('heading', { name: 'Проекты' })).toBeVisible();
    await page.getByRole('button', { name: 'Профиль' }).click();
    await expect(page.getByText('кто-угодно')).not.toHaveCount(0);
  });

  test('выход возвращает на экран входа и очищает сессию', async ({ page }) => {
    await login(page);

    await page.getByRole('button', { name: 'Профиль' }).click();
    await page.getByRole('button', { name: 'Выйти' }).click();

    await expect(page.getByRole('heading', { name: 'Вход в систему' })).toBeVisible();

    // Перезагрузка не должна вернуть пользователя обратно внутрь.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Вход в систему' })).toBeVisible();
  });
});
