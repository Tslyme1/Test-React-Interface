import { expect, type Locator, type Page } from '@playwright/test';

export const DEMO_USER = { login: 'ivanov', password: '1234', name: 'Иванов Алексей Сергеевич' };

/**
 * Шум, за который приложение не отвечает: шрифты тянутся с внешнего CDN,
 * и в закрытом окружении (песочница, CI без сети наружу) запрос падает.
 * Всё остальное в консоли считается ошибкой и роняет тест.
 */
const IGNORED_CONSOLE = [/fonts\.googleapis\.com/i, /fonts\.gstatic\.com/i, /favicon\.ico/i, /ERR_CONNECTION_RESET/i];

export type ConsoleWatcher = { errors: string[]; assertClean: () => void };

/**
 * Сторож консоли. Ловит то, чего не видно на скриншоте: предупреждения
 * React о ключах и пропах, промахи по aria, упавшие запросы. Именно здесь
 * всплывает большинство ошибок интеграции компонентов.
 */
export function watchConsole(page: Page): ConsoleWatcher {
  const errors: string[] = [];

  page.on('console', (msg) => {
    if (msg.type() !== 'error' && msg.type() !== 'warning') return;
    const text = msg.text();
    // Адрес ресурса приходит в location, а не в тексте: у сетевых ошибок
    // сам текст выглядит как «Failed to load resource: 404» без URL,
    // и фильтр по одному тексту их не различает.
    const url = msg.location()?.url ?? '';
    if (IGNORED_CONSOLE.some((re) => re.test(text) || re.test(url))) return;
    errors.push(`[${msg.type()}] ${text}${url ? ` (${url})` : ''}`);
  });

  page.on('pageerror', (err) => errors.push(`[pageerror] ${String(err)}`));

  return {
    errors,
    assertClean: () => expect(errors, `Консоль должна быть чистой:\n${errors.join('\n')}`).toEqual([]),
  };
}

/**
 * Проход через форму входа. Нужен там, где проверяется сам вход.
 *
 * Вход из двух шагов: учётные данные, затем режим работы. Помощник
 * проходит оба и по умолчанию оставляет режим таким, каким его открыл
 * второй шаг (инженерный, если в прошлый раз не выбирали другой).
 */
export async function login(page: Page, user = DEMO_USER, mode?: 'Инженерный' | 'Упрощённый') {
  await page.goto('/');
  await page.getByLabel('Логин или почта').fill(user.login);
  await page.getByLabel('Пароль').fill(user.password);
  await page.getByRole('button', { name: 'Продолжить' }).click();
  await expect(page.getByRole('heading', { name: 'Режим работы' })).toBeVisible();
  if (mode) await page.getByRole('radio', { name: mode }).check();
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page.getByRole('heading', { name: 'Проекты' })).toBeVisible();
}

/**
 * Ждёт, пока элемент перестанет двигаться.
 *
 * Нужно перед наведением на тонкие линии чертежа: курсор ставится
 * по координатам, а окно ввода появляется с анимацией — пока она идёт,
 * указатель попадает мимо линии, и под нагрузкой полного прогона это
 * выглядело случайным падением раз в прогон. Проверка «не подсвечено»
 * перед наведением от этого не спасала: она отвечает сразу, не дожидаясь
 * конца анимации.
 */
export async function waitForStable(locator: Locator) {
  let previous = '';
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const box = await locator.boundingBox();
    const key = box ? `${Math.round(box.x)}:${Math.round(box.y)}:${Math.round(box.width)}` : '';
    if (key !== '' && key === previous) return;
    previous = key;
    await locator.page().waitForTimeout(100);
  }
}

/**
 * Меняет режим работы нового проекта в «Настройках».
 *
 * Помощником, а не тремя строками на месте: выбор режима живёт в окне
 * с карточками, и три сценария из двух файлов повторяли путь к нему
 * дословно — первая же правка этого окна ломала их все разом.
 */
