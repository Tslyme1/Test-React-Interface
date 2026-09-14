import { test, expect, type Page } from '@playwright/test';
import { closeStepEditor, createProject, goToWizardStep, pickOre, runStepCalc, seedSession, watchConsole } from './helpers';

/**
 * Доходит до шага «Грансостав»: расчёт шага «Геометрия» открывает его,
 * а выбор пробы снимает заглушку (см. `available()` в `WizardPage`).
 */
async function goToGranStep(page: Page) {
  await runStepCalc(page);
  await goToWizardStep(page, /Руда/);
  await pickOre(page);
  await expect(page.getByRole('dialog', { name: 'Исходные данные: Руда' })).toBeVisible();
}

/** Убирает все строки (включая заготовку по умолчанию) — дальше тест заводит свои. */
async function clearRows(page: Page) {
  while ((await page.getByRole('button', { name: /Удалить строку/ }).count()) > 0) {
    await page.getByRole('button', { name: /Удалить строку/ }).first().click();
  }
}

/**
 * Две строки классов «-2+1» и «-1+0,5» с введённым «по минусу» — тот же
 * пример, что раньше проверялся через массу класса (равный вклад, 50/50),
 * пересобранный под текущую боковую границу: по минусу растёт к самому
 * крупному классу (50 у row1, 0 у row2, — ничего мельче row2 нет).
 */
async function fillTwoClasses(page: Page) {
  await clearRows(page);
  await page.getByRole('button', { name: 'Добавить класс' }).click();
  await page.getByLabel('Класс крупности, строка 1').fill('-2+1');
  await page.getByLabel('По минусу, строка 1, %').fill('50');
  await page.getByRole('button', { name: 'Добавить класс' }).click();
  await page.getByLabel('Класс крупности, строка 2').fill('-1+0,5');
  await page.getByLabel('По минусу, строка 2, %').fill('0');
}

