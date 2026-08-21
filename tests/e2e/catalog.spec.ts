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

    // Счётчик «Показано: N из M» убран с экрана: он занимал полосу под
    // таблицей и повторял то, что видно по самому списку. Считаем строки.
    await expect(page.getByRole('row')).toHaveCount(31); // 30 машин + шапка
    // Шапка несёт короткие подписи характеристик, а не только названия машин.
    await expect(page.getByRole('columnheader', { name: /D, мм/ })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /Q, т\/ч/ })).toBeVisible();

    console_.assertClean();
  });

  test('поиск находит и по названию, и по значению характеристики', async ({ page }) => {
    // Поле поиска стоит в панели фильтров и подписано изнутри:
    // назначение написано в самом поле и служит его доступным именем.
    const search = page.getByLabel(/^Поиск:/);

    await search.fill('КСД-2200');
    await expect(page.getByRole('button', { name: 'КСД-2200Т', exact: true })).toBeVisible();

    // 3000 — диаметр КМД-3000Т2: ищем по значению, а не по имени.
    await search.fill('3000');
    await expect(page.getByRole('button', { name: 'КМД-3000Т2', exact: true })).toBeVisible();

    await search.fill('такого нет');
    await expect(page.getByText('Ничего не найдено')).toBeVisible();
  });

  /**
   * Семейство машины живёт в окне «Фильтры», а не в строке над таблицей:
   * поиск занял левый край целиком, и каждое условие, вынесенное в строку,
   * отнимало бы у него ширину.
   */
  test('фильтр по семейству сужает список', async ({ page }) => {
    const openFilters = async () => {
      await page.getByRole('button', { name: 'Фильтры' }).click();
      await expect(page.getByRole('heading', { name: 'Фильтры' })).toBeVisible();
    };
    const apply = async () => {
      await page.getByRole('button', { name: 'Готово' }).click();
      await expect(page.getByRole('heading', { name: 'Фильтры' })).toHaveCount(0);
    };

    await openFilters();
    await page.getByRole('dialog', { name: 'Фильтры' }).getByRole('radio', { name: 'КСД' }).check();
    await apply();

    await expect(page.getByRole('button', { name: 'КСД-2200Т', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'КМД-3000Т2', exact: true })).toHaveCount(0);

    await openFilters();
    await page.getByRole('dialog', { name: 'Фильтры' }).getByRole('radio', { name: 'Все' }).check();
    await apply();

    await expect(page.getByRole('button', { name: 'КМД-3000Т2', exact: true })).toBeVisible();
  });

  /**
   * Отбор по характеристикам — тот же набор колонок, что в таблице. Проверяется
   * на пересечении: у КСД-1750Т9 щель «5-15», и по запросу «S не менее 12»
   * машина обязана остаться — её диапазон в запрошенный заходит, хотя целиком
   * в него не укладывается.
   */
  test('отбор по характеристике сужает каталог и применяется по «Готово»', async ({ page }) => {
    const dialog = page.getByRole('dialog', { name: 'Новый проект' });
    await dialog.getByRole('button', { name: 'Фильтры' }).click();

    const filters = page.getByRole('dialog', { name: 'Фильтры' });
    await filters.getByLabel('D, мм: не менее').fill('2000');

    // Окно ещё открыто — каталог под ним не пересобран.
    await expect(page.getByRole('button', { name: 'КСД-900Т', exact: true })).toBeVisible();

    await filters.getByRole('button', { name: 'Готово' }).click();
    await expect(page.getByRole('button', { name: 'КСД-900Т', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'КМД-2200Т6-Д', exact: true })).toBeVisible();

    // Счётчик на кнопке: условия спрятаны под ней, и сколько их — иначе не видно.
    await expect(dialog.getByRole('button', { name: 'Фильтры: 1' })).toBeVisible();

    // Второе условие складывается с первым, а не заменяет его. Счёт идёт
    // по колонкам: пара «от — до» одной характеристики — одно условие.
    await dialog.getByRole('button', { name: 'Фильтры: 1' }).click();
    await filters.getByLabel('m, т: не более').fill('80');
    await filters.getByRole('button', { name: 'Готово' }).click();

    await expect(page.getByRole('button', { name: 'КМД-2100Т', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'КМД-2200Т6-Д', exact: true })).toHaveCount(0);
    await expect(dialog.getByRole('button', { name: 'Фильтры: 2' })).toBeVisible();
  });

  /**
   * Значение в ячейке само бывает диапазоном, поэтому условие — пересечение,
   * а не попадание целиком: машина со щелью 9-27 по запросу «не менее 25»
   * подходит, и прятать её значило бы прятать ровно то, что искали.
   */
  /**
   * Часть условий вынесена в полосу поиска и применяется сразу — в отличие
   * от окна фильтров, которое ждёт «Готово». Значение при этом одно и то же:
   * введённое в полосе видно в окне.
   */
  test('условие из полосы над таблицей применяется сразу', async ({ page }) => {
    const dialog = page.getByRole('dialog', { name: 'Новый проект' });

    await dialog.getByLabel('D, мм: не менее').fill('2000');
    await expect(page.getByRole('button', { name: 'КСД-900Т', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'КМД-2200Т6-Д', exact: true })).toBeVisible();

    // Семейство — там же и тоже сразу.
    await dialog.getByRole('radio', { name: 'КСД' }).check();
    await expect(page.getByRole('button', { name: 'КМД-2200Т6-Д', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'КСД-2200Т', exact: true })).toBeVisible();

    // Окно фильтров показывает то же самое условие, а не пустые поля.
    await dialog.getByRole('button', { name: /^Фильтры/ }).click();
    const filters = page.getByRole('dialog', { name: 'Фильтры' });
    await expect(filters.getByLabel('D, мм: не менее')).toHaveValue('2000');
    await expect(filters.getByRole('radio', { name: 'КСД' })).toBeChecked();
  });

  test('условие по диапазону — пересечение, а не попадание целиком', async ({ page }) => {
    const dialog = page.getByRole('dialog', { name: 'Новый проект' });
    const filters = page.getByRole('dialog', { name: 'Фильтры' });

    await dialog.getByRole('button', { name: 'Фильтры' }).click();
    await filters.getByLabel('S, мм: не менее').fill('25');
    await filters.getByRole('button', { name: 'Готово' }).click();

    // Щель 9-27 верхним краем в запрошенное заходит.
    await expect(page.getByRole('button', { name: 'КМД-3200Т', exact: true })).toBeVisible();
    // А 8-24 не дотягивает целиком.
    await expect(page.getByRole('button', { name: 'КМД-2800Т', exact: true })).toHaveCount(0);
  });

  test('сброс очищает черновик фильтров, а применённое держится до «Готово»', async ({ page }) => {
    const dialog = page.getByRole('dialog', { name: 'Новый проект' });
    const filters = page.getByRole('dialog', { name: 'Фильтры' });

    await dialog.getByRole('button', { name: 'Фильтры' }).click();
    await filters.getByLabel('D, мм: не менее').fill('2000');
    await filters.getByRole('button', { name: 'Готово' }).click();
    await expect(page.getByRole('button', { name: 'КСД-900Т', exact: true })).toHaveCount(0);

    // Сброс правит черновик: пока окно не закрыто по «Готово», отбор держится.
    await dialog.getByRole('button', { name: 'Фильтры: 1' }).click();
    await filters.getByRole('button', { name: 'Сбросить' }).click();
    await expect(filters.getByLabel('D, мм: не менее')).toHaveValue('');
    await expect(page.getByRole('button', { name: 'КСД-900Т', exact: true })).toHaveCount(0);

    await filters.getByRole('button', { name: 'Готово' }).click();
    await expect(page.getByRole('button', { name: 'КСД-900Т', exact: true })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Фильтры', exact: true })).toBeVisible();
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

    // Строка помечена флажком, окно осталось открытым — каталог никуда не уходит.
    await expect(
      dialog.getByRole('row').filter({ hasText: SAMPLE_PROJECT.crusher }).getByRole('checkbox')
    ).toBeChecked();
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
