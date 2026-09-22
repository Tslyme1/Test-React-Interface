import { test, expect } from '@playwright/test';
import { DEMO_USER, login, watchConsole } from './helpers';

test.describe('Вход', () => {
  test('первый шаг — учётные данные, переход заблокирован до заполнения', async ({ page }) => {
    const console_ = watchConsole(page);
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Вход в систему' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'УЗТМ' })).toBeVisible();

    // Режим на первом шаге не спрашивают — он живёт на втором.
    await expect(page.getByRole('radio', { name: 'Инженерный' })).toHaveCount(0);

    const next = page.getByRole('button', { name: 'Продолжить' });
    await expect(next).toBeDisabled();

    await page.getByLabel('Логин или почта').fill(DEMO_USER.login);
    await expect(next).toBeDisabled();

    await page.getByLabel('Пароль').fill(DEMO_USER.password);
    await expect(next).toBeEnabled();

    console_.assertClean();
  });

  test('второй шаг объясняет режимы и возвращает назад, не теряя введённое', async ({ page }) => {
    const console_ = watchConsole(page);
    await page.goto('/');

    await page.getByLabel('Логин или почта').fill(DEMO_USER.login);
    await page.getByLabel('Пароль').fill(DEMO_USER.password);
    await page.getByRole('button', { name: 'Продолжить' }).click();

    await expect(page.getByRole('heading', { name: 'Режим работы' })).toBeVisible();

    /* Карточка режима — не одна подпись: сводка и три коротких пункта,
       ради которых шаг и отделён от логина с паролем. */
    await expect(page.getByText('Три коротких шага и готовый отчёт.')).toBeVisible();
    await expect(page.getByText('Ручной ввод — только крупность продукта')).toBeVisible();

    /* Подписи группы на экране нет: заголовок уже назвал его «Режимом
       работы», и повтор под ним только удваивал высоту шапки. Скринридеру
       группа подписана — `aria-label`, а не видимая `legend`. */
    await expect(page.getByText('Режим работы нового проекта')).toHaveCount(0);
    await expect(page.getByRole('radiogroup', { name: 'Режим работы нового проекта' })).toBeVisible();

    await page.getByRole('button', { name: 'Назад' }).click();
    await expect(page.getByLabel('Логин или почта')).toHaveValue(DEMO_USER.login);

    console_.assertClean();
  });

  test('вход ведёт к списку проектов и показывает имя пользователя в профиле', async ({ page }) => {
    const console_ = watchConsole(page);
    await login(page);

    // Имя — в «Профиле», не в шапке: там сессия долетела до раздела приложения.
    await page.getByRole('button', { name: 'Настройки' }).click();
    await expect(page.getByText(DEMO_USER.name)).toBeVisible();
    console_.assertClean();
  });

  test('сессия переживает перезагрузку страницы', async ({ page }) => {
    await login(page);
    await page.reload();

    await expect(page.getByRole('heading', { name: 'Проекты' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Вход в систему' })).toBeHidden();
  });

  test('режим работы выбирается на втором шаге и задаёт форму нового проекта', async ({ page }) => {
    const console_ = watchConsole(page);
    await page.goto('/');

    await page.getByLabel('Логин или почта').fill(DEMO_USER.login);
    await page.getByLabel('Пароль').fill(DEMO_USER.password);
    await page.getByRole('button', { name: 'Продолжить' }).click();

    // По умолчанию инженерный — шаг открывается на нём.
    await expect(page.getByRole('radio', { name: 'Инженерный' })).toBeChecked();
    await page.getByRole('radio', { name: 'Упрощённый' }).check();
    await page.getByRole('button', { name: 'Войти' }).click();

    // Выбор долетел до создания проекта: окно упрощённого режима, а не
    // инженерное «Новый проект».
    await page.getByRole('button', { name: 'Новый проект' }).first().click();
    await expect(page.getByRole('dialog', { name: 'Выбор дробилки' })).toBeVisible();

    console_.assertClean();
  });

  test('выбранный при входе режим переживает перезагрузку', async ({ page }) => {
    await login(page, DEMO_USER, 'Упрощённый');

    await page.reload();

    /* Раньше режим жил состоянием `App` и сбрасывался на инженерный
       при каждом обновлении страницы — то есть выбор держался до F5. */
    await page.getByRole('button', { name: 'Новый проект' }).first().click();
    await expect(page.getByRole('dialog', { name: 'Выбор дробилки' })).toBeVisible();
  });

  test('вход открыт под любым логином и паролем — стенд, а не учётная запись', async ({ page }) => {
    await login(page, { login: 'кто-угодно', password: 'что-угодно', name: 'кто-угодно' });

    await page.getByRole('button', { name: 'Настройки' }).click();
    await expect(page.getByText('кто-угодно')).not.toHaveCount(0);
  });

  test('выход возвращает на экран входа и очищает сессию', async ({ page }) => {
    await login(page);

    await page.getByRole('button', { name: 'Настройки' }).click();
    await page.getByRole('button', { name: 'Выйти' }).click();

    await expect(page.getByRole('heading', { name: 'Вход в систему' })).toBeVisible();

    // Перезагрузка не должна вернуть пользователя обратно внутрь.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Вход в систему' })).toBeVisible();
  });
});
