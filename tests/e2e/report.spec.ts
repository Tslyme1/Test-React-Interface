import { test, expect } from '@playwright/test';
import { createProject, goToWizardStep, pickOre, runStepCalc, seedSession, watchConsole } from './helpers';

/**
 * Отчёт по проекту — окно сборки: слева состав, справа сам документ.
 *
 * Проверяется именно связь этих двух половин: состав должен менять то,
 * что видно справа, потому что печатается ровно правая половина
 * (`printProjectReport`). Сама печать сценарием не проверяется —
 * она открывает окно браузера и уходит в систему печати.
 */
test.describe('Отчёт по проекту', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page, { empty: true });
    await createProject(page);
    await runStepCalc(page);
  });

  const openReport = async (page: import('@playwright/test').Page) => {
    await page.getByRole('button', { name: 'Отчёт по проекту' }).click();
    const dialog = page.getByRole('dialog', { name: 'Отчёт по проекту' });
    await expect(dialog).toBeVisible();
    return dialog;
  };

  test('открывается автоматическим и показывает разделы посчитанного этапа', async ({ page }) => {
    const console_ = watchConsole(page);
    const dialog = await openReport(page);

    // По умолчанию состав следует расчёту — выбирать ничего не надо.
    await expect(dialog.getByRole('radio', { name: 'Автоматический' })).toBeChecked();

    // Заголовок отчёта — имя проекта, пока своего не написали.
    await expect(dialog.getByRole('heading', { name: 'Тестовый проект' })).toBeVisible();

    // Все четыре таблицы «Дробилки» и её чертёж — в документе справа.
    for (const title of [
      'Параметры камеры дробления',
      'Профиль камеры по расчётным сечениям',
      'Критические углы поворота эксцентрика',
      'Контроль корректности профиля',
      'Схема профиля камеры дробления',
    ]) {
      await expect(dialog.getByRole('heading', { name: title })).toBeVisible();
    }

    /* Непосчитанных этапов в отчёте нет — ни разделом, ни отметкой:
       обещать в документе то, чего ещё не посчитали, нельзя. */
    await expect(dialog.getByRole('heading', { name: 'Продукт дробления' })).toHaveCount(0);

    console_.assertClean();
  });

  test('настраиваемый состав убирает раздел из документа и возвращает его', async ({ page }) => {
    const dialog = await openReport(page);

    const profile = dialog.getByRole('heading', { name: 'Профиль камеры по расчётным сечениям' });
    await expect(profile).toBeVisible();

    await dialog.getByRole('radio', { name: 'Настраиваемый' }).check();
    // Строка раздела — в левой колонке; та же подпись есть и справа,
    // поэтому ищем именно вариант списка.
    await dialog.getByRole('option', { name: 'Профиль камеры по расчётным сечениям' }).click();
    await expect(profile).toHaveCount(0);

    // Остальные разделы на месте — снялся ровно один.
    await expect(dialog.getByRole('heading', { name: 'Параметры камеры дробления' })).toBeVisible();

    await dialog.getByRole('option', { name: 'Профиль камеры по расчётным сечениям' }).click();
    await expect(profile).toBeVisible();
  });

  test('свой заголовок и снятая шапка меняют документ', async ({ page }) => {
    const dialog = await openReport(page);

    await dialog.getByLabel('Заголовок отчёта').fill('Отчёт для смежников');
    await expect(dialog.getByRole('heading', { name: 'Отчёт для смежников' })).toBeVisible();

    await expect(dialog.getByText('Код проекта')).toBeVisible();
    await dialog.getByRole('option', { name: 'Шапка расчёта' }).click();
    await expect(dialog.getByText('Код проекта')).toHaveCount(0);
  });

  test('состав отчёта переживает закрытие окна и перезагрузку', async ({ page }) => {
    const dialog = await openReport(page);
    await dialog.getByRole('radio', { name: 'Настраиваемый' }).check();
    await dialog.getByRole('option', { name: 'Контроль корректности профиля' }).click();
    await dialog.getByLabel('Заголовок отчёта').fill('Отчёт для смежников');
    /* Окно закрывается крестиком в шапке: своей кнопки «Закрыть»
       в футере у него нет — там только действия над отчётом. */
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);

    await page.reload();

    /* Открытые вкладки живут в памяти и перезагрузку не переживают
       (см. `App`), поэтому проект открывается из списка заново. */
    await page.getByRole('row', { name: /КСД-2200Т/ }).click();

    const again = await openReport(page);
    await expect(again.getByRole('radio', { name: 'Настраиваемый' })).toBeChecked();
    await expect(again.getByLabel('Заголовок отчёта')).toHaveValue('Отчёт для смежников');
    await expect(again.getByRole('heading', { name: 'Контроль корректности профиля' })).toHaveCount(0);

    // «Сбросить состав» возвращает полный автоматический отчёт.
    await again.getByRole('button', { name: 'Сбросить состав' }).click();
    await expect(again.getByRole('radio', { name: 'Автоматический' })).toBeChecked();
    await expect(again.getByRole('heading', { name: 'Контроль корректности профиля' })).toBeVisible();
  });

  /**
   * Печать открывает окно браузера и уходит в систему печати, поэтому
   * проверяется то, что туда написано: `window.open` подменяется заглушкой,
   * которая копит документ вместо того, чтобы его показывать.
   *
   * Смысл проверки — печатается ровно предпросмотр: и таблицы, и чертёж,
   * и график, которых в старой печати по этапам не было вовсе.
   */
  test('печать уносит с собой весь собранный документ — с чертежом и графиком', async ({ page }) => {
    await goToWizardStep(page, /Руда/);
    await pickOre(page);
    await runStepCalc(page);

    await page.addInitScript(() => {
      const chunks: string[] = [];
      (window as unknown as { __printed: string[] }).__printed = chunks;
      window.open = () =>
        ({
          document: { write: (html: string) => chunks.push(html), close: () => undefined },
          print: () => undefined,
          onload: null,
        }) as unknown as Window;
    });
    await page.reload();
    await page.getByRole('row', { name: /КСД-2200Т/ }).click();

    const dialog = await openReport(page);
    await dialog.getByRole('button', { name: 'Печать' }).click();

    const printed = await page.evaluate(() => (window as unknown as { __printed: string[] }).__printed.join(''));

    expect(printed).toContain('Тестовый проект');
    expect(printed).toContain('Профиль камеры по расчётным сечениям');
    // Чертёж камеры и кривые грансостава — оба настоящими SVG, а не подписью.
    expect(printed).toContain('<svg');
    expect(printed).toContain('Суммарные характеристики крупности');
    // Стили приложения перенесены — иначе таблицы печатались бы голой разметкой.
    expect(printed).toMatch(/<style|<link[^>]+stylesheet/);
  });

  test('посчитанный следующий этап входит в автоматический отчёт сам', async ({ page }) => {
    await goToWizardStep(page, /Руда/);
    await pickOre(page);
    await runStepCalc(page);

    const dialog = await openReport(page);

    // Разделы «Руды» появились без единого действия в составе отчёта.
    await expect(dialog.getByRole('heading', { name: 'Характеристика гранулометрического состава' })).toBeVisible();
    await expect(dialog.getByRole('heading', { name: 'Суммарные характеристики крупности питания' })).toBeVisible();
    // И разделы «Дробилки» никуда не делись.
    await expect(dialog.getByRole('heading', { name: 'Параметры камеры дробления' })).toBeVisible();
  });
});
