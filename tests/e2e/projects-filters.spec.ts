import { test, expect, type Page } from '@playwright/test';
import { createProject, openTrash, removeFirstProject, seedSession, watchConsole } from './helpers';

/**
 * Панель фильтров, меню строки и корзина. Все три работают на списке
 * с данными, поэтому здесь примеры первого запуска не отключаются —
 * именно этот экран пользователь и видит, открыв приложение впервые.
 */
/**
 * Панель «Фильтры». Часть фильтров при узком окне уходит из строки, и
 * добраться до них можно только отсюда — поэтому сценарии, которым нужен
 * конкретный фильтр, открывают панель, а не полагаются на то, что контрол
 * оказался виден.
 */
function filtersDrawer(page: Page) {
  return page.getByRole('dialog', { name: 'Фильтры' });
}

async function openFilters(page: Page) {
  await page.getByRole('button', { name: /^Фильтры/ }).click();
  const drawer = filtersDrawer(page);
  await expect(drawer).toBeVisible();
  return drawer;
}

test.describe('Главный экран со списком проектов', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page);
    await expect(page.getByRole('table')).toBeVisible();
  });

  test('при первом запуске список заполнен примерами', async ({ page }) => {
    const console_ = watchConsole(page);

    await expect(page.getByText(/Проекты: 18 из 18/)).toBeVisible();
    // Колонки, которых не было в первой версии экрана.
    await expect(page.getByRole('columnheader', { name: 'Месторождение' })).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Руда, вход' })).toBeVisible();

    console_.assertClean();
  });

  test('фильтр по дробилке сужает список, сброс возвращает всё', async ({ page }) => {
    // `.first()`, а не `exact`: колонка «Дробилка» сортируемая и тоже кнопка
    // с тем же именем — фильтр в разметке идёт раньше таблицы.
    await page.getByRole('button', { name: 'Дробилка', exact: true }).first().click();
    await page.getByRole('option', { name: 'КМД-1350Т' }).click();

    await expect(page.getByText(/Проекты: 1 из 18/)).toBeVisible();

    // Сброс живёт в панели «Фильтры», рядом с тем, что он сбрасывает.
    const drawer = await openFilters(page);
    await drawer.getByRole('button', { name: 'Сбросить' }).click();
    await drawer.getByRole('button', { name: 'Готово' }).click();

    await expect(page.getByText(/Проекты: 18 из 18/)).toBeVisible();
  });

  test('фильтр по исполнителю сужает список', async ({ page }) => {
    // Через панель, а не через строку: «Исполнитель» уходит из строки первым,
    // и на стандартной ширине окна теста его там уже нет.
    const drawer = await openFilters(page);
    await drawer.getByLabel('Исполнитель').click();
    await page.getByRole('option', { name: 'Захаров Д.П.' }).click();
    await drawer.getByRole('button', { name: 'Готово' }).click();

    const caption = page.getByText(/Проекты: \d+ из 18/);
    await expect(caption).toBeVisible();
    await expect(caption).not.toContainText('18 из 18');
  });

  test('поиск и фильтр складываются, а не заменяют друг друга', async ({ page }) => {
    await page.getByRole('button', { name: 'Тег', exact: true }).click();
    await page.getByRole('option', { name: 'Рабочий' }).click();

    await page.getByLabel('Поиск по проектам').fill('несуществующее');
    await expect(page.getByText('Ничего не найдено')).toBeVisible();

    // Сброс из пустого состояния возвращает и поиск, и фильтр.
    await page.getByRole('button', { name: 'Сбросить фильтры' }).click();
    await expect(page.getByText(/Проекты: 18 из 18/)).toBeVisible();
  });

  test('кнопка сброса неактивна, пока ничего не отобрано', async ({ page }) => {
    const drawer = await openFilters(page);
    await expect(drawer.getByRole('button', { name: 'Сбросить' })).toBeDisabled();

    await drawer.getByLabel('Поиск по проектам').fill('КМД');
    await expect(drawer.getByRole('button', { name: 'Сбросить' })).toBeEnabled();
  });

  test('кнопка «Фильтры» показывает, сколько условий применено', async ({ page }) => {
    await expect(page.getByRole('button', { name: 'Фильтры', exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Тег', exact: true }).click();
    await page.getByRole('option', { name: 'Рабочий' }).click();

    await expect(page.getByRole('button', { name: 'Фильтры: 1' })).toBeVisible();
  });

  test('при сужении окна фильтры уходят из строки по одному, а не переносятся', async ({ page }) => {
    // По атрибуту очереди, а не по имени: колонка «Исполнитель» в таблице —
    // тоже кнопка с тем же именем, и когда фильтр уходит из строки, поиск
    // по имени незаметно переключается на заголовок колонки.
    const executor = page.locator('[data-filter-priority="5"]');
    const search = page.getByLabel('Поиск по проектам');

    // Широкое окно: в строке все шесть контролов.
    await page.setViewportSize({ width: 1600, height: 900 });
    await expect(executor).toBeVisible();
    await expect(search).toBeVisible();

    // Узкое: «Исполнитель» ушёл, поиск и кнопка остались.
    await page.setViewportSize({ width: 1000, height: 900 });
    await expect(executor).toBeHidden();
    await expect(search).toBeVisible();
    await expect(page.getByRole('button', { name: /^Фильтры/ })).toBeVisible();

    // Ушедший фильтр доступен в панели — доступ к нему не теряется.
    const drawer = await openFilters(page);
    await expect(drawer.getByLabel('Исполнитель')).toBeVisible();
  });
});

test.describe('Корзина', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page);
    await expect(page.getByRole('table')).toBeVisible();
  });

  test('удаление из меню строки уводит проект в корзину, а не стирает', async ({ page }) => {
    await expect(page.getByText(/Проекты: 18 из 18/)).toBeVisible();

    await removeFirstProject(page);
    await expect(page.getByText(/Проекты: 17 из 17/)).toBeVisible();

    await openTrash(page);
    await expect(page.getByRole('dialog', { name: 'Корзина — 1' })).toBeVisible();
  });

  test('восстановление возвращает проект в список', async ({ page }) => {
    await removeFirstProject(page);
    await openTrash(page);

    await page.getByRole('button', { name: 'Восстановить' }).click();
    await expect(page.getByText('Корзина пуста')).toBeVisible();

    // Esc, а не кнопка: «Закрыть» есть и у крестика окна, и в футере,
    // и по имени они неразличимы. Заодно проверяется закрытие с клавиатуры.
    await page.keyboard.press('Escape');
    await expect(page.getByText(/Проекты: 18 из 18/)).toBeVisible();
  });

  test('безвозвратное удаление убирает проект из корзины', async ({ page }) => {
    await removeFirstProject(page);
    await openTrash(page);

    await page.getByRole('button', { name: /^Удалить безвозвратно:/ }).click();
    await expect(page.getByText('Корзина пуста')).toBeVisible();

    // Esc, а не кнопка: «Закрыть» есть и у крестика окна, и в футере,
    // и по имени они неразличимы. Заодно проверяется закрытие с клавиатуры.
    await page.keyboard.press('Escape');
    await expect(page.getByText(/Проекты: 17 из 17/)).toBeVisible();
  });

  test('содержимое корзины переживает перезагрузку', async ({ page }) => {
    await removeFirstProject(page);
    await page.reload();

    await openTrash(page);
    await expect(page.getByRole('dialog', { name: 'Корзина — 1' })).toBeVisible();
  });

  test('пустая корзина объясняет, что удалённое не пропадает сразу', async ({ page }) => {
    await openTrash(page);
    await expect(page.getByText('Корзина пуста')).toBeVisible();
    await expect(page.getByText('Удалённые проекты попадают сюда, и их можно вернуть.')).toBeVisible();
  });
});

test.describe('Печать по шагам из меню строки', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page, { empty: true });
    await createProject(page);
  });

  test('пункт печати появляется только для посчитанных шагов', async ({ page }) => {
    await page.getByRole('button', { name: 'Проекты' }).click();

    await page.getByRole('button', { name: /^Действия:/ }).first().click();
    await expect(page.getByRole('button', { name: /^Печать:/ })).toHaveCount(0);
  });

  test('печать открывает отчёт с таблицей посчитанного шага', async ({ page }) => {
    await page.getByRole('button', { name: 'Выполнить расчёт' }).click();
    await page.getByRole('button', { name: 'Проекты' }).click();

    await page.getByRole('button', { name: /^Действия:/ }).first().click();
    // Посчитан только первый шаг — пункт печати ровно один.
    await expect(page.getByRole('button', { name: /^Печать:/ })).toHaveCount(1);

    const [popup] = await Promise.all([
      page.waitForEvent('popup'),
      page.getByRole('button', { name: 'Печать: Геометрия' }).click(),
    ]);
    await expect(popup.locator('h1')).toHaveText('Результат: геометрия камеры дробления');
    await expect(popup.locator('table')).toContainText('D/2');
    await popup.close();
  });
});
