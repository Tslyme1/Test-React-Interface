import { test, expect } from '@playwright/test';
import { createProject, seedSession } from './helpers';

/**
 * Контрольный пример методики (§7 подробной документации): КСД-2200Гр-ДМ,
 * профиль камеры 10, три зоны дробления плюс зона калибровки. Это те же
 * числа, что стоят в форме по умолчанию, поэтому свежий проект обязан
 * воспроизвести таблицу профиля из документации.
 *
 * Тест сторожит не вёрстку, а математику: если расчёт этапа 1 разойдётся
 * с методикой, здесь это будет видно сразу и по конкретной величине,
 * а не «схема выглядит странно».
 */
const CONTROL_TABLE = [
  { i: '0', l: '0.0', r1: '521.3', r4: '694.5', lSum: '0.0', s1: '—', sot: '—' },
  { i: '1', l: '393.0', r1: '521.3', r4: '694.5', lSum: '393.0', s1: '307.97', sot: '329.76' },
  { i: '2', l: '175.0', r1: '911.9', r4: '957.2', lSum: '568.0', s1: '135.78', sot: '179.07' },
  { i: '3', l: '136.0', r1: '1086.4', r4: '1101.4', lSum: '704.0', s1: '71.82', sot: '126.76' },
  { i: '4', l: '152.0', r1: '1222.1', r4: '1225.5', lSum: '856.0', s1: '43.00', sot: '106.97' },
];

test.describe('Этап 1: расчёт профиля по методике', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page, { empty: true });
    await createProject(page);
    await page.getByRole('button', { name: 'Выполнить расчёт' }).click();
    await page.getByRole('button', { name: /Смотреть результат 1 этапа/ }).click();
  });

  test('таблица профиля совпадает с контрольным примером документации', async ({ page }) => {
    const drawer = page.getByRole('dialog', { name: /Результат: геометрия/ });
    await expect(drawer).toBeVisible();

    const rows = drawer.getByRole('table').nth(1).getByRole('row');

    for (const expected of CONTROL_TABLE) {
      // Сечение опознаётся по паре «R1 · L сум» — она уникальна в таблице.
      const row = rows.filter({ hasText: expected.r1 }).filter({ hasText: expected.lSum }).last();
      const text = await row.innerText();
      for (const value of [expected.l, expected.r4, expected.s1, expected.sot]) {
        expect(text, `сечение ${expected.i}: ожидалось ${value} в «${text}»`).toContain(value);
      }
    }
  });

  test('пять критических углов совпадают с документацией', async ({ page }) => {
    const drawer = page.getByRole('dialog', { name: /Результат: геометрия/ });

    // ALFA_K = 1,49834; 1,04578; 1,02272; 0,96152; 0,93211 рад — в градусах.
    for (const [n, value] of [
      ['1', '85.8'],
      ['2', '59.9'],
      ['3', '58.5'],
      ['4', '55.0'],
      ['5', '53.4'],
    ]) {
      await expect(drawer.getByRole('row').filter({ hasText: `ALFA ${n}` })).toContainText(value);
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
    await expect(drawer.getByRole('row').filter({ hasText: 'Число зон дробления' })).toContainText('3');
    await expect(drawer.getByRole('row').filter({ hasText: 'Число расчётных сечений' })).toContainText('5');

    await page.getByRole('button', { name: 'Закрыть' }).click();
    const zones = page.getByRole('button', { name: 'Число зон дробления' });
    await zones.click();
    await page.getByRole('option', { name: '1', exact: true }).click();
    await page.getByRole('button', { name: 'Пересчитать' }).click();
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
    await page.getByLabel('Ширина разгрузочной щели S0, мм').fill('64');
    await page.getByRole('button', { name: 'Пересчитать' }).click();
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

    await page.getByRole('button', { name: 'Диаграмма' }).click();
    await page.getByRole('option', { name: 'Линии построения' }).click();
    await page.keyboard.press('Escape');

    const svg = page.getByTestId('chamber-scheme');
    // Значения S1 контрольного примера: 307,99 · 135,79 · 71,83 · 43,00.
    await expect(svg.locator('title', { hasText: 'S₁ — раскрытие 40–10: 308 мм' })).not.toHaveCount(0);
    await expect(svg.locator('title', { hasText: 'S₂ — раскрытие 41–11: 136 мм' })).not.toHaveCount(0);
    await expect(svg.locator('title', { hasText: 'S₃ — раскрытие 42–12: 72 мм' })).not.toHaveCount(0);
    await expect(svg.locator('title', { hasText: 'S₀ — раскрытие 3–2: 43 мм' })).not.toHaveCount(0);
  });

  test('дуги β показывают введённый угол к горизонтали', async ({ page }) => {
    await seedSession(page, { empty: true });
    await createProject(page);

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
    await expect(svg.locator('title', { hasText: 'β42 = 59,97° к горизонтали' })).not.toHaveCount(0);
    await expect(svg.locator('title', { hasText: 'β4i = 50,97° к горизонтали' })).not.toHaveCount(0);
    // β₃ = β₂ − θ = 39,98 − 1,5 — методика выводит его сама.
    await expect(svg.locator('title', { hasText: 'β3 = 38,48° к горизонтали' })).not.toHaveCount(0);
    // Конус: β₁₀ − θ = 43,94 − 1,5.
    await expect(svg.locator('title', { hasText: 'β10 = 42,44° к горизонтали' })).not.toHaveCount(0);
  });
});
