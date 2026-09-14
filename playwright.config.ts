import { defineConfig, devices } from '@playwright/test';

/**
 * E2E-проверки core-флоу. Задача набора — ловить регрессии интеграции
 * компонентов дизайн-системы: что экран собрался, состояния переключаются
 * и в консоли пусто. Это дешёвый детерминированный слой; визуальную оценку
 * делает агент `ui-check` поверх этих же тестов.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,

  /**
   * 45 секунд вместо стандартных 30. Сценарии стали тяжелее: почти каждый
   * проходит через окно ввода с его появлением и уходом, а пять рабочих
   * процессов делят одну машину — под нагрузкой отдельные шаги упирались
   * в тридцать секунд там, где поодиночке укладываются в три. Это запас
   * на планировщик, а не на ожидание чего-то по-настоящему долгого.
   */
  timeout: 45_000,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : [['list']],

  use: {
    baseURL: 'http://127.0.0.1:5173',
    // Скриншот и трасса только у упавших: агенту нужен артефакт для разбора,
    // а зелёный прогон не должен плодить мусор.
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
    // Без этого нативный `<input type="date">` рисует `mm/dd/yyyy» —
    // формат браузера по умолчанию в песочнице, а не пользователя.
    locale: 'ru-RU',
  },

  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // В окружении браузеры предустановлены; повторно их не качаем.
        launchOptions: process.env.PLAYWRIGHT_CHROMIUM_PATH
          ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH }
          : {},
      },
    },
  ],

  webServer: {
    command: 'npm run dev -- --host 127.0.0.1 --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
