import { test, expect } from '@playwright/test';
import { createProject, openStepEditor, runStepCalc, seedSession } from './helpers';
import { computeChamberProfile } from '../../src/domain/chamberProfile';

/**
 * Контрольный пример методики (§7 подробной документации): КСД-2200Гр-ДМ,
 * профиль камеры 10, три зоны дробления плюс зона калибровки.
 *
 * Проверяется прямо на `computeChamberProfile`, без интерфейса. Форма
 * спрашивает одну или две зоны (`ZoneCount`) — предел стоит на вводе,
 * а не в методике, и сам расчёт числом зон не ограничен. Загонять сюда
 * третью зону через интерфейс уже нельзя, но проверять на ней математику
 * по-прежнему нужно: это единственный набор данных, для которого документация
 * печатает ответ до последнего знака.
 *
 * Тест сторожит не вёрстку, а математику: если расчёт этапа 1 разойдётся
 * с методикой, здесь это будет видно сразу и по конкретной величине,
 * а не «схема выглядит странно».
 */
const CONTROL_INPUT = {
  zones: 3,
  beta10: deg(43.94),
  beta1: [deg(39.98), deg(39.98), deg(39.98)],
  beta2: deg(39.98),
  beta40: deg(63.96),
  beta4: [deg(63.96), deg(59.97), deg(50.97)],
  l1: [393, 175, 136],
  l2: 152,
  D: 2200,
  H: 823,
  S0: 43,
  theta: deg(1.5),
};

/** Таблица профиля из документации: R и L — до десятой, раскрытия — до сотой. */
const CONTROL_TABLE = [
  { i: 1, R1: 521.3, R4: 694.5, lSum: 393.0, S1: 307.97, SOT: 329.76 },
  { i: 2, R1: 911.9, R4: 957.2, lSum: 568.0, S1: 135.78, SOT: 179.07 },
  { i: 3, R1: 1086.4, R4: 1101.4, lSum: 704.0, S1: 71.82, SOT: 126.76 },
  { i: 4, R1: 1222.1, R4: 1225.5, lSum: 856.0, S1: 43.0, SOT: 106.97 },
];

/** ALFA_K из документации, радианы. */
const CONTROL_ALFA = [1.49834, 1.04578, 1.02272, 0.96152, 0.93211];

function deg(value: number): number {
  return (value * Math.PI) / 180;
}

test.describe('Этап 1: контрольный пример методики (§7)', () => {
  test('таблица профиля совпадает с документацией', () => {
    const profile = computeChamberProfile(CONTROL_INPUT);

    expect(profile.KU, 'сечений — зоны + 2').toBe(4);

    for (const expected of CONTROL_TABLE) {
      const section = profile.sections[expected.i];
      expect(section.R1, `сечение ${expected.i}: R1`).toBeCloseTo(expected.R1, 1);
      expect(section.R4, `сечение ${expected.i}: R4`).toBeCloseTo(expected.R4, 1);
      expect(section.lSum, `сечение ${expected.i}: L сум`).toBeCloseTo(expected.lSum, 1);
      expect(section.S1, `сечение ${expected.i}: S1`).toBeCloseTo(expected.S1, 2);
      expect(section.SOT, `сечение ${expected.i}: SOT`).toBeCloseTo(expected.SOT, 2);
    }
  });

  test('пять критических углов совпадают с документацией', () => {
    const { alfa } = computeChamberProfile(CONTROL_INPUT);

    /* Четыре знака: оригинал (`GeoM.exe`) округляет аргумент синуса до
       четырёх, и дальше пятого знака расходится уже это округление,
       а не сама формула (§8.2). */
    CONTROL_ALFA.forEach((expected, i) => {
      expect(alfa[i], `ALFA ${i + 1}`).toBeCloseTo(expected, 4);
    });
  });
});

/**
 * Те же числа §7, но в форме: зон там две, потому что третьей тройки полей
 * в форме нет. Профиль от этого короче на одну зону дробления — таблица
 * ниже посчитана тем же `computeChamberProfile`, что проверен выше.
 */
