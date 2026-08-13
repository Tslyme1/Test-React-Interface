import { expect, type Page } from '@playwright/test';

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

/** Проход через форму входа. Нужен там, где проверяется сам вход. */
export async function login(page: Page, user = DEMO_USER) {
  await page.goto('/');
  await page.getByLabel('Логин или почта').fill(user.login);
  await page.getByLabel('Пароль').fill(user.password);
  await page.getByRole('button', { name: 'Войти' }).click();
  await expect(page.getByRole('heading', { name: 'Проекты' })).toBeVisible();
}

/**
 * Быстрый вход: сессия кладётся в localStorage до загрузки страницы.
 * Форма входа покрыта отдельным спеком, и прогонять её перед каждым
 * сценарием — платить временем за уже проверенное.
 */
export async function seedSession(page: Page, user = DEMO_USER) {
  await page.addInitScript((seeded) => {
    localStorage.setItem('uztm-session', JSON.stringify(seeded));
  }, {
    login: user.login,
    password: user.password,
    name: user.name,
    email: `${user.login}@uztm.ru`,
    role: 'Инженер',
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Проекты' })).toBeVisible();
}

export type NewProject = {
  name: string;
  customer: string;
  crusher: string;
  ore: string;
};

export const SAMPLE_PROJECT: NewProject = {
  name: 'Тестовый проект',
  customer: 'ЕВРАЗ КГОК',
  crusher: 'КСД-1750Т',
  ore: 'Магнетитовая руда',
};

/** Заполняет и отправляет модалку нового проекта. Модалка должна быть уже открыта. */
export async function fillNewProjectForm(page: Page, project = SAMPLE_PROJECT) {
  const dialog = page.getByRole('dialog');

  await dialog.getByLabel('Название проекта').fill(project.name);

  await dialog.getByRole('button', { name: /Заказчик/ }).click();
  await page.getByRole('option', { name: project.customer }).click();

  await dialog.getByRole('button', { name: /Дробилка/ }).click();
  await page.getByRole('option', { name: project.crusher }).click();

  await dialog.getByRole('button', { name: /Проба руды/ }).click();
  await page.getByRole('option', { name: project.ore }).click();
}

export async function createProject(page: Page, project = SAMPLE_PROJECT) {
  await page.getByRole('button', { name: 'Новый проект' }).first().click();
  await fillNewProjectForm(page, project);
  await page.getByRole('button', { name: 'Создать проект' }).click();
  // Признак попадания в визард — первый шаг.
  await expect(page.getByRole('heading', { name: 'Геометрия камеры дробления' })).toBeVisible();
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
