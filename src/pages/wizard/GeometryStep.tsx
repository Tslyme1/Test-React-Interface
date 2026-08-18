import { useMemo, useState } from 'react';
import { Button, Field, Grid, Input, SegmentedControl, Stack, Surface, Text } from '@uralmash/design-system';
import type { GeomData } from '@/types';
import { ChamberScheme } from '@/components/ChamberScheme/ChamberScheme';
import { buildChamberSchemeProps } from './chamberSchemeAdapter';
import styles from './GeometryStep.module.css';

export function GeometryStep({ data, onChange }: { data: GeomData; onChange: (patch: Partial<GeomData>) => void }) {
  const scheme = useMemo(() => buildChamberSchemeProps(data), [data]);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={collapsed ? `${styles.split} ${styles.splitCollapsed}` : styles.split}>
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

        {/* Не `Field`: у SegmentedControl свой fieldset с legend, а id он не принимает —
            обёртка оставила бы <label for> указывающим в пустоту. Видимая подпись
            повторяет анатомию Field (gap 2xs + Text label), имя для скринридера
            даёт сам контрол. */}
        <Stack gap="2xs" direction="column" align="start">
          <Text variant="label">Единица измерения углов</Text>
          <SegmentedControl
            legend="Единица измерения углов"
            options={[
              { value: 'deg', label: 'Градусы' },
              { value: 'рад', label: 'Радианы' },
            ]}
            value={data.angleUnit}
            onChange={(v) => onChange({ angleUnit: v })}
          />
        </Stack>
      </Stack>

      {/* Обёртка простым `div`, а не `Stack`: липкость — это раскладка экрана,
          а `className` у примитивов системы нет намеренно. */}
      <div className={styles.scheme}>
        {collapsed ? (
          <Stack direction="column" gap="sm" align="center">
            <Button
              variant="ghost"
              size="sm"
              icon="chevronLeft"
              aria-label="Развернуть схему камеры"
              onClick={() => setCollapsed(false)}
            />
            <div className={styles.railLabel}>
              <Text variant="caption" color="textMuted">
                Схема камеры
              </Text>
            </div>
          </Stack>
        ) : (
          <Stack gap="sm" direction="column">
            <Stack direction="row" justify="between" align="center" gap="sm">
              <Text variant="label">Схема профиля камеры</Text>
              <Button
                variant="ghost"
                size="sm"
                icon="chevronRight"
                aria-label="Свернуть схему камеры"
                onClick={() => setCollapsed(true)}
              />
            </Stack>
            <Surface level="flat" border padding="md" fullWidth>
              <ChamberScheme input={scheme.input} calibration={scheme.calibration} />
            </Surface>
            <Text variant="caption" color="textMuted">
              Броня чаши — неподвижный профиль, броня конуса — гирационный. Схема пересчитывается по полям слева; узлы
              профиля, не вынесенные в форму, взяты из демонстрационных значений методики-источника.
            </Text>
          </Stack>
        )}
      </div>
    </div>
  );
}
