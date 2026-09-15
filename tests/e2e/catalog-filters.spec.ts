import { test, expect } from '@playwright/test';
import { createProject, goToWizardStep, runStepCalc, seedSession, watchConsole } from './helpers';

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

  const filters = page.getByRole('dialog', { name: 'Фильтры' });
  await filters.getByRole('button', { name: 'Семейство' }).click();
  await page.getByRole('option', { name: 'КСД' }).click();
  await filters.getByRole('button', { name: 'Готово' }).click();
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

test('семейство применяется только по «Готово»', async ({ page }) => {
  await seedSession(page, { empty: true });
  await page.getByRole('button', { name: 'Новый проект' }).first().click();
  await expect(page.getByRole('table')).toBeVisible();

  const filters = page.getByRole('dialog', { name: 'Фильтры' });
  await page.getByRole('dialog', { name: 'Новый проект' }).getByRole('button', { name: 'Фильтры' }).click();
  await filters.getByRole('button', { name: 'Семейство' }).click();
  await page.getByRole('option', { name: 'КСД' }).click();

  // Окно фильтров ещё открыто — каталог под ним не пересобран.
  await expect(page.getByRole('row').filter({ hasText: 'КМД-3000Т2' })).toHaveCount(1);

  await filters.getByRole('button', { name: 'Готово' }).click();
  await expect(page.getByRole('row').filter({ hasText: 'КМД-3000Т2' })).toHaveCount(0);
});

test('повторное нажатие по строке снимает выбор', async ({ page }) => {
  await seedSession(page, { empty: true });
  await page.getByRole('button', { name: 'Новый проект' }).first().click();

  const dialog = page.getByRole('dialog', { name: 'Новый проект' });
  const mark = dialog.getByRole('checkbox', { name: 'Выбрать КСД-2200Т' });
  const row = dialog.getByRole('button', { name: 'КСД-2200Т', exact: true });

  await expect(mark).not.toBeChecked();
  await row.click();
  await expect(mark).toBeChecked();
  await row.click();
  await expect(mark).not.toBeChecked();

  // Продолжить без выбранной машины нельзя.
  await expect(dialog.getByRole('button', { name: 'Продолжить' })).toBeDisabled();
});

test('условия в полосе поиска каталога — одной ширины', async ({ page }) => {
  await seedSession(page, { empty: true });
  await page.getByRole('button', { name: 'Новый проект' }).first().click();
  await expect(page.getByRole('table')).toBeVisible();

  const dialog = page.getByRole('dialog', { name: 'Новый проект' });
  // `.first()` — в полосе условий над таблицей и в шапке колонки таблицы
  // подписи совпадают («D, мм», «Q, т/ч» — сортировка по той же величине);
  // полоса стоит в разметке раньше таблицы.
  const family = dialog.getByRole('button', { name: 'Семейство' }).first();
  const diameter = dialog.getByRole('button', { name: 'D, мм' }).first();
  const throughput = dialog.getByRole('button', { name: 'Q, т/ч' }).first();

  const familyWidth = (await family.boundingBox())!.width;
  const diameterWidth = (await diameter.boundingBox())!.width;
  const throughputWidth = (await throughput.boundingBox())!.width;

  // Раньше «Семейство» сидело на `flex: 0 0 auto` — под ширину плейсхолдера —
  // а диапазоны рядом держал фиксированный базис, и полоса «плавала»:
  // поля были заметно разной ширины без причины. Теперь все три делят
  // один базис, как и строка фильтров на списке проектов.
  expect(Math.abs(familyWidth - diameterWidth), `Семейство: ${familyWidth}, D: ${diameterWidth}`).toBeLessThan(2);
  expect(Math.abs(diameterWidth - throughputWidth), `D: ${diameterWidth}, Q: ${throughputWidth}`).toBeLessThan(2);
});

test('шапка таблицы каталога остаётся на месте при прокрутке', async ({ page }) => {
  await seedSession(page, { empty: true });
  await page.getByRole('button', { name: 'Новый проект' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Новый проект' });
  await expect(page.getByRole('table')).toBeVisible();

  // Ждём, пока доиграет анимация появления окна — иначе «до» снимается
  // с ещё движущейся панели, и разница пары пикселей выглядит так же,
  // как настоящая прокрутка шапки.
  await page.waitForTimeout(250);
  const head = dialog.getByRole('columnheader', { name: /Дробилка/ }).first();
  const before = (await head.boundingBox())!.y;

  const scroller = dialog.locator('[class*="scroll"]').first();
  await scroller.evaluate((el) => el.scrollBy(0, 300));
  const after = (await head.boundingBox())!.y;

  expect(Math.abs(after - before), `шапка: было ${before}, стало ${after}`).toBeLessThan(2);
});

test('в окне выбора пробы руды есть быстрые фильтры по характеристикам, не только поиск', async ({ page }) => {
  await seedSession(page, { empty: true });
  await createProject(page);
  await runStepCalc(page);
  await goToWizardStep(page, /Руда/);
  const ore = page.getByRole('dialog', { name: 'Выбор пробы руды' });
  await expect(ore).toBeVisible();

  // `.first()` — то же имя носит и сортирующая кнопка в шапке таблицы;
  // полоса условий стоит в разметке раньше таблицы (см. тест выше).
  await expect(ore.getByRole('button', { name: 'f', exact: true }).first()).toBeVisible();
  await expect(ore.getByRole('button', { name: 'ρ, т/м³', exact: true }).first()).toBeVisible();
});

test('колонка названия не меняет ширину при смене выборки', async ({ page }) => {
  await seedSession(page, { empty: true });
  await page.getByRole('button', { name: 'Новый проект' }).first().click();

  const nameHead = page.getByRole('columnheader', { name: /Дробилка/ }).first();
  const before = (await nameHead.boundingBox())!.width;

  const filters = page.getByRole('dialog', { name: 'Фильтры' });
  await page.getByRole('dialog', { name: 'Новый проект' }).getByRole('button', { name: 'Фильтры' }).click();
  await filters.getByRole('button', { name: 'Семейство' }).click();
  await page.getByRole('option', { name: 'КСД' }).click();
  await filters.getByRole('button', { name: 'Готово' }).click();
  await expect(page.getByRole('row').filter({ hasText: 'КМД-3000Т2' })).toHaveCount(0);

  const after = (await nameHead.boundingBox())!.width;
  // Ширину колонки таблица считает по содержимому: у КМД самое длинное имя
  // на 15px длиннее, чем у КСД, и без минимума таблица съезжала вбок целиком.
  expect(Math.abs(after - before), `ширина: было ${before}, стало ${after}`).toBeLessThan(2);
});
