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
    // Справочник не тронут — бейджа об изменениях быть не должно.
    await expect(dialog.getByText('Данные дробилок изменены')).toHaveCount(0);

    await dialog.getByLabel('Название', { exact: true }).fill('КМД-2000Т');

    await expect(dialog.getByText('Задайте параметры слева')).toHaveCount(0);
    await expect(dialog.getByRole('row', { name: /КМД-2000Т/ })).toBeVisible();
  });

  test('пустое состояние занимает правую половину целиком, а не полоску под шапкой', async ({ page }) => {
    const dialog = await openCrusherStep(page);

    const empty = dialog.getByTestId('match-empty');
    await expect(empty).toBeVisible();

    /* Половина остаётся половиной, даже когда показывать в ней пока нечего:
       иначе правый столбец схлопывается в полоску, и разделённое надвое
       окно перестаёт читаться как разделённое надвое ровно в тот момент,
       когда пользователь видит его впервые. Половина задана как 52vh
       (`CatalogMatchPicker.module.css`) — при высоте окна 720px это
       ~370px минус заголовок половины. */
    const box = await empty.boundingBox();
    expect(box, 'пустое состояние должно быть в разметке').not.toBeNull();
    expect(box!.height).toBeGreaterThan(280);
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

    // Подробности — в окне рядом со счётчиком, а не полосой под таблицей.
    await dialog.getByText('Данные дробилок изменены').click();
    const changes = page.getByRole('dialog', { name: 'Изменения в справочнике' });
    await expect(changes.getByText('КСД-9000 опытная', { exact: true })).toBeVisible();
    await expect(changes.getByText('новая дробилка')).toBeVisible();
  });

  test('у каждого параметра слева есть подпись и подсказка с полным именем величины', async ({ page }) => {
    const dialog = await openCrusherStep(page);

    // Короткая запись величины сама по себе ничего не говорит тому, кто
    // видит её впервые, — полное имя лежит в подсказке у подписи.
    const label = dialog.locator('label').filter({ hasText: 'n, мин⁻¹' });
    await expect(label).toHaveCount(1);
    await expect(label.getByRole('button', { name: 'Что означает этот параметр' })).toHaveCount(1);

    /* Подпись связана с контролом, а не просто лежит рядом: иначе она
       повисает в пустоте, и поле остаётся безымянным для скринридера.
       Имя ищется по вхождению — значок-подсказка стоит внутри `<label>`
       и добавляет к нему своё («Что означает этот параметр»). */
    await expect(dialog.getByLabel('P, МН')).toBeVisible();
  });

  test('правка данных машины видна в окне изменений: что было и что стало', async ({ page }) => {
    const dialog = await openCrusherStep(page);

    await dialog.getByLabel('Название', { exact: true }).fill('КМД-2000Т');
    await dialog.getByRole('button', { name: 'Изменить данные: КМД-2000Т' }).click();

    const form = page.getByRole('dialog', { name: /правка данных/ });
    // Имя каталожной позиции не правится: по нему она связана с проектами.
    await expect(form.getByLabel('Название: дробилка')).toBeDisabled();

    const power = form.getByLabel('N, кВт', { exact: true });
    const before = await power.inputValue();
    expect(before).not.toBe('');
    await power.fill('777');
    await form.getByRole('button', { name: 'Сохранить' }).click();

    // Правка данных — не выбор машины: набор она не трогает.
    await expect(dialog.getByText('Выбрано дробилок: 0')).toBeVisible();

    await dialog.getByText('Данные дробилок изменены').click();
    const changes = page.getByRole('dialog', { name: 'Изменения в справочнике' });
    await expect(changes.getByText('КМД-2000Т', { exact: true })).toBeVisible();
    await expect(changes.getByText('данные изменены')).toBeVisible();

    const row = changes.getByRole('row').filter({ hasText: 'N, кВт' });
    await expect(row).toContainText(before);
    await expect(row).toContainText('777');
  });

  test('сохранение формы без единой правки не поднимает бейдж', async ({ page }) => {
    const dialog = await openCrusherStep(page);

    await dialog.getByLabel('Название', { exact: true }).fill('КМД-2000Т');
    await dialog.getByRole('button', { name: 'Изменить данные: КМД-2000Т' }).click();

    const form = page.getByRole('dialog', { name: /правка данных/ });
    await form.getByRole('button', { name: 'Сохранить' }).click();
    await expect(form).toHaveCount(0);

    /* Правка считается от справочника, а не от факта нажатия «Сохранить»:
       открыть форму и закрыть её кнопкой — не изменение данных. */
    await expect(dialog.getByText('Данные дробилок изменены')).toHaveCount(0);
  });

  test('правку можно снять — бейдж уходит вместе с расхождением', async ({ page }) => {
    const dialog = await openCrusherStep(page);

    await dialog.getByLabel('Название', { exact: true }).fill('КМД-2000Т');
    await dialog.getByRole('button', { name: 'Изменить данные: КМД-2000Т' }).click();
    const form = page.getByRole('dialog', { name: /правка данных/ });
    await form.getByLabel('N, кВт', { exact: true }).fill('777');
    await form.getByRole('button', { name: 'Сохранить' }).click();

    const badge = dialog.getByText('Данные дробилок изменены');
    await expect(badge).toBeVisible();

    await badge.click();
    const changes = page.getByRole('dialog', { name: 'Изменения в справочнике' });
    await changes.getByRole('button', { name: 'Вернуть каталожные' }).click();

    await expect(changes.getByText('Справочник не тронут')).toBeVisible();
    await changes.getByRole('button', { name: 'Готово' }).click();
    await expect(badge).toHaveCount(0);
  });

  test('бейдж не всплывает в новой работе из-за правок, сделанных раньше', async ({ page }) => {
    const dialog = await openCrusherStep(page);

    await dialog.getByLabel('Название', { exact: true }).fill('КМД-2000Т');
    await dialog.getByRole('button', { name: 'Изменить данные: КМД-2000Т' }).click();
    const form = page.getByRole('dialog', { name: /правка данных/ });
    await form.getByLabel('N, кВт', { exact: true }).fill('777');
    await form.getByRole('button', { name: 'Сохранить' }).click();
    await expect(dialog.getByText('Данные дробилок изменены')).toBeVisible();

    // Закрываем окно и начинаем новую работу.
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'Новый проект' }).first().click();
    const fresh = page.getByRole('dialog', { name: 'Выбор дробилки' });
    await expect(fresh).toBeVisible();

    /* Правка в справочнике осталась — значение по-прежнему 777, — но
       бейдж про неё молчит: он о том, что поменяли в этой работе,
       а не о всей истории справочника. */
    await expect(fresh.getByText('Данные дробилок изменены')).toHaveCount(0);
    await fresh.getByLabel('Название', { exact: true }).fill('КМД-2000Т');
    await fresh.getByRole('button', { name: 'Изменить данные: КМД-2000Т' }).click();
    await expect(page.getByRole('dialog', { name: /правка данных/ }).getByLabel('N, кВт', { exact: true })).toHaveValue('777');
  });

  test('в инженерном режиме свою дробилку заводят прямо в окне нового проекта', async ({ page }) => {
    await page.getByRole('button', { name: 'Новый проект' }).first().click();
    const dialog = page.getByRole('dialog', { name: 'Новый проект' });

    await dialog.getByRole('button', { name: 'Новая' }).click();
    const form = page.getByRole('dialog', { name: /Новая позиция/ });
    await form.getByLabel('Название: дробилка').fill('КСД-9000 опытная');
    await form.getByLabel('D, мм', { exact: true }).fill('9000');
    await form.getByRole('button', { name: 'Сохранить' }).click();

    // Заведённая машина сразу выбрана — по ней же подставляется имя проекта.
    await expect(dialog.getByRole('row', { name: /КСД-9000 опытная/ })).toBeVisible();
    await expect(dialog.getByLabel('Название проекта')).toHaveValue('КСД-9000 опытная');
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
