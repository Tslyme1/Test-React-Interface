import { test, expect } from '@playwright/test';
import { closeDisplayPopover, createProject, openStepEditor, seedSession, watchConsole } from './helpers';

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
    /* Поля этапа живут в окне ввода — страница показывает сводку и
       результат. Сценарий начинается там же, где и работа: в окне. */
    await openStepEditor(page);
  });

  test('схема видна рядом с формой и доступна как изображение', async ({ page }) => {
    const console_ = watchConsole(page);

    /* Чертёж на экране дважды: рабочий в окне ввода и итоговый на
       странице этапа под ним. Здесь речь про рабочий. */
    const scheme = page.getByTestId('chamber-scheme');
    await expect(scheme).toHaveAttribute('aria-label', /Схема профиля камеры дробления/);
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

    const s0Field = page.getByLabel('Ширина разгрузочной щели S0');
    await s0Field.fill('75');

    /* S₀ — исходная величина методики: раскрытие камеры S1 рекурсивно
       раскручивается вверх именно от неё (§3.2, шаг 5), поэтому в нижнем
       сечении подпись совпадает с полем формы точно, а не приближённо. */
    await expect(svg).toContainText('S₀ — раскрытие 3–2: 75 мм');

    await s0Field.fill('40');
    await expect(svg).toContainText('S₀ — раскрытие 3–2: 40 мм');
  });

  test('изменение угла нутации θ, углов β и длины l2 меняет разметку схемы', async ({ page }) => {
    const svg = page.getByTestId('chamber-scheme');
    const before = await svg.innerHTML();

    await page.getByLabel('Угол нутации θ').fill('6');
    const afterTheta = await svg.innerHTML();
    expect(afterTheta).not.toBe(before);

    /* β₁₀ и β₄₀ — углы зоны входа: на контур этапа 1 они не влияют
       (сечение 0 дублирует первое, шаг 8 методики), зато рисуют стенки
       приёмной части и уходят в этап 2. Проверяем именно их штрихи. */
    await page.getByLabel('Угол конуса β10').fill('30');
    const afterBeta10 = await svg.innerHTML();
    expect(afterBeta10).not.toBe(afterTheta);

    await page.getByLabel('Угол чаши β40').fill('35');
    const afterBeta40 = await svg.innerHTML();
    expect(afterBeta40).not.toBe(afterBeta10);

    await page.getByLabel('Угол чаши β42').fill('45');
    const afterBeta42 = await svg.innerHTML();
    expect(afterBeta42).not.toBe(afterBeta40);

    await page.getByLabel('Длина зоны l₂').fill('260');
    const afterL2 = await svg.innerHTML();
    expect(afterL2).not.toBe(afterBeta42);
  });

  test('изменение диаметра D и высоты H камеры меняет габариты схемы', async ({ page }) => {
    const svg = page.getByTestId('chamber-scheme');
    const before = await svg.innerHTML();

    await page.getByLabel('Диаметр основания D').fill('2400');
    const afterD = await svg.innerHTML();
    expect(afterD).not.toBe(before);

    await page.getByLabel('Высота H от подвеса').fill('1800');
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
    await closeDisplayPopover(page);
    // Угол нутации в градусах был 2.5 — в радианах то же самое значение
    // читается уже совсем иначе, схема обязана пересчитаться без ошибок.
    await page.getByLabel('Угол нутации θ').fill('0.05');

    await expect(svg).toBeVisible();
    expect(await svg.locator('path').count()).toBeGreaterThan(0);

    console_.assertClean();
  });

  test('пустые и некорректные значения полей не ломают схему', async ({ page }) => {
    const console_ = watchConsole(page);
    const svg = page.getByTestId('chamber-scheme');

    await page.getByLabel('Ширина разгрузочной щели S0').fill('');
    await page.getByLabel('Диаметр основания D').fill('');
    await page.getByLabel('Длина зоны l₂').fill('');

    await expect(svg).toBeVisible();
    expect(await svg.locator('path').count()).toBeGreaterThan(0);

    console_.assertClean();
  });

  test('точки профиля несут название точки и подсказку с радиусом и углом', async ({ page }) => {
    const svg = page.getByTestId('chamber-scheme');

    // По умолчанию две зоны дробления, то есть по четыре узла на броню
    // (40 · 41 · 4i · 3 и 10 · 11 · 1i · 2): 4 + 4 + точка подвеса, плюс
    // её же выноска с подписью справа от чертежа = 10 подсказок.
    await expect(svg.locator('title', { hasText: 'Точка' })).toHaveCount(10);
  });
});

test.describe('Схема камеры: выносные размеры', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page, { empty: true });
    await createProject(page);
    /* Поля этапа живут в окне ввода — страница показывает сводку и
       результат. Сценарий начинается там же, где и работа: в окне. */
    await openStepEditor(page);
    await expect(page.getByTestId('chamber-scheme')).toBeVisible();
  });

  test('выносной размер D/2 идёт за полем формы, а не за чертежом', async ({ page }) => {
    const scheme = page.getByTestId('chamber-scheme');

    // Значение по умолчанию D = 2200 (контрольный пример методики).
    await expect(scheme).toContainText('D/2 = 1 100 мм');

    // Меняем диаметр — подпись обязана пойти за полем.
    await page.getByLabel('Диаметр основания D').fill('1750');
    await expect(scheme).toContainText('D/2 = 875 мм');
  });
});
