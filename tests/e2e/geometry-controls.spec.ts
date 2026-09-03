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
    await page.getByRole('option', { name: 'Подсветка участка' }).click();
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

  test('подсветка участка работает и в обратную сторону: наведение на схему подсвечивает поле', async ({ page }) => {
    await page.getByRole('button', { name: 'Отображение' }).click();
    await page.getByRole('option', { name: 'Подсветка участка' }).click();
    await page.keyboard.press('Escape');

    const wrapper = page
      .getByLabel('Диаметр основания D, мм')
      .locator('xpath=ancestor::div[contains(@class,"zonedField")]');
    await expect(wrapper).not.toHaveClass(/zonedFieldActive/);

    // Наводим на прозрачную линию-цель внутри участка «D / 2», а не на
    // группу целиком: в середине рамки группы пусто, и туда попадает фон
    // схемы. Цель лежит ровно на размерной линии и от шрифта не зависит.
    //
    // `force` — потому что у горизонтальной линии рамка нулевой высоты, и
    // Playwright считает её невидимой. Указатель при этом реально ставится
    // на линию, попадание проверяется браузером как обычно: у цели штрих
    // в 18 единиц и `pointer-events: stroke`.
    await page.getByTestId('chamber-scheme').locator('[data-zone="dim-d"] line').first().hover({ force: true });
    await expect(wrapper).toHaveClass(/zonedFieldActive/);

    // Курсор ушёл со схемы — подсветка поля снимается вместе с ним.
    await page.getByRole('heading', { name: 'Геометрия камеры дробления' }).hover();
    await expect(wrapper).not.toHaveClass(/zonedFieldActive/);
  });

  test('в режиме «Только ввод» (по умолчанию) наведение на поле не меняет схему', async ({ page }) => {
    const svg = page.getByTestId('chamber-scheme');
    const before = await svg.innerHTML();

    await page.getByLabel('Диаметр основания D, мм').hover();
    await page.waitForTimeout(150);
    expect(await svg.innerHTML()).toBe(before);
  });

  test('в режиме «Только ввод» наведение на схему не подсвечивает поля', async ({ page }) => {
    // Обёртки с подсветкой в этом режиме нет вовсе — поле стоит в форме само по себе.
    await expect(
      page.getByLabel('Диаметр основания D, мм').locator('xpath=ancestor::div[contains(@class,"zonedField")]')
    ).toHaveCount(0);

    const svg = page.getByTestId('chamber-scheme');
    const before = await svg.innerHTML();
    await svg.locator('[data-zone="dim-d"] line').first().hover({ force: true });
    await page.waitForTimeout(150);
    expect(await svg.innerHTML()).toBe(before);
  });

  test('дельта: после расчёта правка поля показывает «было: …», выключение — прячет', async ({ page }) => {
    const console_ = watchConsole(page);

    await page.getByRole('button', { name: 'Выполнить расчёт' }).click();
    await expect(page.getByRole('button', { name: 'Смотреть результат 1 этапа' })).toBeVisible();

    const field = page.getByLabel('Диаметр основания D, мм');
    await field.fill('1900');

    // Режим «Дельта: Показывать изменения» включён по умолчанию.
    await expect(page.getByText(/было: 1750/)).toBeVisible();

    await page.getByRole('button', { name: 'Отображение' }).click();
    await page.getByRole('option', { name: 'Не показывать изменения' }).click();
    await page.keyboard.press('Escape');

    await expect(page.getByText(/было: 1750/)).toHaveCount(0);

    console_.assertClean();
  });

  test('дельта видна и без единого расчёта — сравнивает с исходными значениями проекта', async ({ page }) => {
    // Раньше снимок заводился только при расчёте, и до первого «Выполнить
    // расчёт» дельта не показывала ничего, даже если поле уже отредактировано —
    // сейчас опора не расчёт, а значения на момент создания проекта.
    await page.getByLabel('Диаметр основания D, мм').fill('1900');
    await expect(page.getByText(/было: 1750/)).toBeVisible();
  });
});

test.describe('Шаг «Геометрия»: число зон и слои схемы', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page, { empty: true });
    await createProject(page);
  });

  test('число зон дробления — выпадающий список коэффициентов методики', async ({ page }) => {
    // Сегменты цепочки больше не зависят от этого поля: l12 — узел профиля
    // (41→42) и стоит в форме всегда, а число зон осталось коэффициентом
    // методики грансостава, к построению профиля отношения не имеющим.
    await expect(page.getByLabel('Длина l12 — 41→42, мм')).toBeVisible();

    const zones = page.getByRole('button', { name: 'Число зон дробления' });
    await expect(zones).toContainText('1');
    await zones.click();
    await page.getByRole('option', { name: '2', exact: true }).click();
    await expect(zones).toContainText('2');

    await expect(page.getByLabel('Длина l12 — 41→42, мм')).toBeVisible();
  });

  test('поповер «Слои» — строка сама переключает видимость участка схемы', async ({ page }) => {
    const svg = page.getByTestId('chamber-scheme');
    // Заливка зон входит в пресет «Обычный» — она видна с самого начала.
    await expect(svg.locator('title', { hasText: 'Зона входа' })).not.toHaveCount(0);

    await page.getByRole('button', { name: 'Слои' }).click();
    const zonesOption = page.getByRole('option', { name: 'Заливка зон' });
    await zonesOption.click();
    await expect(zonesOption).toHaveAttribute('aria-selected', 'false');
    await page.keyboard.press('Escape');

    await expect(svg.locator('title', { hasText: 'Зона входа — участок' })).toHaveCount(0);
  });

  test('режим «Линии построения» показывает лучи, дуги углов и зазоры', async ({ page }) => {
    const svg = page.getByTestId('chamber-scheme');
    // В обычном режиме дуг узловых углов нет.
    await expect(svg.locator('title', { hasText: /^β40/ })).toHaveCount(0);

    await page.getByRole('button', { name: 'Диаграмма' }).click();
    await page.getByRole('option', { name: 'Линии построения' }).click();
    await page.keyboard.press('Escape');

    // Пресет разом включает лучи, дуги и все пять зазоров.
    await expect(svg.locator('title', { hasText: /^β40/ })).not.toHaveCount(0);
    await expect(svg.locator('title', { hasText: 'r40 =' })).not.toHaveCount(0);
    await expect(svg.locator('title', { hasText: 'S₁₁ — зазор' })).not.toHaveCount(0);
  });
});
