import { test, expect } from '@playwright/test';
import { createProject, SAMPLE_PROJECT, seedSession, watchConsole } from './helpers';

/**
 * Шаг «Геометрия»: степпер с одними заголовками, смена дробилки прямо
 * с шага, режим отображения (подсветка участка схемы, дельта от расчёта)
 * и выезжающая панель схемы.
 */
test.describe('Шаг «Геометрия»: заголовки шагов и раскладка', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page, { empty: true });
    await createProject(page);
  });

  test('степпер показывает только заголовки шагов, без подписей под ними', async ({ page }) => {
    // Заголовки — новые: «Дробилка», «Руда», «Продукт», а не «Геометрия»/«Грансостав»/«Продукт».
    await expect(page.getByRole('button', { name: 'Дробилка', exact: true })).toBeVisible();
    await expect(page.getByText('Руда', { exact: true })).toBeVisible();
    await expect(page.getByText('Продукт', { exact: true })).toBeVisible();

    // Прежние подписи под шагами не остались — ни как текст шага, ни как обрезок.
    await expect(page.getByText('Камера дробления')).toHaveCount(0);
    await expect(page.getByText('Характеристика питания')).toHaveCount(0);
    await expect(page.getByText('Грансостав и усилия')).toHaveCount(0);
  });

  test('схема выезжает и заезжает панелью, оставаясь в разметке', async ({ page }) => {
    const toggle = page.getByRole('button', { name: /Схема профиля камеры/ });
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('heading', { name: 'Схема профиля камеры' })).toBeVisible();

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByRole('heading', { name: 'Схема профиля камеры' })).toBeVisible();
  });
});

test.describe('Шаг «Геометрия»: смена дробилки', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page, { empty: true });
    await createProject(page);
  });

  test('плашка показывает текущую дробилку и открывает окно замены', async ({ page }) => {
    await expect(page.getByText(SAMPLE_PROJECT.crusher, { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Сменить дробилку' }).click();
    const dialog = page.getByRole('dialog', { name: 'Сменить дробилку' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('table')).toBeVisible();

    await dialog.getByRole('button', { name: 'КМД-2200Т6-Д', exact: true }).click();

    await expect(dialog).toHaveCount(0);
    await expect(page.getByText('КМД-2200Т6-Д', { exact: true })).toBeVisible();
  });
});

test.describe('Шаг «Геометрия»: режим отображения', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page, { empty: true });
    await createProject(page);
  });

  test('подсветка участка: наведение на поле D меняет разметку схемы, потеря фокуса — возвращает', async ({ page }) => {
    await page.getByRole('button', { name: 'Отображение' }).click();
    await page.getByRole('radio', { name: 'Подсветка участка' }).check();
    await page.keyboard.press('Escape');

    const svg = page.getByTestId('chamber-scheme');
    const before = await svg.innerHTML();

    const field = page.getByLabel('Диаметр основания D, мм');
    await field.hover();
    await expect(async () => {
      expect(await svg.innerHTML()).not.toBe(before);
    }).toPass();

    await page.getByRole('heading', { name: 'Геометрия камеры дробления' }).hover();
    await expect(async () => {
      expect(await svg.innerHTML()).toBe(before);
    }).toPass();
  });

  test('в режиме «Только ввод» (по умолчанию) наведение на поле не меняет схему', async ({ page }) => {
    const svg = page.getByTestId('chamber-scheme');
    const before = await svg.innerHTML();

    await page.getByLabel('Диаметр основания D, мм').hover();
    await page.waitForTimeout(150);
    expect(await svg.innerHTML()).toBe(before);
  });

  test('дельта: после расчёта правка поля показывает «было: …», выключение — прячет', async ({ page }) => {
    const console_ = watchConsole(page);

    await page.getByRole('button', { name: 'Выполнить расчёт' }).click();
    await expect(page.getByRole('button', { name: 'Смотреть результат' })).toBeVisible();

    const field = page.getByLabel('Диаметр основания D, мм');
    await field.fill('1900');

    // Режим «Дельта: Показывать изменения» включён по умолчанию.
    await expect(page.getByText(/было: 1750/)).toBeVisible();

    await page.getByRole('button', { name: 'Отображение' }).click();
    await page.getByRole('radio', { name: 'Не показывать изменения' }).check();
    await page.keyboard.press('Escape');

    await expect(page.getByText(/было: 1750/)).toHaveCount(0);

    console_.assertClean();
  });

  test('дельта не показывается, пока шаг ни разу не считался', async ({ page }) => {
    await page.getByLabel('Диаметр основания D, мм').fill('1900');
    await expect(page.getByText(/было:/)).toHaveCount(0);
  });
});
