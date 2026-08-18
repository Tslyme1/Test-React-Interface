import { Badge, Box, Button, EmptyState, Grid, Input, Stack, Surface, Text } from '@uralmash/design-system';
import { computeSieve, fmt1, round3, type SieveRow } from '@/domain/sieve';

export type SieveAnalysisProps = {
  rows: SieveRow[];
  onRowsChange: (rows: SieveRow[]) => void;
  onApply: (a0: number, va0: number) => void;
};

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
 * Из-за этого подписи полей класса и массы не вынесены в заголовок таблицы
 * визуально один раз, а идут как `aria-label` на каждой строке: `Field`
 * рисует подпись видимо при каждом использовании, и превращать шесть строк
 * таблицы в шесть повторов одной и той же видимой подписи было бы хуже, чем
 * заголовок столбца текстом сверху + программная подпись на контроле.
 */
export function SieveAnalysis({ rows, onRowsChange, onApply }: SieveAnalysisProps) {
  const computed = computeSieve(rows);

  const updateRow = (i: number, patch: Partial<SieveRow>) => {
    onRowsChange(rows.map((r, k) => (k === i ? { ...r, ...patch } : r)));
  };
  const addRow = () => onRowsChange([...rows, { cls: '', mass: '' }]);
  const removeRow = (i: number) => onRowsChange(rows.filter((_, k) => k !== i));

  return (
    <Stack gap="md" direction="column">
      <Surface level="flat" border radius="md" padding="lg" fullWidth>
        {rows.length === 0 ? (
          <EmptyState
            title="Нет классов крупности"
            description="Добавьте класс крупности с массой пробы, чтобы посчитать выход, d̄, σ, a₀ и Va₀."
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
                  Масса класса, г
                </Text>
                <Text variant="label" color="textMuted">
                  Выход γᵢ, Σγᵢ по плюсу и минусу, %
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
                    aria-label={`Масса класса, строка ${i + 1}, г`}
                    value={row.mass}
                    onChange={(e) => updateRow(i, { mass: e.target.value })}
                  />
                  <Stack direction="row" gap="md" wrap align="baseline">
                    <Text variant="bodySm">γᵢ {fmt1(row.gamma)}</Text>
                    <Text variant="bodySm" color="textMuted">
                      Σ+ {fmt1(row.plus)}
                    </Text>
                    <Text variant="bodySm" color="textMuted">
                      Σ− {fmt1(row.minus)}
                    </Text>
                  </Stack>
                  <Button icon="trash" variant="ghost" aria-label={`Удалить строку ${i + 1}`} onClick={() => removeRow(i)} />
                </Grid>
              ))}

              {/* `paddingX`+`paddingY`, а не `padding` — см. комментарий у `Box`
                  в `ProjectsPage.tsx`: одиночный `padding` в этой версии
                  компонента гасит сам себя. */}
              <Box background="surfaceSunken" radius="md" paddingX="sm" paddingY="sm" fullWidth>
                <Grid columns={4} gap="md">
                  <Text variant="label">Всего</Text>
                  <Text variant="label">{fmt1(computed.total)} г</Text>
                  <Text variant="label" color="textMuted">
                    {computed.total ? '100,0 %' : '0,0 %'}
                  </Text>
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
              disabled={!computed.total}
            >
              Записать a₀ и Va₀ в параметры
            </Button>
          </Stack>
        </Stack>
      ) : null}
    </Stack>
  );
}
