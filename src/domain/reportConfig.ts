import type { Project, StepKey } from '@/types';
import { STEP_KEYS } from './steps';

/**
 * Раздел отчёта — наименьшее, что в отчёт включают или не включают.
 *
 * Именно раздел, а не этап: в отчёт по «Дробилке» входят пять разных
 * вещей — параметры камеры, таблица профиля, критические углы, проверки
 * и чертёж, — и нужны они разным читателям. Технологу нужны параметры
 * и проверки, конструктору — профиль и чертёж, и печатать им обоим одно
 * и то же значило бы каждому отдать половину нужного и половину лишнего.
 */
export type ReportBlockId =
  | 'geom.params'
  | 'geom.profile'
  | 'geom.alfa'
  | 'geom.checks'
  | 'geom.scheme'
  | 'gran.table'
  | 'gran.chart'
  | 'prod.params'
  | 'prod.gran'
  | 'prod.chart';

/**
 * Что это за раздел. Различие не косметическое: в CSV уходят только
 * таблицы, а графика и чертежа там быть не может — и сказать об этом
 * надо до нажатия «Экспорт», а не после.
 */
export type ReportBlockKind = 'table' | 'chart';

export type ReportBlock = {
  id: ReportBlockId;
  /** Этап, чей это раздел: непосчитанный этап в отчёт не попадает. */
  step: StepKey;
  title: string;
  kind: ReportBlockKind;
};

/**
 * Реестр разделов. Порядок здесь — порядок в отчёте: от геометрии камеры
 * к продукту дробления, как в расчёте.
 */
export const REPORT_BLOCKS: ReportBlock[] = [
  { id: 'geom.params', step: 'geom', title: 'Параметры камеры дробления', kind: 'table' },
  { id: 'geom.profile', step: 'geom', title: 'Профиль камеры по расчётным сечениям', kind: 'table' },
  { id: 'geom.alfa', step: 'geom', title: 'Критические углы поворота эксцентрика', kind: 'table' },
  { id: 'geom.checks', step: 'geom', title: 'Контроль корректности профиля', kind: 'table' },
  { id: 'geom.scheme', step: 'geom', title: 'Схема профиля камеры дробления', kind: 'chart' },
  { id: 'gran.table', step: 'gran', title: 'Характеристика гранулометрического состава', kind: 'table' },
  { id: 'gran.chart', step: 'gran', title: 'Суммарные характеристики крупности питания', kind: 'chart' },
  { id: 'prod.params', step: 'prod', title: 'Продукт дробления', kind: 'table' },
  { id: 'prod.gran', step: 'prod', title: 'Грансостав продукта дробления', kind: 'table' },
  { id: 'prod.chart', step: 'prod', title: 'Суммарные характеристики крупности продукта', kind: 'chart' },
];

export function reportBlock(id: ReportBlockId): ReportBlock {
  return REPORT_BLOCKS.find((b) => b.id === id) ?? REPORT_BLOCKS[0];
}

/**
 * Как собирается состав отчёта.
 *
 * `auto` — сам по расчёту: всё посчитанное входит, непосчитанное нет,
 * и следить за списком не надо. Это то, что нужно в большинстве случаев,
 * и поэтому значение по умолчанию: отчёт «как есть» не должен требовать
 * ни одного решения.
 *
 * `custom` — состав задан руками и больше сам не меняется. Нужен, когда
 * отчёт готовят под конкретного читателя: смежнику незачем таблица
 * критических углов, а в заявку на оснастку не идёт грансостав.
 */
export type ReportMode = 'auto' | 'custom';

export type ReportConfig = {
  /** Заголовок отчёта. Пусто — берётся имя проекта. */
  title: string;
  mode: ReportMode;
  /** Отмеченные разделы. В режиме `auto` не участвуют, но и не теряются. */
  blocks: ReportBlockId[];
  /** Шапка: кто, когда и на какой машине считал. */
  meta: boolean;
  /** Исходные данные этапов — то, из чего посчитано. */
  inputs: boolean;
};

/**
 * Отчёт по умолчанию — полный и автоматический: отмечены все разделы,
 * шапка и исходные данные на месте. Переключение в «Настраиваемый» тогда
 * начинается с «что убрать», а не с пустого списка, который ещё надо
 * собрать, чтобы увидеть хоть что-нибудь.
 */
export function defaultReportConfig(): ReportConfig {
  return {
    title: '',
    mode: 'auto',
    blocks: REPORT_BLOCKS.map((b) => b.id),
    meta: true,
    inputs: true,
  };
}

/** Посчитанные этапы проекта — только их разделы имеют содержимое. */
export function calculatedSteps(project: Project): StepKey[] {
  return STEP_KEYS.filter((_key, i) => project.calc[i]);
}

/**
 * Разделы, которые войдут в отчёт, в порядке реестра.
 *
 * Непосчитанный этап отсекается в обоих режимах, а не только в `auto`:
 * отметка в настраиваемом списке — это «включить, когда будет», а не
 * обещание напечатать пустую таблицу.
 */
export function resolveReportBlocks(project: Project, config: ReportConfig): ReportBlock[] {
  const done = new Set(calculatedSteps(project));
  return REPORT_BLOCKS.filter(
    (block) => done.has(block.step) && (config.mode === 'auto' || config.blocks.includes(block.id))
  );
}

/** Заголовок отчёта: свой, а если его не писали — имя проекта. */
export function reportTitle(project: Project, config: ReportConfig): string {
  return config.title.trim() || project.name;
}
