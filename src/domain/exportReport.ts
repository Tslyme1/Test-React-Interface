import type { GranRow, KvRow, ProfileRow } from './estimates';
import { buildStepReport } from './estimates';
import type { Project, StepKey } from '@/types';
import { STEP_KEYS, STEP_LABELS, STEP_TITLES } from './steps';
import {
  estimateGeom,
  estimateGeomAlfa,
  estimateGeomChecks,
  estimateGeomProfile,
  estimateGran,
  estimateProd,
  estimateProdGran,
} from './estimates';
import { resolveReportBlocks, reportTitle } from './reportConfig';
import type { ReportBlock, ReportConfig } from './reportConfig';
import { stepSummary } from './stepSummary';
import { NEW_DESIGN_LABEL } from './projectLabels';

/** Разделитель `;`, а не `,`: с русской локалью Excel открывает CSV этим разделителем сам, без диалога импорта. */
const DELIMITER = ';';

function csvCell(value: string): string {
  return /["\n;]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function csvRow(cells: string[]): string {
  return cells.map(csvCell).join(DELIMITER) + '\r\n';
}

function kvTableCsv(title: string, rows: KvRow[]): string {
  return csvRow([title]) + csvRow(['Величина', 'Значение', 'Ед.']) + rows.map((r) => csvRow([r.label, r.value, r.unit])).join('');
}

function granTableCsv(title: string, rows: GranRow[]): string {
  return (
    csvRow([title]) +
    csvRow(['Класс крупности, мм', 'D сред', '0.8·D пред', 'γ', 'Выход по минусу, %']) +
    rows.map((r) => csvRow([r.class, r.dMid, r.d08, r.gamma, r.pass])).join('')
  );
}

function profileTableCsv(rows: ProfileRow[]): string {
  return (
    csvRow(['Профиль камеры по расчётным сечениям']) +
    csvRow(['I', 'L1, мм', 'β₁', 'R1, мм', 'α₁', 'β₄', 'R4, мм', 'α₄', 'L сум, мм', 'S1, мм', 'S1 отк, мм']) +
    rows.map((r) => csvRow([r.i, r.l, r.b1, r.r1, r.a1, r.b4, r.r4, r.a4, r.lSum, r.s1, r.sot])).join('')
  );
}

/**
 * Экспорт шага в CSV — тот же отчёт, что и в печати (`buildStepReport`),
 * только строками с разделителем вместо HTML-таблицы. CSV, а не настоящий
 * `.xlsx`: Excel открывает его без внешней библиотеки для сборки бинарного
 * формата, а разбор по столбцам получает тот же самый.
 */
export function exportStepToExcel(project: Project, stepKey: StepKey): void {
  const report = buildStepReport(project, stepKey);
  const meta = csvRow([`${project.crusherName} · ${project.customer} · ${project.code}`]) + csvRow([]);

  let body: string;
  if (report.kind === 'gran') {
    body = granTableCsv(report.title, report.rows);
  } else {
    body = kvTableCsv(report.title, report.rows);
    if (report.profile) body += csvRow([]) + profileTableCsv(report.profile);
    if (report.gran) body += csvRow([]) + granTableCsv('Грансостав продукта дробления', report.gran);
  }

  // BOM — иначе Excel читает кириллицу в UTF-8 CSV как набор вопросительных знаков.
  downloadTextFile(`${project.code} — ${STEP_LABELS[stepKey]}.csv`, '﻿' + meta + body, 'text/csv;charset=utf-8');
}

/**
 * Имя параметра для CAD — только латиница, цифры и `_`, не начинается
 * с цифры. Источник (`estimateGeom`) даёт русские подписи с индексами
 * и знаками («D₀, мм», «α — угол...») — они читаемы человеком в таблице
 * результата, но не годятся именем переменной в параметрической модели.
 */
const CAD_PARAM_NAMES: Record<string, string> = {
  'D — диаметр основания конуса': 'D',
  'H — до основания конуса от подвеса': 'H',
  'S₀ — разгрузочная щель': 'S0',
  'θ — угол нутации': 'theta',
  'Число зон дробления': 'zones',
  'Число расчётных сечений': 'sections',
  'DI2 — диаметр нижнего сечения': 'DI2',
  'H2 — высота нижнего сечения': 'H2',
  'R2 — радиус-вектор разгрузочной кромки': 'R2',
  'α₂ — его угол к оси': 'alpha2',
  'S1 в верхнем сечении': 'S1_top',
  'SOT в верхнем сечении — приёмное отверстие': 'SOT_top',
  'SOT в нижнем сечении': 'SOT_bottom',
  'L сум — полная длина профиля': 'L_sum',
  'Q — объём камеры': 'volume',
};

function cadParamName(label: string, index: number): string {
  return CAD_PARAM_NAMES[label] ?? `param_${index + 1}`;
}

/**
 * Экспорт геометрии первого этапа в текстовый файл параметров для
 * КОМПАС-3D — простой текст `имя = значение`, который удобно перенести
 * в переменные параметрической модели камеры дробления. Только первый
 * этап: у него есть геометрический профиль камеры, который и передают
 * в CAD, — грансостав и продукт дробления параметрами модели не являются.
 */
export function exportGeomToKompas(project: Project): void {
  const rows = buildStepReport(project, 'geom');
  if (rows.kind !== 'kv') return;

  const lines = [
    `// ${project.crusherName} · ${project.customer} · ${project.code}`,
    '// Экспортировано из интерфейса подбора конусных дробилок КМД/КСД',
    '',
    ...rows.rows.map((r, i) => `${cadParamName(r.label, i)} = ${r.value} // ${r.label}${r.unit ? `, ${r.unit}` : ''}`),
  ];

  downloadTextFile(`${project.code} — геометрия.txt`, lines.join('\r\n') + '\r\n', 'text/plain;charset=utf-8');
}

function downloadTextFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

/** Таблица проверок профиля — «сходится / ошибка» словом, галочки в CSV нет. */
function checkTableCsv(title: string, rows: { label: string; value: string; ok: boolean }[]): string {
  return (
    csvRow([title]) +
    csvRow(['Проверка', 'Значение', 'Результат']) +
    rows.map((r) => csvRow([r.label, r.value, r.ok ? 'сходится' : 'ошибка'])).join('')
  );
}

/**
 * Один раздел собранного отчёта строками CSV. `null` — раздела в CSV
 * не существует: чертёж камеры и графики это картинки, а в таблице
 * значений им места нет. Молча пропустить их нельзя — об этом говорит
 * само окно сборки, ещё до нажатия «Экспорт».
 */
function reportBlockCsv(project: Project, block: ReportBlock): string | null {
  const { geom, gran, prod } = project.data;

  switch (block.id) {
    case 'geom.params':
      return kvTableCsv(block.title, estimateGeom(geom));
    case 'geom.profile':
      return profileTableCsv(estimateGeomProfile(geom));
    case 'geom.alfa':
      return kvTableCsv(block.title, estimateGeomAlfa(geom));
    case 'geom.checks':
      return checkTableCsv(block.title, estimateGeomChecks(geom));
    case 'gran.table':
      return granTableCsv(block.title, estimateGran(gran));
    case 'prod.params':
      return kvTableCsv(block.title, estimateProd(prod, geom));
    case 'prod.gran':
      return granTableCsv(block.title, estimateProdGran(prod));
    default:
      return null; // чертёж и графики
  }
}

/**
 * Выгрузка собранного отчёта в CSV — ровно те разделы, что отмечены
 * в окне сборки, и в том же порядке.
 *
 * Отдельно от `exportStepToExcel`: та выгружает один этап целиком
 * и останется нужна, пока отчёт по этапу открывают с его страницы.
 * Здесь выгружается документ, который собрали, — со своим заголовком,
 * шапкой и исходными данными.
 */
export function exportProjectReport(project: Project, config: ReportConfig): void {
  const blocks = resolveReportBlocks(project, config);
  const title = reportTitle(project, config);

  let out = csvRow([title]);

  if (config.meta) {
    out +=
      csvRow(['Проект', project.name]) +
      csvRow(['Код проекта', project.code]) +
      csvRow(['Заказчик', project.customer]) +
      csvRow(['Дробилка', project.crusherName || NEW_DESIGN_LABEL]) +
      csvRow(['Проба руды', project.ore || '—']) +
      csvRow(['Исполнитель', project.executor]) +
      csvRow([]);
  }

  if (config.inputs) {
    for (const stepKey of STEP_KEYS) {
      if (!project.calc[STEP_KEYS.indexOf(stepKey)]) continue;
      out +=
        csvRow([`Исходные данные — ${STEP_TITLES[stepKey]}`]) +
        stepSummary(project, stepKey)
          .map((item) => csvRow([item.label, item.value]))
          .join('') +
        csvRow([]);
    }
  }

  for (const block of blocks) {
    const table = reportBlockCsv(project, block);
    /* Картинка в CSV не представима — но и умалчивать о ней нельзя:
       строка-заглушка говорит, что раздел в отчёте есть, просто
       его место в распечатке, а не в таблице значений. */
    out += (table ?? csvRow([block.title]) + csvRow(['(график — только в печатном отчёте)'])) + csvRow([]);
  }

  // BOM — иначе Excel читает кириллицу в UTF-8 CSV как набор вопросительных знаков.
  downloadTextFile(`${project.code} — отчёт.csv`, '\ufeff' + out, 'text/csv;charset=utf-8');
}
