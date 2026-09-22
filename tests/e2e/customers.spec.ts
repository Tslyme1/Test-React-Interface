import { test, expect } from '@playwright/test';
import { chooseProjectStart, seedSession } from './helpers';

/**
 * Заказчики — фильтры по исполнителю и тегу (свод по всем проектам этого
 * заказчика — «хотя бы у одного»), и вход в создание нового заказчика через
 * тот же «Новый проект», которым заказчик и заводится (см. `CustomersPage`).
 */
test.describe('Заказчики — фильтры и создание', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page);
    await page.getByRole('button', { name: 'Заказчики' }).click();
    await expect(page.getByRole('table')).toBeVisible();
  });

  test('фильтр по исполнителю сужает список заказчиков', async ({ page }) => {
    await expect(page.getByRole('row', { name: /ЕВРАЗ КГОК/ })).toBeVisible();
    await expect(page.getByRole('row', { name: /Михайловский ГОК/ })).toBeVisible();

    await page.getByRole('button', { name: 'Исполнитель' }).click();
    await page.getByRole('option', { name: 'Иванов А.С.' }).click();

    await expect(page.getByRole('row', { name: /ЕВРАЗ КГОК/ })).toBeVisible();
    await expect(page.getByRole('row', { name: /Михайловский ГОК/ })).toHaveCount(0);
  });

  test('фильтр по тегу сужает список заказчиков', async ({ page }) => {
    await page.getByRole('button', { name: 'Тег' }).click();
    await page.getByRole('option', { name: 'Рабочий' }).click();

    await expect(page.getByRole('row', { name: /ЕВРАЗ КГОК/ })).toBeVisible();
    await expect(page.getByRole('row', { name: /Михайловский ГОК/ })).toHaveCount(0);
  });

  test('«Новый заказчик» открывает создание проекта', async ({ page }) => {
    await page.getByRole('button', { name: 'Новый заказчик' }).click();
    await expect(page.getByRole('dialog')).toBeVisible();
    // Окно открывается развилкой — поля лежат за ответом на неё.
    await chooseProjectStart(page);
    await expect(page.getByLabel('Название проекта')).toBeVisible();
  });
});
