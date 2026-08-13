import { test, expect } from '@playwright/test';
import { createProject, seedSession, watchConsole } from './helpers';

test.describe('Инженерный визард', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page);
    await createProject(page);
  });

  test('шаги 2 и 3 недоступны, пока не посчитан первый', async ({ page }) => {
    // Недоступный шаг степпер рисует не отключённой кнопкой, а просто текстом:
    // кликабельность, которая ничего не делает, в системе запрещена. Поэтому
    // проверяется отсутствие кнопки, а не её disabled-состояние.
    await expect(page.getByText('Грансостав', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /Грансостав/ })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Продукт/ })).toHaveCount(0);
  });

  test('расчёт помечает шаг пройденным, показывает тост и открывает следующий', async ({ page }) => {
    const console_ = watchConsole(page);

    await page.getByRole('button', { name: 'Выполнить расчёт' }).click();

    await expect(page.getByText('Шаг «Геометрия» рассчитан')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Смотреть результат' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Грансостав/ })).toBeEnabled();

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

    await page.getByRole('button', { name: /Грансостав/ }).click();
    await expect(page.getByRole('heading', { name: 'Характеристический грансостав' })).toBeVisible();

    await page.getByRole('button', { name: /Геометрия/ }).click();
    await expect(page.getByRole('heading', { name: 'Геометрия камеры дробления' })).toBeVisible();
  });

  test('введённые значения переживают выход в список и возврат в проект', async ({ page }) => {
    const field = page.getByLabel('Диаметр основания D, мм');
    await field.fill('1900');

    await page.getByRole('button', { name: 'Проекты' }).click();
    await page.getByRole('button', { name: 'КСД-1750Т' }).click();

    await expect(page.getByLabel('Диаметр основания D, мм')).toHaveValue('1900');
  });

  test('введённые значения и отметка расчёта переживают перезагрузку', async ({ page }) => {
    // Проверяет, что вложенные данные визарда переживают сериализацию,
    // а не только верхний уровень записи проекта.
    await page.getByLabel('Диаметр основания D, мм').fill('1900');
    await page.getByRole('button', { name: 'Выполнить расчёт' }).click();
    await expect(page.getByRole('button', { name: 'Смотреть результат' })).toBeVisible();

    await page.reload();
    await page.getByRole('button', { name: 'КСД-1750Т' }).click();

    await expect(page.getByLabel('Диаметр основания D, мм')).toHaveValue('1900');
    await expect(page.getByRole('button', { name: 'Смотреть результат' })).toBeVisible();
  });

  test('посчитанный шаг остаётся посчитанным после возврата', async ({ page }) => {
    await page.getByRole('button', { name: 'Выполнить расчёт' }).click();
    await expect(page.getByRole('button', { name: 'Смотреть результат' })).toBeVisible();

    await page.getByRole('button', { name: 'Проекты' }).click();
    await page.getByRole('button', { name: 'КСД-1750Т' }).click();

    await expect(page.getByRole('button', { name: 'Смотреть результат' })).toBeVisible();
  });

  test('переключение единиц углов — сегментированный контрол работает', async ({ page }) => {
    const radians = page.getByRole('radio', { name: 'Радианы' });
    await radians.check();
    await expect(radians).toBeChecked();

    await expect(page.getByText('в единицах: рад')).toBeVisible();
  });
});
