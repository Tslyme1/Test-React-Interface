import { Field, Grid, Input, SegmentedControl, Stack, Text } from '@uralmash/design-system';
import type { GeomData } from '@/types';

export function GeometryStep({ data, onChange }: { data: GeomData; onChange: (patch: Partial<GeomData>) => void }) {
  return (
    <Stack gap="xl" direction="column">
      <Stack gap="xs" direction="column">
        <Text variant="headingSm">Геометрия камеры дробления</Text>
        <Text variant="bodySm" color="textMuted">
          Основные параметры профиля камеры — диаметр, высота, зазор и угол гирации.
        </Text>
      </Stack>

      <Grid columns={2} gap="lg" rowGap="md">
        <Field label="Диаметр основания D, мм" required>
          {(props) => (
            <Input {...props} fullWidth type="number" value={data.D} onChange={(e) => onChange({ D: e.target.value })} />
          )}
        </Field>

        <Field label="Высота камеры H, мм" required>
          {(props) => (
            <Input {...props} fullWidth type="number" value={data.H} onChange={(e) => onChange({ H: e.target.value })} />
          )}
        </Field>

        <Field label="Длина параллельной зоны l2, мм">
          {(props) => (
            <Input {...props} fullWidth type="number" value={data.l2} onChange={(e) => onChange({ l2: e.target.value })} />
          )}
        </Field>

        <Field label="Ширина разгрузочной щели S0, мм" required>
          {(props) => (
            <Input {...props} fullWidth type="number" value={data.S0} onChange={(e) => onChange({ S0: e.target.value })} />
          )}
        </Field>

        <Field label="Угол гирации θ" hint={`в единицах: ${data.angleUnit}`}>
          {(props) => (
            <Input {...props} fullWidth type="number" value={data.theta} onChange={(e) => onChange({ theta: e.target.value })} />
          )}
        </Field>

        <Field label="Угол конуса β10">
          {(props) => (
            <Input {...props} fullWidth type="number" value={data.beta10} onChange={(e) => onChange({ beta10: e.target.value })} />
          )}
        </Field>

        <Field label="Угол чаши β40">
          {(props) => (
            <Input {...props} fullWidth type="number" value={data.beta40} onChange={(e) => onChange({ beta40: e.target.value })} />
          )}
        </Field>
      </Grid>

      <Field label="Единица измерения углов">
        {() => (
          <SegmentedControl
            legend="Единица измерения углов"
            options={[
              { value: 'deg', label: 'Градусы' },
              { value: 'рад', label: 'Радианы' },
            ]}
            value={data.angleUnit}
            onChange={(v) => onChange({ angleUnit: v })}
          />
        )}
      </Field>
    </Stack>
  );
}
