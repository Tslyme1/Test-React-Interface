import { useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { Box, Button, Chip, Field, Input, Modal, Popover, Select, Stack, Surface, Text } from '@uralmash/design-system';
import type { GeomData, ZoneCount } from '@/types';
import { CatalogPicker } from '@/components/CatalogPicker/CatalogPicker';
import { CRUSHERS, CRUSHER_SPECS } from '@/data/crushers';
import { ChamberScheme } from '@/components/ChamberScheme/ChamberScheme';
import type { ChamberHighlightKey, ChamberSchemeLayers } from '@/components/ChamberScheme/ChamberScheme';
import { InlineSidebar } from '@/components/InlineSidebar/InlineSidebar';
import { OptionCell } from '@/components/OptionCell/OptionCell';
import { FieldHint } from '@/components/FieldHint/FieldHint';
import { GEOM_GLOSSARY } from '@/data/paramGlossary';
import { buildChamberSchemeProps } from '@/domain/chamberInput';
import { convertAngleUnit } from '@/domain/angleUnit';
import styles from './GeometryStep.module.css';

/** Границы масштаба схемы — те же, что и в прототипе-источнике. */
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 6;

/**
 * Слои за каждым режимом отображения схемы. Наборы не пересекаются,
 * поэтому режимы включаются независимо друг от друга — см.
 * `toggleDiagramGroup` в самом компоненте.
 */
const DIAGRAM_NORMAL_LAYERS = ['zones', 'dims'] as const satisfies readonly (keyof ChamberSchemeLayers)[];
const DIAGRAM_BUILD_LAYERS = ['rays', 'arcs', 'gaps'] as const satisfies readonly (keyof ChamberSchemeLayers)[];

/** Режим полей ввода: обычный или с подсветкой участка схемы при наведении. */
type FieldMode = 'input' | 'highlight';
/** Показывать ли отклонение текущего значения от снимка на момент расчёта. */
type DeltaMode = 'show' | 'hide';

export type GeometryStepProps = {
  data: GeomData;
  onChange: (patch: Partial<GeomData>) => void;
  /** Значения на момент создания проекта — опора для режима «Дельта». */
  baseline: GeomData;
  crusherName: string;
  onChangeCrusher: (name: string) => void;
};

export function GeometryStep({ data, onChange, baseline, crusherName, onChangeCrusher }: GeometryStepProps) {
  const scheme = useMemo(() => buildChamberSchemeProps(data), [data]);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  /**
   * Ширина панели схемы. `null` — панель занимает свою половину строки
   * (`50cqi` в `InlineSidebar.module.css`), как и до появления ручки:
   * это состояние «пользователь ширину не трогал», а не число, которое
   * нужно было бы держать синхронным с шириной строки самому.
   */
  const [diagramWidth, setDiagramWidth] = useState<number | null>(null);

  /**
   * Ширина строки «поля / схема» — нужна, чтобы ограничить ручную ширину
   * схемы разумным пределом: без него можно было бы утащить форму слева
   * до нуля. Меряется `ResizeObserver`, а не читается один раз при
   * монтировании — строка меняет ширину при сворачивании сайдбара
   * приложения и при ресайзе окна.
   */
  const splitRef = useRef<HTMLDivElement>(null);
  const [splitWidth, setSplitWidth] = useState(0);
  useEffect(() => {
    const el = splitRef.current;
    if (!el) return;
    const observer = new ResizeObserver(([entry]) => setSplitWidth(entry.contentRect.width));
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  // 420, не 320: заголовок панели несёт две кнопки-действия («Диаграмма»,
  // «Слои») рядом с подписью — вместе они не помещаются в 320px, и до
  // защитного переноса в самой панели (см. `wrap` у заголовка в
  // `InlineSidebar`) дело обычно не доходит, но действия при этом почти
  // упираются в подпись. 420px оставляет им обоим место на одной строке.
  const DIAGRAM_MIN_WIDTH = 420;
  const FIELDS_MIN_WIDTH = 360;
  const diagramMaxWidth = Math.max(DIAGRAM_MIN_WIDTH, splitWidth - FIELDS_MIN_WIDTH);

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

  /**
   * Поле и его участок на схеме — связь в обе стороны.
   *
   * Наведение на поле подсвечивает участок (как было), наведение на участок
   * подсвечивает поле: схема сообщает `hoverZone` сама (`onZoneHover` ниже),
   * и поле с тем же ключом обводится. Односторонняя связь отвечала только
   * на вопрос «где это на схеме», но не на обратный — «что за размер я
   * сейчас вижу», а он у незнакомого чертежа возникает первым.
   */
  const zoned = (key: ChamberHighlightKey, children: ReactNode) =>
    fieldMode === 'highlight' ? (
      <div
        className={hoverZone === key ? `${styles.zonedField} ${styles.zonedFieldActive}` : styles.zonedField}
        onMouseEnter={() => setHoverZone(key)}
        onMouseLeave={() => setHoverZone((z) => (z === key ? null : z))}
      >
        {children}
      </div>
    ) : (
      children
    );

  /** Пояснение под полем: исходное + отклонение от значения на момент создания проекта, если оно есть и включён показ. */
  const hintWithDelta = (key: keyof GeomData, base?: string): string | undefined => {
    if (deltaMode !== 'show') return base;
    const was = baseline[key];
    if (was === data[key]) return base;
    return base ? `${base} · было: ${was}` : `было: ${was}`;
  };

  /** Постфикс поля угла — говорит, в чём сейчас читать число, не отсылая к отдельной подписи над формой. */
  const angleUnitSuffix = data.angleUnit === 'рад' ? 'рад' : 'град°';

  // ── меню «Диаграмма» и «Слои» над схемой ──
  const [diagramOpen, setDiagramOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [layers, setLayers] = useState<Required<ChamberSchemeLayers>>({
    zones: true,
    rays: false,
    arcs: false,
    gaps: false,
    dims: true,
  });
  const toggleLayer = (key: keyof ChamberSchemeLayers) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  /**
   * Режим отображения — не один из двух, а два независимых набора слоёв:
   * «Обычный» — зоны и размеры, «Линии построения» — лучи, дуги углов
   * и зазоры, то есть та часть чертежа, по которой профиль строится.
   * Их включают и вместе: это разные слои одного чертежа, а не
   * взаимоисключающие виды, поэтому здесь флажки, а не переключатель.
   *
   * Своего состояния у режимов нет — оно выводится из самих слоёв. Иначе
   * отметка врала бы после ручной правки в «Слоях»: выключил зоны там,
   * а «Обычный» стоит включённым.
   */
  const normalOn = DIAGRAM_NORMAL_LAYERS.some((key) => layers[key]);
  const buildOn = DIAGRAM_BUILD_LAYERS.some((key) => layers[key]);

  const toggleDiagramGroup = (keys: readonly (keyof ChamberSchemeLayers)[], on: boolean) => {
    setLayers((prev) => {
      const next = { ...prev };
      for (const key of keys) next[key] = !on;
      return next;
    });
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

  /**
   * Не `onWheel` из React: с React 18 синтетическое событие `wheel`
   * навешено на документ пассивным слушателем (ради производительности
   * скролла), и `preventDefault()` внутри него молча ничего не делает —
   * браузер всё равно прокручивает и масштабирует страницу целиком поверх
   * зума схемы. Обычный `addEventListener` с `{ passive: false }` — рабочий.
   */
  const viewportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      setView((v) => ({ ...v, k: Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, v.k * (e.deltaY < 0 ? 1.12 : 0.89))) }));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);

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
    <div className={styles.split} ref={splitRef}>
      <div className={styles.fields}>
        <Stack gap="2xl" direction="column">
          {/* Заголовок и его действия — одной строкой, как в шапке панели
              схемы справа: подпись слева, управление справа, по центру
              по вертикали. Подзаголовок убран — он повторял названия полей,
              которые тут же под ним и стоят, и разводил заголовок с чипсами
              по разной высоте. */}
          <Stack direction="row" justify="between" align="center" gap="md" wrap>
            <Text variant="headingMd">Геометрия камеры</Text>

            <Stack direction="row" align="center" gap="sm">
              <Chip
                icon="fileText"
                action={{ icon: 'pencil', label: 'Сменить дробилку', onClick: () => setCrusherPickerOpen(true) }}
              >
                {crusherName}
              </Chip>

              <Popover
                open={displayOpen}
                onClose={() => setDisplayOpen(false)}
                placement="bottom-end"
                width="md"
                title="Режим отображения"
                trigger={
                  <Button variant="secondary" iconEnd="chevronDown" onClick={() => setDisplayOpen((o) => !o)}>
                    Отображение
                  </Button>
                }
              >
                <Stack gap="lg" direction="column">
                  <Stack gap="2xs" direction="column">
                    <Box paddingX="sm">
                      <Text variant="label">Поля ввода</Text>
                    </Box>
                    <Stack direction="column" gap="none">
                      <OptionCell
                        label="Только ввод"
                        description="Без подсветки участков схемы"
                        checked={fieldMode === 'input'}
                        onSelect={() => setFieldMode('input')}
                      />
                      <OptionCell
                        label="Подсветка участка"
                        description="Наведение подсвечивает участок"
                        checked={fieldMode === 'highlight'}
                        onSelect={() => setFieldMode('highlight')}
                      />
                    </Stack>
                  </Stack>

                  <Stack gap="2xs" direction="column">
                    <Box paddingX="sm">
                      <Text variant="label">Дельта</Text>
                    </Box>
                    <Stack direction="column" gap="none">
                      <OptionCell
                        label="Показывать изменения"
                        description="Отклонение от значений расчёта"
                        checked={deltaMode === 'show'}
                        onSelect={() => setDeltaMode('show')}
                      />
                      <OptionCell
                        label="Не показывать изменения"
                        checked={deltaMode === 'hide'}
                        onSelect={() => setDeltaMode('hide')}
                      />
                    </Stack>
                  </Stack>

                  <Stack gap="2xs" direction="column">
                    <Box paddingX="sm">
                      <Text variant="label">Единицы углов</Text>
                    </Box>
                    <Stack direction="column" gap="none">
                      <OptionCell
                        label="Градусы"
                        checked={data.angleUnit === 'deg'}
                        onSelect={() => onChange(convertAngleUnit(data, 'deg'))}
                      />
                      <OptionCell
                        label="Радианы"
                        checked={data.angleUnit === 'рад'}
                        onSelect={() => onChange(convertAngleUnit(data, 'рад'))}
                      />
                    </Stack>
                  </Stack>
                </Stack>
              </Popover>
            </Stack>
          </Stack>

          {/* Цепочка профиля — теми же группами и узлами, что и на чертеже:
              «повернуть на β, шагнуть на L» от точки подвеса. Каждая строка
              соответствует своему участку схемы (ключ в `zoned`), поэтому
              наведение связывает их в обе стороны. */}
          <Stack gap="md" direction="column">
            <Text variant="headingSm">Броня чаши — неподвижный профиль 40 · 41 · 42 · 4i · 3</Text>

            {zoned(
              'a40',
              <div className={styles.pair}>
                <Field label="Угол луча α40" hint={hintWithDelta('a40')} labelHint={<FieldHint>{GEOM_GLOSSARY.a40}</FieldHint>}>
                  {(props) => (
                    <Input
                      {...props}
                      fullWidth
                      type="number"
                      value={data.a40}
                      onChange={(e) => onChange({ a40: e.target.value })}
                      suffix={angleUnitSuffix}
                    />
                  )}
                </Field>
                <Field label="Длина луча r40, мм" hint={hintWithDelta('r40')} labelHint={<FieldHint>{GEOM_GLOSSARY.r40}</FieldHint>}>
                  {(props) => (
                    <Input {...props} fullWidth type="number" value={data.r40} onChange={(e) => onChange({ r40: e.target.value })} />
                  )}
                </Field>
              </div>
            )}

            {zoned(
              'n40',
              <div className={styles.pair}>
                <Field label="Угол чаши β40" hint={hintWithDelta('b40')} labelHint={<FieldHint>{GEOM_GLOSSARY.b40}</FieldHint>}>
                  {(props) => (
                    <Input
                      {...props}
                      fullWidth
                      type="number"
                      value={data.b40}
                      onChange={(e) => onChange({ b40: e.target.value })}
                      suffix={angleUnitSuffix}
                    />
                  )}
                </Field>
                <Field label="Длина l11 — 40→41, мм" hint={hintWithDelta('l11')} labelHint={<FieldHint>{GEOM_GLOSSARY.l11}</FieldHint>}>
                  {(props) => (
                    <Input {...props} fullWidth type="number" value={data.l11} onChange={(e) => onChange({ l11: e.target.value })} />
                  )}
                </Field>
              </div>
            )}

            {zoned(
              'n41',
              <div className={styles.pair}>
                <Field label="Угол β41" hint={hintWithDelta('b41')} labelHint={<FieldHint>{GEOM_GLOSSARY.b41}</FieldHint>}>
                  {(props) => (
                    <Input
                      {...props}
                      fullWidth
                      type="number"
                      value={data.b41}
                      onChange={(e) => onChange({ b41: e.target.value })}
                      suffix={angleUnitSuffix}
                    />
                  )}
                </Field>
                <Field label="Длина l12 — 41→42, мм" hint={hintWithDelta('l12')} labelHint={<FieldHint>{GEOM_GLOSSARY.l12}</FieldHint>}>
                  {(props) => (
                    <Input {...props} fullWidth type="number" value={data.l12} onChange={(e) => onChange({ l12: e.target.value })} />
                  )}
                </Field>
              </div>
            )}

            {zoned(
              'n42',
              <div className={styles.pair}>
                <Field label="Угол β42" hint={hintWithDelta('b42')} labelHint={<FieldHint>{GEOM_GLOSSARY.b42}</FieldHint>}>
                  {(props) => (
                    <Input
                      {...props}
                      fullWidth
                      type="number"
                      value={data.b42}
                      onChange={(e) => onChange({ b42: e.target.value })}
                      suffix={angleUnitSuffix}
                    />
                  )}
                </Field>
                <Field label="Длина l1i — 42→4i, мм" hint={hintWithDelta('l1i')} labelHint={<FieldHint>{GEOM_GLOSSARY.l1i}</FieldHint>}>
                  {(props) => (
                    <Input {...props} fullWidth type="number" value={data.l1i} onChange={(e) => onChange({ l1i: e.target.value })} />
                  )}
                </Field>
              </div>
            )}

            {zoned(
              'n4i',
              <div className={styles.pair}>
                <Field label="Угол β4i" hint={hintWithDelta('b4i')} labelHint={<FieldHint>{GEOM_GLOSSARY.b4i}</FieldHint>}>
                  {(props) => (
                    <Input
                      {...props}
                      fullWidth
                      type="number"
                      value={data.b4i}
                      onChange={(e) => onChange({ b4i: e.target.value })}
                      suffix={angleUnitSuffix}
                    />
                  )}
                </Field>
                <Field label="Длина l2 — 4i→3, калибровка, мм" hint={hintWithDelta('l2')} labelHint={<FieldHint>{GEOM_GLOSSARY.l2}</FieldHint>}>
                  {(props) => (
                    <Input {...props} fullWidth type="number" value={data.l2} onChange={(e) => onChange({ l2: e.target.value })} />
                  )}
                </Field>
              </div>
            )}

            {zoned(
              't3',
              <div className={`${styles.pair} ${styles.pairSingle}`}>
                <Field label="Терминальный угол β3" hint={hintWithDelta('b3')} labelHint={<FieldHint>{GEOM_GLOSSARY.b3}</FieldHint>}>
                  {(props) => (
                    <Input
                      {...props}
                      fullWidth
                      type="number"
                      value={data.b3}
                      onChange={(e) => onChange({ b3: e.target.value })}
                      suffix={angleUnitSuffix}
                    />
                  )}
                </Field>
              </div>
            )}
          </Stack>

          <div className={styles.groupDivider} />

          <Stack gap="md" direction="column">
            <Text variant="headingSm">Броня конуса — гирационный профиль 10 · 11 · 12 · 1i · 2</Text>

            {zoned(
              'a10',
              <div className={styles.pair}>
                <Field label="Угол луча α10" hint={hintWithDelta('a10')} labelHint={<FieldHint>{GEOM_GLOSSARY.a10}</FieldHint>}>
                  {(props) => (
                    <Input
                      {...props}
                      fullWidth
                      type="number"
                      value={data.a10}
                      onChange={(e) => onChange({ a10: e.target.value })}
                      suffix={angleUnitSuffix}
                    />
                  )}
                </Field>
                <Field label="Длина луча r10, мм" hint={hintWithDelta('r10')} labelHint={<FieldHint>{GEOM_GLOSSARY.r10}</FieldHint>}>
                  {(props) => (
                    <Input {...props} fullWidth type="number" value={data.r10} onChange={(e) => onChange({ r10: e.target.value })} />
                  )}
                </Field>
              </div>
            )}

            {zoned(
              'n10',
              <div className={styles.pair}>
                <Field label="Угол конуса β10" hint={hintWithDelta('b10')} labelHint={<FieldHint>{GEOM_GLOSSARY.b10}</FieldHint>}>
                  {(props) => (
                    <Input
                      {...props}
                      fullWidth
                      type="number"
                      value={data.b10}
                      onChange={(e) => onChange({ b10: e.target.value })}
                      suffix={angleUnitSuffix}
                    />
                  )}
                </Field>
                <Field label="Длина L 10→11, мм" hint={hintWithDelta('L10')} labelHint={<FieldHint>{GEOM_GLOSSARY.L10}</FieldHint>}>
                  {(props) => (
                    <Input {...props} fullWidth type="number" value={data.L10} onChange={(e) => onChange({ L10: e.target.value })} />
                  )}
                </Field>
              </div>
            )}

            {zoned(
              'n11',
              <div className={styles.pair}>
                <Field label="Угол β11" hint={hintWithDelta('b11')} labelHint={<FieldHint>{GEOM_GLOSSARY.b11}</FieldHint>}>
                  {(props) => (
                    <Input
                      {...props}
                      fullWidth
                      type="number"
                      value={data.b11}
                      onChange={(e) => onChange({ b11: e.target.value })}
                      suffix={angleUnitSuffix}
                    />
                  )}
                </Field>
                <Field label="Длина L 11→12, мм" hint={hintWithDelta('L11')} labelHint={<FieldHint>{GEOM_GLOSSARY.L11}</FieldHint>}>
                  {(props) => (
                    <Input {...props} fullWidth type="number" value={data.L11} onChange={(e) => onChange({ L11: e.target.value })} />
                  )}
                </Field>
              </div>
            )}

            {zoned(
              'n12',
              <div className={styles.pair}>
                <Field label="Угол β12" hint={hintWithDelta('b12')} labelHint={<FieldHint>{GEOM_GLOSSARY.b12}</FieldHint>}>
                  {(props) => (
                    <Input
                      {...props}
                      fullWidth
                      type="number"
                      value={data.b12}
                      onChange={(e) => onChange({ b12: e.target.value })}
                      suffix={angleUnitSuffix}
                    />
                  )}
                </Field>
                <Field label="Длина L 12→1i, мм" hint={hintWithDelta('L12')} labelHint={<FieldHint>{GEOM_GLOSSARY.L12}</FieldHint>}>
                  {(props) => (
                    <Input {...props} fullWidth type="number" value={data.L12} onChange={(e) => onChange({ L12: e.target.value })} />
                  )}
                </Field>
              </div>
            )}

            {zoned(
              'n1i',
              <div className={styles.pair}>
                <Field label="Угол β1i" hint={hintWithDelta('b1i')} labelHint={<FieldHint>{GEOM_GLOSSARY.b1i}</FieldHint>}>
                  {(props) => (
                    <Input
                      {...props}
                      fullWidth
                      type="number"
                      value={data.b1i}
                      onChange={(e) => onChange({ b1i: e.target.value })}
                      suffix={angleUnitSuffix}
                    />
                  )}
                </Field>
                <Field label="Длина L 1i→2, мм" hint={hintWithDelta('L1i')} labelHint={<FieldHint>{GEOM_GLOSSARY.L1i}</FieldHint>}>
                  {(props) => (
                    <Input {...props} fullWidth type="number" value={data.L1i} onChange={(e) => onChange({ L1i: e.target.value })} />
                  )}
                </Field>
              </div>
            )}

            {zoned(
              't2',
              <div className={`${styles.pair} ${styles.pairSingle}`}>
                <Field label="Угол на выходе конуса β2" hint={hintWithDelta('b2')} labelHint={<FieldHint>{GEOM_GLOSSARY.b2}</FieldHint>}>
                  {(props) => (
                    <Input
                      {...props}
                      fullWidth
                      type="number"
                      value={data.b2}
                      onChange={(e) => onChange({ b2: e.target.value })}
                      suffix={angleUnitSuffix}
                    />
                  )}
                </Field>
              </div>
            )}
          </Stack>

          <div className={styles.groupDivider} />

          <Stack gap="md" direction="column">
            <Text variant="headingSm">Нутация конуса</Text>

            {zoned(
              'theta',
              <div className={`${styles.pair} ${styles.pairSingle}`}>
                <Field label="Угол нутации θ" hint={hintWithDelta('theta')} labelHint={<FieldHint>{GEOM_GLOSSARY.theta}</FieldHint>}>
                  {(props) => (
                    <Input
                      {...props}
                      fullWidth
                      type="number"
                      value={data.theta}
                      onChange={(e) => onChange({ theta: e.target.value })}
                      suffix={angleUnitSuffix}
                    />
                  )}
                </Field>
              </div>
            )}
          </Stack>

          <div className={styles.groupDivider} />

          {/* Габариты — независимый ввод поверх построенной цепочки: на чертеже
              это производные величины, здесь их задаёт пользователь, и профиль
              подгоняется под них (`applyCalibration`). */}
          <Stack gap="md" direction="column">
            <Text variant="headingSm">Габариты камеры</Text>

            <div className={styles.pair}>
              {zoned(
                'dim-d',
                <Field label="Диаметр основания D, мм" required hint={hintWithDelta('D')} labelHint={<FieldHint>{GEOM_GLOSSARY.D}</FieldHint>}>
                  {(props) => (
                    <Input {...props} fullWidth type="number" value={data.D} onChange={(e) => onChange({ D: e.target.value })} />
                  )}
                </Field>
              )}

              {zoned(
                'dim-h',
                <Field label="Высота камеры H, мм" required hint={hintWithDelta('H')} labelHint={<FieldHint>{GEOM_GLOSSARY.H}</FieldHint>}>
                  {(props) => (
                    <Input {...props} fullWidth type="number" value={data.H} onChange={(e) => onChange({ H: e.target.value })} />
                  )}
                </Field>
              )}
            </div>

            {zoned(
              'gap4',
              <div className={`${styles.pair} ${styles.pairSingle}`}>
                <Field label="Ширина разгрузочной щели S0, мм" required hint={hintWithDelta('S0')} labelHint={<FieldHint>{GEOM_GLOSSARY.S0}</FieldHint>}>
                  {(props) => (
                    <Input {...props} fullWidth type="number" value={data.S0} onChange={(e) => onChange({ S0: e.target.value })} />
                  )}
                </Field>
              </div>
            )}
          </Stack>

          <div className={styles.groupDivider} />

          {/* Коэффициенты методики и число зон своего участка на чертеже
              не имеют — подсвечивать при наведении нечего, обёртки нет. */}
          <Stack gap="md" direction="column">
            <Text variant="headingSm">Коэффициенты профиля</Text>

            <div className={styles.pair}>
              <Field label="Коэффициент R" hint={hintWithDelta('R')} labelHint={<FieldHint>{GEOM_GLOSSARY.R}</FieldHint>}>
                {(props) => (
                  <Input {...props} fullWidth type="number" value={data.R} onChange={(e) => onChange({ R: e.target.value })} />
                )}
              </Field>

              <Field label="Коэффициент a" hint={hintWithDelta('a')} labelHint={<FieldHint>{GEOM_GLOSSARY.a}</FieldHint>}>
                {(props) => (
                  <Input {...props} fullWidth type="number" value={data.a} onChange={(e) => onChange({ a: e.target.value })} />
                )}
              </Field>
            </div>

            <Field label="Число зон дробления" labelHint={<FieldHint>{GEOM_GLOSSARY.zones}</FieldHint>}>
              {(props) => (
                <Select
                  {...props}
                  fullWidth
                  clearable={false}
                  options={[
                    { value: '1', label: '1' },
                    { value: '2', label: '2' },
                  ]}
                  value={data.zones}
                  onChange={(v) => onChange({ zones: v as ZoneCount })}
                />
              )}
            </Field>
          </Stack>

        </Stack>
      </div>

      <InlineSidebar
        open={sidebarOpen}
        onOpenChange={setSidebarOpen}
        title="Схема профиля камеры"
        width={diagramWidth !== null ? Math.min(diagramWidth, diagramMaxWidth) : undefined}
        onWidthChange={setDiagramWidth}
        minWidth={DIAGRAM_MIN_WIDTH}
        maxWidth={diagramMaxWidth}
        actions={
          <>
            <Popover
              open={diagramOpen}
              onClose={() => setDiagramOpen(false)}
              placement="bottom-end"
              width="md"
              title="Режим отображения"
              trigger={
                <Button variant="secondary" iconEnd="chevronDown" onClick={() => setDiagramOpen((o) => !o)}>
                  Диаграмма
                </Button>
              }
            >
              <Stack direction="column" gap="none">
                <OptionCell
                  kind="checkbox"
                  label="Обычный"
                  description="Заливка зон и размеры"
                  checked={normalOn}
                  onSelect={() => toggleDiagramGroup(DIAGRAM_NORMAL_LAYERS, normalOn)}
                />
                <OptionCell
                  kind="checkbox"
                  label="Линии построения"
                  description="Лучи от подвеса к точкам профиля"
                  checked={buildOn}
                  onSelect={() => toggleDiagramGroup(DIAGRAM_BUILD_LAYERS, buildOn)}
                />
              </Stack>
            </Popover>

            <Popover
              open={layersOpen}
              onClose={() => setLayersOpen(false)}
              placement="bottom-end"
              width="sm"
              title="Отображать"
              trigger={
                <Button variant="secondary" iconEnd="chevronDown" onClick={() => setLayersOpen((o) => !o)}>
                  Слои
                </Button>
              }
            >
              <Stack direction="column" gap="none">
                <OptionCell label="Заливка зон" kind="checkbox" checked={layers.zones} onSelect={() => toggleLayer('zones')} />
                <OptionCell
                  label="Лучи из точки подвеса"
                  description="И подписи радиусов r"
                  kind="checkbox"
                  checked={layers.rays}
                  onSelect={() => toggleLayer('rays')}
                />
                <OptionCell label="Углы β (дуги)" kind="checkbox" checked={layers.arcs} onSelect={() => toggleLayer('arcs')} />
                <OptionCell label="Зазоры S" kind="checkbox" checked={layers.gaps} onSelect={() => toggleLayer('gaps')} />
                <OptionCell label="Размеры D/2 и h" kind="checkbox" checked={layers.dims} onSelect={() => toggleLayer('dims')} />
              </Stack>
            </Popover>
          </>
        }
      >
        {/* Без обёртки-`Surface`: она рисовала только внутренний отступ
            (`flat`, `border={false}`), но рвала цепочку определённых высот
            от липкой панели к самой схеме — с ней ограничение высоты не
            доходило до `.viewport`, и низ схемы обрезался. Отступ вернулся
            внутрь, на `.zoomLayer`. */}
        <div
          ref={viewportRef}
          className={panning ? `${styles.viewport} ${styles.viewportPanning}` : styles.viewport}
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
                /* Режим построения только прячет описательные выноски
                   и середины брони — поэтому вместе с «Обычным» он их
                   не отнимает: включены оба набора, значит нужен и тот,
                   что подписывает чертёж словами. */
                construction={buildOn && !normalOn}
                highlight={hoverZone}
                /* Связь в обратную сторону работает в том же режиме, что и
                   прямая: «Подсветка участка» включает обе, «Только ввод» —
                   ни одной, иначе один и тот же переключатель отвечал бы
                   за половину поведения. */
                onZoneHover={fieldMode === 'highlight' ? setHoverZone : undefined}
              />
            </div>

            <div className={styles.zoomControls}>
              <Surface level="raised" radius="sm" padding="2xs" border={false}>
                {/* Без `size`: по умолчанию `md`, тот же размер, что и у
                    «Диаграмма»/«Слои» в заголовке панели — на `sm` кнопки
                    зума выглядели заметно мельче соседних действий над
                    той же схемой, хотя нажимать их приходится не реже.

                    `icon`, а не текстовый символ: у кнопки-иконки ширина
                    равна высоте контрола, у кнопки с текстом — считается
                    по содержимому и паддингу. Разница в пару пикселей
                    делала бы кнопку «сбросить вид» уже соседних. */}
                <Stack direction="column" gap="2xs">
                  <Button variant="secondary" icon="plus" aria-label="Приблизить" onClick={() => zoomBy(1.25)} />
                  <Button variant="secondary" icon="minus" aria-label="Отдалить" onClick={() => zoomBy(0.8)} />
                  <Button variant="secondary" icon="maximize" aria-label="Сбросить вид" onClick={resetView} />
                </Stack>
              </Surface>
            </div>
        </div>
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
          inlineSpecs={['D, мм', 'Q, т/ч']}
        />
      </Modal>
    </div>
  );
}

