import { Field, Grid, Input, SegmentedControl, Stack, Text } from '@uralmash/design-system';
import type { ProdData } from '@/types';

export function ProdStep({ data, onChange }: { data: ProdData; onChange: (patch: Partial<ProdData>) => void }) {
  return (
    <Stack gap="xl" direction="column">
      <Stack gap="xs" direction="column">
        <Text variant="headingSm">Грансостав продукта и усилия</Text>
        <Text variant="bodySm" color="textMuted">
          Параметры продукта дробления и режима нагружения.
        </Text>
      </Stack>

      <Field label="Тип питания">
        {() => (
          <SegmentedControl
            legend="Тип питания"
            options={[
              { value: 'dry', label: 'Сухое' },
              { value: 'wet', label: 'Влажное' },
            ]}
            value={data.feedType}
            onChange={(v) => onChange({ feedType: v })}
          />
        )}
      </Field>

      <Grid columns={2} gap="lg" rowGap="md">
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
      </Grid>
    </Stack>
  );
}
