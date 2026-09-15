import { test, expect } from '@playwright/test';
import { DEMO_USER, SAMPLE_PROJECT, closeDisplayPopover, closeStepEditor, createProject, goToWizardStep, openStepEditor, pickOre, runStepCalc, seedSession, watchConsole, wizardStepButton } from './helpers';

test.describe('Инженерный визард', () => {
  test.beforeEach(async ({ page }) => {
    await seedSession(page, { empty: true });
    await createProject(page);
  });

  test('шаги 2 и 3 недоступны, пока не посчитан первый', async ({ page }) => {
    // Недоступный шаг степпер рисует не отключённой кнопкой, а просто текстом:
    // кликабельность, которая ничего не делает, в системе запрещена. Поэтому
    // проверяется отсутствие кнопки, а не её disabled-состояние.
    await expect(page.getByText('Руда', { exact: true })).toBeVisible();
    await expect(wizardStepButton(page, /Руда/)).toHaveCount(0);
    await expect(wizardStepButton(page, /Продукт/)).toHaveCount(0);
  });

  test('расчёт помечает шаг пройденным, показывает тост и открывает следующий', async ({ page }) => {
    const console_ = watchConsole(page);

    await runStepCalc(page);

    await expect(page.getByText('Шаг «Дробилка» рассчитан')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Экспорт в Excel' })).toBeVisible();
    await expect(wizardStepButton(page, /Руда/)).toBeEnabled();

    console_.assertClean();
  });

  test('отчёт этапа стоит прямо на странице и показывает вычисленные значения', async ({ page }) => {
    await runStepCalc(page);

    const drawer = page.getByRole('main');
    await expect(drawer).toBeVisible();

    // Габарит основания идёт прямо из формы — связь формы и результата жива.
    await expect(drawer.getByRole('row').filter({ hasText: 'D — диаметр основания конуса' })).toContainText('2200');

    /* Таблица профиля по расчётным сечениям — второй блок отчёта. На данных
       по умолчанию это контрольный пример методики, и её числа обязаны
       совпасть с документацией: R1 нижнего сечения 1222,1 мм при S1 = S₀. */
    await expect(drawer.getByRole('row').filter({ hasText: '1222.1' }).last()).toContainText('43.00');

  });

  test('отчёт показывает метаданные расчёта и позволяет завести тег на месте', async ({ page }) => {
    await runStepCalc(page);

    const drawer = page.getByRole('main');
    await expect(drawer.getByText('Дата расчёта')).toBeVisible();
    // Дробилка и мощность — из каталога, по названию выбранной машины (КСД-2200Т).
    await expect(drawer.getByText('КСД-2200Т', { exact: true }).first()).toBeVisible();
    await expect(drawer.getByText('315/400 кВт', { exact: true })).toBeVisible();
    await expect(drawer.getByText(DEMO_USER.name)).toBeVisible();

    // Тег заводится прямо в шторке: «+» открывает список тегов с тем же
    // поповером «Новый тег», что и в фильтре списка проектов, а заведённый
    // тег сразу становится тегом этого проекта и появляется меткой рядом.
    await drawer.getByRole('button', { name: 'Добавить тег' }).click();
    await page.getByRole('button', { name: 'Новый тег' }).click();
    await page.getByLabel('Название тега').fill('Срочный');
    await page.getByRole('button', { name: 'Добавить', exact: true }).click();
    // Метка-чип — единственный `Tag` с кнопкой снятия («Снять метку»):
    // у варианта в открытом списке выбора такой кнопки нет, поэтому счёт
    // по ней однозначен даже пока список ещё не закрыт.
    await expect(drawer.getByRole('button', { name: 'Снять метку' })).toHaveCount(1);

    // Список закрывается сам — клик вне него: свежая метка подвинула «+»
    // левее, и открывать второй список стоит уже после того, как поповер
    // от первого добавления доиграл переезд следом.
    await drawer.getByText('Дата расчёта').click();
    await expect(page.getByRole('button', { name: 'Новый тег' })).toHaveCount(0);

    // Тегов может быть несколько сразу: второй, уже существующий,
    // добавляется тем же «+», отмеченной галочкой в списке — первый
    // остаётся меткой рядом, а не заменяется вторым.
    await drawer.getByRole('button', { name: 'Добавить тег' }).click();
    const workingOption = page.getByRole('option', { name: 'Рабочий' });
    await expect(workingOption).toBeVisible();
    await workingOption.click();
    await expect(drawer.getByRole('button', { name: 'Снять метку' })).toHaveCount(2);
  });

  test('переход по шагам меняет форму', async ({ page }) => {
    await openStepEditor(page);
    await runStepCalc(page);

    await goToWizardStep(page, /Руда/);
    await pickOre(page);
    await expect(page.getByRole('dialog', { name: 'Ввод данных руды' })).toBeVisible();

    await goToWizardStep(page, /Дробилка/);
    await expect(page.getByRole('heading', { name: 'Результаты: Геометрия камеры дробления' })).toBeVisible();
  });

  test('переход на «Руда» без выбранной пробы открывает выбор пробы, оставляя шаг «Дробилка»', async ({ page }) => {
    const console_ = watchConsole(page);

    await runStepCalc(page);
    await goToWizardStep(page, /Руда/);

    // Степпер не переключился: заглушки «нечем считать» на шаге «Грансостав»
    // быть не должно вовсе — вместо неё сразу открывается выбор пробы,
    // а форма позади него остаётся на шаге «Дробилка».
    await expect(page.getByRole('heading', { name: 'Результаты: Геометрия камеры дробления' })).toBeVisible();
    await expect(page.getByRole('dialog', { name: 'Выбор пробы руды' })).toBeVisible();
    await expect(page.getByText('Выберите пробу руды')).toHaveCount(0);

    await pickOre(page);

    await expect(page.getByLabel('Минимальная крупность Dmin')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Выполнить расчёт' })).toBeEnabled();

    console_.assertClean();
  });

  test('выбранная проба руды переживает уход на другой шаг', async ({ page }) => {
    await openStepEditor(page);
    await runStepCalc(page);
    await goToWizardStep(page, /Руда/);
    await pickOre(page);

    await goToWizardStep(page, /Дробилка/);
    await goToWizardStep(page, /Руда/);

    await expect(page.getByRole('dialog', { name: 'Ввод данных руды' })).toBeVisible();
    await expect(page.getByText('Выберите пробу руды')).toHaveCount(0);
  });

  test('введённые значения переживают выход в список и возврат в проект', async ({ page }) => {
    await openStepEditor(page);
    const field = page.getByLabel('Диаметр основания D');
    await field.fill('1900');

    await closeStepEditor(page);
    await page.getByRole('button', { name: 'УЗТМ' }).click();
    await page.getByRole('button', { name: SAMPLE_PROJECT.crusher, exact: true }).click();

    await openStepEditor(page);
    await expect(page.getByLabel('Диаметр основания D')).toHaveValue('1900');
  });

  test('введённые значения и отметка расчёта переживают перезагрузку', async ({ page }) => {
    await openStepEditor(page);
    // Проверяет, что вложенные данные визарда переживают сериализацию,
    // а не только верхний уровень записи проекта.
    await page.getByLabel('Диаметр основания D').fill('1900');
    await runStepCalc(page);
    await expect(page.getByRole('button', { name: 'Экспорт в Excel' })).toBeVisible();

    await page.reload();
    await page.getByRole('button', { name: SAMPLE_PROJECT.crusher, exact: true }).click();

    await openStepEditor(page);
    await expect(page.getByLabel('Диаметр основания D')).toHaveValue('1900');
    await closeStepEditor(page);
    await expect(page.getByRole('button', { name: 'Экспорт в Excel' })).toBeVisible();
  });

  test('посчитанный шаг остаётся посчитанным после возврата', async ({ page }) => {
    await runStepCalc(page);
    await expect(page.getByRole('button', { name: 'Экспорт в Excel' })).toBeVisible();

    await page.getByRole('button', { name: 'УЗТМ' }).click();
    await page.getByRole('button', { name: SAMPLE_PROJECT.crusher, exact: true }).click();

    await expect(page.getByRole('button', { name: 'Экспорт в Excel' })).toBeVisible();
  });

  /**
   * Уход на главную — переключение, а не закрытие: вкладка проекта обязана
   * остаться в шапке, и вернуться в проект можно нажатием по ней самой,
   * без повторного поиска строки в таблице.
   */
  test('проект остаётся открытым, пока его не закрыли крестиком', async ({ page }) => {
    const tab = page.getByRole('button', { name: SAMPLE_PROJECT.name, exact: true });
    await expect(tab).toBeVisible();

    /* Пока ничего не посчитано, проект показан окном ввода поверх списка —
       до шапки приложения через него не дотянуться. */
    await closeStepEditor(page);
    await page.getByRole('button', { name: 'УЗТМ' }).click();
    await expect(page.getByRole('heading', { name: 'Проекты' })).toBeVisible();
    // Вкладка не исчезла вместе с уходом на список.
    await expect(tab).toBeVisible();

    await tab.click();
    await expect(page.getByRole('dialog', { name: 'Исходные данные: Дробилка' })).toBeVisible();

    // Закрывает проект только крестик на его вкладке.
    await closeStepEditor(page);
    await page.getByRole('button', { name: 'Закрыть проект' }).click();
    await expect(tab).toHaveCount(0);
  });

  /**
   * Переименование — поповер у шеврона внутри вкладки, без ухода на модальный
   * слой. Новое имя держится: возврат на главную и обратно не откатывает его.
   */
  test('переименование проекта держится после ухода на главную и обратно', async ({ page }) => {
    // Действия вкладки проявляются при наведении на неё — до этого они
    // занимают место в раскладке, но недоступны нажатию.
    await closeStepEditor(page);
    await page.getByRole('button', { name: 'Тестовый проект', exact: true }).hover();
    await page.getByRole('button', { name: 'Переименовать проект' }).click();
    await page.getByLabel('Название проекта').fill('Переименованный проект');
    await page.getByRole('button', { name: 'Сохранить' }).click();

    const tab = page.getByRole('button', { name: 'Переименованный проект', exact: true });
    await expect(tab).toBeVisible();
    await expect(page.getByRole('button', { name: SAMPLE_PROJECT.name, exact: true })).toHaveCount(0);

    await page.getByRole('button', { name: 'УЗТМ' }).click();
    await expect(tab).toBeVisible();
    await tab.click();
    await expect(page.getByRole('dialog', { name: 'Исходные данные: Дробилка' })).toBeVisible();
  });

  test('переключение единиц углов меняет постфикс у полей угла', async ({ page }) => {
    await openStepEditor(page);
    await expect(page.getByText('град°', { exact: true }).first()).toBeVisible();

    await page.getByRole('button', { name: 'Отображение' }).click();
    const radians = page.getByRole('option', { name: 'Радианы' });
    await radians.click();

    await expect(page.getByText('рад', { exact: true }).first()).toBeVisible();
    await expect(page.getByText('град°', { exact: true })).toHaveCount(0);
  });

  test('ширину панели со схемой можно тянуть вручную', async ({ page }) => {
    await openStepEditor(page);
    const panel = page.locator('[data-open="true"]');
    const before = await panel.boundingBox();
    if (!before) throw new Error('панель схемы не найдена');

    const handle = page.getByRole('separator', { name: /Ширина панели/ });
    const handleBox = await handle.boundingBox();
    if (!handleBox) throw new Error('ручка ширины не найдена');

    // Ручка растянута на всю высоту строки (по самому высокому соседу —
    // форме), которая может быть выше видимой области экрана: центр её
    // рамки — не гарантированно видимая точка. Берём отступ от верха ручки,
    // заведомо попадающий в вьюпорт.
    const grabY = handleBox.y + 40;
    await page.mouse.move(handleBox.x + handleBox.width / 2, grabY);
    await page.mouse.down();
    await page.mouse.move(handleBox.x - 150, grabY, { steps: 10 });
    await page.mouse.up();

    const after = await panel.boundingBox();
    expect(after!.width).toBeGreaterThan(before.width + 100);
  });

  test('дельта работает на «Грансоставе» и «Продукте», не только на «Геометрии»', async ({ page }) => {
    await runStepCalc(page);
    await goToWizardStep(page, /Руда/);
    await pickOre(page);

    const z0 = page.getByLabel('Параметр Z0');
    await expect(page.getByText('было:')).toHaveCount(0);

    // Дельта сравнивает с исходными значениями проекта, а не со снимком
    // на момент расчёта — правка видна сразу, ещё до «Выполнить расчёт».
    await z0.fill('9.9');
    await expect(page.getByText('было: 1.2', { exact: true })).toBeVisible();

    // Шаг «Продукт» доступен только после расчёта «Грансостава» — это
    // про степпер, не про дельту, и не связано с проверкой выше.
    await runStepCalc(page);
    await goToWizardStep(page, /Продукт/);
    const wk = page.getByLabel('Работа разрушения Wk');
    const wkBefore = await wk.inputValue();
    await wk.fill(`${Number(wkBefore) + 1}`);
    await expect(page.getByText(`было: ${wkBefore}`, { exact: true })).toBeVisible();
  });

  test('дельта видна на совсем новом проекте — не нужно сперва считать шаг', async ({ page }) => {
    await openStepEditor(page);
    // Регрессия: снимок раньше заводился только при расчёте, и до первого
    // «Выполнить расчёт» переключатель «Показывать изменения» не показывал
    // ничего, даже если поле уже отредактировано.
    const beta10 = page.getByLabel('Угол конуса β10');
    /* Значение внутри допустимых границ: за ними `Field` показывает ошибку,
       а она вытесняет подсказку — проверять надо дельту, а не валидацию. */
    await beta10.fill('60');
    await expect(page.getByText('было: 43.94', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Отображение' }).click();
    await page.getByRole('option', { name: 'Не показывать изменения' }).click();
    await closeDisplayPopover(page);
    await expect(page.getByText('было: 43.94', { exact: true })).toHaveCount(0);

    await page.getByRole('button', { name: 'Отображение' }).click();
    await page.getByRole('option', { name: /^Показывать изменения/ }).click();
    await closeDisplayPopover(page);
    await expect(page.getByText('было: 43.94', { exact: true })).toBeVisible();
  });

  test('«Грансостав»: заголовок без подзаголовка, плашка пробы в футере, своё «Отображение» с дельтой', async ({ page }) => {
    await runStepCalc(page);
    await goToWizardStep(page, /Руда/);
    await pickOre(page);

    const editor = page.getByRole('dialog', { name: /Исходные данные|Ввод данных/ });
    // Подзаголовок под заголовком шага убран.
    await expect(editor.getByText('Границы крупности питания')).toHaveCount(0);
    /* Плашка пробы стоит в футере окна, слева от кнопок, и подписана:
       окна этапов похожи друг на друга, и без подписи неясно, что это
       за объект. Ищется по кнопке смены пробы: то же имя стоит и первой
       строкой паспорта пробы в левой колонке окна. */
    const oreChip = editor.getByRole('button', { name: 'Сменить пробу руды' }).locator('xpath=ancestor::*[.//text()[normalize-space()="Проба руды"]][1]');
    await expect(oreChip.getByText('Проба руды', { exact: true })).toBeVisible();
    await expect(oreChip.getByText('Костомукшская', { exact: true })).toBeVisible();

    // «Отображение» здесь своё — только дельта, без пунктов про диаграмму.
    await page.getByRole('button', { name: 'Отображение' }).click();
    await expect(page.getByRole('option', { name: 'Только ввод' })).toHaveCount(0);
    await expect(page.getByRole('option', { name: 'Градусы' })).toHaveCount(0);
    await expect(page.getByRole('option', { name: /^Показывать изменения/ })).toBeVisible();

    const z0 = page.getByLabel('Параметр Z0');
    await page.keyboard.press('Escape');
    await z0.fill('9.9');
    await expect(page.getByText('было: 1.2', { exact: true })).toBeVisible();

    await page.getByRole('button', { name: 'Отображение' }).click();
    await page.getByRole('option', { name: 'Не показывать изменения' }).click();
    await closeDisplayPopover(page);
    await expect(page.getByText('было: 1.2', { exact: true })).toHaveCount(0);
  });

  test('результат «Грансостав»: отображение переключает по минусу / по плюсу / частные классы независимо', async ({ page }) => {
    await runStepCalc(page);
    await goToWizardStep(page, /Руда/);
    await pickOre(page);
    await runStepCalc(page);

    const drawer = page.getByRole('main');
    // По умолчанию — только по минусу, как было до появления переключателя.
    await expect(drawer.getByRole('columnheader', { name: 'Выход по минусу, %' })).toBeVisible();
    await expect(drawer.getByRole('columnheader', { name: 'Выход по плюсу, %' })).toHaveCount(0);
    await expect(drawer.getByRole('columnheader', { name: 'Частные классы, %' })).toHaveCount(0);

    await drawer.getByRole('button', { name: 'Отображение' }).click();
    await page.getByRole('option', { name: 'По плюсу' }).click();
    await page.getByRole('option', { name: 'Частные классы' }).click();
    await closeDisplayPopover(page);

    // Все три показаны вместе — переключатель не эксклюзивный.
    await expect(drawer.getByRole('columnheader', { name: 'Выход по минусу, %' })).toBeVisible();
    await expect(drawer.getByRole('columnheader', { name: 'Выход по плюсу, %' })).toBeVisible();
    await expect(drawer.getByRole('columnheader', { name: 'Частные классы, %' })).toBeVisible();

    await drawer.getByRole('button', { name: 'Отображение' }).click();
    await page.getByRole('option', { name: 'По минусу' }).click();
    await closeDisplayPopover(page);
    await expect(drawer.getByRole('columnheader', { name: 'Выход по минусу, %' })).toHaveCount(0);
    await expect(drawer.getByRole('columnheader', { name: 'Выход по плюсу, %' })).toBeVisible();
  });

  test('результат «Продукт» показывает грансостав продукта таблицей и графиком', async ({ page }) => {
    await runStepCalc(page);
    await goToWizardStep(page, /Руда/);
    await pickOre(page);
    await runStepCalc(page);
    await goToWizardStep(page, /Продукт/);
    await runStepCalc(page);

    const drawer = page.getByRole('main');
    await expect(drawer).toBeVisible();

    await expect(drawer.getByRole('heading', { name: 'Грансостав продукта дробления' })).toBeVisible();
    // Первая (не единственная — в конце шторки дублируется таблица этапа
    // «Грансостав», см. следующий тест) — колонка «Выход по минусу»
    // принадлежит именно продукту дробления.
    await expect(drawer.getByRole('columnheader', { name: 'Выход по минусу, %' }).first()).toBeVisible();

    // График — суммарные характеристики крупности, по плюсу и по минусу.
    const chart = drawer.getByRole('img', { name: /Суммарные характеристики крупности/ }).first();
    await expect(chart).toBeVisible();
    await expect(chart.locator('path')).toHaveCount(2);
    await expect(drawer.getByText('По минусу — выход зёрен мельче размера').first()).toBeVisible();
    await expect(drawer.getByText('По плюсу — выход зёрен крупнее размера').first()).toBeVisible();
  });

  test('на странице «Руды» — только её отчёт, без табов, и страница не уезжает после расчёта', async ({ page }) => {
    await runStepCalc(page);
    await goToWizardStep(page, /Руда/);
    await pickOre(page);
    await runStepCalc(page);

    const main = page.getByRole('main');
    await expect(main.getByRole('navigation', { name: 'Отчёты этапов' })).toHaveCount(0);
    await expect(main.getByRole('region', { name: /^Результаты:/ })).toHaveCount(1);

    /* Закрытие окна возвращало фокус на шаг степпера, и браузер докручивал
       к нему корень визарда — шапка страницы уходила за верх экрана. */
    await page.waitForTimeout(500);
    await expect(page.getByRole('heading', { name: 'Результаты: Характеристический грансостав' })).toBeInViewport();
  });

  test('результаты «Продукта» — с отчётами «Руды» и «Дробилки» ниже и табами, следящими за прокруткой', async ({ page }) => {
    await runStepCalc(page);
    await goToWizardStep(page, /Руда/);
    await pickOre(page);
    await runStepCalc(page);
    await goToWizardStep(page, /Продукт/);
    await runStepCalc(page);

    const main = page.getByRole('main');
    // Отчёты по порядку: этот этап, под ним — предыдущие, от ближнего к первому.
    const headings = main.getByRole('region', { name: /^Результаты:/ });
    await expect(headings).toHaveCount(3);
    await expect(main.getByRole('heading', { name: 'Продукт', exact: true })).toBeVisible();
    await expect(main.getByText('Этап 2. Характеристический грансостав')).toBeAttached();
    await expect(main.getByText('Этап 1. Геометрия камеры дробления')).toBeAttached();

    const tab = (name: string) => main.getByRole('navigation', { name: 'Отчёты этапов' }).getByRole('button', { name, exact: true });
    await expect(tab('Продукт')).toHaveAttribute('aria-current', /true|page|location/);

    // Клик ведёт к отчёту, и таб остаётся на месте — закреплён над колонкой.
    await tab('Дробилка').click();
    await expect(main.getByText('Этап 1. Геометрия камеры дробления')).toBeInViewport();
    await expect(tab('Дробилка')).toBeInViewport();
    await expect(tab('Дробилка')).toHaveAttribute('aria-current', /true|page|location/);

    // Прокрутка обратно наверх возвращает подсветку «Продукту».
    await page.waitForTimeout(800);
    await main.getByRole('heading', { name: 'Продукт', exact: true }).scrollIntoViewIfNeeded();
    await page.mouse.wheel(0, -5000);
    await expect(tab('Продукт')).toHaveAttribute('aria-current', /true|page|location/);
  });
});
