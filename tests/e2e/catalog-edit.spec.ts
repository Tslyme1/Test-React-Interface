import { test, expect, type Locator, type Page } from '@playwright/test';
import { seedSession } from './helpers';
import { catalogChanges, mergeCatalog, withCatalogEntry } from '../../src/domain/catalogEdits';
import type { CatalogItem, SpecColumn } from '../../src/data/crushers';

/**
 * Правки справочника: своя дробилка через «+ Новая» и правка данных
 * каталожной. Сначала правила сами по себе, на чистых функциях, потом
 * сценарий в интерфейсе — так падение показывает, что именно сломалось:
 * правило или экран.
 */
const SPECS: SpecColumn[] = [
  { short: 'D, мм', label: 'Диаметр' },
  { short: 'Q, т/ч', label: 'Производительность' },
];

const BASE: CatalogItem[] = [{ name: 'КСД-1', values: { 'D, мм': '1750', 'Q, т/ч': '300' } }];

test.describe('Правки справочника: правила', () => {
  test('правка накладывается на каталожную позицию, своя — добавляется в конец', () => {
    const entries = withCatalogEntry(
      withCatalogEntry([], { name: 'КСД-1', values: { 'D, мм': '1750', 'Q, т/ч': '999' } }),
      { name: 'Своя', values: { 'D, мм': '900' } }
    );

    const merged = mergeCatalog(BASE, entries);

    expect(merged).toHaveLength(2);
    // Порядок каталожных не меняется: справочник отсортирован, и правка
    // не должна уносить машину в конец списка.
    expect(merged[0].name).toBe('КСД-1');
    expect(merged[0].values).toEqual({ 'D, мм': '1750', 'Q, т/ч': '999' });
    expect(merged[1]).toEqual({ name: 'Своя', values: { 'D, мм': '900' } });
  });

  test('изменения считаются от справочника: «было → стало» по каждой величине', () => {
    const entries = withCatalogEntry([], { name: 'КСД-1', values: { 'D, мм': '1750', 'Q, т/ч': '999' } });
    const [change] = catalogChanges(BASE, entries, SPECS);

    expect(change.kind).toBe('edited');
    // Только разошедшаяся величина: диаметр остался каталожным.
    expect(change.fields).toEqual([{ spec: 'Q, т/ч', before: '300', after: '999' }]);
  });

  test('возврат значения к каталожному убирает позицию из изменений', () => {
    const entries = withCatalogEntry(
      withCatalogEntry([], { name: 'КСД-1', values: { 'D, мм': '1750', 'Q, т/ч': '999' } }),
      { name: 'КСД-1', values: { 'D, мм': '1750', 'Q, т/ч': '300' } }
    );

    expect(catalogChanges(BASE, entries, SPECS)).toEqual([]);
  });

  test('своя позиция помечена как новая, даже когда величин у неё нет', () => {
    const entries = withCatalogEntry([], { name: 'Своя', values: {} });
    const [change] = catalogChanges(BASE, entries, SPECS);

    expect(change.kind).toBe('added');
    expect(change.fields).toEqual([]);
  });
});

async function openCrusherStep(page: Page): Promise<Locator> {
  await page.getByRole('button', { name: 'Профиль' }).click();
  await page.getByRole('option', { name: 'Упрощённый' }).click();
  await page.getByRole('button', { name: 'Сменить' }).click();
  await page.getByRole('button', { name: 'Проекты' }).click();
  await page.getByRole('button', { name: 'Новый проект' }).first().click();

  const dialog = page.getByRole('dialog', { name: 'Выбор дробилки' });
  await expect(dialog).toBeVisible();
  return dialog;
}

