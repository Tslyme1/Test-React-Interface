import { test, expect } from '@playwright/test';
import type { Locator } from '@playwright/test';
import { createProject, seedSession } from './helpers';

/**
 * Клик по подписи вкладки — прицельно в её видимый текст (у левого края),
 * а не в геометрический центр всей кнопки. `HeaderTab` в дизайн-системе
 * резервирует место под оверлей действий (переименовать/закрыть) внутри
 * той же кнопки, справа (`.tabLabel { padding-inline-end }`) — у короткой
 * подписи вроде «Тест» центр всей кнопки приходится на этот резерв, а не
 * на сам текст, и наведение или клик по умолчанию (в его геометрический
 * центр) может попасть на иконку действия, а не на подпись. Так и должно
 * быть: это тот же оверлей-на-наведении, что и у вкладок браузера, — реальный
 * пользователь целится в видимый текст, а не в невидимый резерв рядом с ним.
 */
async function clickTabLabel(tab: Locator) {
  await tab.click({ position: { x: 12, y: 12 } });
}

/**
 * Наводит на вкладку так, чтобы открыть её действия (переименовать/закрыть),
 * не спотыкаясь о ту же ловушку: наведение по умолчанию целится в центр
 * подписи, который у короткой вкладки может совпасть с местом, где вот-вот
 * появится сама иконка действия, — и `hover()` перестаёт видеть исходную
 * цель под уже показанным поверх неё действием. Наводим в видимый текст
 * слева, действия открываются в любом случае: `:hover` действует на всю
 * вкладку целиком, а не только на подпись.
 */
async function hoverTab(tab: Locator) {
  await tab.hover({ position: { x: 12, y: 12 } });
}

/**
 * Несколько открытых проектов одновременно — как вкладки браузера:
 * открытие следующего не закрывает предыдущий, закрывает вкладку только
 * крестик на ней самой. См. `openTabs`/`shownProjectId` в `App.tsx`.
 */
test.describe('Несколько открытых проектов', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page, { empty: true });
  });

  test('открытие второго проекта не закрывает первый — обе вкладки видны', async ({ page }) => {
    await createProject(page, { name: 'Проект А', customer: 'ЕВРАЗ КГОК', crusher: 'КСД-2200Т', ore: 'Костомукшская' });

    await page.getByRole('button', { name: 'УЗТМ' }).click();
    await expect(page.getByRole('table')).toBeVisible();
    await createProject(page, { name: 'Проект Б', customer: 'Михайловский ГОК', crusher: 'КСД-900Т', ore: 'Костомукшская' });

    await expect(page.getByRole('button', { name: 'Проект А', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Проект Б', exact: true })).toBeVisible();
  });

  test('клик по вкладке переключает на неё, не закрывая другие', async ({ page }) => {
    await createProject(page, { name: 'Проект А', customer: 'ЕВРАЗ КГОК', crusher: 'КСД-2200Т', ore: 'Костомукшская' });
    await page.getByRole('button', { name: 'УЗТМ' }).click();
    await createProject(page, { name: 'Проект Б', customer: 'Михайловский ГОК', crusher: 'КСД-900Т', ore: 'Костомукшская' });

    // Сейчас показан «Проект Б» (открыт последним). Переключаемся на «А».
    await clickTabLabel(page.getByRole('button', { name: 'Проект А', exact: true }));
    await expect(page.getByText('КСД-2200Т', { exact: true })).toBeVisible();

    // «Б» осталась открытой вкладкой, просто не показана.
    await expect(page.getByRole('button', { name: 'Проект Б', exact: true })).toBeVisible();
  });

  test('закрытие вкладки крестиком не трогает соседние', async ({ page }) => {
    await createProject(page, { name: 'Проект А', customer: 'ЕВРАЗ КГОК', crusher: 'КСД-2200Т', ore: 'Костомукшская' });
    await page.getByRole('button', { name: 'УЗТМ' }).click();
    await createProject(page, { name: 'Проект Б', customer: 'Михайловский ГОК', crusher: 'КСД-900Т', ore: 'Костомукшская' });

    await hoverTab(page.getByRole('button', { name: 'Проект Б', exact: true }));
    await page.getByRole('button', { name: 'Закрыть проект: Проект Б' }).click();

    await expect(page.getByRole('button', { name: 'Проект Б', exact: true })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Проект А', exact: true })).toBeVisible();
  });

  test('закрытие показанной вкладки переключает на соседнюю, а не на список', async ({ page }) => {
    await createProject(page, { name: 'Проект А', customer: 'ЕВРАЗ КГОК', crusher: 'КСД-2200Т', ore: 'Костомукшская' });
    await page.getByRole('button', { name: 'УЗТМ' }).click();
    await createProject(page, { name: 'Проект Б', customer: 'Михайловский ГОК', crusher: 'КСД-900Т', ore: 'Костомукшская' });

    // Показан «Б» — закрываем его же.
    await hoverTab(page.getByRole('button', { name: 'Проект Б', exact: true }));
    await page.getByRole('button', { name: 'Закрыть проект: Проект Б' }).click();

    // Соседняя вкладка («А») становится показанной — не список проектов.
    await expect(page.getByRole('heading', { name: 'Геометрия камеры дробления' })).toBeVisible();
    await expect(page.getByText('КСД-2200Т', { exact: true })).toBeVisible();
  });

  test('короткое название вкладки остаётся кликабельным при наведении и после него', async ({ page }) => {
    // Регрессия на Tslyme1/design-system#1: оверлей действий раньше
    // перехватывал клик по подписи, если название вкладки короткое.
    await createProject(page, { name: 'Тест', customer: 'ЕВРАЗ КГОК', crusher: 'КСД-2200Т', ore: 'Костомукшская' });
    await page.getByRole('button', { name: 'УЗТМ' }).click();
    await createProject(page, { name: 'Проект Б', customer: 'Михайловский ГОК', crusher: 'КСД-900Т', ore: 'Костомукшская' });

    const shortTab = page.getByRole('button', { name: 'Тест', exact: true });
    await hoverTab(shortTab);
    await clickTabLabel(shortTab);

    await expect(page.getByText('КСД-2200Т', { exact: true })).toBeVisible();
  });
});
