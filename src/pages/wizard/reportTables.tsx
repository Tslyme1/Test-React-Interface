import type { ReactNode } from 'react';
import { Badge, Stack, Table, Text } from '@uralmash/design-system';
import type { TableColumn } from '@uralmash/design-system';
import type { CheckRow, GranRow, KvRow, ProfileRow } from '@/domain/estimates';

/**
 * Столбцы таблиц отчёта — одни на все места, где отчёт показывают:
 * страницу этапа (`StepReport`) и окно сборки отчёта (`ReportBuilderModal`).
 *
 * Вынесены сюда, когда мест стало два. Копия столбцов в сборщике
 * разошлась бы с оригиналом на первой же правке — и «Печать» напечатала
 * бы не то, что показывает страница.
 */

export const kvColumns: TableColumn<KvRow>[] = [
  { key: 'label', title: 'Величина' },
  { key: 'value', title: 'Значение', align: 'end' },
  { key: 'unit', title: 'Ед.', align: 'end' },
];

/**
 * Грансостав — теми же массивами, что и в распечатке программы-источника:
 * граница класса, его середина, расчётная ширина куска и доля класса.
 */
export const granColumns: TableColumn<GranRow>[] = [
  { key: 'class', title: 'Класс крупности, мм' },
  { key: 'dMid', title: 'D сред', align: 'end' },
  { key: 'd08', title: '0.8·D пред', align: 'end' },
  { key: 'gamma', title: 'γ', align: 'end' },
  { key: 'pass', title: 'Выход по минусу, %', align: 'end' },
];

/**
 * Профиль камеры по расчётным сечениям — та же таблица, что печатает
 * отчёт этапа 1 методики (§6.2).
 */
export const profileColumns: TableColumn<ProfileRow>[] = [
  { key: 'i', title: 'I' },
  { key: 'l', title: 'L1, мм', align: 'end' },
  { key: 'b1', title: 'β₁', align: 'end' },
  { key: 'r1', title: 'R1, мм', align: 'end' },
  { key: 'a1', title: 'α₁', align: 'end' },
  { key: 'b4', title: 'β₄', align: 'end' },
  { key: 'r4', title: 'R4, мм', align: 'end' },
  { key: 'a4', title: 'α₄', align: 'end' },
  { key: 'lSum', title: 'L сум, мм', align: 'end' },
  { key: 's1', title: 'S1, мм', align: 'end' },
  { key: 'sot', title: 'S1 отк, мм', align: 'end' },
];

/**
 * Встроенные проверки профиля (§3.4 методики). Методика прямо называет их
 * признаком ошибки в исходных данных, поэтому они стоят рядом с таблицей,
 * а не прячутся: посчитать три этапа по не замкнувшемуся профилю можно,
 * но верить результату нельзя.
 */
export const checkColumns: TableColumn<CheckRow>[] = [
  { key: 'label', title: 'Проверка' },
  { key: 'value', title: 'Значение', align: 'end' },
  {
    key: 'ok',
    title: '',
    align: 'end',
    /* `Badge`, а не `Tag`: это статус системы, а не пользовательская метка —
       так и записано в самой системе у `Tag`. Иконка дублирует смысл цвета,
       чтобы результат читался и без различения цветов. */
    render: (row) =>
      row.ok ? (
        <Badge tone="success" icon="check">
          сходится
        </Badge>
      ) : (
        <Badge tone="danger" icon="alertTriangle">
          ошибка
        </Badge>
      ),
  },
];

/**
 * Раздел отчёта: подзаголовок и таблица под ним.
 *
 * Подпись вынесена из самой таблицы наружу: `caption` набирается
 * приглушённым и читается как служебная строка внутри рамки, а разделов
 * в отчёте до десяти — рядом они должны выстраиваться в оглавление, а не
 * теряться в шапках. Скринридеру таблица остаётся подписанной той же
 * строкой (`caption` + `captionHidden`).
 */
export function Section({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <Stack gap="sm" direction="column">
      <Stack direction="row" justify="between" align="center" gap="sm" wrap>
        <Text variant="headingSm">{title}</Text>
        {actions}
      </Stack>
      {children}
    </Stack>
  );
}

/** Таблица раздела: подпись у неё та же, что у подзаголовка, но убрана с экрана. */
export function SectionTable<T>({
  title,
  columns,
  rows,
  rowKey,
}: {
  title: string;
  columns: TableColumn<T>[];
  rows: T[];
  rowKey: (row: T) => string;
}) {
  return <Table columns={columns} rows={rows} rowKey={rowKey} caption={title} captionHidden />;
}
