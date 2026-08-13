#!/usr/bin/env node
/**
 * Снимает ключевые экраны в светлой и тёмной теме — материал для
 * визуального разбора агентом `ui-check`. Тесты проверяют поведение;
 * здесь берётся то, на что нужно посмотреть глазами.
 *
 * Запуск: node scripts/capture-screens.mjs [outDir]
 *
 * Сервер поднимается сам и гасится после съёмки: снимать с собранной
 * статики и быстрее, и честнее — дев-сервер компилирует модули по запросу
 * и под несколькими вкладками разом просто не успевает. Если сервер уже
 * где-то поднят, передай его адрес в REVIEW_BASE_URL.
 */

import { mkdirSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

const OUT = process.argv[2] || 'screenshots-review';
const EXTERNAL_BASE = process.env.REVIEW_BASE_URL;
const PORT = Number(process.env.REVIEW_PORT || 4173);
const BASE = EXTERNAL_BASE || `http://127.0.0.1:${PORT}`;
const EXECUTABLE = process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined;

const SESSION = {
  login: 'ivanov',
  password: '1234',
  name: 'Иванов Алексей Сергеевич',
  email: 'ivanov@uztm.ru',
  role: 'Инженер',
};

const PROJECT = {
  name: 'Тестовый проект',
  customer: 'ЕВРАЗ КГОК',
  crusher: 'КСД-1750Т',
  ore: 'Магнетитовая руда',
};

async function seed(page) {
  await page.addInitScript((s) => localStorage.setItem('uztm-session', JSON.stringify(s)), SESSION);
  await page.goto(BASE);
}

async function createProject(page) {
  await page.getByRole('button', { name: 'Новый проект' }).first().click();
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Название проекта').fill(PROJECT.name);
  await dialog.getByRole('button', { name: /Заказчик/ }).click();
  await page.getByRole('option', { name: PROJECT.customer }).click();
  await dialog.getByRole('button', { name: /Дробилка/ }).click();
  await page.getByRole('option', { name: PROJECT.crusher }).click();
  await dialog.getByRole('button', { name: /Проба руды/ }).click();
  await page.getByRole('option', { name: PROJECT.ore }).click();
  await page.getByRole('button', { name: 'Создать проект' }).click();
  await page.getByRole('heading', { name: 'Геометрия камеры дробления' }).waitFor();
}

/** Экран = имя + сценарий доводки страницы до нужного состояния. */
const SCREENS = [
  ['01-login', async (page) => { await page.goto(BASE); }],
  ['02-projects-empty', seed],
  [
    '03-new-project-modal',
    async (page) => {
      await seed(page);
      await page.getByRole('button', { name: 'Новый проект' }).first().click();
      await page.getByRole('dialog').waitFor();
    },
  ],
  ['04-wizard-geometry', async (page) => { await seed(page); await createProject(page); }],
  [
    '05-wizard-calculated',
    async (page) => {
      await seed(page);
      await createProject(page);
      await page.getByRole('button', { name: 'Выполнить расчёт' }).click();
      await page.getByRole('button', { name: 'Смотреть результат' }).waitFor();
    },
  ],
  [
    '06-results-drawer',
    async (page) => {
      await seed(page);
      await createProject(page);
      await page.getByRole('button', { name: 'Выполнить расчёт' }).click();
      await page.getByRole('button', { name: 'Смотреть результат' }).click();
      await page.getByRole('dialog', { name: /Результат/ }).waitFor();
    },
  ],
  [
    '07-projects-list',
    async (page) => {
      await seed(page);
      await createProject(page);
      await page.getByRole('button', { name: 'Проекты' }).click();
      await page.getByRole('table').waitFor();
    },
  ],
  [
    '08-wizard-gran',
    async (page) => {
      await seed(page);
      await createProject(page);
      await page.getByRole('button', { name: 'Выполнить расчёт' }).click();
      await page.getByRole('button', { name: /Грансостав/ }).click();
      await page.getByRole('heading', { name: 'Характеристический грансостав' }).waitFor();
    },
  ],
];

/** Ждёт, пока сервер начнёт отвечать. Без опроса кадры уходят в пустоту. */
async function waitForServer(url, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  for (;;) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // сервер ещё поднимается
    }
    if (Date.now() > deadline) throw new Error(`Сервер не поднялся: ${url}`);
    await new Promise((r) => setTimeout(r, 400));
  }
}

let server = null;

if (!EXTERNAL_BASE) {
  console.log('Сборка…');
  await new Promise((resolve, reject) => {
    const build = spawn('npx', ['vite', 'build'], { stdio: 'inherit', shell: false });
    build.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`vite build упал: ${code}`))));
    build.on('error', reject);
  });

  server = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], {
    stdio: 'ignore',
    shell: false,
  });
}

mkdirSync(OUT, { recursive: true });
await waitForServer(BASE);

const browser = await chromium.launch({ executablePath: EXECUTABLE });
let failed = 0;

/**
 * Съёмка идёт параллельно: экраны независимы, состояние приложения живёт
 * в памяти вкладки. Последовательный проход занимал впятеро дольше,
 * а именно эту команду агент запускает на каждой проверке.
 *
 * Два потока — не осторожность, а измеренный потолок: на четырёх вкладках
 * навигация начинает отваливаться по таймауту (Playwright на этой же
 * машине сам выбирает два воркера). Поднимать через REVIEW_CONCURRENCY.
 */
const CONCURRENCY = Number(process.env.REVIEW_CONCURRENCY || 2);

const jobs = ['light', 'dark'].flatMap((scheme) => SCREENS.map(([name, go]) => ({ scheme, name, go })));

const queue = [...jobs];

async function worker() {
  for (;;) {
    const job = queue.shift();
    if (!job) return;

    /**
     * Свой контекст на каждый кадр, а не один на тему.
     * localStorage принадлежит контексту, а не вкладке: пока экраны делили
     * общий контекст, соседняя джоба успевала записать сессию, и экран входа
     * снимался уже залогиненным. Изоляция здесь дороже на несколько
     * миллисекунд и полностью убирает гонку.
     */
    const context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      colorScheme: job.scheme,
    });
    const page = await context.newPage();

    try {
      await job.go(page);
      // Кадр берётся после успокоения анимаций: панель и модалка выезжают.
      await page.waitForTimeout(400);
      await page.screenshot({ path: `${OUT}/${job.name}-${job.scheme}.png`, fullPage: false });
      console.log(`✓ ${job.name}-${job.scheme}`);
    } catch (e) {
      failed += 1;
      console.log(`✗ ${job.name}-${job.scheme}: ${String(e).split('\n')[0]}`);
      await page.screenshot({ path: `${OUT}/${job.name}-${job.scheme}-FAILED.png` }).catch(() => {});
    } finally {
      await context.close();
    }
  }
}

await Promise.all(Array.from({ length: CONCURRENCY }, worker));

await browser.close();

// Сервер, поднятый этим скриптом, им же и гасится — иначе он останется
// держать порт и следующий запуск упадёт на strictPort.
server?.kill();

console.log(`\nСнимки в ${OUT}/ — экранов: ${SCREENS.length} × 2 темы, ошибок: ${failed}`);
process.exit(failed > 0 ? 1 : 0);
