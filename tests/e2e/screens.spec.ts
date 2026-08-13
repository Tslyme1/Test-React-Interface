import { test, expect } from '@playwright/test';
import type { Page } from '@playwright/test';
import { createProject, openTrash, removeFirstProject, seedSession } from './helpers';

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

    test(`02 список пуст @screens`, async ({ page }) => {
      await seedSession(page, { empty: true });
      await shot(page, `02-projects-empty-${scheme}`);
    });

    test(`03 новый проект @screens`, async ({ page }) => {
      await seedSession(page, { empty: true });
      await page.getByRole('button', { name: 'Новый проект' }).first().click();
      await expect(page.getByRole('dialog')).toBeVisible();
      await shot(page, `03-new-project-modal-${scheme}`);
    });

    test(`04 выбор дробилки @screens`, async ({ page }) => {
      await seedSession(page, { empty: true });
      await page.getByRole('button', { name: 'Новый проект' }).first().click();
      await page.getByRole('dialog').getByRole('button', { name: /Выбрать из каталога/ }).click();
      await expect(page.getByRole('table')).toBeVisible();
      await shot(page, `04-catalog-crusher-${scheme}`);
    });

    test(`05 выбор пробы руды @screens`, async ({ page }) => {
      await seedSession(page, { empty: true });
      await page.getByRole('button', { name: 'Новый проект' }).first().click();
      await page.getByRole('dialog').getByRole('button', { name: /Выбрать из справочника/ }).click();
      await expect(page.getByRole('table')).toBeVisible();
      await shot(page, `05-catalog-ore-${scheme}`);
    });

    test(`06 визард геометрия со схемой @screens`, async ({ page }) => {
      await seedSession(page, { empty: true });
      await createProject(page);
      await expect(page.getByTestId('chamber-scheme')).toBeVisible();
      await shot(page, `06-wizard-geometry-${scheme}`);
    });

    test(`07 панель результата @screens`, async ({ page }) => {
      await seedSession(page, { empty: true });
      await createProject(page);
      await page.getByRole('button', { name: 'Выполнить расчёт' }).click();
      await page.getByRole('button', { name: 'Смотреть результат' }).click();
      await expect(page.getByRole('dialog', { name: /Результат/ })).toBeVisible();
      await shot(page, `07-results-drawer-${scheme}`);
    });

    test(`08 список с проектом @screens`, async ({ page }) => {
      await seedSession(page, { empty: true });
      await createProject(page);
      await page.getByRole('button', { name: 'Проекты' }).click();
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
      await page.getByRole('button', { name: 'Выполнить расчёт' }).click();
      await page.getByRole('button', { name: /Грансостав/ }).click();
      await page.getByRole('button', { name: 'Выполнить расчёт' }).click();
      await page.getByRole('button', { name: /Продукт/ }).click();
      await page.getByRole('radio', { name: 'Ситовый анализ' }).check();
      await shot(page, `09-sieve-${scheme}`);
    });
  });
}
