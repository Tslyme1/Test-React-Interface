#!/usr/bin/env node
/**
 * ds-docs — приносит документацию дизайн-системы в `.ds-docs/`.
 *
 * Зачем: скиллы `ds-compose` и `ds-review` требуют читать `INVENTORY.md`
 * и `tokens/README.md` перед вёрсткой и ревью, а в npm-пакет системы уходит
 * только `dist` (см. поле `files` её package.json). Без этого шага
 * обязательное первое действие скилла невыполнимо.
 *
 * Копия намеренно временная и не коммитится: единственный источник правды —
 * репозиторий системы. Устаревшая копия в git хуже её отсутствия, потому что
 * ей верят.
 *
 * Запуск: npm run ds:docs
 */

import { mkdirSync, cpSync, existsSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const REPO = process.env.DS_REPO_URL || 'https://github.com/Tslyme1/design-system';
const OUT = '.ds-docs';

/** Что именно нужно скиллам. Больше не тянем — это не зеркало репозитория. */
const WANTED = [
  ['INVENTORY.md', 'INVENTORY.md'],
  ['CLAUDE.md', 'CLAUDE.md'],
  ['src/tokens/README.md', 'tokens/README.md'],
  ['DS-AUDIT.md', 'DS-AUDIT.md'],
];

/**
 * Локальный чекаут, если он есть, экономит клон. В песочнице сессии
 * система уже развёрнута рядом, и ходить в сеть незачем.
 */
const LOCAL = process.env.DS_LOCAL_PATH || '/workspace/tslyme1/design-system';

let source;
let temp = null;

if (existsSync(join(LOCAL, 'INVENTORY.md'))) {
  source = LOCAL;
  console.log(`ds-docs: беру из локального чекаута ${LOCAL}`);
} else {
  temp = join(tmpdir(), `ds-docs-${Date.now()}`);
  console.log(`ds-docs: клонирую ${REPO}`);
  execFileSync('git', ['clone', '--depth', '1', '--quiet', REPO, temp], { stdio: 'inherit' });
  source = temp;
}

rmSync(OUT, { recursive: true, force: true });
mkdirSync(join(OUT, 'tokens'), { recursive: true });

const copied = [];
for (const [from, to] of WANTED) {
  const src = join(source, from);
  if (!existsSync(src)) {
    console.log(`ds-docs: пропущен ${from} — в системе его нет`);
    continue;
  }
  cpSync(src, join(OUT, to));
  copied.push(to);
}

// Пометка происхождения: чтобы через месяц никто не принял копию за исходник.
let revision = 'неизвестно';
try {
  revision = execFileSync('git', ['-C', source, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim();
} catch {
  /* чекаут может быть без .git — не повод падать */
}

writeFileSync(
  join(OUT, 'ОТКУДА.md'),
  [
    '# Это копия, а не исходник',
    '',
    `Файлы принесены из \`${REPO}\` (ревизия \`${revision}\`) командой \`npm run ds:docs\`.`,
    '',
    'Правки здесь бессмысленны — при следующем запуске папка пересоздаётся.',
    'Менять дизайн-систему нужно в её собственном репозитории.',
    '',
    `Обновлено: ${new Date().toISOString()}`,
    '',
  ].join('\n')
);

if (temp) rmSync(temp, { recursive: true, force: true });

console.log(`ds-docs: готово — ${copied.length} файлов в ${OUT}/ (ревизия ${revision})`);
