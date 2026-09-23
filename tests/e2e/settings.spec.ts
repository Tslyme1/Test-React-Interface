import { test, expect } from '@playwright/test';
import { DEMO_USER, seedSession } from './helpers';

/**
 * «Настройки» — данные учётной записи, тема, размер шрифта и режим
 * нового проекта. Пункт назывался «Профиль» до переименования: за ним
 * стоят настройки отображения, а не карточка пользователя.
 * Переключатель здесь, а не в сайдбаре: это настройка, а не переход.
 */
test.describe('Настройки', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page, { empty: true });
    await page.getByRole('button', { name: 'Настройки' }).click();
    await expect(page.getByRole('heading', { name: 'Настройки' })).toBeVisible();
  });

  test('по умолчанию — инженерный режим, «Новый проект» открывает обычную модалку', async ({ page }) => {
    await expect(page.getByRole('option', { name: 'Инженерный' })).toHaveAttribute('aria-selected', 'true');

    await page.getByRole('button', { name: 'Проекты' }).click();
    await page.getByRole('button', { name: 'Новый проект' }).first().click();
    await expect(page.getByRole('dialog', { name: 'Новый проект', exact: true })).toBeVisible();
  });

  test('переключение на «Упрощённый» меняет, что открывает «Новый проект»', async ({ page }) => {
    await page.getByRole('option', { name: 'Упрощённый' }).click();
    // Смена режима спрашивает подтверждение — затрагивает следующий новый проект.
    await page.getByRole('button', { name: 'Сменить' }).click();

    await page.getByRole('button', { name: 'Проекты' }).click();
    await page.getByRole('button', { name: 'Новый проект' }).first().click();
    await expect(page.getByRole('dialog', { name: 'Выбор дробилки' })).toBeVisible();
  });

  test('режим работы — строки с описанием, а не сегмент-контрол', async ({ page }) => {
    await expect(page.getByText('Числа расчёта вводите вы.')).toBeVisible();
    await expect(page.getByText('Числа расчёта подставляются сами.')).toBeVisible();

    await page.getByRole('option', { name: 'Упрощённый' }).click();
    // Смена режима спрашивает подтверждение — до него выбор в списке не меняется.
    await expect(page.getByRole('option', { name: 'Упрощённый' })).toHaveAttribute('aria-selected', 'false');
    await page.getByRole('button', { name: 'Сменить' }).click();

    await expect(page.getByRole('option', { name: 'Упрощённый' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByRole('option', { name: 'Инженерный' })).toHaveAttribute('aria-selected', 'false');
  });

  test('тема — по умолчанию «Как в системе», выбор переживает перезагрузку', async ({ page }) => {
    await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.*/);
    await expect(page.getByRole('option', { name: 'Как в системе' })).toHaveAttribute('aria-selected', 'true');

    await page.getByRole('option', { name: 'Тёмная' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

    await page.reload();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await page.getByRole('button', { name: 'Настройки' }).click();
    await expect(page.getByRole('option', { name: 'Тёмная' })).toHaveAttribute('aria-selected', 'true');
  });

  test('размер шрифта меняет кегли ролей типографики глобально и переживает перезагрузку', async ({ page }) => {
    const bodySize = () =>
      page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--text-body-size').trim());

    await expect(page.getByRole('option', { name: 'Обычный' })).toHaveAttribute('aria-selected', 'true');
    // «Обычный» ничего не переопределяет — значение приходит из токена системы.
    expect(await bodySize()).toBe('14px');

    await page.getByRole('option', { name: 'Очень крупный' }).click();
    expect(await bodySize()).toBe('18.2px');

    await page.reload();
    await page.getByRole('button', { name: 'Настройки' }).click();
    expect(await bodySize()).toBe('18.2px');
    await expect(page.getByRole('option', { name: 'Очень крупный' })).toHaveAttribute('aria-selected', 'true');

    await page.getByRole('option', { name: 'Обычный' }).click();
    expect(await bodySize()).toBe('14px');
  });

  test('после выхода и нового входа открывается список проектов, а не раздел, из которого вышли', async ({ page }) => {
    await seedSession(page);
    await page.getByRole('button', { name: 'Настройки' }).click();
    await expect(page.getByRole('heading', { name: 'Настройки' })).toBeVisible();

    await page.getByRole('button', { name: 'Выйти' }).click();
    await expect(page.getByRole('heading', { name: 'Вход в систему' })).toBeVisible();

    /* Вход прямо здесь, без помощника `login`: тот начинается с `goto`,
       а `seedSession` возвращает сессию в хранилище при каждой загрузке —
       перезагрузка внесла бы пользователя обратно мимо формы. */
    await page.getByLabel('Логин или почта').fill(DEMO_USER.login);
    await page.getByLabel('Пароль').fill(DEMO_USER.password);
    await page.getByRole('button', { name: 'Продолжить' }).click();
    await page.getByRole('button', { name: 'Войти' }).click();

    /* Регрессия: раздел сайдбара жил в состоянии `App` и выход его не
       трогал — следующий вход возвращал туда же, откуда вышли. */
    await expect(page.getByRole('heading', { name: 'Проекты' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Настройки' })).toHaveCount(0);
  });
});
