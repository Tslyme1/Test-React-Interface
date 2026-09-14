import { Field, Input, SegmentedControl, Stack, Text } from '@uralmash/design-system';
import type { ProdData } from '@/types';
import { FieldHint } from '@/components/FieldHint/FieldHint';
import { PROD_GLOSSARY } from '@/data/paramGlossary';

export type ProdStepProps = {
  data: ProdData;
  onChange: (patch: Partial<ProdData>) => void;
  /**
   * Значения на момент создания проекта — опора для подсказки «было: X».
   * `null` в упрощённом режиме: там шаг не сравнивается с исходным
   * состоянием постфактум.
   */
  baseline?: ProdData | null;
  /**
   * Упрощённый режим: только тип питания и максимальная крупность
   * продукта — единственный ввод во всём режиме. Остальные параметры
   * (работа разрушения) не показываются и остаются на значениях
   * по умолчанию.
   */
  simplified?: boolean;
};

export function ProdStep({ data, onChange, baseline = null, simplified = false }: ProdStepProps) {
  /** Пояснение под полем: исходное + было ли отредактировано после создания проекта. */
  const hintWithDelta = (key: keyof ProdData, base?: string): string | undefined => {
    if (!baseline) return base;
    const was = baseline[key];
    if (was === data[key]) return base;
    return base ? `${base} · было: ${was}` : `было: ${was}`;
  };

  if (simplified) {
    return (
      <Stack gap="2xl" direction="column">
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

        <Field
          label="Максимальная крупность продукта Dmax"
          required
          labelHint={<FieldHint>{PROD_GLOSSARY.dMax}</FieldHint>}
        >
          {(props) => (
            <Input {...props} fullWidth type="number" value={data.dMax} onChange={(e) => onChange({ dMax: e.target.value })} suffix="мм" />
          )}
        </Field>
      </Stack>
    );
  }

  return (
    <Stack gap="2xl" direction="column">
      <Text variant="headingMd">Грансостав продукта и усилия</Text>

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
        <Field label="Минимальная крупность продукта Dmin" required hint={hintWithDelta('dMin')} labelHint={<FieldHint>{PROD_GLOSSARY.dMin}</FieldHint>}>
          {(props) => (
            <Input {...props} fullWidth type="number" value={data.dMin} onChange={(e) => onChange({ dMin: e.target.value })} suffix="мм" />
          )}
        </Field>

        <Field label="Максимальная крупность продукта Dmax" required hint={hintWithDelta('dMax')} labelHint={<FieldHint>{PROD_GLOSSARY.dMax}</FieldHint>}>
          {(props) => (
            <Input {...props} fullWidth type="number" value={data.dMax} onChange={(e) => onChange({ dMax: e.target.value })} suffix="мм" />
          )}
        </Field>

        <Field label="Работа разрушения Wk" hint={hintWithDelta('wk')} labelHint={<FieldHint>{PROD_GLOSSARY.wk}</FieldHint>}>
          {(props) => (
            <Input {...props} fullWidth type="number" value={data.wk} onChange={(e) => onChange({ wk: e.target.value })} />
          )}
        </Field>

        <Field label="Работа измельчения Wm" hint={hintWithDelta('wm')} labelHint={<FieldHint>{PROD_GLOSSARY.wm}</FieldHint>}>
          {(props) => (
            <Input {...props} fullWidth type="number" value={data.wm} onChange={(e) => onChange({ wm: e.target.value })} />
          )}
        </Field>

        <Field label="КПД дробления" required hint={hintWithDelta('kpd')} labelHint={<FieldHint>{PROD_GLOSSARY.kpd}</FieldHint>}>
          {(props) => (
            <Input {...props} fullWidth type="number" step="0.01" value={data.kpd} onChange={(e) => onChange({ kpd: e.target.value })} />
          )}
        </Field>
      </Stack>
    </Stack>
  );
}
