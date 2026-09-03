import { Badge, Box, Button, EmptyState, Grid, Input, SegmentedControl, Stack, Surface, Text } from '@uralmash/design-system';
import type { SieveInputMode } from '@/types';
import { computeSieve, convertSieveRows, fmt1, round3, type SieveRow } from '@/domain/sieve';

export type SieveAnalysisProps = {
  rows: SieveRow[];
  onRowsChange: (rows: SieveRow[]) => void;
  mode: SieveInputMode;
  /**
   * И режим, и переведённые под него строки — одним вызовом. Раздельные
   * `onRowsChange` + отдельный вызов на смену режима каждый читали бы
   * `data.gran` в момент вызова, и второй патч затирал бы собой то, что
   * первый только что записал (оба вычислены от одного и того же снимка
   * пропа `data`, ещё не увидевшего первое обновление).
   */
  onModeChange: (mode: SieveInputMode, rows: SieveRow[]) => void;
  onApply: (a0: number, va0: number) => void;
};

const MODE_OPTIONS: { value: SieveInputMode; label: string }[] = [
  { value: 'minus', label: 'По минусу' },
  { value: 'plus', label: 'По плюсу' },
  { value: 'classes', label: 'Частные классы' },
];

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <Stack gap="2xs" direction="column">
      <Text variant="caption" color="textMuted">
        {label}
      </Text>
      <Text variant="body">{value}</Text>
    </Stack>
  );
}

/**
 * Редактируемая таблица ситового анализа.
 *
 * `Table` из системы для этого не подходит по роли: он не умеет режим
 * редактирования ячеек, только читает `row[key]` или рисует `render`
 * поверх готовых данных (см. `INVENTORY.md`: «не использовать для
 * раскладки — для формы есть `Grid`»). Раскладка собрана из `Grid` + `Input`,
 * как и предполагает эта же запись инвентаря для формы.
 *
 * Из-за этого подписи полей класса и выхода не вынесены в заголовок таблицы
 * визуально один раз, а идут как `aria-label` на каждой строке: `Field`
 * рисует подпись видимо при каждом использовании, и превращать шесть строк
 * таблицы в шесть повторов одной и той же видимой подписи было бы хуже, чем
 * заголовок столбца текстом сверху + программная подпись на контроле.
 *
 * Вводится только одна из трёх величин выхода (`mode`) — остальные две
 * пересчитываются: по минусу и по плюсу дополняют друг друга до 100 %,
 * частный класс — разность соседних значений по плюсу. Переключение `mode`
 * переводит уже введённые числа в новую величину (`convertSieveRows`),
 * а не стирает их — то же распределение, только под другим столбцом.
 */
