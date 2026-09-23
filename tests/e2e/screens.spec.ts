import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { DEMO_USER, closeStepEditor, createProject, fillNewProjectForm, goToWizardStep, openStepEditor, openTrash, pickOre, removeFirstProject, runStepCalc, seedSession } from './helpers';

/**
 * Съёмка экранов для визуального разбора агентом `ui-check`.
 *
 * Это тест, а не отдельный скрипт, ровно по одной причине: прежний
 * `scripts/capture-screens.mjs` держал собственную копию сценария создания
 * проекта. Копия разошлась с приложением при первой же правке формы — снимки
 * пяти экранов молча перестали получаться, а ревью продолжало опираться
 * на устаревшие PNG. Теперь путь по интерфейсу один и тот же, что у тестов:
 * разойтись ему не с чем.
 *
 * Метка `@screens` держит эти сценарии вне обычного прогона: они ничего
 * не проверяют, только снимают.
 */

const OUT = 'screenshots-review';

/** Кадр берётся после успокоения анимаций: панель и модалка выезжают. */
async function shot(page: Page, name: string) {
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${OUT}/${name}.png` });
}

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`@screens ${scheme}`, () => {
    test.use({ colorScheme: scheme, viewport: { width: 1440, height: 900 } });

    test(`01 вход @screens`, async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'Вход в систему' })).toBeVisible();
      await shot(page, `01-login-${scheme}`);
    });

    test(`01b выбор режима работы @screens`, async ({ page }) => {
      await page.goto('/');
      await page.getByLabel('Логин или почта').fill(DEMO_USER.login);
      await page.getByLabel('Пароль').fill(DEMO_USER.password);
      await page.getByRole('button', { name: 'Продолжить' }).click();
      await expect(page.getByRole('heading', { name: 'Режим работы' })).toBeVisible();
      await shot(page, `01b-login-mode-${scheme}`);
    });

    test(`02 список пуст @screens`, async ({ page }) => {
      await seedSession(page, { empty: true });
      await shot(page, `02-projects-empty-${scheme}`);
    });

    test(`03 новый проект — каталог дробилок @screens`, async ({ page }) => {
      await seedSession(page, { empty: true });
      await page.getByRole('button', { name: 'Новый проект' }).first().click();
      await expect(page.getByRole('table')).toBeVisible();
      await shot(page, `03-new-project-modal-${scheme}`);
    });

    test(`04 новый проект с выбранной машиной @screens`, async ({ page }) => {
      await seedSession(page, { empty: true });
      await page.getByRole('button', { name: 'Новый проект' }).first().click();
      await fillNewProjectForm(page);
      await shot(page, `04-new-project-filled-${scheme}`);
    });

    test(`05 выбор пробы руды @screens`, async ({ page }) => {
      await seedSession(page, { empty: true });
      await createProject(page);
      await runStepCalc(page);
      await goToWizardStep(page, /Руда/);
      await expect(page.getByRole('dialog', { name: 'Выбор пробы руды' })).toBeVisible();
      await shot(page, `05-catalog-ore-${scheme}`);
    });

    test(`06 визард геометрия со схемой @screens`, async ({ page }) => {
      await seedSession(page, { empty: true });
      await createProject(page);
      /* Чертёж живёт в двух местах: рабочий — в окне ввода, итоговый —
         в отчёте посчитанного этапа. Здесь снимок рабочего, рядом
         с полями. */
      await openStepEditor(page);
      await expect(page.getByTestId('chamber-scheme')).toBeVisible();
      await shot(page, `06-wizard-geometry-${scheme}`);
    });

    test(`07 панель результата @screens`, async ({ page }) => {
      await seedSession(page, { empty: true });
      await createProject(page);
      await runStepCalc(page);
      await expect(page.getByRole('main')).toBeVisible();
      await shot(page, `07-results-drawer-${scheme}`);
    });

    test(`07b отчёт по проекту @screens`, async ({ page }) => {
      await seedSession(page, { empty: true });
      await createProject(page);
      await runStepCalc(page);
      await goToWizardStep(page, /Руда/);
      await pickOre(page);
      await runStepCalc(page);
      // Отчёт собирается на последнем этапе — туда и идём.
      await goToWizardStep(page, /Продукт/);
      await runStepCalc(page);
      await page.getByRole('button', { name: 'Отчёт по проекту' }).click();
      await expect(page.getByRole('dialog', { name: 'Отчёт по проекту' })).toBeVisible();
      await shot(page, `07b-report-builder-${scheme}`);
    });

    test(`08 список с проектом @screens`, async ({ page }) => {
      await seedSession(page, { empty: true });
      await createProject(page);
      await closeStepEditor(page);
      await expect(page.getByRole('table')).toBeVisible();
      await shot(page, `08-projects-list-${scheme}`);
    });

    test(`10 список с примерами @screens`, async ({ page }) => {
      // Без `empty` — тот самый экран, который видит пользователь
      // при первом открытии: заполненный список, фильтры, корзина.
      await seedSession(page);
      await expect(page.getByRole('table')).toBeVisible();
      await shot(page, `10-projects-seeded-${scheme}`);
    });

    test(`11 корзина @screens`, async ({ page }) => {
      await seedSession(page);
      await expect(page.getByRole('table')).toBeVisible();
      await removeFirstProject(page);
      await openTrash(page);
      await shot(page, `11-trash-${scheme}`);
    });

    test(`09 ситовый анализ @screens`, async ({ page }) => {
      await seedSession(page, { empty: true });
      await createProject(page);
      await runStepCalc(page);
      await goToWizardStep(page, /Руда/);
      await pickOre(page);
      await page.getByRole('radio', { name: 'Ситовый анализ' }).check();
      await shot(page, `09-sieve-${scheme}`);
    });
  });
}
