import { useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, ReactNode, WheelEvent as ReactWheelEvent } from 'react';
import {
  Button,
  Checkbox,
  Chip,
  Field,
  Grid,
  Input,
  Modal,
  Popover,
  Radio,
  RadioGroup,
  SegmentedControl,
  Stack,
  Surface,
  Text,
} from '@uralmash/design-system';
import type { GeomData } from '@/types';
import { CatalogPicker } from '@/components/CatalogPicker/CatalogPicker';
import { CRUSHERS, CRUSHER_SPECS } from '@/data/crushers';
import { ChamberScheme } from '@/components/ChamberScheme/ChamberScheme';
import type { ChamberHighlightKey, ChamberSchemeLayers } from '@/components/ChamberScheme/ChamberScheme';
import { InlineSidebar } from '@/components/InlineSidebar/InlineSidebar';
import { buildChamberSchemeProps } from './chamberSchemeAdapter';
import styles from './GeometryStep.module.css';

/** Границы масштаба схемы — те же, что и в прототипе-источнике. */
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 6;

const DIAGRAM_MODE_NAME = 'chamber-diagram-mode';
const FIELD_MODE_NAME = 'chamber-field-mode';
const DELTA_MODE_NAME = 'chamber-delta-mode';

/** Режим полей ввода: обычный или с подсветкой участка схемы при наведении. */
type FieldMode = 'input' | 'highlight';
/** Показывать ли отклонение текущего значения от снимка на момент расчёта. */
type DeltaMode = 'show' | 'hide';

export type GeometryStepProps = {
  data: GeomData;
  onChange: (patch: Partial<GeomData>) => void;
  /** Снимок формы на момент последнего расчёта — опора для режима «Дельта». `null`, пока не считалось. */
  baseline: GeomData | null;
  crusherName: string;
  onChangeCrusher: (name: string) => void;
};

