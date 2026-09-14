import { test, expect } from '@playwright/test';
import { SAMPLE_PROJECT, createProject, openStepEditor, runStepCalc, seedSession, watchConsole } from './helpers';

/**
 * Шаг «Геометрия»: степпер с одними заголовками, смена дробилки прямо
 * с шага, режим отображения (подсветка участка схемы, дельта от расчёта)
 * и выезжающая панель схемы.
 */
test.describe('Шаг «Геометрия»: заголовки шагов и раскладка', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page, { empty: true });
    await createProject(page);
    /* Поля этапа живут в окне ввода — страница показывает сводку и
       результат. Сценарий начинается там же, где и работа: в окне. */
    await openStepEditor(page);
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
    await expect(page.getByText('Схема профиля камеры', { exact: true })).toBeVisible();

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByText('Схема профиля камеры', { exact: true })).toBeVisible();
  });
});

test.describe('Шаг «Геометрия»: смена дробилки', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page, { empty: true });
    await createProject(page);
    /* Поля этапа живут в окне ввода — страница показывает сводку и
       результат. Сценарий начинается там же, где и работа: в окне. */
    await openStepEditor(page);
  });

  test('плашка показывает текущую дробилку и открывает окно замены', async ({ page }) => {
    /* Имя дробилки на экране дважды: в сводке этапа и на плашке в окне
       ввода. Здесь речь про плашку — она же и открывает замену. */
    const editor = page.getByRole('dialog', { name: /Исходные данные/ });
    await expect(editor.getByText(SAMPLE_PROJECT.crusher, { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Сменить дробилку' }).click();
    const dialog = page.getByRole('dialog', { name: 'Сменить дробилку' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('table')).toBeVisible();

    await dialog.getByRole('button', { name: 'КМД-2200Т6-Д', exact: true }).click();

    await expect(dialog).toHaveCount(0);
    await expect(editor.getByText('КМД-2200Т6-Д', { exact: true })).toBeVisible();
  });
});

test.describe('Шаг «Геометрия»: режим отображения', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page, { empty: true });
    await createProject(page);
    /* Поля этапа живут в окне ввода — страница показывает сводку и
       результат. Сценарий начинается там же, где и работа: в окне. */
    await openStepEditor(page);
  });

  test('подсветка участка: наведение на поле D меняет разметку схемы, потеря фокуса — возвращает', async ({ page }) => {
    await page.getByRole('button', { name: 'Отображение' }).click();
    await page.getByRole('option', { name: 'Подсветка участка' }).click();
    await page.keyboard.press('Escape');

    const svg = page.getByTestId('chamber-scheme');
    const before = await svg.innerHTML();

    const field = page.getByLabel('Диаметр основания D');
    await field.hover();
    await expect(async () => {
      expect(await svg.innerHTML()).not.toBe(before);
    }).toPass();

    await page.getByRole('dialog', { name: /Исходные данные/ }).getByText('Зона входа — приёмная часть камеры').hover();
    await expect(async () => {
      expect(await svg.innerHTML()).toBe(before);
    }).toPass();
  });

  test('подсветка участка работает и в обратную сторону: наведение на схему подсвечивает поле', async ({ page }) => {
    await page.getByRole('button', { name: 'Отображение' }).click();
    await page.getByRole('option', { name: 'Подсветка участка' }).click();
    await page.keyboard.press('Escape');

    const wrapper = page
      .getByLabel('Диаметр основания D')
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
    await page.getByRole('dialog', { name: /Исходные данные/ }).getByText('Зона входа — приёмная часть камеры').hover();
    await expect(wrapper).not.toHaveClass(/zonedFieldActive/);
  });

  test('в режиме «Только ввод» (по умолчанию) наведение на поле не меняет схему', async ({ page }) => {
    const svg = page.getByTestId('chamber-scheme');
    const before = await svg.innerHTML();

    await page.getByLabel('Диаметр основания D').hover();
    await page.waitForTimeout(150);
    expect(await svg.innerHTML()).toBe(before);
  });

  test('в режиме «Только ввод» наведение на схему не подсвечивает поля', async ({ page }) => {
    // Обёртки с подсветкой в этом режиме нет вовсе — поле стоит в форме само по себе.
    await expect(
      page.getByLabel('Диаметр основания D').locator('xpath=ancestor::div[contains(@class,"zonedField")]')
    ).toHaveCount(0);

    const svg = page.getByTestId('chamber-scheme');
    const before = await svg.innerHTML();
    await svg.locator('[data-zone="dim-d"] line').first().hover({ force: true });
    await page.waitForTimeout(150);
    expect(await svg.innerHTML()).toBe(before);
  });

  test('дельта: после расчёта правка поля показывает «было: …», выключение — прячет', async ({ page }) => {
    const console_ = watchConsole(page);

    await runStepCalc(page);
    await expect(page.getByRole('button', { name: 'Экспорт в Excel' })).toBeVisible();

    // Расчёт закрывает окно ввода — правим данные, открыв его заново.
    await openStepEditor(page);
    const field = page.getByLabel('Диаметр основания D');
    await field.fill('1900');

    // Режим «Дельта: Показывать изменения» включён по умолчанию.
    await expect(page.getByText(/было: 2200/)).toBeVisible();

    await page.getByRole('button', { name: 'Отображение' }).click();
    await page.getByRole('option', { name: 'Не показывать изменения' }).click();
    await page.keyboard.press('Escape');

    await expect(page.getByText(/было: 2200/)).toHaveCount(0);

    console_.assertClean();
  });

  test('дельта видна и без единого расчёта — сравнивает с исходными значениями проекта', async ({ page }) => {
    // Раньше снимок заводился только при расчёте, и до первого «Выполнить
    // расчёт» дельта не показывала ничего, даже если поле уже отредактировано —
    // сейчас опора не расчёт, а значения на момент создания проекта.
    await page.getByLabel('Диаметр основания D').fill('1900');
    await expect(page.getByText(/было: 2200/)).toBeVisible();
  });
});

