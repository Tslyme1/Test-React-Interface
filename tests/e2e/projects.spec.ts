import { test, expect } from '@playwright/test';
import { SAMPLE_PROJECT, createProject, fillNewProjectForm, seedSession, watchConsole } from './helpers';

test.describe('Список проектов', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page);
  });

  test('пустое состояние предлагает создать первый проект', async ({ page }) => {
    await expect(page.getByText('Проектов пока нет')).toBeVisible();
    await expect(page.getByText('Создайте первый расчёт — он появится в списке.')).toBeVisible();

    // Три входа в создание: иконка «+» в шапке сервиса, кнопка над списком
    // и действие в самом пустом состоянии.
    await expect(page.getByRole('button', { name: 'Новый проект' })).toHaveCount(3);
  });

  test('кнопка создания заблокирована, пока не заполнены обязательные поля', async ({ page }) => {
    await page.getByRole('button', { name: 'Новый проект' }).first().click();

    const submit = page.getByRole('button', { name: 'Создать проект' });
    await expect(submit).toBeDisabled();

    await page.getByRole('dialog').getByLabel('Название проекта').fill('Только название');
    await expect(submit).toBeDisabled();

    await fillNewProjectForm(page);
    await expect(submit).toBeEnabled();
  });

  test('созданный проект появляется в таблице со своими данными', async ({ page }) => {
    const console_ = watchConsole(page);

    await createProject(page);
    await page.getByRole('button', { name: 'Проекты' }).click();

    const row = page.getByRole('row').filter({ hasText: SAMPLE_PROJECT.crusher });
    await expect(row).toBeVisible();
    await expect(row).toContainText(SAMPLE_PROJECT.customer);
    await expect(row).toContainText(SAMPLE_PROJECT.ore);
    await expect(row).toContainText('Иванов Алексей Сергеевич');

    console_.assertClean();
  });

  test('поиск фильтрует строки и показывает пустой результат', async ({ page }) => {
    await createProject(page);
    await page.getByRole('button', { name: 'Проекты' }).click();

    const search = page.getByLabel('Поиск');

    await search.fill(SAMPLE_PROJECT.customer);
    await expect(page.getByRole('row').filter({ hasText: SAMPLE_PROJECT.crusher })).toBeVisible();

    await search.fill('несуществующий заказчик');
    await expect(page.getByText('Ничего не найдено')).toBeVisible();

    await search.fill('');
    await expect(page.getByRole('row').filter({ hasText: SAMPLE_PROJECT.crusher })).toBeVisible();
  });

  test('удаление убирает проект и возвращает пустое состояние', async ({ page }) => {
    await createProject(page);
    await page.getByRole('button', { name: 'Проекты' }).click();

    await page.getByRole('button', { name: 'Удалить проект' }).click();

    await expect(page.getByText('Проектов пока нет')).toBeVisible();
  });

  test('открытие проекта из таблицы ведёт в визард', async ({ page }) => {
    await createProject(page);
    await page.getByRole('button', { name: 'Проекты' }).click();

    await page.getByRole('button', { name: SAMPLE_PROJECT.crusher }).click();

    await expect(page.getByRole('heading', { name: 'Геометрия камеры дробления' })).toBeVisible();
  });
});
