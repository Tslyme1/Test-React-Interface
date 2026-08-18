#!/usr/bin/env node
/**
 * ds-lint — проверка кода приложения на обход дизайн-системы.
 *
 * Правила и регулярные выражения перенесены из `scripts/ds-lint.mjs`
 * репозитория Tslyme1/design-system (в npm-пакет попадает только `dist/`,
 * поэтому переиспользовать файл импортом нельзя — это копия).
 *
 * Отличие от оригинала одно, и оно принципиальное: список разрешённых
 * путей пуст. В самой системе `tokens/` и `primitives/` обязаны обращаться
 * к сырым значениям — там система реализуется. В потребляющем приложении
 * такого места нет: любое сырое значение здесь означает, что компонент
 * или токен применили в обход, и шкала начала расходиться.
 *
 * Локальное исключение — комментарий `ds-lint-disable` в строке. Каждое
 * такое место стоит обсуждать, а не оставлять молча.
 *
 * Запуск: node scripts/ds-lint.mjs src
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, extname } from 'node:path';

const ROOT = process.argv[2] || 'src';
const EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.css']);

/** В приложении сырые значения не легальны нигде. */
const ALLOWED = [];

const CSS = new Set(['.css']);
const CODE = new Set(['.ts', '.tsx', '.js', '.jsx']);