const DEFAULT_TABLE = [
  { i: '0', l: '0.0', r1: '656.1', r4: '793.3', lSum: '0.0', s1: '—', sot: '—' },
  { i: '1', l: '393.0', r1: '656.1', r4: '793.3', lSum: '393.0', s1: '278.41', sot: '307.00' },
  { i: '2', l: '175.0', r1: '1047.5', r4: '1079.6', lSum: '568.0', s1: '105.98', sot: '156.18' },
  { i: '3', l: '152.0', r1: '1222.1', r4: '1225.5', lSum: '720.0', s1: '43.00', sot: '106.97' },
];

test.describe('Этап 1: расчёт профиля по методике', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page, { empty: true });
    await createProject(page);
    await runStepCalc(page);
    await page.getByRole('button', { name: /Смотреть результат 1 этапа/ }).click();
  });

  test('таблица профиля совпадает с расчётом по умолчанию', async ({ page }) => {
    const drawer = page.getByRole('dialog', { name: /Результат: геометрия/ });
    await expect(drawer).toBeVisible();

    const rows = drawer.getByRole('table').nth(1).getByRole('row');

    for (const expected of DEFAULT_TABLE) {
      // Сечение опознаётся по паре «R1 · L сум» — она уникальна в таблице.
      const row = rows.filter({ hasText: expected.r1 }).filter({ hasText: expected.lSum }).last();
      const text = await row.innerText();
      for (const value of [expected.l, expected.r4, expected.s1, expected.sot]) {
        expect(text, `сечение ${expected.i}: ожидалось ${value} в «${text}»`).toContain(value);
      }
    }
  });

  test('встроенные проверки методики сходятся на исправном профиле', async ({ page }) => {
    const drawer = page.getByRole('dialog', { name: /Результат: геометрия/ });

    // §3.4: замыкание рекурсии, монотонность просвета, диапазон углов.
    await expect(drawer.getByRole('row').filter({ hasText: 'S1 в нижнем сечении = S₀' })).toContainText('сходится');
    await expect(drawer.getByRole('row').filter({ hasText: 'Просвет SOT убывает' })).toContainText('сходится');
    await expect(drawer.getByRole('row').filter({ hasText: 'Все α в пределах' })).toContainText('сходится');
  });

  test('число зон дробления меняет профиль и число сечений', async ({ page }) => {
    /* Третья строка файла геометрии — «Число зон дробления». Она задаёт
       длину массивов l₁(i), β₁(i), β₄(i), а значит и число расчётных
       сечений: зоны + 2. */
    const drawer = page.getByRole('dialog', { name: /Результат: геометрия/ });
    await expect(drawer.getByRole('row').filter({ hasText: 'Число зон дробления' })).toContainText('2');
    await expect(drawer.getByRole('row').filter({ hasText: 'Число расчётных сечений' })).toContainText('4');

    await page.getByRole('button', { name: 'Закрыть' }).click();
    await openStepEditor(page);
    await page.getByLabel('Число зон дробления').fill('1');
    await runStepCalc(page, 'Пересчитать');
    await page.getByRole('button', { name: /Смотреть результат 1 этапа/ }).click();

    await expect(drawer.getByRole('row').filter({ hasText: 'Число зон дробления' })).toContainText('1');
    await expect(drawer.getByRole('row').filter({ hasText: 'Число расчётных сечений' })).toContainText('3');
    // Замыкание рекурсии обязано держаться при любом числе зон.
    await expect(drawer.getByRole('row').filter({ hasText: 'S1 в нижнем сечении = S₀' })).toContainText('сходится');
  });

  test('щель S₀ доходит до нижнего сечения без подгонки', async ({ page }) => {
    /* Раньше S₀ применялся жёстким сдвигом брони конуса поверх готового
       профиля, и в остальных сечениях зазор был случайным. Теперь S₀ —
       начало рекурсии раскрытия, поэтому в нижнем сечении оно совпадает
       с полем формы при любом введённом значении. */
    await page.getByRole('button', { name: 'Закрыть' }).click();
    await openStepEditor(page);
    await page.getByLabel('Ширина разгрузочной щели S0').fill('64');
    await runStepCalc(page, 'Пересчитать');
    await page.getByRole('button', { name: /Смотреть результат 1 этапа/ }).click();

    const drawer = page.getByRole('dialog', { name: /Результат: геометрия/ });
    await expect(drawer.getByRole('row').filter({ hasText: 'S1 в нижнем сечении = S₀' })).toContainText('64.00 / 64.00');
    await expect(drawer.getByRole('row').filter({ hasText: 'S1 в нижнем сечении = S₀' })).toContainText('сходится');
  });
});