export function SieveAnalysis({ rows, onRowsChange, mode, onModeChange, onApply }: SieveAnalysisProps) {
  const computed = computeSieve(rows, mode);
  // Пустое поле выхода численно равно нулю (`toNum('') === 0`), а по минусу
  // = 0 — это осмысленный, ненулевой ввод (100 % ретенции), а не «ничего не
  // ввели». Поэтому готовность действия смотрит на сам факт ввода текста,
  // а не на `computed.total`, которая на пустой строке может внезапно
  // выйти ненулевой.
  const hasInput = rows.some((r) => r.value.trim() !== '');

  const updateRow = (i: number, patch: Partial<SieveRow>) => {
    onRowsChange(rows.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  };
  const addRow = () => onRowsChange([...rows, { cls: '', value: '' }]);
  const removeRow = (i: number) => onRowsChange(rows.filter((_, k) => k !== i));

  const changeMode = (next: SieveInputMode) => {
    onModeChange(next, convertSieveRows(rows, mode, next));
  };

  const activeLabel = MODE_OPTIONS.find((o) => o.value === mode)!.label;
  const passive = MODE_OPTIONS.filter((o) => o.value !== mode);
  const passiveValue = (key: SieveInputMode, row: (typeof computed.rows)[number]) =>
    key === 'minus' ? row.minus : key === 'plus' ? row.plus : row.gamma;

  return (
    <Stack gap="md" direction="column">
      {/* Не `Field` — см. пояснение в `GeometryStep`: `SegmentedControl`
          не принимает id, и обёртка оставила бы подпись без контрола. */}
      <Stack gap="2xs" direction="column" align="start">
        <Text variant="label">Что вводить</Text>
        <SegmentedControl legend="Что вводить" options={MODE_OPTIONS} value={mode} onChange={changeMode} />
      </Stack>

      <Surface level="flat" border radius="md" padding="lg" fullWidth>
        {rows.length === 0 ? (
          <EmptyState
            title="Нет классов крупности"
            description="Добавьте класс крупности и укажите выход, чтобы посчитать d̄, σ, a₀ и Va₀."
            icon="plus"
            action={
              <Button variant="secondary" iconStart="plus" onClick={addRow}>
                Добавить класс
              </Button>
            }
          />
        ) : (
          <Stack gap="lg" direction="column">
            <Stack gap="sm" direction="column">
              <Grid columns={4} gap="md">
                <Text variant="label" color="textMuted">
                  Класс крупности, мм
                </Text>
                <Text variant="label" color="textMuted">
                  {activeLabel}, %
                </Text>
                <Text variant="label" color="textMuted">
                  {passive.map((o) => o.label).join(' / ')}, %
                </Text>
                <span />
              </Grid>

              {computed.rows.map((row, i) => (
                <Grid key={i} columns={4} gap="md" rowGap="xs">
                  <Input
                    fullWidth
                    type="text"
                    placeholder="-0,5+0,3"
                    aria-label={`Класс крупности, строка ${i + 1}`}
                    value={row.cls}
                    onChange={(e) => updateRow(i, { cls: e.target.value })}
                  />
                  <Input
                    fullWidth
                    type="number"
                    aria-label={`${activeLabel}, строка ${i + 1}, %`}
                    value={rows[i].value}
                    onChange={(e) => updateRow(i, { value: e.target.value })}
                  />
                  <Stack direction="row" gap="md" wrap align="baseline">
                    {passive.map((o) => (
                      <Text key={o.value} variant="bodySm" color="textMuted">
                        {/* Пустая строка ввода — не то же самое, что введённый ноль:
                            пересчёт от пустоты показал бы «100» или «0» на пустом
                            месте, как будто что-то посчитано, хотя не введено ничего. */}
                        {o.label} {row.value.trim() === '' ? '—' : fmt1(passiveValue(o.value, row))}
                      </Text>
                    ))}
                  </Stack>
                  <Button icon="trash" variant="ghost" aria-label={`Удалить строку ${i + 1}`} onClick={() => removeRow(i)} />
                </Grid>
              ))}

              {/* `paddingX`+`paddingY`, а не `padding` — см. комментарий у `Box`
                  в `ProjectsPage.tsx`: одиночный `padding` в этой версии
                  компонента гасит сам себя. */}
              <Box background="surfaceSunken" radius="md" paddingX="sm" paddingY="sm" fullWidth>
                <Grid columns={4} gap="md">
                  <Text variant="label">Σ частных классов</Text>
                  <span />
                  <Text variant="label">{fmt1(computed.total)} %</Text>
                  <span />
                </Grid>
              </Box>
            </Stack>

            <Button variant="ghost" iconStart="plus" onClick={addRow}>
              Добавить класс
            </Button>
          </Stack>
        )}
      </Surface>

      {rows.length > 0 ? (
        <Stack direction="row" gap="xl" wrap justify="between" align="end">
          <Stack direction="row" gap="xl" wrap>
            <StatItem label="Средневзвешенная крупность d̄" value={`${round3(computed.dm)} мм`} />
            <StatItem label="Стандартное отклонение σ" value={`${round3(computed.sigma)} мм`} />
            <StatItem label="a₀ = d̄ / dmax" value={String(round3(computed.a0))} />
            <StatItem label="Va₀ = σ / d̄" value={String(round3(computed.va0))} />
          </Stack>

          <Stack direction="row" gap="sm" align="center">
            {computed.dmax === 0 ? (
              <Badge tone="warning">Не распознан класс с верхней границей — a₀ не посчитан</Badge>
            ) : null}
            <Button
              variant="secondary"
              onClick={() => onApply(round3(computed.a0), round3(computed.va0))}
              disabled={!hasInput}
            >
              Записать a₀ и Va₀ в параметры
            </Button>
          </Stack>
        </Stack>
      ) : null}
    </Stack>
  );
}
