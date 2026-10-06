import { test, expect } from '@playwright/test';
import { SAMPLE_PROJECT, closeDisplayPopover, createProject, openStepEditor, runStepCalc, seedSession, waitForStable, watchConsole, wizardStepButton } from './helpers';

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
    /* Степпер живёт в футере страницы этапа, а страница появляется
       с первого расчёта: до него проект показан окном поверх списка. */
    await runStepCalc(page);

    /* Заголовки — новые: «Дробилка», «Руда», «Продукт», а не
       «Геометрия»/«Грансостав»/«Продукт». Ищем в самом степпере: слово
       «Дробилка» стоит ещё и подписью плашки в футере окна ввода. */
    await expect(wizardStepButton(page, /^Дробилка$/)).toBeVisible();
    await expect(page.getByRole('list').getByText('Руда', { exact: true })).toBeVisible();
    await expect(page.getByRole('list').getByText('Продукт', { exact: true })).toBeVisible();

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
    const editor = page.getByRole('dialog', { name: /Исходные данные|Ввод данных/ });
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
    await closeDisplayPopover(page);

    const svg = page.getByTestId('chamber-scheme');
    const before = await svg.innerHTML();

    const field = page.getByLabel('Диаметр основания D');
    await field.hover();
    await expect(async () => {
      expect(await svg.innerHTML()).not.toBe(before);
    }).toPass();

    await page.getByRole('dialog', { name: /Исходные данные|Ввод данных/ }).getByText('Зона входа — приёмная часть камеры').hover();
    await expect(async () => {
      expect(await svg.innerHTML()).toBe(before);
    }).toPass();
  });

  test('подсветка участка работает и в обратную сторону: наведение на схему подсвечивает поле', async ({ page }) => {
    await page.getByRole('button', { name: 'Отображение' }).click();
    await page.getByRole('option', { name: 'Подсветка участка' }).click();
    await closeDisplayPopover(page);

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
    await waitForStable(page.getByTestId('chamber-scheme'));
    await page.getByTestId('chamber-scheme').locator('[data-zone="dim-d"] line').first().hover({ force: true });
    await expect(wrapper).toHaveClass(/zonedFieldActive/);

    // Курсор ушёл со схемы — подсветка поля снимается вместе с ним.
    await page.getByRole('dialog', { name: /Исходные данные|Ввод данных/ }).getByText('Зона входа — приёмная часть камеры').hover();
    await expect(wrapper).not.toHaveClass(/zonedFieldActive/);
  });

  test('в режиме «Только ввод» (по умолчанию) наведение на поле не меняет схему', async ({ page }) => {
    const svg = page.getByTestId('chamber-scheme');
    const before = await svg.innerHTML();

    await page.getByLabel('Диаметр основания D').hover();
    await page.waitForTimeout(150);
    expect(await svg.innerHTML()).toBe(before);
  });

  /**
   * Наведение на чертёж называет поле без всяких настроек.
   *
   * Раньше это включалось тем же переключателем, что и подсветка участка
   * от полей, и чертёж по умолчанию молчал: поводить по нему курсором
   * не давало ничего — при том что с незнакомым чертежом первым делом
   * делают именно это. Режимом остался только обратный ход.
   */
  test('в режиме «Только ввод» наведение на схему всё равно называет поле', async ({ page }) => {
    const wrapper = page
      .getByLabel('Диаметр основания D')
      .locator('xpath=ancestor::div[contains(@class,"zonedField")]');
    await expect(wrapper).not.toHaveClass(/zonedFieldActive/);

    await waitForStable(page.getByTestId('chamber-scheme'));
    await page.getByTestId('chamber-scheme').locator('[data-zone="dim-d"] line').first().hover({ force: true });
    await expect(wrapper).toHaveClass(/zonedFieldActive/);
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
    await closeDisplayPopover(page);

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
    await closeDisplayPopover(page);

    // Пресет разом включает лучи, дуги и все пять зазоров.
    await expect(svg.locator('title', { hasText: /^β40/ })).not.toHaveCount(0);
    await expect(svg.locator('title', { hasText: 'r40 =' })).not.toHaveCount(0);
    /* Раскрытие подписано величиной из расчёта: конус нарисован в рабочем
       положении, поэтому отрезок между парными узлами и есть S1. */
    await expect(svg.locator('title', { hasText: 'S₁ — раскрытие 40–10' })).not.toHaveCount(0);
  });
});

