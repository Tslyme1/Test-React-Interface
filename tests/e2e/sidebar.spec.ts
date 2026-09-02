import { test, expect } from '@playwright/test';
import { createProject, seedSession, watchConsole } from './helpers';

/**
 * Сайдбар — разделы приложения (Проекты, Заказчики, Профиль, Корзина),
 * отдельно от шапки сервиса, которая несёт бренд и открытый проект.
 * Переход между разделами не закрывает открытый проект — так же, как
 * раньше уход на список не закрывал его через знак «УЗТМ». Скрывается
 * целиком, когда открытый инженерный проект показан на экране: внутри
 * проекта должен быть виден только он (см. `wizard.spec.ts`).
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

  test('строка заказчика ведёт на «Проекты», отфильтрованные на него, меняет заголовок на хлебную крошку и подсвечивает «Заказчики»', async ({ page }) => {
    await page.getByRole('button', { name: 'Заказчики' }).click();
    await page.getByRole('row', { name: /ЕВРАЗ КГОК/ }).click();

    // Заголовок экрана — хлебная крошка «Заказчики / ЕВРАЗ КГОК», а не общее
    // «Проекты»: ясно, что список сейчас показывает именно его историю,
    // а не весь список сразу, и откуда сюда пришли.
    const heading = page.getByRole('heading', { name: 'Заказчики / ЕВРАЗ КГОК' });
    await expect(heading).toBeVisible();
    await expect(page.getByRole('button', { name: 'ЕВРАЗ КГОК', exact: true })).toBeVisible();
    const rows = page.getByRole('row').filter({ hasNotText: 'Дробилка' });
    const count = await rows.count();
    for (let i = 0; i < count; i += 1) {
      await expect(rows.nth(i)).toContainText('ЕВРАЗ КГОК');
    }

    // Раздел контента — список проектов, но в сайдбаре по-прежнему подсвечен
    // «Заказчики» (проп `selected` у `Cell`): пользователь пришёл сюда именно
    // оттуда и не «потерялся».
    await expect(page.getByRole('button', { name: 'Заказчики' })).toHaveClass(/selected/);
    await expect(page.getByRole('button', { name: 'Проекты' })).not.toHaveClass(/selected/);
  });

  test('корзина открывается из сайдбара', async ({ page }) => {
    await page.getByRole('button', { name: /Действия:/ }).first().click();
    await page.getByRole('button', { name: 'Удалить в корзину' }).click();

    await page.getByRole('button', { name: /Корзина/ }).click();
    await expect(page.getByRole('dialog', { name: /Корзина/ })).toBeVisible();
  });

  test('«Профиль» и «Корзина» стоят внизу списка, «Проекты» и «Заказчики» — вверху', async ({ page }) => {
    const labels = await page.locator('[class*="sidebar"] button').allInnerTexts();
    const clean = labels.map((t) => t.replace(/\d+$/, '').trim()).filter(Boolean);
    expect(clean.indexOf('Проекты')).toBeLessThan(clean.indexOf('Профиль'));
    expect(clean.indexOf('Заказчики')).toBeLessThan(clean.indexOf('Корзина'));
  });

  test('сайдбар скрывается, когда открытый проект показан на экране', async ({ page }) => {
    await expect(page.locator('[class*="sidebar"]')).toBeVisible();

    await createProject(page);
    await expect(page.locator('[class*="sidebar"]')).toHaveCount(0);

    // Уход на список возвращает сайдбар — проект остаётся открытым, но с глаз ушёл.
    await page.getByRole('button', { name: 'УЗТМ' }).click();
    await expect(page.locator('[class*="sidebar"]')).toBeVisible();
  });
});
