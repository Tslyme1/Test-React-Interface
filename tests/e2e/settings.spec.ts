import { test, expect } from '@playwright/test';
import { seedSession } from './helpers';

/**
 * «Настройки» — данные учётной записи, тема, размер шрифта и режим
 * нового проекта. Пункт назывался «Профиль» до переименования: за ним
 * стоят настройки отображения, а не карточка пользователя.
 * Переключатель здесь, а не в сайдбаре: это настройка, а не переход.
 */
test.describe('Настройки', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page, { empty: true });
    await page.getByRole('button', { name: 'Настройки' }).click();
    await expect(page.getByRole('heading', { name: 'Настройки' })).toBeVisible();
  });

  test('по умолчанию — инженерный режим, «Новый проект» открывает обычную модалку', async ({ page }) => {
    await expect(page.getByRole('option', { name: 'Инженерный' })).toHaveAttribute('aria-selected', 'true');

    await page.getByRole('button', { name: 'Проекты' }).click();
    await page.getByRole('button', { name: 'Новый проект' }).first().click();
    await expect(page.getByRole('dialog', { name: 'Новый проект', exact: true })).toBeVisible();
  });

  test('переключение на «Упрощённый» меняет, что открывает «Новый проект»', async ({ page }) => {
    await page.getByRole('option', { name: 'Упрощённый' }).click();
    // Смена режима спрашивает подтверждение — затрагивает следующий новый проект.
    await page.getByRole('button', { name: 'Сменить' }).click();

    await page.getByRole('button', { name: 'Проекты' }).click();
    await page.getByRole('button', { name: 'Новый проект' }).first().click();
    await expect(page.getByRole('dialog', { name: 'Выбор дробилки' })).toBeVisible();
  });

  test('режим работы — строки с описанием, а не сегмент-контрол', async ({ page }) => {
    await expect(page.getByText('Ручная настройка всех параметров на каждом этапе.')).toBeVisible();
    await expect(page.getByText('Три коротких шага и готовый отчёт.')).toBeVisible();

    await page.getByRole('option', { name: 'Упрощённый' }).click();
    // Смена режима спрашивает подтверждение — до него выбор в списке не меняется.
    await expect(page.getByRole('option', { name: 'Упрощённый' })).toHaveAttribute('aria-selected', 'false');
    await page.getByRole('button', { name: 'Сменить' }).click();

    await expect(page.getByRole('option', { name: 'Упрощённый' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('option', { name: 'Инженерный' })).toHaveAttribute('aria-selected', 'false');
  });

  test('тема — по умолчанию «Как в системе», выбор переживает перезагрузку', async ({ page }) => {
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.*/);
    await expect(page.getByRole('option', { name: 'Как в системе' })).toHaveAttribute('aria-selected', 'true');

    await page.getByRole('option', { name: 'Тёмная' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.getByRole('button', { name: 'Настройки' }).click();
    await expect(page.getByRole('option', { name: 'Тёмная' })).toHaveAttribute('aria-selected', 'true');
  });

  test('размер шрифта меняет кегли ролей типографики глобально и переживает перезагрузку', async ({ page }) => {
    const bodySize = () =>
      page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--text-body-size').trim());

    await expect(page.getByRole('option', { name: 'Обычный' })).toHaveAttribute('aria-selected', 'true');
    // «Обычный» ничего не переопределяет — значение приходит из токена системы.
    expect(await bodySize()).toBe('14px');

    await page.getByRole('option', { name: 'Очень крупный' }).click();
    expect(await bodySize()).toBe('18.2px');

    await page.reload();
    await page.getByRole('button', { name: 'Настройки' }).click();
    expect(await bodySize()).toBe('18.2px');
    await expect(page.getByRole('option', { name: 'Очень крупный' })).toHaveAttribute('aria-selected', 'true');

    await page.getByRole('option', { name: 'Обычный' }).click();
    expect(await bodySize()).toBe('14px');
  });
});
