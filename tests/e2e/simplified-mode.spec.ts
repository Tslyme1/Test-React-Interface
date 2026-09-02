import { test, expect, type Page } from '@playwright/test';
import { seedSession, watchConsole } from './helpers';

/**
 * Упрощённый режим — одно непрерывное окно (`SimplifiedProjectModal`) от
 * выбора дробилки до отчёта. Список проектов остаётся на экране всё время:
 * окно поверх него открывает, продолжает и завершает расчёт, не подменяя
 * собой главную и не открывая никаких экранов под собой.
 */

async function switchToSimplified(page: Page) {
  await page.getByRole('button', { name: 'Профиль' }).click();
  await page.getByRole('radio', { name: 'Упрощённый' }).click();
  await page.getByRole('button', { name: 'Проекты' }).click();
}

/**
 * Открывает окно, проходит шаг «Дробилка» и создаёт проект. Шаг «Дробилка»
 * подтверждает себя автоматически при создании — по возврату окно уже
 * стоит на шаге «Руда» с непустым выбором дробилок позади.
 */
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

  // То же окно продолжает работу — не переоткрывалось, список остался под ним.
  await expect(page.getByRole('dialog')).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Проекты' })).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Руда' })).toBeVisible();
}

test.describe('Упрощённый режим — до создания проекта', () => {
  test('степпер виден уже на первом шаге', async ({ page }) => {
    await seedSession(page, { empty: true });
    await switchToSimplified(page);

    await page.getByRole('button', { name: 'Новый проект' }).first().click();
    const dialog = page.getByRole('dialog', { name: /упрощ/i });
    await expect(dialog).toBeVisible();

    // Шаги «Руда» и «Продукт» видны в степпере сразу — не только начиная
    // со второго шага (footer этой ветки раньше не получал степпер вовсе).
    // «Дробилка» здесь неоднозначна (так же называется и колонка каталога),
    // поэтому опознаётся по своей паре с номером шага.
    await expect(dialog.getByText('1Дробилка', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Руда', { exact: true })).toBeVisible();
    await expect(dialog.getByText('Продукт', { exact: true })).toBeVisible();
  });
});

test.describe('Упрощённый режим', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page, { empty: true });
    await switchToSimplified(page);
    await createSimplifiedProject(page);
  });

  test('после создания стоит на шаге «Руда» — только выбор, без полей ввода', async ({ page }) => {
    const console_ = watchConsole(page);
    const dialog = page.getByRole('dialog');

    // Ни одного текстового поля на шаге — это выбор, а не форма.
    await expect(dialog.locator('input[type="number"]')).toHaveCount(0);
    // Список проектов виден под затемнением — окно не заменило собой главную.
    await expect(page.getByRole('heading', { name: 'Проекты' })).toBeVisible();

    console_.assertClean();
  });

  test('можно выбрать несколько проб руды на шаге «Руда»', async ({ page }) => {
    const dialog = page.getByRole('dialog');

    await dialog.getByRole('row').nth(1).click();
    await dialog.getByRole('row').nth(2).click();

    // Ровно те же две строки отмечены флажком — окно держит набор, не форму.
    await expect(dialog.getByRole('checkbox', { checked: true })).toHaveCount(2);
  });

  test('расчёт по шагу «Продукт» открывает отчёт с навигацией по комбинациям — то же окно', async ({ page }) => {
    const dialog = page.getByRole('dialog');
    await dialog.getByRole('row').nth(1).click();
    await dialog.getByRole('row').nth(2).click();
    await dialog.getByRole('button', { name: 'Продолжить' }).click();

    // `exact` — иначе матчит заодно заголовок самого окна («Упрощённый расчёт — Продукт»).
    await expect(dialog.getByRole('heading', { name: 'Продукт', exact: true })).toBeVisible();
    // Единственное поле ввода во всём режиме.
    await dialog.getByLabel(/Максимальная крупность продукта/).fill('30');

    await dialog.getByRole('button', { name: 'Выполнить расчёт' }).click();

    // По-прежнему одно и то же окно — просто с другим содержимым внутри.
    await expect(page.getByRole('dialog')).toHaveCount(1);
    await expect(dialog.getByRole('heading', { name: 'Результат' })).toBeVisible();

    const combo = dialog.getByLabel('Комбинация «дробилка — проба»');
    await expect(combo).toBeVisible();
    const before = await combo.innerText();
    await combo.click();
    await page.getByRole('option').last().click();
    const after = await combo.innerText();
    expect(after).not.toEqual(before);

    await dialog.getByRole('button', { name: 'Готово' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Проекты' })).toBeVisible();
  });

  test('строку проекта можно снова открыть тем же окном и продолжить расчёт', async ({ page }) => {
    // Закрываем, не выбрав пробу.
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // Строка проекта в списке — открывает то же окно на том месте, где остановились.
    await page.getByRole('row', { name: /КМД-2000Т/ }).first().click();
    await expect(page.getByRole('dialog')).toBeVisible();
    await expect(page.getByRole('dialog').getByRole('heading', { name: 'Руда' })).toBeVisible();
  });
});
