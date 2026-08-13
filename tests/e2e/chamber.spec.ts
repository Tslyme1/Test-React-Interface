import { test, expect } from '@playwright/test';
import { createProject, seedSession, watchConsole } from './helpers';

/**
 * Схема профиля камеры дробления на шаге «Геометрия» — перенос математики
 * `dir`/`buildChain`/`geometry`/`makeTransform` из `cone-crusher-chamber.html`
 * в декларативный React-SVG. Главная ценность экрана — схема пересчитывается
 * по полям формы, поэтому тесты бьют именно в это: меняем поле, смотрим, что
 * разметка SVG изменилась.
 */
test.describe('Схема камеры дробления на шаге «Геометрия»', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page);
    await createProject(page);
  });

  test('схема видна рядом с формой и доступна как изображение', async ({ page }) => {
    const console_ = watchConsole(page);

    const scheme = page.getByRole('img', { name: /Схема профиля камеры дробления/ });
    await expect(scheme).toBeVisible();

    // Профиль строится из декларативных SVG-примитивов, а не из строки:
    // и броня чаши, и броня конуса нарисованы каждая одним <path>.
    expect(await scheme.locator('path').count()).toBeGreaterThanOrEqual(2);
    expect(await scheme.locator('circle').count()).toBeGreaterThan(0);
    expect(await scheme.locator('text').count()).toBeGreaterThan(0);

    console_.assertClean();
  });

  test('изменение ширины разгрузочной щели S0 пересчитывает зазор в схеме', async ({ page }) => {
    const svg = page.getByTestId('chamber-scheme');

    const s0Field = page.getByLabel('Ширина разгрузочной щели S0, мм');
    await s0Field.fill('75');

    // Целевой S0 достигается точным жёстким сдвигом брони конуса вдоль
    // линии зазора (см. `applyCalibration` в `src/domain/chamberGeometry.ts`),
    // поэтому итоговое расстояние в подписи совпадает с введённым числом.
    await expect(svg).toContainText('S₀ — выходная щель: 75 мм');

    await s0Field.fill('40');
    await expect(svg).toContainText('S₀ — выходная щель: 40 мм');
  });

  test('изменение угла гирации θ, углов β и длины l2 меняет разметку схемы', async ({ page }) => {
    const svg = page.getByTestId('chamber-scheme');
    const before = await svg.innerHTML();

    await page.getByLabel('Угол гирации θ').fill('6');
    const afterTheta = await svg.innerHTML();
    expect(afterTheta).not.toBe(before);

    await page.getByLabel('Угол конуса β10').fill('30');
    const afterBeta10 = await svg.innerHTML();
    expect(afterBeta10).not.toBe(afterTheta);

    await page.getByLabel('Угол чаши β40').fill('35');
    const afterBeta40 = await svg.innerHTML();
    expect(afterBeta40).not.toBe(afterBeta10);

    await page.getByLabel('Длина параллельной зоны l2, мм').fill('260');
    const afterL2 = await svg.innerHTML();
    expect(afterL2).not.toBe(afterBeta40);
  });

  test('изменение диаметра D и высоты H камеры меняет габариты схемы', async ({ page }) => {
    const svg = page.getByTestId('chamber-scheme');
    const before = await svg.innerHTML();

    await page.getByLabel('Диаметр основания D, мм').fill('2400');
    const afterD = await svg.innerHTML();
    expect(afterD).not.toBe(before);

    await page.getByLabel('Высота камеры H, мм').fill('1800');
    const afterH = await svg.innerHTML();
    expect(afterH).not.toBe(afterD);
  });

  test('переключение единицы измерения углов на радианы не ломает схему', async ({ page }) => {
    const console_ = watchConsole(page);
    const svg = page.getByTestId('chamber-scheme');

    await page.getByRole('radio', { name: 'Радианы' }).check();
    // Угол гирации в градусах был 2.5 — в радианах то же самое значение
    // читается уже совсем иначе, схема обязана пересчитаться без ошибок.
    await page.getByLabel('Угол гирации θ').fill('0.05');

    await expect(svg).toBeVisible();
    expect(await svg.locator('path').count()).toBeGreaterThan(0);

    console_.assertClean();
  });

  test('пустые и некорректные значения полей не ломают схему', async ({ page }) => {
    const console_ = watchConsole(page);
    const svg = page.getByTestId('chamber-scheme');

    await page.getByLabel('Ширина разгрузочной щели S0, мм').fill('');
    await page.getByLabel('Диаметр основания D, мм').fill('');
    await page.getByLabel('Длина параллельной зоны l2, мм').fill('');

    await expect(svg).toBeVisible();
    expect(await svg.locator('path').count()).toBeGreaterThan(0);

    console_.assertClean();
  });

  test('точки профиля несут название точки и подсказку с радиусом и углом', async ({ page }) => {
    const svg = page.getByTestId('chamber-scheme');

    // 5 точек брони чаши + 5 точек брони конуса + точка подвеса = 11 подписей.
    await expect(svg.locator('title', { hasText: 'Точка' })).toHaveCount(11);
  });
});

test.describe('Схема камеры: выносные размеры', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page);
    await createProject(page);
    await expect(page.getByTestId('chamber-scheme')).toBeVisible();
  });

  test('подписи D, h и S₀ совпадают с полями формы', async ({ page }) => {
    const scheme = page.getByTestId('chamber-scheme');

    // Значения по умолчанию: D = 1750, H = 1200, S0 = 32.
    await expect(scheme).toContainText('D = 1 750 мм');

    // Меняем диаметр — подпись обязана пойти за полем, а не за чертежом.
    await page.getByLabel('Диаметр основания D, мм').fill('2200');
    await expect(scheme).toContainText('D = 2 200 мм');
  });
});
