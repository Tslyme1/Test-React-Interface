import { test, expect } from '@playwright/test';
import { DEMO_USER, login, watchConsole } from './helpers';

test.describe('Вход', () => {
  test('первый шаг — учётные данные, переход заблокирован до заполнения', async ({ page }) => {
    const console_ = watchConsole(page);
    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'Вход в систему' })).toBeVisible();
    await expect(page.getByRole('img', { name: 'УЗТМ' })).toBeVisible();

    // Режим на первом шаге не спрашивают — он живёт на втором.
    await expect(page.getByRole('radio', { name: 'Инженерный' })).toHaveCount(0);

    const next = page.getByRole('button', { name: 'Продолжить' });
    await expect(next).toBeDisabled();

    await page.getByLabel('Логин или почта').fill(DEMO_USER.login);
    await expect(next).toBeDisabled();

    await page.getByLabel('Пароль').fill(DEMO_USER.password);
    await expect(next).toBeEnabled();

    console_.assertClean();
  });

  test('второй шаг объясняет, чем режимы отличаются друг от друга', async ({ page }) => {
    const console_ = watchConsole(page);
    await page.goto('/');

    await page.getByLabel('Логин или почта').fill(DEMO_USER.login);
    await page.getByLabel('Пароль').fill(DEMO_USER.password);
    await page.getByRole('button', { name: 'Продолжить' }).click();

    await expect(page.getByRole('heading', { name: 'Режим работы' })).toBeVisible();

    /* Сводки построены одинаково и различаются одним словом — откуда
       берутся числа расчёта. Это и есть разница между режимами, ради
       которой шаг отделён от логина с паролем. */
    await expect(page.getByText('Числа расчёта вводите вы.')).toBeVisible();
    await expect(page.getByText('Числа расчёта подставляются сами.')).toBeVisible();
    await expect(page.getByText('Вручную — только крупность продукта')).toBeVisible();

    /* Формулировки выверены по коду: в инженерном режиме из каталога
       приходит ровно диаметр основания, и обещать, что не подставляется
       ничего, карточка не имеет права. */
    await expect(page.getByText('Из каталога приходит только диаметр машины')).toBeVisible();
    await expect(page.getByText(/Ни одно значение не подставляется/)).toHaveCount(0);

    /* Общее для обоих режимов в пунктах не упоминается: печать и чертёж
       есть и там и там, и раньше они стояли в списке различий, ничего
       не различая. */
    for (const common of [/Печать/, /Чертёж/, /Excel/, /КОМПАС/]) {
      await expect(page.getByText(common)).toHaveCount(0);
    }

    /* Подписи группы на экране нет: заголовок уже назвал его «Режимом
       работы», и повтор под ним только удваивал высоту шапки. Скринридеру
       группа подписана — `aria-label`, а не видимая `legend`. */
    await expect(page.getByText('Режим работы нового проекта')).toHaveCount(0);
    await expect(page.getByRole('radiogroup', { name: 'Режим работы нового проекта' })).toBeVisible();

    /* Возврата к логину с паролем на этом шаге нет: из него либо входят,
       либо не входят, и вторая кнопка рядом с главной предлагала бы
       отменить то, что ещё не сделано. */
    await expect(page.getByRole('button', { name: 'Назад' })).toHaveCount(0);

    console_.assertClean();
  });

  test('вход ведёт к списку проектов и показывает имя пользователя в профиле', async ({ page }) => {
    const console_ = watchConsole(page);
    await login(page);

    // Имя — в «Профиле», не в шапке: там сессия долетела до раздела приложения.
    await page.getByRole('button', { name: 'Настройки' }).click();
    await expect(page.getByText(DEMO_USER.name)).toBeVisible();
    console_.assertClean();
  });

  test('сессия переживает перезагрузку страницы', async ({ page }) => {
    await login(page);
    await page.reload();

    await expect(page.getByRole('heading', { name: 'Проекты' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Вход в систему' })).toBeHidden();
  });

  test('режим работы выбирается на втором шаге и задаёт форму нового проекта', async ({ page }) => {
    const console_ = watchConsole(page);
    await page.goto('/');

    await page.getByLabel('Логин или почта').fill(DEMO_USER.login);
    await page.getByLabel('Пароль').fill(DEMO_USER.password);
    await page.getByRole('button', { name: 'Продолжить' }).click();

    // По умолчанию инженерный — шаг открывается на нём.
    await expect(page.getByRole('radio', { name: 'Инженерный' })).toBeChecked();
    await page.getByRole('radio', { name: 'Упрощённый' }).check();
    await page.getByRole('button', { name: 'Войти' }).click();

    // Выбор долетел до создания проекта: окно упрощённого режима, а не
    // инженерное «Новый проект».
    await page.getByRole('button', { name: 'Новый проект' }).first().click();
    await expect(page.getByRole('dialog', { name: 'Выбор дробилки' })).toBeVisible();

    console_.assertClean();
  });

  test('выбранный при входе режим переживает перезагрузку', async ({ page }) => {
    await login(page, DEMO_USER, 'Упрощённый');

    await page.reload();

    /* Раньше режим жил состоянием `App` и сбрасывался на инженерный
       при каждом обновлении страницы — то есть выбор держался до F5. */
    await page.getByRole('button', { name: 'Новый проект' }).first().click();
    await expect(page.getByRole('dialog', { name: 'Выбор дробилки' })).toBeVisible();
  });

  test('вход открыт под любым логином и паролем — стенд, а не учётная запись', async ({ page }) => {
    await login(page, { login: 'кто-угодно', password: 'что-угодно', name: 'кто-угодно' });

    await page.getByRole('button', { name: 'Настройки' }).click();
    await expect(page.getByText('кто-угодно')).not.toHaveCount(0);
  });

  test('выход возвращает на экран входа и очищает сессию', async ({ page }) => {
    await login(page);

    await page.getByRole('button', { name: 'Настройки' }).click();
    await page.getByRole('button', { name: 'Выйти' }).click();

    await expect(page.getByRole('heading', { name: 'Вход в систему' })).toBeVisible();

    // Перезагрузка не должна вернуть пользователя обратно внутрь.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'Вход в систему' })).toBeVisible();
  });
});
