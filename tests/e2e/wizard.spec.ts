import { test, expect } from '@playwright/test';
import { SAMPLE_PROJECT, createProject, pickOre, seedSession, watchConsole } from './helpers';

test.describe('Инженерный визард', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page, { empty: true });
    await createProject(page);
  });

  test('шаги 2 и 3 недоступны, пока не посчитан первый', async ({ page }) => {
    // Недоступный шаг степпер рисует не отключённой кнопкой, а просто текстом:
    // кликабельность, которая ничего не делает, в системе запрещена. Поэтому
    // проверяется отсутствие кнопки, а не её disabled-состояние.
    await expect(page.getByText('Руда', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Руда/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Продукт/ })).toHaveCount(0);
  });

  test('расчёт помечает шаг пройденным, показывает тост и открывает следующий', async ({ page }) => {
    const console_ = watchConsole(page);

    await page.getByRole('button', { name: 'Выполнить расчёт' }).click();

    await expect(page.getByText('Шаг «Дробилка» рассчитан')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Смотреть результат' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Руда/ })).toBeEnabled();

    console_.assertClean();
  });

  test('результат открывается панелью и показывает вычисленные значения', async ({ page }) => {
    await page.getByRole('button', { name: 'Выполнить расчёт' }).click();
    await page.getByRole('button', { name: 'Смотреть результат' }).click();

    const drawer = page.getByRole('dialog', { name: /Результат: геометрия/ });
    await expect(drawer).toBeVisible();
    await expect(drawer.getByText('Рассчитано')).toBeVisible();

    // D/2 выводится из введённого D = 1750 — связь формы и результата жива.
    await expect(drawer.getByRole('row').filter({ hasText: 'D/2' })).toContainText('875');

    await drawer.getByRole('button', { name: 'Закрыть', exact: true }).click();
    await expect(drawer).toBeHidden();
  });

  test('панель результата закрывается по Esc', async ({ page }) => {
    await page.getByRole('button', { name: 'Выполнить расчёт' }).click();
    await page.getByRole('button', { name: 'Смотреть результат' }).click();

    const drawer = page.getByRole('dialog', { name: /Результат: геометрия/ });
    await expect(drawer).toBeVisible();

    await page.keyboard.press('Escape');
    await expect(drawer).toBeHidden();
  });

  test('переход по шагам меняет форму', async ({ page }) => {
    await page.getByRole('button', { name: 'Выполнить расчёт' }).click();

    await page.getByRole('button', { name: /Руда/ }).click();
    await pickOre(page);
    await expect(page.getByRole('heading', { name: 'Характеристический грансостав' })).toBeVisible();

    await page.getByRole('button', { name: /Дробилка/ }).click();
    await expect(page.getByRole('heading', { name: 'Геометрия камеры дробления' })).toBeVisible();
  });

  test('переход на «Руда» без выбранной пробы открывает выбор пробы, оставляя шаг «Дробилка»', async ({ page }) => {
    const console_ = watchConsole(page);

    await page.getByRole('button', { name: 'Выполнить расчёт' }).click();
    await page.getByRole('button', { name: /Руда/ }).click();

    // Степпер не переключился: заглушки «нечем считать» на шаге «Грансостав»
    // быть не должно вовсе — вместо неё сразу открывается выбор пробы,
    // а форма позади него остаётся на шаге «Дробилка».
    await expect(page.getByRole('heading', { name: 'Геометрия камеры дробления' })).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Выбор пробы руды' })).toBeVisible();
    await expect(page.getByText('Выберите пробу руды')).toHaveCount(0);

    await pickOre(page);

    await expect(page.getByLabel('Минимальная крупность Dmin, мм')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Выполнить расчёт' })).toBeEnabled();

    console_.assertClean();
  });

  test('выбранная проба руды переживает уход на другой шаг', async ({ page }) => {
    await page.getByRole('button', { name: 'Выполнить расчёт' }).click();
    await page.getByRole('button', { name: /Руда/ }).click();
    await pickOre(page);

    await page.getByRole('button', { name: /Дробилка/ }).click();
    await page.getByRole('button', { name: /Руда/ }).click();

    await expect(page.getByRole('heading', { name: 'Характеристический грансостав' })).toBeVisible();
    await expect(page.getByText('Выберите пробу руды')).toHaveCount(0);
  });

  test('введённые значения переживают выход в список и возврат в проект', async ({ page }) => {
    const field = page.getByLabel('Диаметр основания D, мм');
    await field.fill('1900');

    await page.getByRole('button', { name: 'УЗТМ' }).click();
    await page.getByRole('button', { name: SAMPLE_PROJECT.crusher, exact: true }).click();

    await expect(page.getByLabel('Диаметр основания D, мм')).toHaveValue('1900');
  });

  test('введённые значения и отметка расчёта переживают перезагрузку', async ({ page }) => {
    // Проверяет, что вложенные данные визарда переживают сериализацию,
    // а не только верхний уровень записи проекта.
    await page.getByLabel('Диаметр основания D, мм').fill('1900');
    await page.getByRole('button', { name: 'Выполнить расчёт' }).click();
    await expect(page.getByRole('button', { name: 'Смотреть результат' })).toBeVisible();

    await page.reload();
    await page.getByRole('button', { name: SAMPLE_PROJECT.crusher, exact: true }).click();

    await expect(page.getByLabel('Диаметр основания D, мм')).toHaveValue('1900');
    await expect(page.getByRole('button', { name: 'Смотреть результат' })).toBeVisible();
  });

  test('посчитанный шаг остаётся посчитанным после возврата', async ({ page }) => {
    await page.getByRole('button', { name: 'Выполнить расчёт' }).click();
    await expect(page.getByRole('button', { name: 'Смотреть результат' })).toBeVisible();

    await page.getByRole('button', { name: 'УЗТМ' }).click();
    await page.getByRole('button', { name: SAMPLE_PROJECT.crusher, exact: true }).click();

    await expect(page.getByRole('button', { name: 'Смотреть результат' })).toBeVisible();
  });

  /**
   * Уход на главную — переключение, а не закрытие: вкладка проекта обязана
   * остаться в шапке, и вернуться в проект можно нажатием по ней самой,
   * без повторного поиска строки в таблице.
   */
  test('проект остаётся открытым, пока его не закрыли крестиком', async ({ page }) => {
    const tab = page.getByRole('button', { name: SAMPLE_PROJECT.name, exact: true });
    await expect(tab).toBeVisible();

    await page.getByRole('button', { name: 'УЗТМ' }).click();
    await expect(page.getByRole('heading', { name: 'Проекты' })).toBeVisible();
    // Вкладка не исчезла вместе с уходом на список.
    await expect(tab).toBeVisible();

    await tab.click();
    await expect(page.getByRole('heading', { name: 'Геометрия камеры дробления' })).toBeVisible();

    // Закрывает проект только крестик на его вкладке.
    await page.getByRole('button', { name: 'Закрыть проект' }).click();
    await expect(tab).toHaveCount(0);
  });

  /**
   * Переименование — поповер у шеврона внутри вкладки, без ухода на модальный
   * слой. Новое имя держится: возврат на главную и обратно не откатывает его.
   */
  test('переименование проекта держится после ухода на главную и обратно', async ({ page }) => {
    // Действия вкладки проявляются при наведении на неё — до этого они
    // занимают место в раскладке, но недоступны нажатию.
    await page.getByRole('button', { name: 'Тестовый проект', exact: true }).hover();
    await page.getByRole('button', { name: 'Переименовать проект' }).click();
    await page.getByLabel('Название проекта').fill('Переименованный проект');
    await page.getByRole('button', { name: 'Сохранить' }).click();

    const tab = page.getByRole('button', { name: 'Переименованный проект', exact: true });
    await expect(tab).toBeVisible();
    await expect(page.getByRole('button', { name: SAMPLE_PROJECT.name, exact: true })).toHaveCount(0);

    await page.getByRole('button', { name: 'УЗТМ' }).click();
    await expect(tab).toBeVisible();
    await tab.click();
    await expect(page.getByRole('heading', { name: 'Геометрия камеры дробления' })).toBeVisible();
  });

  test('переключение единиц углов меняет постфикс у полей угла', async ({ page }) => {
    await expect(page.getByText('°', { exact: true }).first()).toBeVisible();

    await page.getByRole('button', { name: 'Отображение' }).click();
    const radians = page.getByRole('option', { name: 'Радианы' });
    await radians.click();
    await expect(radians).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('Escape');

    await expect(page.getByText('рад', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('°', { exact: true })).toHaveCount(0);
  });

  test('ширину панели со схемой можно тянуть вручную', async ({ page }) => {
    const panel = page.locator('[data-open="true"]');
    const before = await panel.boundingBox();
    if (!before) throw new Error('панель схемы не найдена');

    const handle = page.getByRole('separator', { name: /Ширина панели/ });
    const handleBox = await handle.boundingBox();
    if (!handleBox) throw new Error('ручка ширины не найдена');

    await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
    await page.mouse.down();
    await page.mouse.move(handleBox.x - 150, handleBox.y + handleBox.height / 2, { steps: 10 });
    await page.mouse.up();

    const after = await panel.boundingBox();
    expect(after!.width).toBeGreaterThan(before.width + 100);
  });

  test('дельта работает на «Грансоставе» и «Продукте», не только на «Геометрии»', async ({ page }) => {
    await page.getByRole('button', { name: 'Выполнить расчёт' }).click();
    await page.getByRole('button', { name: /Руда/ }).click();
    await pickOre(page);

    const z0 = page.getByLabel('Параметр Z0');
    await expect(page.getByText('было:')).toHaveCount(0);

    await page.getByRole('button', { name: 'Выполнить расчёт' }).click();
    await z0.fill('9.9');
    // Отредактировано после расчёта этого же шага — подсказка «было: X»
    // обязана появиться прямо под полем, тем же приёмом, что на «Геометрии».
    await expect(page.getByText('было: 1.2', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: /Продукт/ }).click();
    const wk = page.getByLabel('Работа разрушения Wk');
    const wkBefore = await wk.inputValue();
    await page.getByRole('button', { name: 'Выполнить расчёт' }).click();
    await wk.fill(`${Number(wkBefore) + 1}`);
    await expect(page.getByText(`было: ${wkBefore}`, { exact: true })).toBeVisible();
  });
});
