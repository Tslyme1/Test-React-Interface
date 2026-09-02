import { Field, Input, SegmentedControl, Stack, Text } from '@uralmash/design-system';
import type { ProdData } from '@/types';
import { SieveAnalysis } from './SieveAnalysis';

export type ProdStepProps = {
  data: ProdData;
  onChange: (patch: Partial<ProdData>) => void;
  /**
   * Снимок формы на момент последнего расчёта — опора для подсказки
   * «было: X». `null`, пока не считалось или в упрощённом режиме (там
   * шаг не форкается и не сравнивается с прошлым расчётом постфактум).
   */
  baseline?: ProdData | null;
  /** Тост о результате действия — например, записи a₀/Va₀ в параметры. */
  showToast?: (message: string) => void;
  /**
   * Упрощённый режим: только тип питания и максимальная крупность
   * продукта — единственный ввод во всём режиме. Остальные параметры
   * (работа разрушения, форма куска, ситовый анализ) не показываются
   * и остаются на значениях по умолчанию.
   */
  simplified?: boolean;
};

export function ProdStep({ data, onChange, baseline = null, showToast, simplified = false }: ProdStepProps) {
  const applySieveToParams = (nextA0: number, nextVa0: number) => {
    onChange({ a0: String(nextA0), va0: String(nextVa0) });
    showToast?.(`Записано в параметры: a₀ = ${nextA0}, Va₀ = ${nextVa0}`);
  };

  /** Пояснение под полем: исходное + было ли отредактировано после последнего расчёта. */
  const hintWithDelta = (key: keyof ProdData, base?: string): string | undefined => {
    if (!baseline) return base;
    const was = baseline[key];
    if (was === data[key]) return base;
    return base ? `${base} · было: ${was}` : `было: ${was}`;
  };

  if (simplified) {
    return (
      <Stack gap="xl" direction="column">
        <Stack gap="xs" direction="column">
          <Text variant="headingMd">Продукт</Text>
          <Text variant="bodySm" color="textMuted">
            Тип питания и желаемая крупность продукта — расчёт пройдёт по каждой выбранной паре «дробилка — проба».
          </Text>
        </Stack>

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

        <Field label="Максимальная крупность продукта Dmax, мм" required>
          {(props) => (
            <Input {...props} fullWidth type="number" value={data.dMax} onChange={(e) => onChange({ dMax: e.target.value })} />
          )}
        </Field>
      </Stack>
    );
  }

  return (
    <Stack gap="xl" direction="column">
      <Stack gap="xs" direction="column">
        <Text variant="headingMd">Грансостав продукта и усилия</Text>
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
        <Field label="Минимальная крупность продукта Dmin, мм" required hint={hintWithDelta('dMin')}>
          {(props) => (
            <Input {...props} fullWidth type="number" value={data.dMin} onChange={(e) => onChange({ dMin: e.target.value })} />
          )}
        </Field>

        <Field label="Максимальная крупность продукта Dmax, мм" required hint={hintWithDelta('dMax')}>
          {(props) => (
            <Input {...props} fullWidth type="number" value={data.dMax} onChange={(e) => onChange({ dMax: e.target.value })} />
          )}
        </Field>

        <Field label="Работа разрушения Wk" hint={hintWithDelta('wk')}>
          {(props) => (
            <Input {...props} fullWidth type="number" value={data.wk} onChange={(e) => onChange({ wk: e.target.value })} />
          )}
        </Field>

        <Field label="Работа измельчения Wm" hint={hintWithDelta('wm')}>
          {(props) => (
            <Input {...props} fullWidth type="number" value={data.wm} onChange={(e) => onChange({ wm: e.target.value })} />
          )}
        </Field>

        <Field label="КПД дробления" required hint={hintWithDelta('kpd')}>
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
            <Field label="Среднее относительное длины куска a₀" hint={hintWithDelta('a0', 'd̄ / dmax')}>
              {(props) => (
                <Input {...props} fullWidth type="number" step="0.001" value={data.a0} onChange={(e) => onChange({ a0: e.target.value })} />
              )}
            </Field>

            <Field label="Коэффициент вариации длины Va₀" hint={hintWithDelta('va0', 'σ / d̄')}>
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