/**
 * Конус на чертеже стоит в рабочем положении — повёрнут на угол нутации θ.
 * Это не оформление: α₁ отсчитывается от оси конуса, α₄ — от оси дробилки,
 * и только при развороте на θ отрезок между парными узлами становится равен
 * раскрытию камеры S1, которое методика выводит из того же треугольника
 * (§3.2, шаг 6). В нейтральном положении он расходится с S1 почти вдвое
 * у разгрузочной кромки — 75 мм против 43.
 */
test.describe('Этап 1: чертёж совпадает с расчётом', () => {
  test('отрезок между парными узлами равен раскрытию S1 из расчёта', async ({ page }) => {
    await seedSession(page, { empty: true });
    await createProject(page);
    await openStepEditor(page);

    await page.getByRole('button', { name: 'Диаграмма' }).click();
    await page.getByRole('option', { name: 'Линии построения' }).click();
    await page.keyboard.press('Escape');

    const svg = page.getByTestId('chamber-scheme');
    // Значения S1 профиля по умолчанию: 278,41 · 105,98 · 43,00.
    await expect(svg.locator('title', { hasText: 'S₁ — раскрытие 40–10: 278 мм' })).not.toHaveCount(0);
    await expect(svg.locator('title', { hasText: 'S₂ — раскрытие 41–11: 106 мм' })).not.toHaveCount(0);
    await expect(svg.locator('title', { hasText: 'S₀ — раскрытие 3–2: 43 мм' })).not.toHaveCount(0);
  });

  test('дуги β показывают введённый угол к горизонтали', async ({ page }) => {
    await seedSession(page, { empty: true });
    await createProject(page);
    await openStepEditor(page);

    await page.getByRole('button', { name: 'Диаграмма' }).click();
    await page.getByRole('option', { name: 'Линии построения' }).click();
    await page.keyboard.press('Escape');

    const svg = page.getByTestId('chamber-scheme');
    /* β — «угол при основании», то есть наклон образующей к горизонтали,
       и дуга у узла подписывает участок, приходящий в него сверху: β₄₀ —
       стенку зоны входа, β₃ — зону калибровки. Углы конуса показаны как
       β − θ: он нарисован в рабочем положении. */
    await expect(svg.locator('title', { hasText: 'β40 = 63,96° к горизонтали' })).not.toHaveCount(0);
    await expect(svg.locator('title', { hasText: 'β41 = 63,96° к горизонтали' })).not.toHaveCount(0);
    /* Последняя зона дробления подписана i-й: при двух зонах i = 2,
       то есть это и есть β₄₂ из формы. */
    await expect(svg.locator('title', { hasText: 'β4i = 59,97° к горизонтали' })).not.toHaveCount(0);
    // β₃ = β₂ − θ = 39,98 − 1,5 — методика выводит его сама.
    await expect(svg.locator('title', { hasText: 'β3 = 38,48° к горизонтали' })).not.toHaveCount(0);
    // Конус: β₁₀ − θ = 43,94 − 1,5.
    await expect(svg.locator('title', { hasText: 'β10 = 42,44° к горизонтали' })).not.toHaveCount(0);
  });
});
