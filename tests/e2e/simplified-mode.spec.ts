import { test, expect, type Page } from '@playwright/test';
import { seedSession, watchConsole } from './helpers';

/**
 * Упрощённый режим: шаги дают только выбор из каталога, без единого поля
 * ввода на первых двух шагах. Несколько дробилок и проб — расчёт на шаге
 * «Продукт» проходит по каждой комбинации, а отчёт даёт между ними
 * переключаться.
 */

async function switchToSimplified(page: Page) {
  await page.getByRole('radio', { name: 'Упрощённый' }).click();
}

async function createSimplifiedProject(page: Page) {
  await page.getByRole('button', { name: 'Новый проект' }).first().click();
  const dialog = page.getByRole('dialog', { name: /упрощ/i });
  await expect(dialog).toBeVisible();

  await dialog.getByRole('row', { name: /КМД-2000Т/ }).click();
  await dialog.getByRole('row', { name: /КСД-2000Т/ }).click();
  await dialog.getByLabel('Название проекта').fill('Упрощённый расчёт');
  await dialog.getByRole('button', { name: 'Заказчик *' }).click();
  await page.getByRole('option').first().click();
  await dialog.getByRole('button', { name: 'Продолжить' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

test.describe('Упрощённый режим', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page, { empty: true });
    await switchToSimplified(page);
    await createSimplifiedProject(page);
  });

  test('шаг «Дробилка» — только выбор, без полей ввода', async ({ page }) => {
    const console_ = watchConsole(page);

    await expect(page.getByRole('heading', { name: 'Дробилки' })).toBeVisible();
    await expect(page.getByText('КМД-2000Т')).toBeVisible();
    await expect(page.getByText('КСД-2000Т')).toBeVisible();
    // Ни одного текстового поля на шаге — это выбор, а не форма.
    await expect(page.locator('input[type="number"]')).toHaveCount(0);

    console_.assertClean();
  });

  test('можно выбрать несколько проб руды на шаге «Руда»', async ({ page }) => {
    await page.getByRole('button', { name: 'Продолжить' }).click();
    await page.getByRole('button', { name: /Руда/ }).click();
    await expect(page.getByRole('heading', { name: 'Пробы руды' })).toBeVisible();

    await page.getByRole('button', { name: /Выбрать — \d+ в каталоге/ }).click();
    const oreDialog = page.getByRole('dialog', { name: /проба руды/i });
    await oreDialog.getByRole('row').nth(1).click();
    await oreDialog.getByRole('row').nth(2).click();
    await page.getByRole('button', { name: 'Готово' }).click();

    await expect(page.getByRole('button', { name: /Убрать:/ })).toHaveCount(2);
  });

  test('расчёт по шагу «Продукт» открывает отчёт с навигацией по комбинациям', async ({ page }) => {
    await page.getByRole('button', { name: 'Продолжить' }).click();
    await page.getByRole('button', { name: /Руда/ }).click();
    await page.getByRole('button', { name: /Выбрать — \d+ в каталоге/ }).click();
    const oreDialog = page.getByRole('dialog', { name: /проба руды/i });
    await oreDialog.getByRole('row').nth(1).click();
    await oreDialog.getByRole('row').nth(2).click();
    await page.getByRole('button', { name: 'Готово' }).click();

    await page.getByRole('button', { name: 'Продолжить' }).click();
    await page.getByRole('button', { name: /Продукт/ }).click();
    await expect(page.getByRole('heading', { name: 'Продукт' })).toBeVisible();
    // Единственное поле ввода во всём режиме.
    await page.getByLabel(/Максимальная крупность продукта/).fill('30');

    await page.getByRole('button', { name: 'Выполнить расчёт' }).click();
    await page.getByRole('button', { name: 'Смотреть результат' }).click();

    const drawer = page.getByRole('dialog', { name: /Результат/ });
    await expect(drawer).toBeVisible();
    // 2 дробилки × 2 пробы — четыре комбинации, переключатель обязан быть.
    const combo = drawer.getByLabel('Комбинация «дробилка — проба»');
    await expect(combo).toBeVisible();
    await expect(drawer.getByRole('table').first()).toBeVisible();

    const before = await combo.innerText();
    await combo.click();
    // 2 дробилки × 2 пробы — четыре комбинации в списке.
    await expect(page.getByRole('option')).toHaveCount(4);
    // Последняя, а не соседняя: заведомо другая пара «дробилка — проба»,
    // а не просто следующая строка списка.
    const lastOption = page.getByRole('option').last();
    const lastLabel = await lastOption.innerText();
    await lastOption.click();

    await expect(combo).toHaveText(lastLabel);
    expect(lastLabel).not.toEqual(before);
  });
});