test.describe('Подбор по параметрам: две половины окна', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page, { empty: true });
  });

  test('пока параметр не задан, справа пустое состояние, а не весь справочник', async ({ page }) => {
    const dialog = await openCrusherStep(page);

    await expect(dialog.getByText('Задайте параметры слева')).toBeVisible();
    // Ни одной строки: тридцать машин «по умолчанию» — не результат подбора.
    await expect(dialog.getByRole('checkbox')).toHaveCount(0);

    await dialog.getByLabel(/^Поиск:/).fill('КМД-2000Т');

    await expect(dialog.getByText('Задайте параметры слева')).toHaveCount(0);
    await expect(dialog.getByRole('row', { name: /КМД-2000Т/ })).toBeVisible();
  });

  test('отбор диапазоном сужает правую половину', async ({ page }) => {
    const dialog = await openCrusherStep(page);

    await dialog.getByRole('button', { name: 'D, мм' }).click();
    await page.getByLabel('D, мм: не менее').fill('2200');
    await page.getByRole('button', { name: 'Готово' }).click();

    const rows = dialog.getByRole('checkbox');
    const narrowed = await rows.count();
    expect(narrowed).toBeGreaterThan(0);

    // Каждая оставшаяся машина обязана быть не меньше запрошенного.
    await expect(dialog.getByRole('row', { name: /КМД-1750/ })).toHaveCount(0);
  });

  test('«+ Новая» заводит свою дробилку с данными — она сразу выбрана и видна в изменениях', async ({ page }) => {
    const dialog = await openCrusherStep(page);

    await dialog.getByRole('button', { name: 'Новая' }).click();
    const form = page.getByRole('dialog', { name: /Новая позиция/ });
    await expect(form).toBeVisible();

    await form.getByLabel('Название: дробилка').fill('КСД-9000 опытная');
    await form.getByLabel('D, мм', { exact: true }).fill('9000');
    await form.getByLabel('Q, т/ч', { exact: true }).fill('4200');
    await form.getByRole('button', { name: 'Сохранить' }).click();

    await expect(form).toHaveCount(0);
    // Заведённая машина сразу отмечена: её для того и заводили.
    await expect(dialog.getByText('Выбрано дробилок: 1')).toBeVisible();
    await expect(dialog.getByRole('row', { name: /КСД-9000 опытная/ })).toBeVisible();
    await expect(dialog.getByText('КСД-9000 опытная — новая позиция')).toBeVisible();
  });

  test('правка данных машины показывает под таблицей, что было и что стало', async ({ page }) => {
    const dialog = await openCrusherStep(page);

    await dialog.getByLabel(/^Поиск:/).fill('КМД-2000Т');
    await dialog.getByRole('button', { name: 'Изменить данные: КМД-2000Т' }).click();

    const form = page.getByRole('dialog', { name: /правка данных/ });
    // Имя каталожной позиции не правится: по нему она связана с проектами.
    await expect(form.getByLabel('Название: дробилка')).toBeDisabled();

    const power = form.getByLabel('N, кВт', { exact: true });
    const before = await power.inputValue();
    expect(before).not.toBe('');
    await power.fill('777');
    await form.getByRole('button', { name: 'Сохранить' }).click();

    await expect(dialog.getByText('КМД-2000Т — данные изменены')).toBeVisible();
    await expect(dialog.getByText(`N, кВт: было ${before} → стало 777`)).toBeVisible();
    // Правка данных — не выбор машины: набор она не трогает.
    await expect(dialog.getByText('Выбрано дробилок: 0')).toBeVisible();
  });

  test('заведённая дробилка находится и в инженерном режиме', async ({ page }) => {
    const dialog = await openCrusherStep(page);

    await dialog.getByRole('button', { name: 'Новая' }).click();
    const form = page.getByRole('dialog', { name: /Новая позиция/ });
    await form.getByLabel('Название: дробилка').fill('КСД-9000 опытная');
    await form.getByRole('button', { name: 'Сохранить' }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    // Справочник один на приложение — режим его не делит.
    await page.getByRole('button', { name: 'Профиль' }).click();
    await page.getByRole('option', { name: 'Инженерный' }).click();
    await page.getByRole('button', { name: 'Сменить' }).click();
    await page.getByRole('button', { name: 'Проекты' }).click();
    await page.getByRole('button', { name: 'Новый проект' }).first().click();

    const engineering = page.getByRole('dialog', { name: 'Новый проект' });
    await engineering.getByLabel(/^Поиск:/).fill('опытная');
    await expect(engineering.getByRole('row', { name: /КСД-9000 опытная/ })).toBeVisible();
  });
});
