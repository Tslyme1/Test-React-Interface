import { test, expect, type Page } from '@playwright/test';
import {
  controlsWithoutAccessibleName,
  createProject,
  hasHorizontalOverflow,
  orphanLabels,
  seedSession,
  watchConsole,
} from './helpers';

/**
 * Сквозные инварианты — то, что должно быть верно на каждом экране.
 * Эти проверки ловят промахи интеграции компонентов, которых не видно
 * ни на скриншоте, ни в сценарном тесте.
 */

const SCREENS: { name: string; go: (page: Page) => Promise<void> }[] = [
  {
    name: 'вход',
    go: async (page) => {
      await page.goto('/');
      await expect(page.getByRole('heading', { name: 'Вход в систему' })).toBeVisible();
    },
  },
  {
    name: 'список проектов — пусто',
    go: async (page) => {
      await seedSession(page);
    },
  },
  {
    name: 'модалка нового проекта',
    go: async (page) => {
      await seedSession(page);
      await page.getByRole('button', { name: 'Новый проект' }).first().click();
      await expect(page.getByRole('dialog')).toBeVisible();
    },
  },
  {
    name: 'визард — шаг геометрии',
    go: async (page) => {
      await seedSession(page);
      await createProject(page);
    },
  },
  {
    name: 'список проектов — со строкой',
    go: async (page) => {
      await seedSession(page);
      await createProject(page);
      await page.getByRole('button', { name: 'Проекты' }).click();
      await expect(page.getByRole('table')).toBeVisible();
    },
  },
  {
    name: 'панель результата',
    go: async (page) => {
      await seedSession(page);
      await createProject(page);
      await page.getByRole('button', { name: 'Выполнить расчёт' }).click();
      await page.getByRole('button', { name: 'Смотреть результат' }).click();
      await expect(page.getByRole('dialog', { name: /Результат/ })).toBeVisible();
    },
  },
];

for (const screen of SCREENS) {
  test.describe(`Инварианты: ${screen.name}`, () => {
    test('без ошибок в консоли', async ({ page }) => {
      const console_ = watchConsole(page);
      await screen.go(page);
      console_.assertClean();
    });

    test('у каждого контрола есть доступное имя', async ({ page }) => {
      await screen.go(page);
      const nameless = await controlsWithoutAccessibleName(page);
      expect(nameless, `Контролы без подписи на экране «${screen.name}»`).toEqual([]);
    });

    test('каждая подпись связана со своим контролом', async ({ page }) => {
      await screen.go(page);
      const orphans = await orphanLabels(page);
      expect(orphans, `Подписи, указывающие в пустоту, на экране «${screen.name}»`).toEqual([]);
    });

    test('страница не едет по горизонтали', async ({ page }) => {
      await screen.go(page);
      expect(await hasHorizontalOverflow(page), `Горизонтальная прокрутка на экране «${screen.name}»`).toBe(false);
    });
  });
}

test.describe('Инварианты: тема', () => {
  test('тёмная тема не оставляет прозрачный фон и нечитаемый текст', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'dark' });
    await seedSession(page);

    const { bg, fg } = await page.evaluate(() => {
      const style = getComputedStyle(document.body);
      return { bg: style.backgroundColor, fg: style.color };
    });

    // Прозрачный фон означает, что страница одолжила подложку хоста —
    // ровно тот случай, когда тёмный текст ложится на тёмное.
    expect(bg).not.toBe('rgba(0, 0, 0, 0)');
    expect(bg).not.toBe('transparent');
    expect(fg).not.toBe(bg);
  });
});
