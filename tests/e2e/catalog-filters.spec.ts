import { test, expect } from '@playwright/test';
import { seedSession, watchConsole } from './helpers';

/**
 * Окно фильтров каталога и фиксированная высота окна нового проекта.
 *
 * Оба случая проверяются здесь, потому что оба ловят регрессии, невидимые
 * на скриншоте: закрытие двух окон разом по одному Esc и подпрыгивание
 * окна при вводе в поиск.
 */

test('окно фильтров внутри окна каталога: Esc закрывает только верхнее', async ({ page }) => {
  const console_ = watchConsole(page);
  await seedSession(page, { empty: true });
  await page.getByRole('button', { name: 'Новый проект' }).first().click();
  await expect(page.getByRole('table')).toBeVisible();

  await page.getByRole('button', { name: 'Фильтры' }).click();
  await expect(page.getByRole('heading', { name: 'Фильтры' })).toBeVisible();

  await page.getByRole('radio', { name: 'КСД' }).check();
  await page.getByRole('button', { name: 'Готово' }).click();
  await expect(page.getByRole('heading', { name: 'Фильтры' })).toHaveCount(0);
  // Окно каталога должно остаться открытым, фильтр — применённым.
  await expect(page.getByRole('heading', { name: 'Новый проект' })).toBeVisible();
  await expect(page.getByRole('row').filter({ hasText: 'КМД-3000Т2' })).toHaveCount(0);

  await page.getByRole('button', { name: 'Фильтры' }).click();
  await expect(page.getByRole('heading', { name: 'Фильтры' })).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: 'Фильтры' })).toHaveCount(0);
  await expect(page.getByRole('heading', { name: 'Новый проект' })).toBeVisible();

  console_.assertClean();
});

test('высота окна не меняется при сужении выборки', async ({ page }) => {
  await seedSession(page, { empty: true });
  await page.getByRole('button', { name: 'Новый проект' }).first().click();
  const dialog = page.getByRole('dialog');
  await expect(page.getByRole('table')).toBeVisible();

  const before = (await dialog.boundingBox())!.height;
  await page.getByLabel(/^Поиск:/).fill('КСД-900');
  await expect(page.getByRole('row').filter({ hasText: 'КСД-900Т' })).toHaveCount(1);
  const after = (await dialog.boundingBox())!.height;

  expect(Math.abs(after - before), `высота: было ${before}, стало ${after}`).toBeLessThan(2);
});
