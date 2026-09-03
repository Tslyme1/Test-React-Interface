import { test, expect } from '@playwright/test';
import { createProject, SAMPLE_PROJECT, seedSession } from './helpers';

async function hoverAndCloseTab(page: import('@playwright/test').Page, name: string) {
  const tab = page.getByRole('button', { name, exact: true });
  await tab.hover({ position: { x: 12, y: 12 } });
  await page.getByRole('button', { name: `Закрыть проект: ${name}` }).click();
}

/**
 * Правка числового поля на уже посчитанном шаге не форкает проект (см.
 * `fork-project.spec.ts` — форк только у дискретных решений вроде дробилки
 * или пробы руды), но и не должна молча разойтись с уже показанным
 * отчётом: закрытие вкладки в этом состоянии подтверждается отдельно.
 */
test.describe('Подтверждение закрытия при непересчитанных изменениях', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page, { empty: true });
    await createProject(page);
    await page.getByRole('button', { name: 'Выполнить расчёт' }).click();
  });

  test('правка поля после расчёта — закрытие вкладки спрашивает подтверждение', async ({ page }) => {
    await page.getByLabel('Диаметр основания D, мм').fill('1900');

    await hoverAndCloseTab(page, SAMPLE_PROJECT.name);

    await expect(page.getByRole('dialog', { name: 'Есть непересчитанные изменения' })).toBeVisible();
  });

  test('«Остаться в проекте» не закрывает вкладку', async ({ page }) => {
    await page.getByLabel('Диаметр основания D, мм').fill('1900');
    await hoverAndCloseTab(page, SAMPLE_PROJECT.name);

    await page.getByRole('dialog', { name: 'Есть непересчитанные изменения' }).getByRole('button', { name: 'Остаться в проекте' }).click();

    await expect(page.getByRole('button', { name: SAMPLE_PROJECT.name, exact: true })).toBeVisible();
    await expect(page.getByLabel('Диаметр основания D, мм')).toHaveValue('1900');
  });

  test('«Закрыть проект» закрывает вкладку, изменения остаются сохранёнными', async ({ page }) => {
    await page.getByLabel('Диаметр основания D, мм').fill('1900');
    await hoverAndCloseTab(page, SAMPLE_PROJECT.name);

    await page.getByRole('dialog', { name: 'Есть непересчитанные изменения' }).getByRole('button', { name: 'Закрыть проект' }).click();

    await expect(page.getByRole('button', { name: SAMPLE_PROJECT.name, exact: true })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Проекты' })).toBeVisible();

    await page.getByRole('button', { name: SAMPLE_PROJECT.crusher, exact: true }).click();
    await expect(page.getByLabel('Диаметр основания D, мм')).toHaveValue('1900');
  });

  test('закрытие без правок после расчёта не спрашивает ничего', async ({ page }) => {
    await hoverAndCloseTab(page, SAMPLE_PROJECT.name);

    await expect(page.getByRole('dialog', { name: 'Есть непересчитанные изменения' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: SAMPLE_PROJECT.name, exact: true })).toHaveCount(0);
  });

  test('пересчёт шага после правки снимает предупреждение при закрытии', async ({ page }) => {
    await page.getByLabel('Диаметр основания D, мм').fill('1900');
    await expect(page.getByText('Есть непересчитанные изменения')).toBeVisible();

    await page.getByRole('button', { name: 'Пересчитать' }).click();
    await expect(page.getByText('Есть непересчитанные изменения')).toHaveCount(0);

    await hoverAndCloseTab(page, SAMPLE_PROJECT.name);

    await expect(page.getByRole('dialog', { name: 'Есть непересчитанные изменения' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: SAMPLE_PROJECT.name, exact: true })).toHaveCount(0);
  });
});
