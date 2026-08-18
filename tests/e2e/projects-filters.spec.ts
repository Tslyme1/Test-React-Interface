import { test, expect } from '@playwright/test';
import { openTrash, removeFirstProject, seedSession, watchConsole } from './helpers';

/**
 * Панель фильтров, меню строки и корзина. Все три работают на списке
 * с данными, поэтому здесь примеры первого запуска не отключаются —
 * именно этот экран пользователь и видит, открыв приложение впервые.
 */
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

    await page.getByRole('button', { name: 'Сбросить' }).click();
    await expect(page.getByText(/Проекты: 18 из 18/)).toBeVisible();
  });

  test('фильтр по исполнителю сужает список', async ({ page }) => {
    // `.first()` — колонка «Исполнитель» тоже сортируемая кнопка с тем же именем.
    await page.getByRole('button', { name: 'Исполнитель', exact: true }).first().click();
    await page.getByRole('option', { name: 'Захаров Д.П.' }).click();

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
    await expect(page.getByRole('button', { name: 'Сбросить' })).toBeDisabled();

    await page.getByLabel('Поиск по проектам').fill('КМД');
    await expect(page.getByRole('button', { name: 'Сбросить' })).toBeEnabled();
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
