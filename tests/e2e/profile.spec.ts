import { test, expect } from '@playwright/test';
import { seedSession } from './helpers';

/**
 * «Профиль» — данные пользователя и переключатель режима нового проекта.
 * Переключатель здесь, а не в сайдбаре: это настройка, а не переход.
 */
test.describe('Профиль', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page, { empty: true });
    await page.getByRole('button', { name: 'Профиль' }).click();
    await expect(page.getByRole('heading', { name: 'Профиль' })).toBeVisible();
  });

  test('по умолчанию — инженерный режим, «Новый проект» открывает обычную модалку', async ({ page }) => {
    await expect(page.getByRole('option', { name: 'Инженерный' })).toHaveAttribute('aria-selected', 'true');

    await page.getByRole('button', { name: 'Проекты' }).click();
    await page.getByRole('button', { name: 'Новый проект' }).first().click();
    await expect(page.getByRole('dialog', { name: 'Новый проект', exact: true })).toBeVisible();
  });

  test('переключение на «Упрощённый» меняет, что открывает «Новый проект»', async ({ page }) => {
    await page.getByRole('option', { name: 'Упрощённый' }).click();

    await page.getByRole('button', { name: 'Проекты' }).click();
    await page.getByRole('button', { name: 'Новый проект' }).first().click();
    await expect(page.getByRole('dialog', { name: 'Выбор дробилки' })).toBeVisible();
  });

  test('режим работы — строки с описанием, а не сегмент-контрол', async ({ page }) => {
    await expect(page.getByText('Ручная настройка всех параметров на каждом этапе.')).toBeVisible();
    await expect(page.getByText('Три коротких шага и готовый отчёт.')).toBeVisible();

    await page.getByRole('option', { name: 'Упрощённый' }).click();
    await expect(page.getByRole('option', { name: 'Упрощённый' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('option', { name: 'Инженерный' })).toHaveAttribute('aria-selected', 'false');
  });
});