test.describe('Шаг «Геометрия»: число зон и слои схемы', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page, { empty: true });
    await createProject(page);
    /* Поля этапа живут в окне ввода — страница показывает сводку и
       результат. Сценарий начинается там же, где и работа: в окне. */
    await openStepEditor(page);
  });

  test('число зон дробления вводится числом и задаёт, сколько зон в расчёте', async ({ page }) => {
    /* Число зон — исходное данное методики: оно задаёт длину массивов
       l₁(i), β₁(i), β₄(i). Поле ввода, а не список: методика числом зон
       не ограничена. */
    const svg = page.getByTestId('chamber-scheme');
    const zones = page.getByLabel('Число зон дробления');

    await expect(zones).toHaveValue('2');
    await expect(page.getByLabel('Зона 2 — длина')).toBeVisible();
    await expect(svg.locator('title', { hasText: 'Сегмент 11→1i' })).not.toHaveCount(0);

    await zones.fill('1');

    // Узлов стало на один меньше: 40 · 4i · 3 вместо 40 · 41 · 4i · 3.
    await expect(page.getByLabel('Зона 2 — длина')).toHaveCount(0);
    await expect(page.getByLabel('Зона 1 — длина')).toBeVisible();
    await expect(svg.locator('title', { hasText: 'Сегмент 11→1i' })).toHaveCount(0);
    await expect(svg.locator('title', { hasText: 'Сегмент 10→1i' })).not.toHaveCount(0);

    /* Больше двух зон тоже можно: новая тройка дописывается копией
       последней — заполнять её с нуля значило бы вводить заново то,
       что уже введено рядом. */
    await zones.fill('4');
    await expect(page.getByLabel('Зона 4 — длина')).toBeVisible();
    await expect(page.getByLabel('Зона 4 — длина')).toHaveValue(await page.getByLabel('Зона 1 — длина').inputValue());
    await expect(svg.locator('title', { hasText: 'Сегмент 13→1i' })).not.toHaveCount(0);
  });

  test('поповер «Слои» — строка сама переключает видимость участка схемы', async ({ page }) => {
    const svg = page.getByTestId('chamber-scheme');
    // Заливка зон входит в пресет «Обычный» — она видна с самого начала.
    await expect(svg.locator('title', { hasText: 'Зона дробления 1' })).not.toHaveCount(0);

    await page.getByRole('button', { name: 'Слои' }).click();
    const zonesOption = page.getByRole('option', { name: 'Заливка зон' });
    await zonesOption.click();
    await expect(zonesOption).toHaveAttribute('aria-selected', 'false');
    await page.keyboard.press('Escape');

    await expect(svg.locator('title', { hasText: 'Зона дробления 1 — участок' })).toHaveCount(0);
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
    /* Раскрытие подписано величиной из расчёта: конус нарисован в рабочем
       положении, поэтому отрезок между парными узлами и есть S1. */
    await expect(svg.locator('title', { hasText: 'S₁ — раскрытие 40–10' })).not.toHaveCount(0);
  });
});
