import { test, expect } from '@playwright/test';
import { closeStepEditor, createProject, openStepEditor, seedSession } from './helpers';

/**
 * Границы исходных данных этапа 1 (`src/domain/geomLimits.ts`).
 *
 * Методика считает профиль рекурсией и почти на любых числах что-нибудь
 * да выдаёт, поэтому заведомо невозможный ввод ловится на самом шаге,
 * а не оставляется расчёту.
 */
test.describe('Этап 1: границы исходных данных', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page, { empty: true });
    await createProject(page);
    /* Поля этапа живут в окне ввода — страница показывает сводку и
       результат. Сценарий начинается там же, где и работа: в окне. */
    await openStepEditor(page);
  });

  test('значение за границей помечает поле ошибкой, но не подменяет число', async ({ page }) => {
    const theta = page.getByLabel('Угол нутации θ');
    await theta.fill('1000000');

    await expect(page.getByText('Допустимо от 0,1 до 6°')).toBeVisible();
    // Введённое остаётся как есть: молча править ввод пользователя нельзя.
    await expect(theta).toHaveValue('1000000');

    await theta.fill('1.5');
    await expect(page.getByText('Допустимо от 0,1 до 6°')).toHaveCount(0);
  });

  test('границы пересчитываются при переключении на радианы', async ({ page }) => {
    const theta = page.getByLabel('Угол нутации θ');
    await expect(theta).toHaveAttribute('min', '0.1');
    await expect(theta).toHaveAttribute('max', '6');

    await page.getByRole('button', { name: 'Отображение' }).click();
    await page.getByRole('option', { name: 'Радианы' }).click();
    await page.keyboard.press('Escape');

    // 0,1° и 6° в радианах.
    await expect(theta).toHaveAttribute('min', '0.0017');
    await expect(theta).toHaveAttribute('max', '0.1047');
  });

  test('β₄₀ ограничен девяноста градусами — прямой запрет методики', async ({ page }) => {
    /* §8.1: ветка β₄₀ > π/2 в модели движения куска не реализована,
       расчёт куска на таких данных аварийно завершается. */
    const b40 = page.getByLabel('Угол чаши β40');
    await expect(b40).toHaveAttribute('max', '90');

    await b40.fill('91');
    await expect(page.getByText('Допустимо от 1 до 90°')).toBeVisible();
  });

  test('связь между полями: зона калибровки не может быть выше точки подвеса', async ({ page }) => {
    /* Шаг 2 методики: H2 = H − l₂·sin β₂. Если она уходит в минус,
       нижнее расчётное сечение оказывается выше точки подвеса, и дальше
       рекурсия считает несуществующую камеру. Границей одного поля это
       не выражается — условие связывает H, l₂ и β₂. */
    await page.getByLabel('Высота H от подвеса').fill('100');
    await page.getByLabel('Длина зоны l₂').fill('200');

    await expect(page.getByText('Зона калибровки выше точки подвеса: H − l₂·sin β₂ должно быть больше нуля')).toBeVisible();
  });

  test('справка перечисляет границы и объясняет ситовый размер', async ({ page }) => {
    // Справка живёт в шапке приложения — окно ввода её перекрывает.
    await closeStepEditor(page);
    await page.getByRole('button', { name: 'Справка по параметрам' }).click();
    const help = page.getByRole('dialog');

    await expect(help).toContainText('Угол нутации θ — от 0,1 до 6°');
    await expect(help).toContainText('Диаметр основания D — от 300 до 4000 мм');
    await expect(help).toContainText('Угол чаши в зоне входа β40 — от 1 до 90°');
    // Величины зоны подписаны один раз без номера: зон столько, сколько завёл пользователь.
    await expect(help).toContainText('Длина зоны дробления — от 10 до 2000 мм');

    // Крупность: ситовый размер — сторона квадратной ячейки.
    await expect(help).toContainText('сторона квадратной ячейки сита');
    await expect(help).toContainText('0,8·D пред');
    await expect(help).toContainText('через щель кусок проходит наименьшим своим размером');
  });
});