export function GeometryStep({ data, onChange, baseline, crusherName, onChangeCrusher }: GeometryStepProps) {
  const scheme = useMemo(() => buildChamberSchemeProps(data), [data]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const hasSecondZone = data.zones === '2';

  // ── смена дробилки ──
  const [crusherPickerOpen, setCrusherPickerOpen] = useState(false);

  // ── режим отображения: поля ввода (подсветка участка) и дельта ──
  const [displayOpen, setDisplayOpen] = useState(false);
  const [fieldMode, setFieldMode] = useState<FieldMode>('input');
  const [deltaMode, setDeltaMode] = useState<DeltaMode>('show');
  const [hoverZone, setHoverZone] = useState<ChamberHighlightKey | null>(null);

  // Смена режима с «Подсветка участка» на «Только ввод» не должна оставлять
  // на схеме подсветку от последнего наведения, случившегося ещё в старом режиме.
  useEffect(() => {
    if (fieldMode === 'input') setHoverZone(null);
  }, [fieldMode]);

  const zoned = (key: ChamberHighlightKey, children: ReactNode) =>
    fieldMode === 'highlight' ? (
      <div onMouseEnter={() => setHoverZone(key)} onMouseLeave={() => setHoverZone((z) => (z === key ? null : z))}>
        {children}
      </div>
    ) : (
      children
    );

  /** Пояснение под полем: исходное + отклонение от снимка на момент расчёта, если оно есть и включён показ. */
  const hintWithDelta = (key: keyof GeomData, base?: string): string | undefined => {
    if (deltaMode !== 'show' || !baseline) return base;
    const was = baseline[key];
    if (was === data[key]) return base;
    return base ? `${base} · было: ${was}` : `было: ${was}`;
  };

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
    <div className={styles.split}>
      <div className={styles.fields}>
        <Stack gap="lg" direction="column">
          <Stack direction="row" justify="between" align="start" gap="md" wrap>
            <Stack gap="xs" direction="column">
              <Text variant="headingMd">Геометрия камеры дробления</Text>
              <Text variant="bodySm" color="textMuted">
                Основные параметры профиля камеры — диаметр, высота, зазор и угол гирации.
              </Text>
            </Stack>

            <Stack direction="row" align="center" gap="sm">
              <Chip
                icon="settings"
                action={{ icon: 'pencil', label: 'Сменить дробилку', onClick: () => setCrusherPickerOpen(true) }}
              >
                {crusherName}
              </Chip>

              <Popover
                open={displayOpen}
                onClose={() => setDisplayOpen(false)}
                placement="bottom-end"
                width="sm"
                title="Режим отображения"
                trigger={
                  <Button variant="secondary" size="sm" iconEnd="chevronDown" onClick={() => setDisplayOpen((o) => !o)}>
                    Отображение
                  </Button>
                }
              >
                <Stack gap="lg" direction="column">
                  <RadioGroup name={FIELD_MODE_NAME} legend="Поля ввода">
                    <Radio
                      name={FIELD_MODE_NAME}
                      label="Только ввод"
                      description="Ввод данных без подсветки участков"
                      checked={fieldMode === 'input'}
                      onChange={() => setFieldMode('input')}
                    />
                    <Radio
                      name={FIELD_MODE_NAME}
                      label="Подсветка участка"
                      description="При наведении на параметры подсвечивается участок схемы"
                      checked={fieldMode === 'highlight'}
                      onChange={() => setFieldMode('highlight')}
                    />
                  </RadioGroup>

                  <RadioGroup name={DELTA_MODE_NAME} legend="Дельта">
                    <Radio
                      name={DELTA_MODE_NAME}
                      label="Показывать изменения"
                      description="Отклонение от исходных значений рядом с полем"
                      checked={deltaMode === 'show'}
                      onChange={() => setDeltaMode('show')}
                    />
                    <Radio
                      name={DELTA_MODE_NAME}
                      label="Не показывать изменения"
                      checked={deltaMode === 'hide'}
                      onChange={() => setDeltaMode('hide')}
                    />
                  </RadioGroup>
                </Stack>
              </Popover>
            </Stack>
          </Stack>

          {/* Не `Field`: у SegmentedControl свой fieldset с legend, а id он не принимает —
              обёртка оставила бы <label for> указывающим в пустоту. Видимая подпись
              повторяет анатомию Field (gap 2xs + Text label), имя для скринридера
              даёт сам контрол. */}
          <Surface padding="lg" fullWidth>
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
          </Surface>

          <Surface padding="lg" fullWidth>
            <Stack gap="sm" direction="column">
              <Text variant="label">Углы профиля</Text>
              <Grid columns={3} gap="lg" rowGap="md">
                {zoned(
                  'beta10',
                  <Field label="Угол конуса β10" hint={hintWithDelta('beta10')}>
                    {(props) => (
                      <Input {...props} fullWidth type="number" value={data.beta10} onChange={(e) => onChange({ beta10: e.target.value })} />
                    )}
                  </Field>
                )}

                {zoned(
                  'beta2',
                  <Field label="Угол на выходе конуса β2" hint={hintWithDelta('beta2')}>
                    {(props) => (
                      <Input {...props} fullWidth type="number" value={data.beta2} onChange={(e) => onChange({ beta2: e.target.value })} />
                    )}
                  </Field>
                )}

                {zoned(
                  'beta40',
                  <Field label="Угол чаши β40" hint={hintWithDelta('beta40')}>
                    {(props) => (
                      <Input {...props} fullWidth type="number" value={data.beta40} onChange={(e) => onChange({ beta40: e.target.value })} />
                    )}
                  </Field>
                )}
              </Grid>
            </Stack>
          </Surface>

          <Surface padding="lg" fullWidth>
            <Stack gap="sm" direction="column">
              <Text variant="label">Геометрия камеры</Text>
              <Grid columns={3} gap="lg" rowGap="md">
                {zoned(
                  'D',
                  <Field label="Диаметр основания D, мм" required hint={hintWithDelta('D')}>
                    {(props) => (
                      <Input {...props} fullWidth type="number" value={data.D} onChange={(e) => onChange({ D: e.target.value })} />
                    )}
                  </Field>
                )}

                {zoned(
                  'H',
                  <Field label="Высота камеры H, мм" required hint={hintWithDelta('H')}>
                    {(props) => (
                      <Input {...props} fullWidth type="number" value={data.H} onChange={(e) => onChange({ H: e.target.value })} />
                    )}
                  </Field>
                )}

                {zoned(
                  'l2',
                  <Field label="Длина параллельной зоны l2, мм" hint={hintWithDelta('l2')}>
                    {(props) => (
                      <Input {...props} fullWidth type="number" value={data.l2} onChange={(e) => onChange({ l2: e.target.value })} />
                    )}
                  </Field>
                )}

                {/* R и a — параметры профиля камеры из методики-источника. Прототип
                    держит их в той же группе «Геометрия камеры», хотя формульно
                    они относятся к другой части методики (грансостав/усилия) —
                    `computeChamberGeometry` их не использует, см. комментарий
                    у `buildChamberSchemeProps`. Здесь они хранятся вместе с
                    проектом на тех же правах, что и остальные поля шага. */}
                <Field label="Коэффициент R" hint={hintWithDelta('R')}>
                  {(props) => (
                    <Input {...props} fullWidth type="number" step="0.01" value={data.R} onChange={(e) => onChange({ R: e.target.value })} />
                  )}
                </Field>

                <Field label="Коэффициент a" hint={hintWithDelta('a')}>
                  {(props) => (
                    <Input {...props} fullWidth type="number" step="0.01" value={data.a} onChange={(e) => onChange({ a: e.target.value })} />
                  )}
                </Field>
              </Grid>
            </Stack>
          </Surface>

          <Surface padding="lg" fullWidth>
            <Stack gap="sm" direction="column">
              <Text variant="label">Угол нутации</Text>
              <Grid columns={2} gap="lg" rowGap="md">
                {zoned(
                  'theta',
                  <Field label="Угол гирации θ" hint={hintWithDelta('theta', `в единицах: ${data.angleUnit}`)}>
                    {(props) => (
                      <Input {...props} fullWidth type="number" value={data.theta} onChange={(e) => onChange({ theta: e.target.value })} />
                    )}
                  </Field>
                )}
              </Grid>
            </Stack>
          </Surface>

          <Surface padding="lg" fullWidth>
            <Stack gap="sm" direction="column">
              <Text variant="label">Разгрузочная щель</Text>
              <Grid columns={2} gap="lg" rowGap="md">
                {zoned(
                  'S0',
                  <Field label="Ширина разгрузочной щели S0, мм" required hint={hintWithDelta('S0')}>
                    {(props) => (
                      <Input {...props} fullWidth type="number" value={data.S0} onChange={(e) => onChange({ S0: e.target.value })} />
                    )}
                  </Field>
                )}
              </Grid>
            </Stack>
          </Surface>

          <Surface padding="lg" fullWidth>
            <Stack gap="sm" direction="column">
              <Text variant="label">Длины зон дробления</Text>
              <Grid columns={2} gap="lg" rowGap="md">
                <Field label="Длина первой зоны l11, мм" hint={hintWithDelta('l11')}>
                  {(props) => (
                    <Input {...props} fullWidth type="number" value={data.l11} onChange={(e) => onChange({ l11: e.target.value })} />
                  )}
                </Field>

                {hasSecondZone ? (
                  <Field label="Длина второй зоны l12, мм" hint={hintWithDelta('l12')}>
                    {(props) => (
                      <Input {...props} fullWidth type="number" value={data.l12} onChange={(e) => onChange({ l12: e.target.value })} />
                    )}
                  </Field>
                ) : null}
              </Grid>
            </Stack>
          </Surface>

          {/* Не `Field` — см. пояснение выше в этом файле. */}
          <Surface padding="lg" fullWidth>
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
          </Surface>
        </Stack>
      </div>

      <InlineSidebar
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
        title="Схема профиля камеры"
        actions={
          <>
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
          </>
        }
      >
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
                highlight={hoverZone}
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
      </InlineSidebar>

      <Modal open={crusherPickerOpen} onClose={() => setCrusherPickerOpen(false)} title="Сменить дробилку" size="lg">
        <CatalogPicker
          specs={CRUSHER_SPECS}
          items={CRUSHERS}
          value={crusherName}
          onPick={(name) => {
            // Повторный клик по уже выбранной строке снимает выбор (`onPick(null)`) —
            // у действующего проекта не бывает состояния «дробилка не выбрана»,
            // поэтому такой клик просто игнорируется, а не гасит имя.
            if (!name) return;
            onChangeCrusher(name);
            setCrusherPickerOpen(false);
          }}
          nameLabel="Дробилка"
          searchPlaceholder="КМД-2200, 2200, 500-655…"
        />
      </Modal>
    </div>
  );
}
