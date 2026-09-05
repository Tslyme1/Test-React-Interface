import type { Project, StepKey } from '@/types';
import { buildStepReport } from './estimates';
import { STEP_LABELS } from './steps';

/**
 * Печать одного шага проекта — открывает отдельный документ и сразу
 * посылает его на печать, как «Печать по шагам» в исходном прототипе.
 *
 * Отдельное окно, а не печать текущей страницы: печатать нужно ровно
 * таблицу шага, а не весь интерфейс со списком, фильтрами и корзиной —
 * в прототипе это решалось атрибутом на `<body>` и специальным printCSS,
 * здесь то же самое проще получить отдельным документом, у которого
 * кроме отчёта ничего нет.
 *
 * Стили печати — чёрным по белому, ключевыми словами CSS (`black`,
 * `white`, `gray`), а не токенами системы: документ открывается пустым
 * окном без её `styles.css`, доступа к `var(--color-*)` у него нет.
 */
export function printStepReport(project: Project, stepKey: StepKey): void {
  const report = buildStepReport(project, stepKey);
  // Без `noopener`: с ним `window.open` по спецификации возвращает `null`
  // (окно при этом всё равно открывается — оно просто остаётся пустым,
  // писать в него уже нечем). Ссылка на `opener` не нужна ни атакующему,
  // ни нам — документ открываем свой же, тут же и пишем сами.
  const win = window.open('', '_blank', 'width=800,height=1000');
  if (!win) return; // блокировщик всплывающих окон — молча, без падения интерфейса

  const num = (v: string) => `<td class="num">${escapeHtml(v)}</td>`;

  const rowsHtml =
    report.kind === 'gran'
      ? report.rows
          .map((r) => `<tr><td>${escapeHtml(r.class)}</td>${num(r.dMid)}${num(r.d08)}${num(r.gamma)}${num(r.pass)}</tr>`)
          .join('')
      : report.rows.map((r) => `<tr><td>${escapeHtml(r.label)}</td>${num(r.value)}${num(r.unit)}</tr>`).join('');

  const headHtml =
    report.kind === 'gran'
      ? '<tr><th>Класс крупности, мм</th><th class="num">D сред</th><th class="num">0.8·D пред</th><th class="num">γ</th><th class="num">Выход по минусу, %</th></tr>'
      : '<tr><th>Величина</th><th class="num">Значение</th><th class="num">Ед.</th></tr>';

  /**
   * Профиль камеры по точкам печатается второй таблицей — он есть только
   * у шага «Геометрия», и в распечатке программы-источника стоит там же,
   * отдельным блоком под параметрами камеры.
   */
  const profileHtml =
    report.kind === 'kv' && report.profile
      ? `<h2>Профиль камеры по расчётным сечениям</h2>
  <table>
    <thead><tr><th>I</th><th class="num">L1, мм</th><th class="num">β₁</th><th class="num">R1, мм</th><th class="num">α₁</th><th class="num">β₄</th><th class="num">R4, мм</th><th class="num">α₄</th><th class="num">L сум, мм</th><th class="num">S1, мм</th><th class="num">S1 отк, мм</th></tr></thead>
    <tbody>${report.profile
      .map((r) => `<tr><td>${escapeHtml(r.i)}</td>${num(r.l)}${num(r.b1)}${num(r.r1)}${num(r.a1)}${num(r.b4)}${num(r.r4)}${num(r.a4)}${num(r.lSum)}${num(r.s1)}${num(r.sot)}</tr>`)
      .join('')}</tbody>
  </table>`
      : '';

  /**
   * Грансостав продукта печатается второй таблицей у шага «Продукт» —
   * та же роль, что у профиля камеры на «Геометрии»: развёрнутые данные
   * под сводными величинами. График на печать не идёт: печатная страница
   * своя, без токенов системы, и рисовать его заново — сложность больше,
   * чем стоит вопрос ради статичной распечатки.
   */
  const granHtml =
    report.kind === 'kv' && report.gran
      ? `<h2>Грансостав продукта дробления</h2>
  <table>
    <thead><tr><th>Класс крупности, мм</th><th class="num">D сред</th><th class="num">0.8·D пред</th><th class="num">γ</th><th class="num">Выход по минусу, %</th></tr></thead>
    <tbody>${report.gran
      .map((r) => `<tr><td>${escapeHtml(r.class)}</td>${num(r.dMid)}${num(r.d08)}${num(r.gamma)}${num(r.pass)}</tr>`)
      .join('')}</tbody>
  </table>`
      : '';

  win.document.write(`<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<title>${escapeHtml(`Печать — ${project.crusherName} — ${STEP_LABELS[stepKey]}`)}</title>
<style>
  body { font-family: system-ui, sans-serif; color: black; background: white; margin: 24px; }
  h1 { font-size: 18px; margin: 0 0 4px; } /* ds-lint-disable: печатный CSS отдельного документа, у токенов системы сюда нет доступа */
  h2 { font-size: 15px; margin: 20px 0 4px; } /* ds-lint-disable: печатный CSS отдельного документа */
  .meta { font-size: 13px; color: gray; margin-bottom: 4px; }
  .note { font-size: 12px; color: gray; margin-bottom: 20px; }
  table { border-collapse: collapse; width: 100%; }
  th, td { border: 1px solid gray; padding: 6px 10px; text-align: left; font-size: 13px; }
  th { background: white; font-weight: 600; }
  .num { text-align: right; }
</style>
</head>
<body>
  <h1>${escapeHtml(report.title)}</h1>
  <div class="meta">${escapeHtml(project.crusherName)} · ${escapeHtml(project.customer)} · ${escapeHtml(project.code)}</div>
  <div class="note">Значения — иллюстративная оценка на основе введённых параметров, а не результат полной инженерной методики дробления.</div>
  <table>
    <thead>${headHtml}</thead>
    <tbody>${rowsHtml}</tbody>
  </table>
  ${profileHtml}
  ${granHtml}
</body>
</html>`);
  win.document.close();

  // `onload` у части браузеров не срабатывает для документа, написанного
  // через `document.write` в уже открытое окно, — печать вызывается один
  // раз, каким бы путём событие ни пришло.
  let printed = false;
  const printOnce = () => {
    if (printed) return;
    printed = true;
    win.print();
  };
  win.onload = printOnce;
  setTimeout(printOnce, 200);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
