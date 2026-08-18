import { test, expect } from '@playwright/test';
import { SAMPLE_PROJECT, seedSession, watchConsole } from './helpers';

/**
 * Выбор из справочника. До этого набора компонент проверялся только
 * попутно — через создание проекта в других сценариях, где он лишь
 * проходной шаг. Поиск, фильтр и сортировка не проверялись вовсе.
 */
test.describe('Выбор дробилки из каталога', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page, { empty: true });
    // Каталог и есть тело окна нового проекта — отдельного перехода в него нет.
    await page.getByRole('button', { name: 'Новый проект' }).first().click();
    await expect(page.getByRole('table')).toBeVisible();
  });

  test('показывает весь каталог с характеристиками', async ({ page }) => {
    const console_ = watchConsole(page);

    await expect(page.getByText('Показано: 30 из 30')).toBeVisible();
    // Шапка несёт короткие подписи характеристик, а не только названия машин.
    await expect(page.getByRole('columnheader', { name: /D, мм/ })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /Q, т\/ч/ })).toBeVisible();

    console_.assertClean();
  });

  test('поиск находит и по названию, и по значению характеристики', async ({ page }) => {
    const search = page.getByLabel('Поиск');

    await search.fill('КСД-2200');
    await expect(page.getByRole('button', { name: 'КСД-2200Т', exact: true })).toBeVisible();

    // 3000 — диаметр КМД-3000Т2: ищем по значению, а не по имени.
    await search.fill('3000');
    await expect(page.getByRole('button', { name: 'КМД-3000Т2', exact: true })).toBeVisible();

    await search.fill('такого нет');
    await expect(page.getByText('Ничего не найдено')).toBeVisible();
  });

  test('фильтр по семейству сужает список', async ({ page }) => {
    await page.getByRole('radio', { name: 'КСД' }).check();

    await expect(page.getByRole('button', { name: 'КСД-2200Т', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'КМД-3000Т2', exact: true })).toHaveCount(0);

    await page.getByRole('radio', { name: 'Все' }).check();
    await expect(page.getByRole('button', { name: 'КМД-3000Т2', exact: true })).toBeVisible();
  });

  test('по умолчанию отсортировано по диаметру, а не по порядку файла', async ({ page }) => {
    // Самая маленькая машина каталога — КСД-900Т, D = 900.
    const firstRow = page.getByRole('row').nth(1);
    await expect(firstRow).toContainText('КСД-900Т');
  });

  test('сортировка по характеристике учитывает числа, а не строки', async ({ page }) => {
    await page.getByRole('button', { name: /D, мм/ }).click();

    // По убыванию первым должен идти 3500, а не «900» как старшая строка.
    const firstRow = page.getByRole('row').nth(1);
    await expect(firstRow).toContainText('3500');
  });

  test('выбор отмечает строку и подставляет название проекта', async ({ page }) => {
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByLabel('Название проекта')).toHaveValue('');

    await dialog.getByRole('button', { name: SAMPLE_PROJECT.crusher, exact: true }).click();

    // Строка помечена, окно осталось открытым — каталог никуда не уходит.
    await expect(dialog.getByRole('row').filter({ hasText: SAMPLE_PROJECT.crusher })).toContainText('Выбрано');
    await expect(dialog.getByLabel('Название проекта')).toHaveValue(SAMPLE_PROJECT.crusher);
  });

  test('своё название не затирается при смене дробилки', async ({ page }) => {
    const dialog = page.getByRole('dialog');

    await dialog.getByRole('button', { name: SAMPLE_PROJECT.crusher, exact: true }).click();
    await dialog.getByLabel('Название проекта').fill('Своё название');

    await dialog.getByRole('button', { name: 'КМД-3000Т2', exact: true }).click();

    await expect(dialog.getByLabel('Название проекта')).toHaveValue('Своё название');
  });
});
