import { Field, Input, SegmentedControl, Stack, Text } from '@uralmash/design-system';
import type { ProdData } from '@/types';
import { SieveAnalysis } from './SieveAnalysis';

export type ProdStepProps = {
  data: ProdData;
  onChange: (patch: Partial<ProdData>) => void;
  /** Тост о результате действия — например, записи a₀/Va₀ в параметры. */
  showToast?: (message: string) => void;
};

export function ProdStep({ data, onChange, showToast }: ProdStepProps) {
  const applySieveToParams = (nextA0: number, nextVa0: number) => {
    onChange({ a0: String(nextA0), va0: String(nextVa0) });
    showToast?.(`Записано в параметры: a₀ = ${nextA0}, Va₀ = ${nextVa0}`);
  };

  return (
    <Stack gap="xl" direction="column">
      <Stack gap="xs" direction="column">
        <Text variant="headingSm">Грансостав продукта и усилия</Text>
        <Text variant="bodySm" color="textMuted">
          Параметры продукта дробления и режима нагружения.
        </Text>
      </Stack>

      {/* Не `Field` — см. пояснение в GeometryStep: SegmentedControl не принимает id,
          и обёртка оставила бы подпись без контрола. */}
      <Stack gap="2xs" direction="column" align="start">
        <Text variant="label">Тип питания</Text>
        <SegmentedControl
          legend="Тип питания"
          options={[
            { value: 'dry', label: 'Сухое' },
            { value: 'wet', label: 'Влажное' },
          ]}
          value={data.feedType}
          onChange={(v) => onChange({ feedType: v })}
        />
      </Stack>

      <Stack direction="column" gap="md">
        <Field label="Минимальная крупность продукта Dmin, мм" required>
          {(props) => (
            <Input {...props} fullWidth type="number" value={data.dMin} onChange={(e) => onChange({ dMin: e.target.value })} />
          )}
        </Field>

        <Field label="Максимальная крупность продукта Dmax, мм" required>
          {(props) => (
            <Input {...props} fullWidth type="number" value={data.dMax} onChange={(e) => onChange({ dMax: e.target.value })} />
          )}
        </Field>

        <Field label="Работа разрушения Wk">
          {(props) => (
            <Input {...props} fullWidth type="number" value={data.wk} onChange={(e) => onChange({ wk: e.target.value })} />
          )}
        </Field>

        <Field label="Работа измельчения Wm">
          {(props) => (
            <Input {...props} fullWidth type="number" value={data.wm} onChange={(e) => onChange({ wm: e.target.value })} />
          )}
        </Field>

        <Field label="КПД дробления" required>
          {(props) => (
            <Input {...props} fullWidth type="number" step="0.01" value={data.kpd} onChange={(e) => onChange({ kpd: e.target.value })} />
          )}
        </Field>
      </Stack>

      <Stack gap="lg" direction="column">
        <Stack direction="row" justify="between" align="start" gap="md" wrap>
          <Stack gap="xs" direction="column">
            <Text variant="headingSm">Параметры формы куска</Text>
            <Text variant="bodySm" color="textMuted">
              a₀ и Va₀ задаются напрямую или получаются из ситового анализа пробы.
            </Text>
          </Stack>

          {/* Не `Field` — см. пояснение выше по файлу и в GeometryStep: SegmentedControl
              не принимает id, обёртка оставила бы подпись без контрола. */}
          <Stack gap="2xs" direction="column" align="start">
            <Text variant="label">Способ задания a₀ и Va₀</Text>
            <SegmentedControl
              legend="Способ задания a₀ и Va₀"
              options={[
                { value: 'direct', label: 'Прямой ввод' },
                { value: 'sieve', label: 'Ситовый анализ' },
              ]}
              value={data.shapeMode}
              onChange={(v) => onChange({ shapeMode: v })}
            />
          </Stack>
        </Stack>

        {data.shapeMode === 'direct' ? (
          <Stack direction="column" gap="md">
            <Field label="Среднее относительное длины куска a₀" hint="d̄ / dmax">
              {(props) => (
                <Input {...props} fullWidth type="number" step="0.001" value={data.a0} onChange={(e) => onChange({ a0: e.target.value })} />
              )}
            </Field>

            <Field label="Коэффициент вариации длины Va₀" hint="σ / d̄">
              {(props) => (
                <Input
                  {...props}
                  fullWidth
                  type="number"
                  step="0.001"
                  value={data.va0}
                  onChange={(e) => onChange({ va0: e.target.value })}
                />
              )}
            </Field>
          </Stack>
        ) : (
          <SieveAnalysis rows={data.sieveRows} onRowsChange={(rows) => onChange({ sieveRows: rows })} onApply={applySieveToParams} />
        )}
      </Stack>
    </Stack>
  );
}