test.describe('Ситовый анализ на шаге «Грансостав»', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page, { empty: true });
    await createProject(page);
    await goToGranStep(page);
  });

  test('по умолчанию — прямой ввод a₀ и Va₀', async ({ page }) => {
    await expect(page.getByRole('radio', { name: 'Прямой ввод' })).toBeChecked();
    await expect(page.getByLabel('Среднее относительное длины куска a₀')).toBeVisible();
    await expect(page.getByLabel('Коэффициент вариации длины Va₀')).toBeVisible();
  });

  test('переключатель уводит в ситовый анализ и показывает классы крупности по умолчанию', async ({ page }) => {
    const console_ = watchConsole(page);

    await page.getByRole('radio', { name: 'Ситовый анализ' }).check();

    // Таблица не пустая по умолчанию — классы крупности уже заданы,
    // вводить остаётся только выход.
    await expect(page.getByText('Нет классов крупности')).toHaveCount(0);
    await expect(page.getByLabel('Класс крупности, строка 1')).toHaveValue('-300+150');
    // Поля прямого ввода в этом режиме не показываются — способ выбран однозначно.
    await expect(page.getByLabel('Среднее относительное длины куска a₀')).toHaveCount(0);

    console_.assertClean();
  });

  test('добавление и удаление строки класса крупности', async ({ page }) => {
    await page.getByRole('radio', { name: 'Ситовый анализ' }).check();
    await clearRows(page);
    await expect(page.getByText('Нет классов крупности')).toBeVisible();

    await page.getByRole('button', { name: 'Добавить класс' }).click();
    await expect(page.getByLabel('Класс крупности, строка 1')).toBeVisible();

    await page.getByRole('button', { name: 'Удалить строку 1' }).click();
    await expect(page.getByText('Нет классов крупности')).toBeVisible();
  });

  test('по умолчанию вводится «по минусу» — по плюсу и частные классы считаются сами и недоступны для ввода', async ({ page }) => {
    await page.getByRole('radio', { name: 'Ситовый анализ' }).check();

    await expect(page.getByRole('radio', { name: 'По минусу' })).toBeChecked();
    await expect(page.getByLabel('По минусу, строка 1, %')).toBeVisible();
    await expect(page.getByLabel('По плюсу, строка 1, %')).toHaveCount(0);
    await expect(page.getByLabel('Частные классы, строка 1, %')).toHaveCount(0);
  });

  test('ситовый анализ считает выход классов, суммы, d̄, σ, a₀ и Va₀', async ({ page }) => {
    const console_ = watchConsole(page);

    await page.getByRole('radio', { name: 'Ситовый анализ' }).check();
    await fillTwoClasses(page);

    // По плюсу и частные классы — пересчитаны сами, каждая в своей колонке:
    // по минусу 50/0 даёт по плюсу 50/100 и частные классы 50/50 — «50,0»
    // встречается трижды (плюс строки 1, частные строки 1 и 2), «100,0» один раз.
    await expect(page.getByText('50,0', { exact: true })).toHaveCount(3);
    await expect(page.getByText('100,0', { exact: true })).toBeVisible();

    // d̄ = (50·1,5 + 50·0,75) / 100 = 1,125; σ = 0,375; dmax = 2.
    await expect(page.getByText('1.125 мм')).toBeVisible();
    await expect(page.getByText('0.375 мм')).toBeVisible();
    // a₀ = d̄/dmax = 0,5625 → 0.563; Va₀ = σ/d̄ = 0,3(3) → 0.333.
    await expect(page.getByText('0.563', { exact: true })).toBeVisible();
    await expect(page.getByText('0.333', { exact: true })).toBeVisible();

    console_.assertClean();
  });

  test('переключение «что вводить» переносит уже введённые значения, а не стирает их', async ({ page }) => {
    await page.getByRole('radio', { name: 'Ситовый анализ' }).check();
    await clearRows(page);
    await page.getByRole('button', { name: 'Добавить класс' }).click();
    await page.getByLabel('Класс крупности, строка 1').fill('-2+1');
    await page.getByLabel('По минусу, строка 1, %').fill('30');

    await page.getByRole('radio', { name: 'По плюсу' }).check();
    // По минусу = 30 → по плюсу = 100 − 30 = 70.
    await expect(page.getByLabel('По плюсу, строка 1, %')).toHaveValue('70');
  });

  test('действие записи в параметры недоступно без введённого выхода', async ({ page }) => {
    await page.getByRole('radio', { name: 'Ситовый анализ' }).check();
    await clearRows(page);
    await page.getByRole('button', { name: 'Добавить класс' }).click();
    await page.getByLabel('Класс крупности, строка 1').fill('-2+1');

    await expect(page.getByRole('button', { name: 'Записать a₀ и Va₀ в параметры' })).toBeDisabled();
  });

  test('«Записать a₀ и Va₀ в параметры» переносит значения в прямой ввод и показывает тост', async ({ page }) => {
    await page.getByRole('radio', { name: 'Ситовый анализ' }).check();
    await fillTwoClasses(page);

    await page.getByRole('button', { name: 'Записать a₀ и Va₀ в параметры' }).click();

    await expect(page.getByText('Записано в параметры: a₀ = 0.563, Va₀ = 0.333')).toBeVisible();

    await page.getByRole('radio', { name: 'Прямой ввод' }).check();
    await expect(page.getByLabel('Среднее относительное длины куска a₀')).toHaveValue('0.563');
    await expect(page.getByLabel('Коэффициент вариации длины Va₀')).toHaveValue('0.333');
  });

  test('ситовая таблица и способ ввода переживают переход на другой шаг и обратно', async ({ page }) => {
    await page.getByRole('radio', { name: 'Ситовый анализ' }).check();
    await fillTwoClasses(page);

    /* Степпер живёт в футере страницы — окно ввода его перекрывает.
       Переход на непосчитанный этап открывает окно снова сам. */
    await closeStepEditor(page);
    await goToWizardStep(page, /Дробилка/);
    await expect(page.getByRole('heading', { name: 'Геометрия камеры' })).toBeVisible();

    await closeStepEditor(page);
    await goToWizardStep(page, /Руда/);
    await expect(page.getByRole('dialog', { name: 'Исходные данные: Руда' })).toBeVisible();

    // Способ ввода остался «Ситовый анализ», строки и посчитанные по ним
    // величины на месте — состояние живёт в `GranData`, а не в самом шаге.
    await expect(page.getByRole('radio', { name: 'Ситовый анализ' })).toBeChecked();
    await expect(page.getByLabel('Класс крупности, строка 1')).toHaveValue('-2+1');
    await expect(page.getByLabel('По минусу, строка 1, %')).toHaveValue('50');

    // Записанные a₀/Va₀ тоже пережили переход и видны при возврате к прямому вводу.
    await page.getByRole('button', { name: 'Записать a₀ и Va₀ в параметры' }).click();
    await closeStepEditor(page);
    await goToWizardStep(page, /Дробилка/);
    await closeStepEditor(page);
    await goToWizardStep(page, /Руда/);
    await page.getByRole('radio', { name: 'Прямой ввод' }).check();
    await expect(page.getByLabel('Среднее относительное длины куска a₀')).toHaveValue('0.563');
  });
});
