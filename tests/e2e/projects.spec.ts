import { test, expect } from '@playwright/test';
import { SAMPLE_PROJECT, chooseProjectStart, closeStepEditor, createProject, fillNewProjectForm, goToWizardStep, pickOre, removeFirstProject, runStepCalc, seedSession, watchConsole } from './helpers';

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
    await chooseProjectStart(page);

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
    await chooseProjectStart(page);

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
    await closeStepEditor(page);
    await page.getByRole('button', { name: 'УЗТМ' }).click();

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
    await runStepCalc(page);
    await goToWizardStep(page, /Руда/);
    await pickOre(page);
    await closeStepEditor(page);

    await page.getByRole('button', { name: 'УЗТМ' }).click();

    const row = page.getByRole('row').filter({ hasText: SAMPLE_PROJECT.crusher });
    await expect(row).toContainText(SAMPLE_PROJECT.ore);
  });

  test('в окне «Руда» слева — паспорт выбранной пробы, и правится он здесь же', async ({ page }) => {
    await createProject(page);
    await runStepCalc(page);
    await goToWizardStep(page, /Руда/);
    await pickOre(page);

    const editor = page.getByRole('dialog', { name: 'Ввод данных руды' });
    const table = editor.getByRole('table', { name: `Параметры пробы: ${SAMPLE_PROJECT.ore}` });
    await expect(table.getByRole('row', { name: /Плотность, ρ, т\/м³\s*3\.35/ })).toBeVisible();

    // Правка — только выбранной пробы: карандаш стоит в её строке, первой в таблице.
    await expect(table.getByRole('row').nth(1)).toContainText(SAMPLE_PROJECT.ore);
    await table.getByRole('button', { name: `Редактировать: проба руды ${SAMPLE_PROJECT.ore}` }).click();
    const form = page.getByRole('dialog', { name: 'Проба руды: правка данных' });
    await form.getByLabel('ρ, т/м³', { exact: true }).fill('3.4');
    await form.getByRole('button', { name: 'Сохранить' }).click();
    await expect(form).toHaveCount(0);
    await expect(table.getByRole('row', { name: /Плотность, ρ, т\/м³\s*3\.4/ })).toBeVisible();
    // Окно ввода при этом не закрылось — правка шла поверх него.
    await expect(editor).toBeVisible();
  });

  test('на странице этапа правка данных дробилки — карандашом в её строке сводки', async ({ page }) => {
    await createProject(page);
    await runStepCalc(page);

    const summary = page.getByRole('table', { name: 'Исходные данные' });
    const row = summary.getByRole('row', { name: new RegExp(`Дробилка\\s*${SAMPLE_PROJECT.crusher}`) });
    await row.getByRole('button', { name: `Редактировать: дробилка ${SAMPLE_PROJECT.crusher}` }).click();
    await expect(page.getByRole('dialog', { name: 'Дробилка: правка данных' })).toBeVisible();
  });

  test('поиск фильтрует строки и показывает пустой результат', async ({ page }) => {
    await createProject(page);
    await closeStepEditor(page);
    await page.getByRole('button', { name: 'УЗТМ' }).click();

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
    await closeStepEditor(page);
    await page.getByRole('button', { name: 'УЗТМ' }).click();

    await removeFirstProject(page);

    await expect(page.getByText('Проектов пока нет')).toBeVisible();
  });

  test('проекты переживают перезагрузку страницы', async ({ page }) => {
    await createProject(page);
    await closeStepEditor(page);
    await page.getByRole('button', { name: 'УЗТМ' }).click();
    await expect(page.getByRole('row').filter({ hasText: SAMPLE_PROJECT.crusher })).toBeVisible();

    await page.reload();

    await expect(page.getByRole('row').filter({ hasText: SAMPLE_PROJECT.crusher })).toBeVisible();
    await expect(page.getByText('Проектов пока нет')).toBeHidden();
  });

  test('удаление проекта тоже сохраняется', async ({ page }) => {
    await createProject(page);
    await closeStepEditor(page);
    await page.getByRole('button', { name: 'УЗТМ' }).click();
    await removeFirstProject(page);
    await expect(page.getByText('Проектов пока нет')).toBeVisible();

    await page.reload();

    await expect(page.getByText('Проектов пока нет')).toBeVisible();
  });

  test('открытие проекта из таблицы ведёт в визард', async ({ page }) => {
    await createProject(page);
    await closeStepEditor(page);
    await page.getByRole('button', { name: 'УЗТМ' }).click();

    await page.getByRole('button', { name: SAMPLE_PROJECT.crusher, exact: true }).click();

    /* Пока не посчитан ни один этап, проект живёт окном ввода поверх
       списка: страницы у него ещё нет, показывать на ней нечего. */
    await expect(page.getByRole('dialog', { name: 'Исходные данные: Дробилка' })).toBeVisible();
  });
});

test.describe('Список проектов — узкий вьюпорт', () => {
  test('кнопка «Меню» остаётся доступна при горизонтальной прокрутке таблицы', async ({ page }) => {
    // Уже колонок, которые обычно есть у одиннадцатиколоночной таблицы,
    // чем свежий iPhone SE — таблица гарантированно уходит в свою
    // внутреннюю горизонтальную прокрутку (`pinEndKey="actions"`
    // в `ProjectsPage.tsx`).
    await page.setViewportSize({ width: 640, height: 800 });
    await seedSession(page);
    await expect(page.getByRole('table')).toBeVisible();

    const menuButton = page.getByRole('button', { name: /Действия:/ }).first();
    const box = await menuButton.boundingBox();
    const viewport = page.viewportSize();
    expect(box).not.toBeNull();
    expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width);

    // Не просто «в границах вьюпорта» — кнопка нажимается без предварительной
    // прокрутки таблицы вручную.
    await menuButton.click();
    await expect(page.getByRole('button', { name: 'Открыть проект' })).toBeVisible();
  });
});