/**
 * Связь «поле формы ↔ участок чертежа» — то, на чём держится весь смысл
 * схемы рядом с формой. Рвалась она тихо: ключ в форме записан руками,
 * и промах в нём выглядел просто как «наведение ничего не делает».
 * Так и было у S₀ (`gap4` при трёх зазорах на чертеже) и у угла β₂
 * (`t2`, которого в обычных слоях нет вовсе).
 */
test.describe('Шаг «Геометрия»: связь формы и чертежа', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page, { empty: true });
    await createProject(page);
    await openStepEditor(page);
  });

  test('каждое поле формы находит свой участок на чертеже', async ({ page }) => {
    const { keys, missing } = await page.evaluate(() => {
      const drawn = new Set(
        Array.from(document.querySelectorAll('[data-testid="chamber-scheme"] [data-zone]')).map((el) =>
          el.getAttribute('data-zone')
        )
      );
      const keys = Array.from(document.querySelectorAll('[data-zone-field]'))
        .map((el) => el.getAttribute('data-zone-field') ?? '')
        .filter((key, i, all) => all.indexOf(key) === i);
      return { keys, missing: keys.filter((key) => !drawn.has(key)) };
    });

    /* Проверка не должна проходить оттого, что полей не нашлось вовсе:
       восемь групп формы дают по меньшей мере семь разных участков. */
    expect(keys.length, 'поля с участками на чертеже не найдены вовсе').toBeGreaterThan(6);
    expect(missing, `поля указывают на участки, которых на чертеже нет: ${missing.join(', ')}`).toEqual([]);
  });

  test('S₀ и линия разгрузочной щели подсвечивают друг друга', async ({ page }) => {
    const wrapper = page
      .getByLabel('Ширина разгрузочной щели S0')
      .locator('xpath=ancestor::div[contains(@class,"zonedField")]');

    await expect(wrapper).not.toHaveClass(/zonedFieldActive/);
    /* Курсор ставится по координатам, а окно появляется с анимацией —
       ждём, пока чертёж встанет на место. */
    await waitForStable(page.getByTestId('chamber-scheme'));

    /* Зазор разгрузки — последний по счёту, и его номер зависит от числа
       зон: при двух зонах это `gap3`, а форма держала записанный руками
       `gap4`, то есть не подсвечивала ничего. */
    await page.getByTestId('chamber-scheme').locator('[data-zone="gap3"] line').first().hover({ force: true });
    await expect(wrapper).toHaveClass(/zonedFieldActive/);
  });

  test('наведение на чертёж подкручивает форму к полю за кромкой экрана', async ({ page }) => {
    const dialog = page.getByRole('dialog', { name: /Исходные данные/ });
    const field = page.getByLabel('Угол чаши β40');

    await waitForStable(page.getByTestId('chamber-scheme'));

    /* Уводим начало формы из виду: поле зоны входа стоит первым, а участок
       на чертеже остаётся на месте — панель со схемой липкая. */
    await dialog.getByLabel('Коэффициент a').scrollIntoViewIfNeeded();
    await expect(field).not.toBeInViewport();

    await page.getByTestId('chamber-scheme').locator('[data-zone="nb0"]').first().hover({ force: true });

    /* Прокрутка плавная — ждём её результат, а не мгновенное состояние. */
    await expect(field).toBeInViewport({ timeout: 2000 });
  });
});