export async function switchMode(page: Page, mode: 'Инженерный' | 'Упрощённый') {
  await page.getByRole('button', { name: 'Настройки' }).click();
  await page.getByRole('button', { name: 'Режим работы нового проекта' }).click();

  const dialog = page.getByRole('dialog', { name: 'Сменить режим работы' });
  await dialog.getByRole('radio', { name: mode }).check();
  await dialog.getByRole('button', { name: 'Сменить' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

export type SeedOptions = {
  user?: typeof DEMO_USER;
  /**
   * Начать с пустым списком проектов.
   *
   * По умолчанию приложение при первом запуске подсыпает примеры — экран
   * с ними и надо проверять. Но сценариям про пустое состояние и про
   * «создал один проект — он единственный в таблице» примеры мешают,
   * и они объявляют пустоту явно, а не полагаются на побочный эффект.
   */
  empty?: boolean;
};

/** Версия формата хранилища проектов. Должна совпадать с `useProjects`. */
const PROJECTS_SCHEMA_VERSION = 14;

/**
 * Быстрый вход: сессия кладётся в localStorage до загрузки страницы.
 * Форма входа покрыта отдельным спеком, и прогонять её перед каждым
 * сценарием — платить временем за уже проверенное.
 */
export async function seedSession(page: Page, options: SeedOptions = {}) {
  const user = options.user ?? DEMO_USER;

  await page.addInitScript(
    (seeded) => {
      localStorage.setItem('uztm-session', JSON.stringify(seeded.user));

      // Скрипт выполняется перед КАЖДОЙ загрузкой страницы, включая
      // `page.reload()`. Записывать пустой список безусловно — значит стирать
      // то, что тест только что создал, ровно в сценариях про перезагрузку.
      // Поэтому только когда ключа ещё нет — как и делает само приложение.
      if (seeded.empty && localStorage.getItem('uztm-projects') === null) {
        // `seeded: true` — иначе приложение решит, что список ещё
        // нетронутый, и подсыплет примеры поверх намеренно пустого списка.
        localStorage.setItem(
          'uztm-projects',
          JSON.stringify({ version: seeded.version, projects: [], trash: [], seeded: true })
        );
      }
    },
    {
      user: {
        login: user.login,
        password: user.password,
        name: user.name,
        email: `${user.login}@uztm.ru`,
        role: 'Инженер',
      },
      empty: options.empty ?? false,
      version: PROJECTS_SCHEMA_VERSION,
    }
  );

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Проекты' })).toBeVisible();
}

export type NewProject = {
  name: string;
  customer: string;
  crusher: string;
  ore: string;
};

/** Значения берутся из настоящего каталога — выдуманных названий машин здесь нет. */
export const SAMPLE_PROJECT: NewProject = {
  name: 'Тестовый проект',
  customer: 'ЕВРАЗ КГОК',
  crusher: 'КСД-2200Т',
  ore: 'Костомукшская',
};

/**
 * Заполняет модалку нового проекта. Модалка должна быть уже открыта.
 *
 * Тело окна — каталог дробилок, название и заказчик стоят в футере.
 * Пробы руды здесь нет: её выбирают на шаге «Грансостав».
 */
export async function fillNewProjectForm(page: Page, project = SAMPLE_PROJECT) {
  const dialog = page.getByRole('dialog');

  await dialog.getByRole('button', { name: project.crusher, exact: true }).click();

  // Название подставляется по выбранной машине — перебиваем своим.
  await dialog.getByLabel('Название проекта').fill(project.name);

  await dialog.getByRole('button', { name: /Заказчик/ }).click();
  await page.getByRole('option', { name: project.customer }).click();
}

export async function createProject(page: Page, project = SAMPLE_PROJECT) {
  await page.getByRole('button', { name: 'Новый проект' }).first().click();
  await fillNewProjectForm(page, project);
  await page.getByRole('button', { name: 'Продолжить' }).click();

  /**
   * Признак попадания в визард — открытое окно ввода первого шага.
   *
   * Непосчитанный этап открывается сразу с ним: считать нечего, пока
   * данные не введены. Помощник его не закрывает — из него же и
   * запускается расчёт, и большинству сценариев нужно именно оно.
   * Кому нужна страница за ним — `closeStepEditor`.
   */
  /* Пока не посчитан ни один этап, проект живёт окном ввода поверх
     списка: страницы у него ещё нет, показывать на ней нечего.
     Помощник оставляет окно открытым — из него же и запускают расчёт. */
  await expect(page.getByRole('dialog', { name: /Исходные данные|Ввод данных/ })).toBeVisible();
}

/**
 * Открывает окно ввода исходных данных текущего этапа.
 *
 * На непосчитанном этапе главное действие футера — «Ввести данные»,
 * на посчитанном правка живёт кнопкой «Изменить данные» в шапке этапа.
 */
export async function openStepEditor(page: Page) {
  const dialog = page.getByRole('dialog', { name: /Исходные данные|Ввод данных/ });
  /* Уже открыто — непосчитанный этап показывается вместе с ним. Ждём,
     а не спрашиваем мгновенно: окно открывается само, и быстрый вопрос
     попадал бы в промежуток, пока оно доигрывает появление. */
  const shown = await dialog
    .waitFor({ state: 'visible', timeout: 1000 })
    .then(() => true)
    .catch(() => false);
  if (shown) return;

  const enter = page.getByRole('button', { name: 'Ввести данные' });
  if (await enter.count()) await enter.click();
  else await page.getByRole('button', { name: 'Изменить данные' }).click();
  await expect(page.getByRole('dialog', { name: /Исходные данные|Ввод данных/ })).toBeVisible();
}

/**
 * Закрывает поповер отображения, если он ещё открыт.
 *
 * Выбор пункта закрывает панель не всегда: там, где он меняет данные
 * формы (единицы углов), панель уходит сама, а там, где только режим
 * показа, — остаётся. Escape вслепую в первом случае доставался бы окну
 * под панелью.
 */
export async function closeDisplayPopover(page: Page) {
  const option = page.getByRole('option').first();
  /* Сначала даём панели уйти самой: она остаётся в разметке, пока
     доигрывает закрытие, и мгновенный вопрос «видна ли?» застаёт её
     ещё на экране — Escape тогда доставался бы окну под ней. */
  await option.waitFor({ state: 'detached', timeout: 1000 }).catch(() => undefined);

  if (!(await option.isVisible().catch(() => false))) return;

  /*
   * Панель закрывается нажатием «мимо» — событием, адресованным `body`,
   * а не Escape и не повторным нажатием триггера.
   *
   * Escape уходит в документ: если панель к этому моменту уже начала
   * уходить сама, её обработчик снят, и клавишу ловит окно под ней —
   * закрывается вся форма этапа, а следующая проверка сценария не находит
   * поля, которое только что видела. Под нагрузкой полного прогона это
   * ловилось раз в прогон и выглядело случайностью.
   *
   * Повторное нажатие триггера тоже ненадёжно: закрытие по клику снаружи
   * срабатывает раньше, и обработчик кнопки открывает панель обратно.
   * Настоящий клик по чему-нибудь «пустому» опасен иначе — под окном
   * это затемнение, и попадание по нему закрывает само окно.
   *
   * Событие на `body` свободно от всего этого: для панели оно «снаружи»
   * (её узел лежит в портале и цель события в него не входит), а больше
   * его никто не слушает — ни затемнение окна, ни кнопки.
   */
  await page.evaluate(() => {
    for (const type of ['pointerdown', 'mousedown', 'mouseup', 'click']) {
      document.body.dispatchEvent(new MouseEvent(type, { bubbles: true, composed: true }));
    }
  });

  await expect(option).toBeHidden();
}

/**
 * Переход по степперу. Степпер живёт в футере страницы, и открытое окно
 * ввода его перекрывает — поэтому окно сначала закрывается. Переход
 * на непосчитанный этап откроет его снова сам.
 */
export async function goToWizardStep(page: Page, name: RegExp) {
  await closeStepEditor(page);
  await wizardStepButton(page, name).click();
}

/**
 * Кнопка этапа в степпере. Ищется внутри списка, а не по всей странице:
 * рядом стоит «Следующий этап: Руда», и по одному имени они неразличимы.
 */
export function wizardStepButton(page: Page, name: RegExp) {
  return page.getByRole('list').getByRole('button', { name });
}

/**
 * Запускает расчёт этапа. Кнопка живёт в окне ввода — там, где видно,
 * что именно уходит в расчёт, — поэтому окно при необходимости
 * открывается, а после расчёта закрывается само.
 */
export async function runStepCalc(page: Page, label: 'Выполнить расчёт' | 'Пересчитать' = 'Выполнить расчёт') {
  const dialog = page.getByRole('dialog', { name: /Исходные данные|Ввод данных/ });
  /* Ждём окно, а не спрашиваем про него сразу: переход на непосчитанный
     этап открывает его сам, и мгновенная проверка попадала бы в промежуток,
     пока оно ещё доигрывает появление. */
  const shown = await dialog
    .waitFor({ state: 'visible', timeout: 1500 })
    .then(() => true)
    .catch(() => false);
  if (!shown) await openStepEditor(page);
  await dialog.getByRole('button', { name: label }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

/**
 * Закрывает окно ввода исходных данных и ждёт, пока оно уйдёт
 * из разметки, а не только с глаз: `Modal` в системе остаётся в дереве,
 * пока доигрывает анимацию ухода, и следующее действие сценария
 * успевало в закрывающееся окно.
 */
export async function closeStepEditor(page: Page) {
  const dialog = page.getByRole('dialog', { name: /Исходные данные|Ввод данных/ });
  /* Тихо ничего не делает, когда окна нет: на посчитанном этапе оно
     не открывается само, и сценариям незачем помнить, где именно. */
  if ((await dialog.count()) === 0) return;
  await dialog.getByRole('button', { name: 'Закрыть' }).first().click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

/**
 * Выбирает пробу руды в уже открытой модалке «Выбор пробы руды».
 *
 * Модалка открывается кликом по шагу «Руда» без выбранной пробы — переход
 * остаётся на шаге «Дробилка» и не показывает шаг «Грансостав» заглушкой,
 * поэтому открывать окно здесь отдельным кликом уже не нужно.
 */
export async function pickOre(page: Page, ore = SAMPLE_PROJECT.ore) {
  await page.getByRole('dialog', { name: 'Выбор пробы руды' }).getByRole('button', { name: ore, exact: true }).click();
  await expect(page.getByRole('dialog', { name: 'Ввод данных руды' })).toBeVisible();
}

/**
 * Контролы без доступного имени. Поле, потерявшее связь с подписью, выглядит
 * нормально и ломается молча — глазами это не ловится, а `Field` в дизайн-системе
 * именно эту связь и обязан обеспечивать.
 */
export async function controlsWithoutAccessibleName(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const selector = 'input:not([type="hidden"]), select, textarea, button';
    const out: string[] = [];

    for (const el of Array.from(document.querySelectorAll<HTMLElement>(selector))) {
      if (el.offsetParent === null && el.getAttribute('type') !== 'radio' && el.getAttribute('type') !== 'checkbox') {
        continue; // невидимое не мешает
      }

      const labelledBy = el.getAttribute('aria-labelledby');
      const name =
        el.getAttribute('aria-label')?.trim() ||
        (labelledBy ? document.getElementById(labelledBy)?.textContent?.trim() : '') ||
        (el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`)?.textContent?.trim() : '') ||
        el.closest('label')?.textContent?.trim() ||
        el.textContent?.trim() ||
        (el as HTMLInputElement).title?.trim();

      if (!name) {
        out.push(`<${el.tagName.toLowerCase()}${el.id ? ` id="${el.id}"` : ''} class="${el.className}">`);
      }
    }
    return out;
  });
}

/**
 * Подписи, указывающие в пустоту: `<label for="x">` без элемента с таким id.
 *
 * Так выглядит развалившаяся связка `Field` → контрол: если контрол не принял
 * `id` из render-пропов, подпись остаётся сама по себе. Проверка доступного
 * имени такое не ловит — у кнопки `Select` именем становится плейсхолдер,
 * и контрол formально подписан, хотя с подписью поля больше не связан.
 */
export async function orphanLabels(page: Page): Promise<string[]> {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLLabelElement>('label[for]'))
      .filter((label) => !document.getElementById(label.htmlFor))
      .map((label) => `<label for="${label.htmlFor}">${label.textContent?.trim() ?? ''}</label>`)
  );
}

/** Горизонтальная прокрутка страницы — признак съехавшей раскладки. */
export async function hasHorizontalOverflow(page: Page): Promise<boolean> {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
}

/**
 * Удаляет первый проект таблицы через меню строки.
 *
 * Прямой кнопки удаления в ячейке больше нет: действия строки собраны
 * под многоточием, как в прототипе. Удаление мягкое — проект уходит
 * в корзину, а не исчезает.
 */
export async function removeFirstProject(page: Page) {
  await page.getByRole('button', { name: /^Действия:/ }).first().click();
  await page.getByRole('button', { name: 'Удалить в корзину' }).click();
}

/** Переходит на экран корзины из пункта «Корзина» в сайдбаре. */
export async function openTrash(page: Page) {
  await page.getByRole('button', { name: /Корзина/ }).click();
  await expect(page.getByRole('heading', { name: 'Корзина', exact: true })).toBeVisible();
}
