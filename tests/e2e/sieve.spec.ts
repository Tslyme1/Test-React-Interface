import { test, expect, type Page } from '@playwright/test';
import { createProject, pickOre, seedSession, watchConsole } from './helpers';

/**
 * Доходит до шага «Продукт»: расчёт шага «Геометрия» открывает «Грансостав»,
 * расчёт «Грансостава» открывает «Продукт» (см. `available()` в `WizardPage`).
 */
async function goToProdStep(page: Page) {
  await page.getByRole('button', { name: 'Выполнить расчёт' }).click();
  await page.getByRole('button', { name: /Грансостав/ }).click();
  // «Грансостав» закрыт заглушкой, пока не выбрана проба руды.
  await pickOre(page);
  await page.getByRole('button', { name: 'Выполнить расчёт' }).click();
  await page.getByRole('button', { name: /Продукт/ }).click();
  await expect(page.getByRole('heading', { name: 'Грансостав продукта и усилия' })).toBeVisible();
}

test.describe('Ситовый анализ на шаге «Продукт»', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page, { empty: true });
    await createProject(page);
    await goToProdStep(page);
  });

  test('по умолчанию — прямой ввод a₀ и Va₀', async ({ page }) => {
    await expect(page.getByRole('radio', { name: 'Прямой ввод' })).toBeChecked();
    await expect(page.getByLabel('Среднее относительное длины куска a₀')).toBeVisible();
    await expect(page.getByLabel('Коэффициент вариации длины Va₀')).toBeVisible();
  });

  test('переключатель уводит в ситовый анализ и показывает пустое состояние', async ({ page }) => {
    const console_ = watchConsole(page);

    await page.getByRole('radio', { name: 'Ситовый анализ' }).check();

    await expect(page.getByText('Нет классов крупности')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Добавить класс' })).toBeVisible();
    // Поля прямого ввода в этом режиме не показываются — способ выбран однозначно.
    await expect(page.getByLabel('Среднее относительное длины куска a₀')).toHaveCount(0);

    console_.assertClean();
  });

  test('добавление и удаление строки класса крупности', async ({ page }) => {
    await page.getByRole('radio', { name: 'Ситовый анализ' }).check();
    await page.getByRole('button', { name: 'Добавить класс' }).click();

    await expect(page.getByLabel('Класс крупности, строка 1')).toBeVisible();
    await expect(page.getByText('Нет классов крупности')).toHaveCount(0);

    await page.getByRole('button', { name: 'Удалить строку 1' }).click();
    await expect(page.getByText('Нет классов крупности')).toBeVisible();
  });

  test('ситовый анализ считает выход классов, суммы, d̄, σ, a₀ и Va₀', async ({ page }) => {
    const console_ = watchConsole(page);

    await page.getByRole('radio', { name: 'Ситовый анализ' }).check();

    await page.getByRole('button', { name: 'Добавить класс' }).click();
    await page.getByLabel('Класс крупности, строка 1').fill('-2+1');
    await page.getByLabel('Масса класса, строка 1, г').fill('100');

    await page.getByRole('button', { name: 'Добавить класс' }).click();
    await page.getByLabel('Класс крупности, строка 2').fill('-1+0,5');
    await page.getByLabel('Масса класса, строка 2, г').fill('100');

    // Выход классов: масса поровну — по 50%. Накопленные суммы идут
    // от 100% по минусу к 100% по плюсу.
    await expect(page.getByText('γᵢ 50,0').first()).toBeVisible();
    await expect(page.getByText('Σ+ 50,0')).toBeVisible();
    await expect(page.getByText('Σ− 100,0')).toBeVisible();
    await expect(page.getByText('Σ+ 100,0')).toBeVisible();
    await expect(page.getByText('Σ− 50,0')).toBeVisible();

    await expect(page.getByText('200,0 г')).toBeVisible();

    // d̄ = (50·1,5 + 50·0,75) / 100 = 1,125; σ = 0,375; dmax = 2.
    await expect(page.getByText('1.125 мм')).toBeVisible();
    await expect(page.getByText('0.375 мм')).toBeVisible();
    // a₀ = d̄/dmax = 0,5625 → 0.563; Va₀ = σ/d̄ = 0,3(3) → 0.333.
    await expect(page.getByText('0.563', { exact: true })).toBeVisible();
    await expect(page.getByText('0.333', { exact: true })).toBeVisible();

    console_.assertClean();
  });

  test('«Записать a₀ и Va₀ в параметры» переносит значения в прямой ввод и показывает тост', async ({ page }) => {
    await page.getByRole('radio', { name: 'Ситовый анализ' }).check();
    await page.getByRole('button', { name: 'Добавить класс' }).click();
    await page.getByLabel('Класс крупности, строка 1').fill('-2+1');
    await page.getByLabel('Масса класса, строка 1, г').fill('100');
    await page.getByRole('button', { name: 'Добавить класс' }).click();
    await page.getByLabel('Класс крупности, строка 2').fill('-1+0,5');
    await page.getByLabel('Масса класса, строка 2, г').fill('100');

    await page.getByRole('button', { name: 'Записать a₀ и Va₀ в параметры' }).click();

    await expect(page.getByText('Записано в параметры: a₀ = 0.563, Va₀ = 0.333')).toBeVisible();

    await page.getByRole('radio', { name: 'Прямой ввод' }).check();
    await expect(page.getByLabel('Среднее относительное длины куска a₀')).toHaveValue('0.563');
    await expect(page.getByLabel('Коэффициент вариации длины Va₀')).toHaveValue('0.333');
  });

  test('действие записи в параметры недоступно без введённой массы', async ({ page }) => {
    await page.getByRole('radio', { name: 'Ситовый анализ' }).check();
    await page.getByRole('button', { name: 'Добавить класс' }).click();
    await page.getByLabel('Класс крупности, строка 1').fill('-2+1');

    await expect(page.getByRole('button', { name: 'Записать a₀ и Va₀ в параметры' })).toBeDisabled();
  });

  test('ситовая таблица и способ ввода переживают переход на другой шаг и обратно', async ({ page }) => {
    await page.getByRole('radio', { name: 'Ситовый анализ' }).check();
    await page.getByRole('button', { name: 'Добавить класс' }).click();
    await page.getByLabel('Класс крупности, строка 1').fill('-2+1');
    await page.getByLabel('Масса класса, строка 1, г').fill('100');
    await page.getByRole('button', { name: 'Добавить класс' }).click();
    await page.getByLabel('Класс крупности, строка 2').fill('-1+0,5');
    await page.getByLabel('Масса класса, строка 2, г').fill('100');

    await page.getByRole('button', { name: /Геометрия/ }).click();
    await expect(page.getByRole('heading', { name: 'Геометрия камеры дробления' })).toBeVisible();

    await page.getByRole('button', { name: /Продукт/ }).click();
    await expect(page.getByRole('heading', { name: 'Грансостав продукта и усилия' })).toBeVisible();

    // Способ ввода остался «Ситовый анализ», строки и посчитанные по ним
    // величины на месте — состояние живёт в `ProdData`, а не в самом шаге.
    await expect(page.getByRole('radio', { name: 'Ситовый анализ' })).toBeChecked();
    await expect(page.getByLabel('Класс крупности, строка 1')).toHaveValue('-2+1');
    await expect(page.getByLabel('Масса класса, строка 1, г')).toHaveValue('100');
    await expect(page.getByLabel('Класс крупности, строка 2')).toHaveValue('-1+0,5');
    await expect(page.getByLabel('Масса класса, строка 2, г')).toHaveValue('100');
    await expect(page.getByText('1.125 мм')).toBeVisible();

    // Записанные a₀/Va₀ тоже пережили переход и видны при возврате к прямому вводу.
    await page.getByRole('button', { name: 'Записать a₀ и Va₀ в параметры' }).click();
    await page.getByRole('button', { name: /Геометрия/ }).click();
    await page.getByRole('button', { name: /Продукт/ }).click();
    await page.getByRole('radio', { name: 'Прямой ввод' }).check();
    await expect(page.getByLabel('Среднее относительное длины куска a₀')).toHaveValue('0.563');
    await expect(page.getByLabel('Коэффициент вариации длины Va₀')).toHaveValue('0.333');
  });
});
