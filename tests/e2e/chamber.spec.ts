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
    await seedSession(page, { empty: true });
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
    // Зазор между крайними точками профиля — тот самый S₀ поля формы.
    await expect(svg).toContainText('S₀ — зазор 3–2: 75 мм');

    await s0Field.fill('40');
    await expect(svg).toContainText('S₀ — зазор 3–2: 40 мм');
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

    await page.getByLabel('Длина l2 — 4i→3, калибровка, мм').fill('260');
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

    // Единицы угла переключаются в поповере «Отображение» — строка выбора
    // там `Cell`, а не именованный нативный `radio` (см. `OptionCell`
    // в `GeometryStep`).
    await page.getByRole('button', { name: 'Отображение' }).click();
    await page.getByRole('option', { name: 'Радианы' }).click();
    await page.keyboard.press('Escape');
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
    await page.getByLabel('Длина l2 — 4i→3, калибровка, мм').fill('');

    await expect(svg).toBeVisible();
    expect(await svg.locator('path').count()).toBeGreaterThan(0);

    console_.assertClean();
  });

  test('точки профиля несут название точки и подсказку с радиусом и углом', async ({ page }) => {
    const svg = page.getByTestId('chamber-scheme');

    // 5 точек брони чаши + 5 точек брони конуса + точка подвеса, плюс
    // её же выноска с подписью справа от чертежа = 12 подсказок.
    await expect(svg.locator('title', { hasText: 'Точка' })).toHaveCount(12);
  });
});

test.describe('Схема камеры: выносные размеры', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page, { empty: true });
    await createProject(page);
    await expect(page.getByTestId('chamber-scheme')).toBeVisible();
  });

  test('выносной размер D/2 идёт за полем формы, а не за чертежом', async ({ page }) => {
    const scheme = page.getByTestId('chamber-scheme');

    // Значение по умолчанию D = 1750 — на выноске половина диаметра.
    await expect(scheme).toContainText('D/2 = 875 мм');

    // Меняем диаметр — подпись обязана пойти за полем.
    await page.getByLabel('Диаметр основания D, мм').fill('2200');
    await expect(scheme).toContainText('D/2 = 1 100 мм');
  });
});
