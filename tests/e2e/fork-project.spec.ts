import { test, expect } from '@playwright/test';
import { SAMPLE_PROJECT, closeStepEditor, createProject, goToWizardStep, openStepEditor, pickOre, runStepCalc, seedSession } from './helpers';

/**
 * Правка данных уже посчитанного шага не переписывает проект на месте —
 * она предлагает создать копию с применённой правкой, а исходный проект
 * остаётся таким, каким был на момент расчёта.
 */
test.describe('Форк проекта при правке посчитанного шага', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page, { empty: true });
    await createProject(page);
    await runStepCalc(page);
    /* Расчёт закрывает окно ввода — сценариям ниже нужны поля и плашки,
       то есть само окно, поэтому открываем его снова. */
    await openStepEditor(page);
  });

  test('смена дробилки на посчитанном шаге предлагает создать копию', async ({ page }) => {
    await page.getByRole('button', { name: 'Сменить дробилку' }).click();
    await page.getByRole('dialog', { name: 'Сменить дробилку' }).getByRole('button', { name: 'КМД-3000Т2', exact: true }).click();

    const confirm = page.getByRole('dialog', { name: 'Шаг уже посчитан' });
    await expect(confirm).toBeVisible();

    await confirm.getByRole('button', { name: 'Создать копию' }).click();

    /* Открыт новый проект — с новой дробилкой, шаг снова не посчитан,
       а значит показан он окном ввода поверх списка. */
    await expect(page.getByText('КМД-3000Т2', { exact: true }).first()).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Исходные данные: Дробилка' })).toBeVisible();
    await closeStepEditor(page);

    // Исходный проект остаётся в списке нетронутым.
    await expect(page.getByRole('cell', { name: SAMPLE_PROJECT.crusher, exact: true })).toBeVisible();
  });

  test('отмена в окне подтверждения не создаёт копию и не меняет проект', async ({ page }) => {
    await page.getByRole('button', { name: 'Сменить дробилку' }).click();
    await page.getByRole('dialog', { name: 'Сменить дробилку' }).getByRole('button', { name: 'КМД-3000Т2', exact: true }).click();

    await page.getByRole('dialog', { name: 'Шаг уже посчитан' }).getByRole('button', { name: 'Отмена' }).click();

    // Дробилка не поменялась, второй проект не появился.
    await expect(page.getByText(SAMPLE_PROJECT.crusher, { exact: true }).first()).toBeVisible();
    await closeStepEditor(page);
    await page.getByRole('button', { name: 'УЗТМ' }).click();
    await expect(page.getByRole('row')).toHaveCount(2); // заголовок + один проект
  });

  test('смена пробы руды на посчитанном шаге «Грансостав» тоже форкает', async ({ page }) => {
    await goToWizardStep(page, /Руда/);
    await pickOre(page);
    await expect(page.getByRole('dialog', { name: 'Выбор пробы руды' })).toHaveCount(0);
    await runStepCalc(page);

    await openStepEditor(page);
    await page.getByRole('button', { name: 'Сменить пробу руды' }).click();
    await page.getByRole('dialog', { name: 'Выбор пробы руды' }).getByRole('button', { name: 'Михайловская', exact: true }).click();

    await expect(page.getByRole('dialog', { name: 'Шаг уже посчитан' })).toBeVisible();
  });
});
