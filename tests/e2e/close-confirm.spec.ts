import { test, expect } from '@playwright/test';
import { SAMPLE_PROJECT, closeDisplayPopover, closeStepEditor, createProject, goToWizardStep, openStepEditor, pickOre, runStepCalc, seedSession } from './helpers';

async function hoverAndCloseTab(page: import('@playwright/test').Page, name: string) {
  const tab = page.getByRole('button', { name, exact: true });
  await tab.hover({ position: { x: 12, y: 12 } });
  await page.getByRole('button', { name: `Закрыть проект: ${name}` }).click();
}

/**
 * Закрытие вкладки проекта, который за это посещение изменили.
 *
 * Точка отсчёта — состояние проекта на момент открытия, а не снимок
 * на момент расчёта: «поменял данные и пересчитал» — самый обычный
 * заход в посчитанный проект, и откатывать при закрытии надо его
 * целиком. По снимку расчёта выходило, что «Пересчитать» стирает
 * все изменения и окно не показывает ничего.
 */
test.describe('Подтверждение закрытия при непересчитанных изменениях', () => {
  /**
   * Сценарии начинаются там же, где и жалоба: проект **уже посчитан**
   * и его открывают заново из списка. Именно в этом случае есть к чему
   * откатывать — состояние до захода; у проекта, созданного и
   * посчитанного тут же, его нет, и окно при закрытии не появляется.
   */
  test.beforeEach(async ({ page }) => {
    await seedSession(page, { empty: true });
    await createProject(page);
    await runStepCalc(page);
    await closeStepEditor(page);
    await hoverAndCloseTab(page, SAMPLE_PROJECT.name);

    await page.getByRole('button', { name: SAMPLE_PROJECT.crusher, exact: true }).click();
    /* Посчитанный этап открывается без окна ввода — сценариям ниже нужны
       поля, то есть само окно. */
    await openStepEditor(page);
  });

  test('правка поля после расчёта — закрытие вкладки спрашивает подтверждение', async ({ page }) => {
    await page.getByLabel('Диаметр основания D').fill('1900');

    await closeStepEditor(page);
    await hoverAndCloseTab(page, SAMPLE_PROJECT.name);

    await expect(page.getByRole('dialog', { name: 'Сохранить изменения перед закрытием?' })).toBeVisible();
  });

  test('«Отмена» не закрывает вкладку', async ({ page }) => {
    await page.getByLabel('Диаметр основания D').fill('1900');
    await closeStepEditor(page);
    await hoverAndCloseTab(page, SAMPLE_PROJECT.name);

    await page.getByRole('dialog', { name: 'Сохранить изменения перед закрытием?' }).getByRole('button', { name: 'Отмена' }).click();

    await expect(page.getByRole('button', { name: SAMPLE_PROJECT.name, exact: true })).toBeVisible();
    await openStepEditor(page);
    await expect(page.getByLabel('Диаметр основания D')).toHaveValue('1900');
  });

  test('«Закрыть без сохранения» закрывает вкладку и возвращает проект к состоянию на входе', async ({ page }) => {
    const before = await page.getByLabel('Диаметр основания D').inputValue();
    await page.getByLabel('Диаметр основания D').fill('1900');
    await closeStepEditor(page);
    await hoverAndCloseTab(page, SAMPLE_PROJECT.name);

    await page.getByRole('dialog', { name: 'Сохранить изменения перед закрытием?' }).getByRole('button', { name: 'Закрыть без сохранения' }).click();

    await expect(page.getByRole('button', { name: SAMPLE_PROJECT.name, exact: true })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Проекты' })).toBeVisible();

    // Правка откатывается к тому, чем проект был на момент открытия.
    await page.getByRole('button', { name: SAMPLE_PROJECT.crusher, exact: true }).click();
    await openStepEditor(page);
    await expect(page.getByLabel('Диаметр основания D')).toHaveValue(before);
  });

  test('«Сохранить» в диалоге закрывает вкладку, оставляя правки', async ({ page }) => {
    await page.getByLabel('Диаметр основания D').fill('1900');
    await closeStepEditor(page);
    await hoverAndCloseTab(page, SAMPLE_PROJECT.name);

    await page
      .getByRole('dialog', { name: 'Сохранить изменения перед закрытием?' })
      .getByRole('button', { name: 'Сохранить' })
      .click();

    await expect(page.getByRole('button', { name: SAMPLE_PROJECT.name, exact: true })).toHaveCount(0);

    await page.getByRole('button', { name: SAMPLE_PROJECT.crusher, exact: true }).click();
    await openStepEditor(page);
    await expect(page.getByLabel('Диаметр основания D')).toHaveValue('1900');

    /* Отчёт при этом честно остаётся помеченным непересчитанным: данные
       сохранены, но расчёт по ним не запускали, и «Сохранить» в окне
       закрытия не вправе утверждать обратное. */
    await closeStepEditor(page);
    await expect(page.getByText('Есть непересчитанные изменения')).toBeVisible();
  });

  /**
   * Окно называет правки поимённо. До этого оно говорило одну фразу —
   * «вы меняли данные после расчёта», — и человек, вернувшийся к проекту
   * через неделю, выбирал между «сохранить» и «закрыть» вслепую: что
   * именно он трогал, окно не показывало.
   */
  test('окно перечисляет, что именно изменено, и с чем считали', async ({ page }) => {
    const before = await page.getByLabel('Диаметр основания D').inputValue();
    await page.getByLabel('Диаметр основания D').fill('1900');
    await page.getByLabel('Высота H от подвеса').fill('900');
    await closeStepEditor(page);
    await hoverAndCloseTab(page, SAMPLE_PROJECT.name);

    const dialog = page.getByRole('dialog', { name: 'Сохранить изменения перед закрытием?' });
    await expect(dialog).toBeVisible();

    // Сколько всего правок — чтобы не пересчитывать строки глазами.
    await expect(dialog.getByText('изменено значений: 2')).toBeVisible();

    // Правки сгруппированы по этапу, к которому относятся.
    await expect(dialog.getByText('Этап «Геометрия»')).toBeVisible();

    const row = dialog.getByRole('row').filter({ hasText: 'Диаметр основания D' });
    await expect(row).toContainText(before);
    await expect(row).toContainText('1900');
    await expect(dialog.getByRole('row').filter({ hasText: 'Высота H от подвеса' })).toContainText('900');

    // Нетронутые величины в списке не висят.
    await expect(dialog.getByRole('row').filter({ hasText: 'Коэффициент R' })).toHaveCount(0);
  });

  test('правки на разных этапах перечислены каждая под своим этапом', async ({ page }) => {
    await page.getByLabel('Диаметр основания D').fill('1900');
    await closeStepEditor(page);

    await goToWizardStep(page, /Руда/);
    await pickOre(page);
    await runStepCalc(page);
    await openStepEditor(page);
    await page.getByLabel('Максимальная крупность Dmax').fill('95');
    await closeStepEditor(page);

    await hoverAndCloseTab(page, SAMPLE_PROJECT.name);
    const dialog = page.getByRole('dialog', { name: 'Сохранить изменения перед закрытием?' });

    await expect(dialog.getByText('Этап «Геометрия»')).toBeVisible();
    await expect(dialog.getByText('Этап «Грансостав»')).toBeVisible();
    await expect(dialog.getByRole('row').filter({ hasText: 'Диаметр основания D' })).toContainText('1900');
    await expect(dialog.getByRole('row').filter({ hasText: 'Максимальная крупность Dmax' })).toContainText('95');
  });

  /**
   * Переключение «градусы ↔ радианы» пересчитывает все углы разом
   * (`convertAngleUnit`). Без приведения снимка к текущим единицам список
   * выглядел бы так, будто человек вручную правил каждый угол.
   */
  test('смена единиц углов — одна строка, а не правка каждого угла', async ({ page }) => {
    await page.getByRole('button', { name: 'Отображение' }).click();
    await page.getByRole('option', { name: 'Радианы' }).click();
    await closeDisplayPopover(page);
    await closeStepEditor(page);

    await hoverAndCloseTab(page, SAMPLE_PROJECT.name);
    const dialog = page.getByRole('dialog', { name: 'Сохранить изменения перед закрытием?' });

    await expect(dialog.getByText('изменено значений: 1')).toBeVisible();
    await expect(dialog.getByRole('row').filter({ hasText: 'Единицы углов' })).toContainText('радианы');
    await expect(dialog.getByRole('row').filter({ hasText: 'Угол нутации θ' })).toHaveCount(0);
  });

  test('закрытие без правок после расчёта не спрашивает ничего', async ({ page }) => {
    await closeStepEditor(page);
    await hoverAndCloseTab(page, SAMPLE_PROJECT.name);

    await expect(page.getByRole('dialog', { name: 'Сохранить изменения перед закрытием?' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: SAMPLE_PROJECT.name, exact: true })).toHaveCount(0);
  });

  /**
   * Регрессия, ради которой точка отсчёта и переехала на момент
   * открытия: поменял данные, нажал «Пересчитать», закрыл — и окно
   * не появлялось вовсе, потому что снимок расчёта к этому моменту
   * уже совпадал с данными.
   */
  test('правка с пересчётом тоже спрашивает при закрытии', async ({ page }) => {
    const before = await page.getByLabel('Диаметр основания D').inputValue();
    await page.getByLabel('Диаметр основания D').fill('1900');
    await runStepCalc(page, 'Пересчитать');
    await expect(page.getByText('Есть непересчитанные изменения')).toHaveCount(0);

    await hoverAndCloseTab(page, SAMPLE_PROJECT.name);

    const dialog = page.getByRole('dialog', { name: 'Сохранить изменения перед закрытием?' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('row').filter({ hasText: 'Диаметр основания D' })).toContainText('1900');
    // Пересчёт назван отдельной строкой: закрытие без сохранения вернёт
    // этап к прежнему расчёту.
    await expect(dialog.getByRole('row').filter({ hasText: 'Расчёт этапа' })).toContainText('пересчитан');

    await dialog.getByRole('button', { name: 'Закрыть без сохранения' }).click();
    await page.getByRole('button', { name: SAMPLE_PROJECT.crusher, exact: true }).click();
    await openStepEditor(page);
    await expect(page.getByLabel('Диаметр основания D')).toHaveValue(before);
  });

  /**
   * Открыли, ничего не тронули, закрыли — спрашивать не о чем. Иначе
   * окно всплывало бы каждый раз, когда в проект просто заглянули.
   */
  test('просмотр без правок закрывается молча', async ({ page }) => {
    await closeStepEditor(page);
    await hoverAndCloseTab(page, SAMPLE_PROJECT.name);

    await expect(page.getByRole('dialog', { name: 'Сохранить изменения перед закрытием?' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: SAMPLE_PROJECT.name, exact: true })).toHaveCount(0);

    // И открыть его снова можно без всяких следов прошлого захода.
    await page.getByRole('button', { name: SAMPLE_PROJECT.crusher, exact: true }).click();
    await closeStepEditor(page);
    await hoverAndCloseTab(page, SAMPLE_PROJECT.name);
    await expect(page.getByRole('dialog', { name: 'Сохранить изменения перед закрытием?' })).toHaveCount(0);
  });
});
