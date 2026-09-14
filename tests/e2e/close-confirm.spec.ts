import { test, expect } from '@playwright/test';
import { SAMPLE_PROJECT, closeStepEditor, createProject, openStepEditor, runStepCalc, seedSession } from './helpers';

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
    await runStepCalc(page);
    /* Расчёт закрывает окно ввода — сценариям ниже нужны поля и плашки,
       то есть само окно, поэтому открываем его снова. */
    await openStepEditor(page);
  });

  test('правка поля после расчёта — закрытие вкладки спрашивает подтверждение', async ({ page }) => {
    await page.getByLabel('Диаметр основания D').fill('1900');

    await closeStepEditor(page);
    await hoverAndCloseTab(page, SAMPLE_PROJECT.name);

    await expect(page.getByRole('dialog', { name: 'Сохранить изменения?' })).toBeVisible();
  });

  test('«Отмена» не закрывает вкладку', async ({ page }) => {
    await page.getByLabel('Диаметр основания D').fill('1900');
    await closeStepEditor(page);
    await hoverAndCloseTab(page, SAMPLE_PROJECT.name);

    await page.getByRole('dialog', { name: 'Сохранить изменения?' }).getByRole('button', { name: 'Отмена' }).click();

    await expect(page.getByRole('button', { name: SAMPLE_PROJECT.name, exact: true })).toBeVisible();
    await openStepEditor(page);
    await expect(page.getByLabel('Диаметр основания D')).toHaveValue('1900');
  });

  test('«Не сохранять» закрывает вкладку и возвращает значения к последнему расчёту', async ({ page }) => {
    const before = await page.getByLabel('Диаметр основания D').inputValue();
    await page.getByLabel('Диаметр основания D').fill('1900');
    await closeStepEditor(page);
    await hoverAndCloseTab(page, SAMPLE_PROJECT.name);

    await page.getByRole('dialog', { name: 'Сохранить изменения?' }).getByRole('button', { name: 'Не сохранять' }).click();

    await expect(page.getByRole('button', { name: SAMPLE_PROJECT.name, exact: true })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Проекты' })).toBeVisible();

    // Правка после расчёта откатывается к снимку, с которым шаг считали.
    await page.getByRole('button', { name: SAMPLE_PROJECT.crusher, exact: true }).click();
    await openStepEditor(page);
    await expect(page.getByLabel('Диаметр основания D')).toHaveValue(before);
  });

  test('«Сохранить» в диалоге закрывает вкладку, оставляя правки и снимая предупреждение', async ({ page }) => {
    await page.getByLabel('Диаметр основания D').fill('1900');
    await closeStepEditor(page);
    await hoverAndCloseTab(page, SAMPLE_PROJECT.name);

    await page
      .getByRole('dialog', { name: 'Сохранить изменения?' })
      .getByRole('button', { name: 'Сохранить' })
      .click();

    await expect(page.getByRole('button', { name: SAMPLE_PROJECT.name, exact: true })).toHaveCount(0);

    await page.getByRole('button', { name: SAMPLE_PROJECT.crusher, exact: true }).click();
    await openStepEditor(page);
    await expect(page.getByLabel('Диаметр основания D')).toHaveValue('1900');
    await expect(page.getByText('Есть непересчитанные изменения')).toHaveCount(0);
  });

  test('закрытие без правок после расчёта не спрашивает ничего', async ({ page }) => {
    await closeStepEditor(page);
    await hoverAndCloseTab(page, SAMPLE_PROJECT.name);

    await expect(page.getByRole('dialog', { name: 'Сохранить изменения?' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: SAMPLE_PROJECT.name, exact: true })).toHaveCount(0);
  });

  test('пересчёт шага после правки снимает предупреждение при закрытии', async ({ page }) => {
    await page.getByLabel('Диаметр основания D').fill('1900');
    await expect(page.getByText('Есть непересчитанные изменения')).toBeVisible();

    await runStepCalc(page, 'Пересчитать');
    await expect(page.getByText('Есть непересчитанные изменения')).toHaveCount(0);

    await closeStepEditor(page);
    await hoverAndCloseTab(page, SAMPLE_PROJECT.name);

    await expect(page.getByRole('dialog', { name: 'Сохранить изменения?' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: SAMPLE_PROJECT.name, exact: true })).toHaveCount(0);
  });
});
