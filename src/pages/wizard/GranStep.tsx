import { Field, Grid, Input, Stack, Text } from '@uralmash/design-system';
import type { GranData } from '@/types';

export function GranStep({ data, onChange }: { data: GranData; onChange: (patch: Partial<GranData>) => void }) {
  return (
    <Stack gap="xl" direction="column">
      <Stack gap="xs" direction="column">
        <Text variant="headingSm">Характеристический грансостав</Text>
        <Text variant="bodySm" color="textMuted">
          Границы крупности питания и параметры характеристики распределения.
        </Text>
      </Stack>

      <Grid columns={2} gap="lg" rowGap="md">
        <Field label="Минимальная крупность Dmin, мм" required>
          {(props) => (
            <Input {...props} fullWidth type="number" value={data.dMin} onChange={(e) => onChange({ dMin: e.target.value })} />
          )}
        </Field>

        <Field label="Максимальная крупность Dmax, мм" required>
          {(props) => (
            <Input {...props} fullWidth type="number" value={data.dMax} onChange={(e) => onChange({ dMax: e.target.value })} />
          )}
        </Field>

        <Field label="Параметр Z0">
          {(props) => (
            <Input {...props} fullWidth type="number" value={data.z0} onChange={(e) => onChange({ z0: e.target.value })} />
          )}
        </Field>

        <Field label="Параметр S00">
          {(props) => (
            <Input {...props} fullWidth type="number" value={data.s00} onChange={(e) => onChange({ s00: e.target.value })} />
          )}
        </Field>

        <Field label="Параметр N0">
          {(props) => (
            <Input {...props} fullWidth type="number" value={data.n0} onChange={(e) => onChange({ n0: e.target.value })} />
          )}
        </Field>
      </Grid>
    </Stack>
  );
}
