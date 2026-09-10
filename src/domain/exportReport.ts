import type { GranRow, KvRow, ProfileRow } from './estimates';
import { buildStepReport } from './estimates';
import type { Project, StepKey } from '@/types';
import { STEP_LABELS } from './steps';

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
