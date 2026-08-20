import { useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, WheelEvent as ReactWheelEvent } from 'react';
import { Button, Checkbox, Field, Grid, Input, Popover, Radio, RadioGroup, SegmentedControl, Stack, Surface, Text } from '@uralmash/design-system';
import type { GeomData } from '@/types';
import { ChamberScheme } from '@/components/ChamberScheme/ChamberScheme';
import type { ChamberSchemeLayers } from '@/components/ChamberScheme/ChamberScheme';
import { buildChamberSchemeProps } from './chamberSchemeAdapter';
import styles from './GeometryStep.module.css';

/** Границы масштаба схемы — те же, что и в прототипе-источнике. */
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 6;

const DIAGRAM_MODE_NAME = 'chamber-diagram-mode';

export function GeometryStep({ data, onChange }: { data: GeomData; onChange: (patch: Partial<GeomData>) => void }) {
  const scheme = useMemo(() => buildChamberSchemeProps(data), [data]);
  const [collapsed, setCollapsed] = useState(false);
  const hasSecondZone = data.zones === '2';

  // ── меню «Диаграмма» и «Слои» над схемой ──
  const [diagramOpen, setDiagramOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [diagramMode, setDiagramMode] = useState<'normal' | 'build'>('normal');
  const [layers, setLayers] = useState<Required<ChamberSchemeLayers>>({
    bowl: true,
    cone: true,
    theta: true,
    gap: true,
    dims: true,
  });
  const toggleLayer = (key: keyof ChamberSchemeLayers) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  // ── зум и панорамирование схемы ──
  const [view, setView] = useState({ k: 1, x: 0, y: 0 });
  const [panning, setPanning] = useState(false);
  // Флаг тянется дольше состояния: обработчик `mousemove` из `addEventListener`
  // не видит следующий рендер, а `panning` в стейте нужен только для курсора.
  const panningRef = useRef(false);

  const zoomBy = (factor: number) => {
    setView((v) => ({ ...v, k: Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, v.k * factor)) }));
  };
  const resetView = () => setView({ k: 1, x: 0, y: 0 });

  const handleWheel = (e: ReactWheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    zoomBy(e.deltaY < 0 ? 1.12 : 0.89);
  };

  const handleMouseDown = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const startX = e.clientX;
    const startY = e.clientY;
    const originX = view.x;
    const originY = view.y;
    panningRef.current = true;
    setPanning(true);

    const handleMove = (ev: MouseEvent) => {
      setView((v) => ({ ...v, x: originX + (ev.clientX - startX), y: originY + (ev.clientY - startY) }));
    };
    const handleUp = () => {
      panningRef.current = false;
      setPanning(false);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  return (
    <div className={collapsed ? `${styles.split} ${styles.splitCollapsed}` : styles.split}>
      <Stack gap="xl" direction="column">
        <Stack gap="xs" direction="column">
          <Text variant="headingSm">Геометрия камеры дробления</Text>
          <Text variant="bodySm" color="textMuted">
            Основные параметры профиля камеры — диаметр, высота, зазор и угол гирации.
          </Text>
        </Stack>

        {/* Не `Field`: у SegmentedControl свой fieldset с legend, а id он не принимает —
            обёртка оставила бы <label for> указывающим в пустоту. Видимая подпись
            повторяет анатомию Field (gap 2xs + Text label), имя для скринридера
            даёт сам контрол. */}
        <Stack gap="2xs" direction="column" align="start">
          <Text variant="label">Число зон дробления</Text>
          <SegmentedControl
            legend="Число зон дробления"
            options={[
              { value: '1', label: '1' },
              { value: '2', label: '2' },
            ]}
            value={data.zones}
            onChange={(v) => onChange({ zones: v })}
          />
        </Stack>

        <Stack gap="sm" direction="column">
          <Text variant="label">Углы профиля</Text>
          <Grid columns={3} gap="lg" rowGap="md">
            <Field label="Угол конуса β10">
              {(props) => (
                <Input {...props} fullWidth type="number" value={data.beta10} onChange={(e) => onChange({ beta10: e.target.value })} />
              )}
            </Field>

            <Field label="Угол на выходе конуса β2">
              {(props) => (
                <Input {...props} fullWidth type="number" value={data.beta2} onChange={(e) => onChange({ beta2: e.target.value })} />
              )}
            </Field>

            <Field label="Угол чаши β40">
              {(props) => (
                <Input {...props} fullWidth type="number" value={data.beta40} onChange={(e) => onChange({ beta40: e.target.value })} />
              )}
            </Field>
          </Grid>
        </Stack>

        <Stack gap="sm" direction="column">
          <Text variant="label">Геометрия камеры</Text>
          <Grid columns={3} gap="lg" rowGap="md">
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

            {/* R и a — параметры профиля камеры из методики-источника. Прототип
                держит их в той же группе «Геометрия камеры», хотя формульно
                они относятся к другой части методики (грансостав/усилия) —
                `computeChamberGeometry` их не использует, см. комментарий
                у `buildChamberSchemeProps`. Здесь они хранятся вместе с
                проектом на тех же правах, что и остальные поля шага. */}
            <Field label="Коэффициент R">
              {(props) => (
                <Input {...props} fullWidth type="number" step="0.01" value={data.R} onChange={(e) => onChange({ R: e.target.value })} />
              )}
            </Field>

            <Field label="Коэффициент a">
              {(props) => (
                <Input {...props} fullWidth type="number" step="0.01" value={data.a} onChange={(e) => onChange({ a: e.target.value })} />
              )}
            </Field>
          </Grid>
        </Stack>

        <Stack gap="sm" direction="column">
          <Text variant="label">Угол нутации</Text>
          <Grid columns={2} gap="lg" rowGap="md">
            <Field label="Угол гирации θ" hint={`в единицах: ${data.angleUnit}`}>
              {(props) => (
                <Input {...props} fullWidth type="number" value={data.theta} onChange={(e) => onChange({ theta: e.target.value })} />
              )}
            </Field>
          </Grid>
        </Stack>

        <Stack gap="sm" direction="column">
          <Text variant="label">Разгрузочная щель</Text>
          <Grid columns={2} gap="lg" rowGap="md">
            <Field label="Ширина разгрузочной щели S0, мм" required>
              {(props) => (
                <Input {...props} fullWidth type="number" value={data.S0} onChange={(e) => onChange({ S0: e.target.value })} />
              )}
            </Field>
          </Grid>
        </Stack>

        <Stack gap="sm" direction="column">
          <Text variant="label">Длины зон дробления</Text>
          <Grid columns={2} gap="lg" rowGap="md">
            <Field label="Длина первой зоны l11, мм">
              {(props) => (
                <Input {...props} fullWidth type="number" value={data.l11} onChange={(e) => onChange({ l11: e.target.value })} />
              )}
            </Field>

            {hasSecondZone ? (
              <Field label="Длина второй зоны l12, мм">
                {(props) => (
                  <Input {...props} fullWidth type="number" value={data.l12} onChange={(e) => onChange({ l12: e.target.value })} />
                )}
              </Field>
            ) : null}
          </Grid>
        </Stack>

        {/* Не `Field` — см. пояснение выше в этом файле. */}
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
              <Stack direction="row" align="center" gap="sm">
                <Button
                  variant="ghost"
                  size="sm"
                  icon="chevronRight"
                  aria-label="Свернуть схему камеры"
                  onClick={() => setCollapsed(true)}
                />
                <Text variant="headingSm">Схема профиля камеры</Text>
              </Stack>

              <Stack direction="row" align="center" gap="xs">
                <Popover
                  open={diagramOpen}
                  onClose={() => setDiagramOpen(false)}
                  placement="bottom-end"
                  width="sm"
                  title="Режим отображения"
                  trigger={
                    <Button variant="secondary" size="sm" iconEnd="chevronDown" onClick={() => setDiagramOpen((o) => !o)}>
                      Диаграмма
                    </Button>
                  }
                >
                  <RadioGroup name={DIAGRAM_MODE_NAME} legend="Режим отображения" direction="column">
                    <Radio
                      name={DIAGRAM_MODE_NAME}
                      label="Обычный"
                      checked={diagramMode === 'normal'}
                      onChange={() => setDiagramMode('normal')}
                    />
                    <Radio
                      name={DIAGRAM_MODE_NAME}
                      label="Линии построения"
                      description="Лучи от точки подвеса к каждой точке профиля"
                      checked={diagramMode === 'build'}
                      onChange={() => setDiagramMode('build')}
                    />
                  </RadioGroup>
                </Popover>

                <Popover
                  open={layersOpen}
                  onClose={() => setLayersOpen(false)}
                  placement="bottom-end"
                  width="sm"
                  title="Отображать"
                  trigger={
                    <Button variant="secondary" size="sm" iconEnd="chevronDown" onClick={() => setLayersOpen((o) => !o)}>
                      Слои
                    </Button>
                  }
                >
                  <Stack direction="column" gap="2xs">
                    <Checkbox label="Броня чаши" checked={layers.bowl} onChange={() => toggleLayer('bowl')} />
                    <Checkbox label="Броня конуса" checked={layers.cone} onChange={() => toggleLayer('cone')} />
                    <Checkbox label="Угол θ (дуга)" checked={layers.theta} onChange={() => toggleLayer('theta')} />
                    <Checkbox label="Зазор S₀" checked={layers.gap} onChange={() => toggleLayer('gap')} />
                    <Checkbox label="Размеры D/2 и h" checked={layers.dims} onChange={() => toggleLayer('dims')} />
                  </Stack>
                </Popover>
              </Stack>
            </Stack>

            <Surface level="flat" border padding="sm" fullWidth>
              <div
                className={panning ? `${styles.viewport} ${styles.viewportPanning}` : styles.viewport}
                onWheel={handleWheel}
                onMouseDown={handleMouseDown}
              >
                <div
                  className={styles.zoomLayer}
                  style={{
                    transform: `translate(${view.x}px, ${view.y}px) scale(${view.k})`,
                    transition: panning ? 'none' : undefined,
                  }}
                >
                  <ChamberScheme
                    input={scheme.input}
                    calibration={scheme.calibration}
                    layers={layers}
                    construction={diagramMode === 'build'}
                  />
                </div>

                <div className={styles.zoomControls}>
                  <Surface level="raised" radius="sm" padding="2xs">
                    <Stack direction="column" gap="2xs">
                      <Button variant="secondary" size="sm" aria-label="Приблизить" onClick={() => zoomBy(1.25)}>
                        +
                      </Button>
                      <Button variant="secondary" size="sm" aria-label="Отдалить" onClick={() => zoomBy(0.8)}>
                        −
                      </Button>
                      <Button variant="secondary" size="sm" icon="maximize" aria-label="Сбросить вид" onClick={resetView} />
                    </Stack>
                  </Surface>
                </div>
              </div>
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
