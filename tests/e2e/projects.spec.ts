import { test, expect } from '@playwright/test';
import {
  SAMPLE_PROJECT,
  createProject,
  fillNewProjectForm,
  pickOre,
  removeFirstProject,
  seedSession,
  watchConsole,
} from './helpers';

test.describe('Список проектов', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page, { empty: true });
  });

  test('пустое состояние предлагает создать первый проект', async ({ page }) => {
    await expect(page.getByText('Проектов пока нет')).toBeVisible();
    await expect(page.getByText('Создайте первый расчёт — он появится в списке.')).toBeVisible();

    // Два входа в создание: иконка «+» в шапке сервиса и действие в самом
    // пустом состоянии. Кнопки над списком здесь нет намеренно — вторая
    // primary на одном экране означала бы, что главное действие не выбрано.
    await expect(page.getByRole('button', { name: 'Новый проект' })).toHaveCount(2);
  });

  test('кнопка создания заблокирована, пока не заполнены обязательные поля', async ({ page }) => {
    await page.getByRole('button', { name: 'Новый проект' }).first().click();

    const submit = page.getByRole('button', { name: 'Продолжить' });
    await expect(submit).toBeDisabled();

    // Одного названия мало: без выбранной машины считать нечего.
    await page.getByRole('dialog').getByLabel('Название проекта').fill('Только название');
    await expect(submit).toBeDisabled();

    await fillNewProjectForm(page);
    await expect(submit).toBeEnabled();
  });

  /**
   * Заказчик — список подсказок, а не закрытый справочник: новых заводят
   * на месте. Проверяется здесь, потому что дефект был не в приложении:
   * `Select` рисовал поле ввода только под `searchable`, и `allowCustom`
   * обещал свободное значение, которое некуда было ввести.
   */
  test('заказчика можно ввести своего, а не только выбрать из списка', async ({ page }) => {
    await page.getByRole('button', { name: 'Новый проект' }).first().click();

    const dialog = page.getByRole('dialog', { name: 'Новый проект' });
    await dialog.getByRole('button', { name: SAMPLE_PROJECT.crusher, exact: true }).click();
    await dialog.getByRole('button', { name: /Заказчик/ }).click();

    await page.getByLabel('Поиск или новое значение').fill('Ковдорский ГОК');
    await page.keyboard.press('Enter');

    // Имя триггера — подпись поля («Заказчик»), поэтому значение проверяется
    // по тексту внутри него, а не по доступному имени.
    await expect(dialog.getByRole('button', { name: /Заказчик/ })).toContainText('Ковдорский ГОК');
    await expect(page.getByRole('button', { name: 'Продолжить' })).toBeEnabled();
  });

  test('созданный проект появляется в таблице со своими данными', async ({ page }) => {
    const console_ = watchConsole(page);

    await createProject(page);
    await page.getByRole('button', { name: 'Проекты' }).click();

    const row = page.getByRole('row').filter({ hasText: SAMPLE_PROJECT.crusher });
    await expect(row).toBeVisible();
    await expect(row).toContainText(SAMPLE_PROJECT.customer);
    // Исполнитель — вошедший пользователь: отдельного поля при создании нет.
    await expect(row).toContainText('Иванов Алексей Сергеевич');
    // Характеристики машины подставлены из каталога сразу, без расчёта.
    await expect(row).toContainText('т/ч');
    // А месторождения ещё нет: пробу руды выбирают на шаге «Грансостав».
    await expect(row).not.toContainText(SAMPLE_PROJECT.ore);

    console_.assertClean();
  });

  test('выбранная на шаге «Грансостав» проба руды попадает в строку таблицы', async ({ page }) => {
    await createProject(page);

    await page.getByRole('button', { name: 'Выполнить расчёт' }).click();
    await page.getByRole('button', { name: /Грансостав/ }).click();
    await pickOre(page);

    await page.getByRole('button', { name: 'Проекты' }).click();

    const row = page.getByRole('row').filter({ hasText: SAMPLE_PROJECT.crusher });
    await expect(row).toContainText(SAMPLE_PROJECT.ore);
  });

  test('поиск фильтрует строки и показывает пустой результат', async ({ page }) => {
    await createProject(page);
    await page.getByRole('button', { name: 'Проекты' }).click();

    const search = page.getByLabel('Поиск по проектам');

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

    await removeFirstProject(page);

    await expect(page.getByText('Проектов пока нет')).toBeVisible();
  });

  test('проекты переживают перезагрузку страницы', async ({ page }) => {
    await createProject(page);
    await page.getByRole('button', { name: 'Проекты' }).click();
    await expect(page.getByRole('row').filter({ hasText: SAMPLE_PROJECT.crusher })).toBeVisible();

    await page.reload();

    await expect(page.getByRole('row').filter({ hasText: SAMPLE_PROJECT.crusher })).toBeVisible();
    await expect(page.getByText('Проектов пока нет')).toBeHidden();
  });

  test('удаление проекта тоже сохраняется', async ({ page }) => {
    await createProject(page);
    await page.getByRole('button', { name: 'Проекты' }).click();
    await removeFirstProject(page);
    await expect(page.getByText('Проектов пока нет')).toBeVisible();

    await page.reload();

    await expect(page.getByText('Проектов пока нет')).toBeVisible();
  });

  test('открытие проекта из таблицы ведёт в визард', async ({ page }) => {
    await createProject(page);
    await page.getByRole('button', { name: 'Проекты' }).click();

    await page.getByRole('button', { name: SAMPLE_PROJECT.crusher, exact: true }).click();

    await expect(page.getByRole('heading', { name: 'Геометрия камеры дробления' })).toBeVisible();
  });
});