const RULES = [
  {
    id: 'raw-color',
    scope: null,
    re: /#[0-9a-fA-F]{3,8}\b|\brgba?\(|\bhsla?\(|\boklch\(/g,
    msg: 'Сырой цвет. Используй семантическую роль дизайн-системы.',
  },
  {
    id: 'raw-px-css',
    scope: CSS,
    re: /(?<!line-)(?:padding|margin|gap|border-radius|font-size|row-gap|column-gap)(?:-(?:top|right|bottom|left|inline|block))?\s*:\s*-?\d+(?:\.\d+)?(?:px|rem|em)/g,
    msg: 'Сырое значение в CSS. Используй var(--space-*) / var(--radius-*) / var(--text-*).',
  },
  {
    id: 'spacing-margin',
    scope: CSS,
    /**
     * Аналог правила `spacing-margin` из кита, переписанный под CSS Modules:
     * в оригинале оно ловит Tailwind-классы (`mt-4`), которых здесь нет.
     *
     * `0` и `auto` остаются легальными: это сброс и центрирование, а не
     * расстояние между соседями. Отрицательные значения тоже ловятся —
     * ими обычно чинят то, что должен был решить родительский Stack.
     *
     * `\s*` в начале проверки не лишний: без него движок откатывает
     * предыдущий `\s*`, встаёт на пробел перед значением и проскакивает
     * мимо исключения — `margin: 0` начинает считаться нарушением.
     */
    re: /(?:^|[;{\s])margin(?:-(?:top|right|bottom|left|inline|block))?\s*:\s*(?!\s*(?:(?:0(?:px|rem|em|%)?|auto)\s*)+(?:[;}]|$))[^;}]+/g,
    msg: 'Margin для расстояния между соседями. Используй <Stack gap>.',
  },
  {
    id: 'style-object-size',
    scope: CODE,
    re: /\b(?:padding|margin|gap|rowGap|columnGap|fontSize|borderRadius)(?:Top|Right|Bottom|Left|Inline|Block)?\s*:\s*(?:-?\d+(?:\.\d+)?\b|['"`]-?\d)/g,
    msg: 'Число в объекте стилей. Размеры задаются пропами примитивов (Stack gap, Box padding).',
  },
  {
    id: 'style-object-color',
    scope: CODE,
    re: /\b(?:color|background|backgroundColor|borderColor)\s*:\s*['"`](?:red|blue|green|white|black|gray|grey|silver|yellow|orange|purple|pink|brown|navy|teal|olive|maroon|lime|aqua|fuchsia|[a-z-]*gradient\()/gi,
    msg: 'Сырой цвет строкой в объекте стилей. Используй семантическую роль.',
  },
  {
    id: 'primitive-import',
    scope: CODE,
    re: /from\s+['"][^'"]*tokens\/primitives['"]/g,
    msg: 'Прямой импорт примитивов. Импортируй из публичного входа дизайн-системы.',
  },
  {
    id: 'fixed-height-css',
    scope: CSS,
    re: /(?:^|[;{\s])(?:height|min-height)\s*:\s*\d+(?:\.\d+)?(?:px|rem|em)/g,
    msg: 'Фиксированная высота. Блок с текстом не должен её иметь; для контролов есть var(--control-*).',
  },
  {
    id: 'dashed-css-class',
    scope: CSS,
    re: /^\s*\.[a-zA-Z][a-zA-Z0-9]*-[a-zA-Z0-9-]+\s*[,{]/g,
    msg: 'Дефис в имени класса CSS-модуля. Из экспорта такой ключ удаляется — пиши camelCase.',
  },
  {
    id: 'raw-z-index',
    scope: null,
    re: /z-index\s*:[ \t]*\d+|zIndex\s*:[ \t]*\d+/g,
    msg: 'Сырой z-index. Используй var(--z-*) — иначе слои начнут спорить.',
  },
  {
    id: 'raw-font-family',
    scope: CSS,
    re: /font-family\s*:(?![^;]*var\()[^;]+;/g,
    msg: 'Гарнитура напрямую. Используй var(--font-heading) / var(--font-body).',
  },
];

function walk(dir, acc = []) {
  let entries;
  try {
    entries = readdirSync(dir);
  } catch {
    return acc;
  }
  for (const e of entries) {
    if (e === 'node_modules' || e.startsWith('.')) continue;
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, acc);
    else if (EXTS.has(extname(p))) acc.push(p);
  }
  return acc;
}

const files = walk(ROOT);
const violations = [];

for (const file of files) {
  if (ALLOWED.some((a) => file.includes(a))) continue;
  const ext = extname(file);
  const lines = readFileSync(file, 'utf8').split('\n');
  lines.forEach((line, i) => {
    if (/ds-lint-disable/.test(line)) return;
    for (const rule of RULES) {
      if (rule.scope && !rule.scope.has(ext)) continue;
      rule.re.lastIndex = 0;
      let m;
      while ((m = rule.re.exec(line)) !== null) {
        violations.push({ file, line: i + 1, rule: rule.id, match: m[0].trim(), msg: rule.msg });
      }
    }
  });
}

/**
 * Обращение к несуществующему классу CSS-модуля.
 *
 * `styles.cardSlot` при удалённом `.cardSlot` — это `undefined`, а
 * `className={undefined}` не ошибка: элемент просто теряет все стили.
 */
for (const file of files) {
  if (!CODE.has(extname(file))) continue;

  const src = readFileSync(file, 'utf8');
  const moduleImport = src.match(/import\s+(\w+)\s+from\s+['"]([^'"]+\.module\.css)['"]/);
  if (!moduleImport) continue;

  const [, binding, relative] = moduleImport;
  const cssPath = join(file, '..', relative);
  let css;
  try {
    css = readFileSync(cssPath, 'utf8');
  } catch {
    continue;
  }

  const defined = new Set([...css.matchAll(/\.([a-zA-Z_][\w-]*)/g)].map((m) => m[1]));

  const bracket = [...src.matchAll(new RegExp(`\\b${binding}\\[['"]([^'"]+)['"]\\]`, 'g'))];
  const codeOnly = src.replace(/(['"])(?:\\.|(?!\1).)*\1/g, '""');
  const dotted = [...codeOnly.matchAll(new RegExp(`\\b${binding}\\.([a-zA-Z_]\\w*)`, 'g'))];

  for (const match of [...bracket, ...dotted]) {
    if (defined.has(match[1])) continue;
    const line = src.slice(0, match.index).split('\n').length;
    violations.push({
      file,
      line,
      rule: 'unknown-css-class',
      match: `${binding}.${match[1]}`,
      msg: `Класса .${match[1]} нет в ${relative}. className={undefined} не падает — элемент молча теряет стили.`,
    });
  }
}

if (violations.length === 0) {
  console.log(`ds-lint: чисто — ${files.length} файлов проверено.`);
  process.exit(0);
}

const byRule = violations.reduce((acc, v) => {
  (acc[v.rule] ||= []).push(v);
  return acc;
}, {});

console.log(`\nds-lint: найдено ${violations.length} нарушений в ${files.length} файлах.\n`);
for (const [rule, list] of Object.entries(byRule)) {
  console.log(`── ${rule} (${list.length}) — ${list[0].msg}`);
  for (const v of list.slice(0, 20)) {
    console.log(`   ${v.file}:${v.line}  ${v.match}`);
  }
  if (list.length > 20) console.log(`   … ещё ${list.length - 20}`);
  console.log('');
}
process.exit(1);
