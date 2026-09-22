import { test, expect } from '@playwright/test';
import { SAMPLE_PROJECT, chooseProjectStart, seedSession, watchConsole } from './helpers';

/**
 * Развилка нового инженерного проекта: считаем существующую машину
 * или проектируем новую.
 *
 * Раньше окно открывалось сразу каталогом, и второго случая выразить
 * было нечем — приходилось выбрать какую-нибудь машину и стереть её
 * данные руками. Сценарии ниже проверяют, что ветки действительно
 * расходятся: в одной есть каталог и паспортный диаметр, в другой
 * каталога нет вовсе.
 */
test.describe('Новый проект: с чего начинается расчёт', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page, { empty: true });
    await page.getByRole('button', { name: 'Новый проект' }).first().click();
  });

  test('окно открывается вопросом, а не каталогом', async ({ page }) => {
    const console_ = watchConsole(page);
    const dialog = page.getByRole('dialog', { name: 'Новый проект' });

    await expect(dialog.getByText('С чего начинается расчёт?')).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Расчёт дробилки из каталога' })).toBeVisible();
    await expect(dialog.getByRole('button', { name: 'Новое проектирование' })).toBeVisible();

    // Каталога до ответа нет: в одной из веток его не будет вовсе.
    await expect(dialog.getByRole('table')).toHaveCount(0);

    console_.assertClean();
  });

  test('«Назад» возвращает к развилке, не теряя введённого', async ({ page }) => {
    const dialog = page.getByRole('dialog', { name: 'Новый проект' });

    await chooseProjectStart(page, 'catalog');
    await dialog.getByRole('button', { name: SAMPLE_PROJECT.crusher, exact: true }).click();
    await expect(dialog.getByLabel('Название проекта')).toHaveValue(SAMPLE_PROJECT.crusher);

    await dialog.getByRole('button', { name: 'Назад' }).click();
    await expect(dialog.getByText('С чего начинается расчёт?')).toBeVisible();

    await chooseProjectStart(page, 'catalog');
    await expect(dialog.getByLabel('Название проекта')).toHaveValue(SAMPLE_PROJECT.crusher);
  });

  test('ветка каталога подставляет в геометрию паспортный диаметр машины', async ({ page }) => {
    const dialog = page.getByRole('dialog', { name: 'Новый проект' });

    await chooseProjectStart(page, 'catalog');
    // КМД-3000Т2 — диаметр конуса 3000 мм, а не 2200 по умолчанию.
    await dialog.getByRole('button', { name: 'КМД-3000Т2', exact: true }).click();
    await dialog.getByRole('button', { name: /Заказчик/ }).click();
    await page.getByRole('option', { name: SAMPLE_PROJECT.customer }).click();
    await dialog.getByRole('button', { name: 'Продолжить' }).click();

    const editor = page.getByRole('dialog', { name: /Исходные данные/ });
    await expect(editor).toBeVisible();
    await expect(editor.getByLabel('Диаметр основания D')).toHaveValue('3000');
  });

  test('новое проектирование обходится без каталога и ведёт сразу к геометрии камеры', async ({ page }) => {
    const console_ = watchConsole(page);
    const dialog = page.getByRole('dialog', { name: 'Новый проект' });

    await chooseProjectStart(page, 'blank');

    // Каталога в этой ветке нет — вместо него объяснение, что будет дальше.
    await expect(dialog.getByRole('table')).toHaveCount(0);
    await expect(dialog.getByText('Камера дробления задаётся с нуля')).toBeVisible();

    // Название подсказано — как по выбранной машине в другой ветке.
    await expect(dialog.getByLabel('Название проекта')).toHaveValue('Новая разработка');

    await dialog.getByRole('button', { name: /Заказчик/ }).click();
    await page.getByRole('option', { name: SAMPLE_PROJECT.customer }).click();
    await dialog.getByRole('button', { name: 'Продолжить' }).click();

    const editor = page.getByRole('dialog', { name: /Исходные данные/ });
    await expect(editor).toBeVisible();
    // Значения методики по умолчанию — паспорта, откуда их взять, нет.
    await expect(editor.getByLabel('Диаметр основания D')).toHaveValue('2200');
    // Плашка объекта говорит прямо, что машины из каталога здесь нет.
    await expect(editor.getByText('Новая разработка')).toBeVisible();
    await expect(editor.getByRole('button', { name: 'Выбрать дробилку' })).toBeVisible();

    console_.assertClean();
  });

  test('проект без машины из каталога помечен в списке, а не прочерком', async ({ page }) => {
    const dialog = page.getByRole('dialog', { name: 'Новый проект' });

    await chooseProjectStart(page, 'blank');
    await dialog.getByLabel('Название проекта').fill('Камера 2500');
    await dialog.getByRole('button', { name: /Заказчик/ }).click();
    await page.getByRole('option', { name: SAMPLE_PROJECT.customer }).click();
    await dialog.getByRole('button', { name: 'Продолжить' }).click();

    // Уходим из окна ввода обратно к списку.
    await page.getByRole('dialog', { name: /Исходные данные/ }).getByRole('button', { name: 'Закрыть' }).first().click();
    await expect(page.getByRole('dialog')).toHaveCount(0);

    /* Прочерк в колонке «Дробилка» читался бы как «ещё не выбрали»,
       хотя выбирать здесь нечего и не будут. */
    await expect(page.getByRole('row', { name: /Новая разработка/ })).toBeVisible();
  });
});
