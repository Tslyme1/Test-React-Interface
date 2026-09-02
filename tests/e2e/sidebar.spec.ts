import { test, expect } from '@playwright/test';
import { createProject, seedSession, watchConsole } from './helpers';

/**
 * Сайдбар — разделы приложения (Профиль, Режим работы, Проекты, Заказчики,
 * Корзина), отдельно от шапки сервиса, которая несёт бренд и открытый
 * проект. Переход между разделами не закрывает открытый проект — так же,
 * как раньше уход на список не закрывал его через знак «УЗТМ».
 */
test.describe('Сайдбар', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page);
    await expect(page.getByRole('table')).toBeVisible();
  });

  test('переход в «Заказчики» и «Профиль» без ошибок в консоли', async ({ page }) => {
    const console_ = watchConsole(page);

    await page.getByRole('button', { name: 'Заказчики' }).click();
    await expect(page.getByRole('heading', { name: 'Заказчики' })).toBeVisible();
    // Свод по тем же проектам: заказчик из примеров обязан найтись.
    await expect(page.getByRole('cell', { name: 'ЕВРАЗ КГОК' })).toBeVisible();

    await page.getByRole('button', { name: 'Профиль' }).click();
    await expect(page.getByRole('heading', { name: 'Профиль' })).toBeVisible();

    await page.getByRole('button', { name: 'Проекты' }).click();
    await expect(page.getByRole('heading', { name: 'Проекты' })).toBeVisible();

    console_.assertClean();
  });

  test('строка заказчика ведёт на «Проекты», отфильтрованные на него', async ({ page }) => {
    await page.getByRole('button', { name: 'Заказчики' }).click();
    await page.getByRole('row', { name: /ЕВРАЗ КГОК/ }).click();

    await expect(page.getByRole('heading', { name: 'Проекты' })).toBeVisible();
    // Фильтр «Заказчик» в строке над таблицей показывает применённое значение.
    await expect(page.getByRole('button', { name: 'ЕВРАЗ КГОК', exact: true })).toBeVisible();
    const rows = page.getByRole('row').filter({ hasNotText: 'Дробилка' });
    const count = await rows.count();
    for (let i = 0; i < count; i += 1) {
      await expect(rows.nth(i)).toContainText('ЕВРАЗ КГОК');
    }
  });

  test('корзина открывается из сайдбара', async ({ page }) => {
    await page.getByRole('button', { name: /Действия:/ }).first().click();
    await page.getByRole('button', { name: 'Удалить в корзину' }).click();

    await page.getByRole('button', { name: /Корзина/ }).click();
    await expect(page.getByRole('dialog', { name: /Корзина/ })).toBeVisible();
  });

  test('режим открытого проекта задан при создании и не меняется в сайдбаре', async ({ page }) => {
    await createProject(page);

    const engineering = page.getByRole('radio', { name: 'Инженерный' });
    const simplified = page.getByRole('radio', { name: 'Упрощённый' });
    await expect(engineering).toBeChecked();
    await expect(engineering).toBeDisabled();
    await expect(simplified).toBeDisabled();
  });
});
