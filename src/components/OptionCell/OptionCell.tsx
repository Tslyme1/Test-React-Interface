import { Cell, Checkbox, Radio } from '@uralmash/design-system';

export type OptionCellProps = {
  label: string;
  description?: string;
  checked: boolean;
  onSelect: () => void;
  kind?: 'radio' | 'checkbox';
};

/**
 * Строка выбора — тот же ряд, что и вариант `Select` (`Cell` с флажком
 * или отметкой в правом слоте, а не голый `Checkbox`/`Radio` посреди
 * панели): высота из шкалы контролов и подсветка при наведении вместо
 * мелкого контрола без чужого поля вокруг. Используется и в списках
 * поповеров (режим отображения, слои схемы), и отдельными строками
 * на всю ширину (режим работы в профиле).
 *
 * Флажок/переключатель здесь декоративны (`readOnly`, вне табуляции) —
 * переключает состояние сама строка через `onClick`, как и у `Cell`
 * с флажком внутри `Select`.
 *
 * Без `selected` у самой `Cell`: заливка выбранного и так дублирует то,
 * что уже показывает флажок/радио в правом слоте — вместе это читалось
 * как две разных отметки одного и того же. `aria-selected` остаётся
 * для доступности, только визуальную заливку убрали.
 */
export function OptionCell({ label, description, checked, onSelect, kind = 'radio' }: OptionCellProps) {
  return (
    <Cell
      size="md"
      role="option"
      aria-selected={checked}
      description={description}
      onClick={onSelect}
      trailing={
        kind === 'checkbox' ? (
          <Checkbox checked={checked} readOnly tabIndex={-1} />
        ) : (
          <Radio checked={checked} readOnly tabIndex={-1} />
        )
      }
    >
      {label}
    </Cell>
  );
}
