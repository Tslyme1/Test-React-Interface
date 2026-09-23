import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { Box, Button, Chip, Field, Icon, Input, Modal, Popover, Stack, Surface, Text } from '@uralmash/design-system';
import type { GeomData } from '@/types';
import { CatalogPicker } from '@/components/CatalogPicker/CatalogPicker';
import { CRUSHER_SPECS } from '@/data/crushers';
import { ChamberScheme } from '@/components/ChamberScheme/ChamberScheme';
import { calibrationZoneKey, dischargeGapKey, zoneNodeKeys } from '@/components/ChamberScheme/ChamberScheme';
import type { ChamberHighlightKey, ChamberSchemeLayers } from '@/components/ChamberScheme/ChamberScheme';
import { InlineSidebar } from '@/components/InlineSidebar/InlineSidebar';
import { OptionCell } from '@/components/OptionCell/OptionCell';
import { FieldHint } from '@/components/FieldHint/FieldHint';
import { GEOM_GLOSSARY, ZONE_GLOSSARY } from '@/data/paramGlossary';
import { buildChamberProfileInput, crushingZones } from '@/domain/chamberInput';
import { limitIn, validateGeom, zoneLimitIn } from '@/domain/geomLimits';
import type { LimitedField, ZoneField } from '@/domain/geomLimits';
import { convertAngleUnit } from '@/domain/angleUnit';
import { portalSlot } from './portalSlot';
import { useUserCatalog } from '@/state/userCatalog';
import { CatalogCreateButton } from '@/components/CatalogCreateButton/CatalogCreateButton';
import styles from './GeometryStep.module.css';

/**
 * Потолок числа зон. Методика его не ставит — это защита от опечатки:
 * «20» вместо «2» превратило бы форму в сотню полей, а чертёж —
 * в частокол. Реальные камеры укладываются в две-три зоны.
 */
const MAX_ZONES = 9;

/**
 * Ближайший предок, который действительно прокручивается.
 *
 * Форма живёт в окне (`Modal`), и прокручивается не она сама, а
 * содержимое окна; искать его по классу дизайн-системы нельзя — имя
 * там собрано сборщиком. Поэтому ищем по поведению: первый предок,
 * у которого содержимое выше самого блока и включена прокрутка.
 */
function scrollableAncestor(node: HTMLElement): HTMLElement | null {
  let el: HTMLElement | null = node.parentElement;
  while (el) {
    const overflow = getComputedStyle(el).overflowY;
    if ((overflow === 'auto' || overflow === 'scroll') && el.scrollHeight > el.clientHeight) return el;
    el = el.parentElement;
  }
  return null;
}

const ZONE_COUNT_HINT =
  'Сколько зон между зоной входа и зоной калибровки. Для каждой вводятся своя длина и свои углы образующих конуса и чаши.';

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
  /**
   * Новое имя машины. Переименование не правит проект на месте: машина
   * с другим именем и правленой камерой — это уже другая разработка,
   * и она заводится отдельным проектом (см. `WizardPage`).
   */
  onRenameCrusher: (name: string) => void;
  /** Узел у заголовка окна — туда уходит «Отображение». */
  actionsSlot?: HTMLElement | null;
  /** Узел в футере окна — туда уходит плашка выбранной дробилки. */
  objectSlot?: HTMLElement | null;
};

export function GeometryStep({
  data,
  onChange,
  baseline,
  crusherName,
  onChangeCrusher,
  onRenameCrusher,
  actionsSlot,
  objectSlot,
}: GeometryStepProps) {
  const schemeInput = useMemo(() => buildChamberProfileInput(data), [data]);
  /** Сколько троек «длина + углы» показывать — см. `crushingZones`. */
  const zoneCount = crushingZones(data);

  /**
   * Правка одной зоны. Набор пересобирается новым массивом: правка
   * объекта на месте не дошла бы до `React` — он сравнивает по ссылке,
   * и чертёж остался бы на старых числах.
   */
  const changeZone = (index: number, patch: Partial<GeomData['zones'][number]>) =>
    onChange({ zones: data.zones.map((zone, i) => (i === index ? { ...zone, ...patch } : zone)) });

  /**
   * Смена числа зон. Лишние тройки отрезаются, новые дописываются копией
   * последней: соседние зоны обычно отличаются немногим, и заполнять
   * новую с нуля значило бы вводить заново то, что уже введено рядом.
   */
  const changeZoneCount = (raw: string) => {
    const parsed = Math.round(Number(raw));
    if (!Number.isFinite(parsed)) return;
    const next = Math.max(1, Math.min(parsed, MAX_ZONES));
    if (next === data.zones.length) return;

    const last = data.zones[data.zones.length - 1];
    const zones = Array.from({ length: next }, (_, i) => data.zones[i] ?? { ...last });
    onChange({ zones });
  };

  /**
   * Границы исходных данных (`geomLimits`). Ошибка выводится под полем
   * и вытесняет подсказку, поэтому высота формы не скачет. Значение при
   * этом не подменяется: правка, которую пользователь не делал, хуже
   * неверного числа, о котором ему сказали.
   */
  const errors = useMemo(() => validateGeom(data), [data]);

  /** `min`/`max` в тех же единицах, в которых поле показано сейчас. */
  const bounds = (field: LimitedField) => {
    const { min, max } = limitIn(field, data);
    return { min, max };
  };

  /** То же для величины внутри зоны — границы у всех зон одни и те же. */
  const zoneBounds = (field: ZoneField) => {
    const { min, max } = zoneLimitIn(field, data);
    return { min, max };
  };
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
  /**
   * Черновик имени машины. `null` — окно переименования закрыто.
   * Черновик, а не правка на месте: имя применяется только по
   * «Сохранить», потому что сохранение здесь заводит новый проект.
   */
  const [renameDraft, setRenameDraft] = useState<string | null>(null);
  const renameReady = renameDraft !== null && renameDraft.trim().length > 0 && renameDraft.trim() !== crusherName;
  /* Справочник с правками пользователя: заведённая в упрощённом режиме
     машина обязана находиться и здесь — справочник один на приложение. */
  const crusherCatalog = useUserCatalog('crushers');

  // ── режим отображения: поля ввода (подсветка участка) и дельта ──
  const [displayOpen, setDisplayOpen] = useState(false);
  const [fieldMode, setFieldMode] = useState<FieldMode>('input');
  const [deltaMode, setDeltaMode] = useState<DeltaMode>('show');
  /**
   * Что сейчас подсвечено и с какой стороны на это навели.
   *
   * Сторона важна не для вида, а для прокрутки: когда связь назвал
   * чертёж, форму надо подкрутить к найденному полю (см. ниже), а когда
   * навели на само поле — крутить некуда, оно и так под курсором.
   */
  const [hover, setHover] = useState<{ key: ChamberHighlightKey; from: 'field' | 'scheme' } | null>(null);
  const hoverZone = hover?.key ?? null;

  // Смена режима с «Подсветка участка» на «Только ввод» гасит подсветку,
  // начатую полем: сама связь «поле → участок» в этом режиме выключена.
  // Наведение на чертёж при этом работает всегда и не гасится.
  useEffect(() => {
    if (fieldMode === 'input') setHover((h) => (h?.from === 'field' ? null : h));
  }, [fieldMode]);

  /**
   * Форма прокручивается к полю, которое назвал чертёж.
   *
   * Без этого связь работала только наполовину: чертёж честно обводил
   * поле, но поле могло стоять за краем видимой части формы — и наведение
   * не отвечало ни на что. Прокрутка минимальная: поле подводится к
   * ближней кромке, а не к середине, чтобы соседние поля не перескакивали
   * под курсором дальше, чем нужно.
   *
   * `smooth`: рывок на каждое наведение читался бы как подёргивание
   * формы, а не как ответ на вопрос.
   */
  const fieldsRef = useRef<HTMLDivElement>(null);
  /**
   * Есть ли подсвеченное поле, которое не поместилось в видимую часть
   * формы даже после прокрутки, и в какую сторону оно осталось. Бывает,
   * когда один участок чертежа называет два поля из разных групп: обе
   * сразу на экран не влезают, и надо сказать, куда крутить дальше.
   */
  const [offscreen, setOffscreen] = useState<'up' | 'down' | null>(null);

  useEffect(() => {
    setOffscreen(null);
    if (!hover || hover.from !== 'scheme') return;

    const root = fieldsRef.current;
    if (!root) return;

    const targets = Array.from(root.querySelectorAll<HTMLElement>(`[data-zone-field="${CSS.escape(hover.key)}"]`));
    if (targets.length === 0) return;

    const scroller = scrollableAncestor(root);
    if (!scroller) return;

    const view = scroller.getBoundingClientRect();
    const rects = targets.map((node) => node.getBoundingClientRect());
    const top = Math.min(...rects.map((r) => r.top));
    const bottom = Math.max(...rects.map((r) => r.bottom));

    /* Запас у кромки: поле, подведённое встык, выглядит обрезанным,
       и по нему не видно, есть ли что-то дальше. */
    const EDGE = 24;
    let delta = 0;
    if (top < view.top + EDGE) delta = top - view.top - EDGE;
    else if (bottom > view.bottom - EDGE) {
      /* Не дальше, чем нужно первому полю: иначе пара полей, которая
         не помещается целиком, уводила бы верхнее за кромку. */
      delta = Math.min(bottom - view.bottom + EDGE, top - view.top - EDGE);
    }
    if (delta !== 0) scroller.scrollBy({ top: delta, behavior: 'smooth' });

    /* Что останется за кромкой, когда прокрутка доиграет. */
    if (bottom - delta > view.bottom) setOffscreen('down');
    else if (top - delta < view.top) setOffscreen('up');
  }, [hover]);

  /**
   * Поле и его участок на схеме — связь в обе стороны.
   *
   * Наведение на поле подсвечивает участок (как было), наведение на участок
   * подсвечивает поле: схема сообщает `hoverZone` сама (`onZoneHover` ниже),
   * и поле с тем же ключом обводится. Односторонняя связь отвечала только
   * на вопрос «где это на схеме», но не на обратный — «что за размер я
   * сейчас вижу», а он у незнакомого чертежа возникает первым.
   */
  const zoned = (key: ChamberHighlightKey, children: ReactNode) => (
    /* Обёртка стоит всегда, а не только в режиме «Подсветка участка»:
       по её `data-zone-field` поле находят и прокрутка, и тест связи
       «поле ↔ участок», а подсветку от чертежа она принимает независимо
       от режима — наведение на чертёж работает без настроек. Режимом
       управляется только обратное направление: подсвечивать участок
       при движении курсора по форме нужно не всем и не всегда. */
    <div
      data-zone-field={key}
      className={hoverZone === key ? `${styles.zonedField} ${styles.zonedFieldActive}` : styles.zonedField}
      {...(fieldMode === 'highlight'
        ? {
            onMouseEnter: () => setHover({ key, from: 'field' }),
            onMouseLeave: () => setHover((h) => (h?.key === key ? null : h)),
          }
        : {})}
    >
      {children}
    </div>
  );

  /** Пояснение под полем: исходное + отклонение от значения на момент создания проекта, если оно есть и включён показ. */
  const hintWithDelta = (key: keyof GeomData, base?: string): string | undefined => {
    if (deltaMode !== 'show') return base;
    const was = baseline[key];
    if (was === data[key]) return base;
    return base ? `${base} · было: ${was}` : `было: ${was}`;
  };

  /**
   * Отклонение величины зоны от исходной. Зона опознаётся номером:
   * если зон стало больше, чем было при создании проекта, сравнивать
   * новой не с чем — подсказки у неё просто нет.
   */
  const hintWithZoneDelta = (index: number, key: keyof GeomData['zones'][number]): string | undefined => {
    if (deltaMode !== 'show') return undefined;
    const was = baseline.zones[index]?.[key];
    if (was === undefined || was === data.zones[index][key]) return undefined;
    return `было: ${was}`;
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
      <div className={styles.fields} ref={fieldsRef}>
        {/* Подсвеченное поле не поместилось целиком — говорим, куда крутить.
            Плашка липкая у кромки формы: она отвечает на вопрос «а где
            остальное», который возникает ровно в тот момент, когда смотришь
            на край. Указатель, а не кнопка: прокрутку к первому полю форма
            уже сделала сама, дальше человек крутит сам и видит, куда. */}
        {offscreen ? (
          <div className={offscreen === 'up' ? `${styles.offscreen} ${styles.offscreenUp}` : `${styles.offscreen} ${styles.offscreenDown}`}>
            <Surface level="overlay" radius="sm" padding="2xs" border={false}>
              <Stack direction="row" gap="2xs" align="center">
                <Icon name={offscreen === 'up' ? 'chevronUp' : 'chevronDown'} size="sm" />
                <Text variant="caption" color="textMuted">
                  Ещё одно поле этого участка {offscreen === 'up' ? 'выше' : 'ниже'}
                </Text>
              </Stack>
            </Surface>
          </div>
        ) : null}

        <Stack gap="2xl" direction="column">
          {/* Заголовок и его действия — одной строкой, как в шапке панели
              схемы справа: подпись слева, управление справа, по центру
              по вертикали. Подзаголовок убран — он повторял названия полей,
              которые тут же под ним и стоят, и разводил заголовок с чипсами
              по разной высоте. */}
          {/* Своего заголовка у формы нет: она живёт в окне, и его
              заголовок называет этап. Два названия подряд — «Исходные
              данные: Дробилка» и «Геометрия камеры» — отвечали бы на один
              вопрос дважды. */}
          {portalSlot(
            objectSlot,
            <Stack direction="row" align="center" gap="sm">
              <Text variant="bodySm" color="textMuted">
                Дробилка
              </Text>
              {/* Два разных действия над машиной, поэтому и значки разные:
                  «сменить» открывает каталог (`folder`), «переименовать»
                  правит имя (`pencil`). Один `pencil` на оба читался бы
                  как одно действие, случайно продублированное. */}
              <Chip
                size="sm"
                icon="fileText"
                action={{ icon: 'folder', label: 'Сменить дробилку', onClick: () => setCrusherPickerOpen(true) }}
              >
                {crusherName}
              </Chip>
              <Button
                variant="ghost"
                size="sm"
                icon="pencil"
                aria-label="Переименовать дробилку"
                onClick={() => setRenameDraft(crusherName)}
              />
            </Stack>
          )}

          {portalSlot(
            actionsSlot,
            <Popover
                open={displayOpen}
                onClose={() => setDisplayOpen(false)}
                placement="bottom-end"
                width="md"
                title="Режим отображения"
                trigger={
                  <Button variant="secondary" size="sm" iconEnd="chevronDown" onClick={() => setDisplayOpen((o) => !o)}>
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
          )}

          {/* Исходные данные профиля — ровно те, что принимает методика
              (§2.2): углы образующих обеих броней по зонам, длины зон,
              габариты основания конуса и щель. Радиус-векторы r и их углы α
              здесь не спрашиваются: методика их вычисляет (§3.2), и держать
              их полями значило бы задать профиль дважды и противоречиво —
              именно от этого чертёж переставал отвечать введённым числам.
              Каждая строка соответствует своему участку схемы (ключ
              в `zoned`), поэтому наведение связывает их в обе стороны. */}
          <Stack gap="md" direction="column">
            <Text variant="headingSm">Зона входа — приёмная часть камеры</Text>

            <div className={styles.pair}>
            {zoned(
              'nc0',
              <Field label="Угол конуса β10" hint={hintWithDelta('b10')} error={errors.b10} labelHint={<FieldHint>{GEOM_GLOSSARY.b10}</FieldHint>}>
                {(props) => (
                  <Input
                    {...props}
                    fullWidth
                    type="number"
                    value={data.b10}
                    onChange={(e) => onChange({ b10: e.target.value })}
                    suffix={angleUnitSuffix}
                    {...bounds('b10')}
                  />
                )}
              </Field>
            )}

            {zoned(
              'nb0',
              <Field label="Угол чаши β40" hint={hintWithDelta('b40')} error={errors.b40} labelHint={<FieldHint>{GEOM_GLOSSARY.b40}</FieldHint>}>
                {(props) => (
                  <Input
                    {...props}
                    fullWidth
                    type="number"
                    value={data.b40}
                    onChange={(e) => onChange({ b40: e.target.value })}
                    suffix={angleUnitSuffix}
                    {...bounds('b40')}
                  />
                )}
              </Field>
            )}
            </div>
          </Stack>

          <div className={styles.groupDivider} />

          <Stack gap="md" direction="column">
            <Text variant="headingSm">Зоны дробления</Text>

            {/* Число зон — исходное данное методики (третья строка файла
                геометрии): оно задаёт длину массивов l₁(i), β₁(i), β₄(i),
                поэтому стоит здесь, над самими зонами, а не в коэффициентах
                внизу формы.

                Поле ввода, а не выбор из списка: методика числом зон
                не ограничена, и закрытый список упирался в потолок там,
                где его нет. Уменьшение отрезает лишние тройки, увеличение
                дописывает новые копией последней — чаще всего соседние
                зоны отличаются немногим, и заполнять новую с нуля значило
                бы вводить заново то, что уже введено рядом. */}
            <Field
              label="Число зон дробления"
              labelHint={<FieldHint>{ZONE_COUNT_HINT}</FieldHint>}
            >
              {(props) => (
                <Input
                  {...props}
                  fullWidth
                  type="number"
                  min={1}
                  max={MAX_ZONES}
                  value={String(zoneCount)}
                  onChange={(e) => changeZoneCount(e.target.value)}
                />
              )}
            </Field>

            {/* Длина у зоны одна на обе брони: это один и тот же участок
                камеры, у чаши он идёт от 40 к 41, у конуса — от 10 к 11.
                Методика и задаёт их одним массивом l₁(i). */}
            <div className={styles.triple}>
            {data.zones.map((zone, index) => {
              const keys = zoneNodeKeys(index);
              const zoneErrors = errors.zones?.[index] ?? {};
              const number = index + 1;

              return (
                <Fragment key={index}>
                  {zoned(
                    keys.bowl,
                    <Field
                      label={`Зона ${number} — длина`}
                      hint={hintWithZoneDelta(index, 'l1')}
                      error={zoneErrors.l1}
                      labelHint={<FieldHint>{ZONE_GLOSSARY.l1}</FieldHint>}
                    >
                      {(props) => (
                        <Input
                          {...props}
                          fullWidth
                          type="number"
                          value={zone.l1}
                          onChange={(e) => changeZone(index, { l1: e.target.value })}
                          suffix="мм"
                          {...zoneBounds('l1')}
                        />
                      )}
                    </Field>
                  )}

                  {zoned(
                    keys.cone,
                    <Field
                      label={`Угол конуса β1${number}`}
                      hint={hintWithZoneDelta(index, 'b1')}
                      error={zoneErrors.b1}
                      labelHint={<FieldHint>{ZONE_GLOSSARY.b1}</FieldHint>}
                    >
                      {(props) => (
                        <Input
                          {...props}
                          fullWidth
                          type="number"
                          value={zone.b1}
                          onChange={(e) => changeZone(index, { b1: e.target.value })}
                          suffix={angleUnitSuffix}
                          {...zoneBounds('b1')}
                        />
                      )}
                    </Field>
                  )}

                  {zoned(
                    keys.bowl,
                    <Field
                      label={`Угол чаши β4${number}`}
                      hint={hintWithZoneDelta(index, 'b4')}
                      error={zoneErrors.b4}
                      labelHint={<FieldHint>{ZONE_GLOSSARY.b4}</FieldHint>}
                    >
                      {(props) => (
                        <Input
                          {...props}
                          fullWidth
                          type="number"
                          value={zone.b4}
                          onChange={(e) => changeZone(index, { b4: e.target.value })}
                          suffix={angleUnitSuffix}
                          {...zoneBounds('b4')}
                        />
                      )}
                    </Field>
                  )}
                </Fragment>
              );
            })}
            </div>
          </Stack>

          <div className={styles.groupDivider} />

          <Stack gap="md" direction="column">
            <Text variant="headingSm">Зона калибровки — 4i · 3 / 1i · 2</Text>

            <div className={styles.pair}>
            {zoned(
              calibrationZoneKey(zoneCount),
              <Field label="Длина зоны l₂" hint={hintWithDelta('l2')} error={errors.l2} labelHint={<FieldHint>{GEOM_GLOSSARY.l2}</FieldHint>}>
                {(props) => (
                  <Input {...props} fullWidth type="number" value={data.l2} onChange={(e) => onChange({ l2: e.target.value })} {...bounds('l2')} suffix="мм" />
                )}
              </Field>
            )}

            {/* На тот же участок, что и длина этой зоны, а не на ключ `t2`:
                такого участка на чертеже в обычных слоях нет вовсе, и поле
                не подсвечивало ничего. Угол и длина — два параметра одного
                участка, и подсвечиваться им правильно вместе. */}
            {zoned(
              calibrationZoneKey(zoneCount),
              <Field label="Угол конуса на выходе β2" hint={hintWithDelta('b2')} error={errors.b2} labelHint={<FieldHint>{GEOM_GLOSSARY.b2}</FieldHint>}>
                {(props) => (
                  <Input
                    {...props}
                    fullWidth
                    type="number"
                    value={data.b2}
                    onChange={(e) => onChange({ b2: e.target.value })}
                    suffix={angleUnitSuffix}
                    {...bounds('b2')}
                  />
                )}
              </Field>
            )}
            </div>

            <Text variant="bodySm" color="textMuted">
              Угол чаши в этой зоне методика выводит сама: β₃ = β₂ − θ — образующие идут параллельно
              с поправкой на эксцентриситет, поэтому щель по всей зоне остаётся равной S₀.
            </Text>
          </Stack>

          <div className={styles.groupDivider} />

          {/* Габариты — полноценные исходные данные методики, а не подгонка
              поверх готового профиля: именно от основания конуса и щели
              рекурсия раскручивает весь профиль снизу вверх (§3.2, шаг 2). */}
          <Stack gap="md" direction="column">
            <Text variant="headingSm">Основание конуса и щель</Text>

            <div className={styles.pair}>
              {zoned(
                'dim-d',
                <Field label="Диаметр основания D" required hint={hintWithDelta('D')} error={errors.D} labelHint={<FieldHint>{GEOM_GLOSSARY.D}</FieldHint>}>
                  {(props) => (
                    <Input {...props} fullWidth type="number" value={data.D} onChange={(e) => onChange({ D: e.target.value })} {...bounds('D')} suffix="мм" />
                  )}
                </Field>
              )}

              {zoned(
                'dim-h',
                <Field label="Высота H от подвеса" required hint={hintWithDelta('H')} error={errors.H} labelHint={<FieldHint>{GEOM_GLOSSARY.H}</FieldHint>}>
                  {(props) => (
                    <Input {...props} fullWidth type="number" value={data.H} onChange={(e) => onChange({ H: e.target.value })} {...bounds('H')} suffix="мм" />
                  )}
                </Field>
              )}
            </div>

            {zoned(
              dischargeGapKey(zoneCount),
              <div className={`${styles.pair} ${styles.pairSingle}`}>
                <Field label="Ширина разгрузочной щели S0" required hint={hintWithDelta('S0')} error={errors.S0} labelHint={<FieldHint>{GEOM_GLOSSARY.S0}</FieldHint>}>
                  {(props) => (
                    <Input {...props} fullWidth type="number" value={data.S0} onChange={(e) => onChange({ S0: e.target.value })} {...bounds('S0')} suffix="мм" />
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
                <Field label="Угол нутации θ" hint={hintWithDelta('theta')} error={errors.theta} labelHint={<FieldHint>{GEOM_GLOSSARY.theta}</FieldHint>}>
                  {(props) => (
                    <Input
                      {...props}
                      fullWidth
                      type="number"
                      value={data.theta}
                      onChange={(e) => onChange({ theta: e.target.value })}
                      suffix={angleUnitSuffix}
                      {...bounds('theta')}
                    />
                  )}
                </Field>
              </div>
            )}
          </Stack>

          <div className={styles.groupDivider} />

          {/* Коэффициенты методики своего участка на чертеже не имеют —
              подсвечивать при наведении нечего, обёртки нет. Число зон
              дробления не спрашивается: его задаёт сам набор зон выше. */}
          <Stack gap="md" direction="column">
            <Text variant="headingSm">Коэффициенты профиля</Text>

            <div className={styles.pair}>
              <Field label="Коэффициент R" hint={hintWithDelta('R')} error={errors.R} labelHint={<FieldHint>{GEOM_GLOSSARY.R}</FieldHint>}>
                {(props) => (
                  <Input {...props} fullWidth type="number" value={data.R} onChange={(e) => onChange({ R: e.target.value })} {...bounds('R')} suffix="м" />
                )}
              </Field>

              <Field label="Коэффициент a" hint={hintWithDelta('a')} error={errors.a} labelHint={<FieldHint>{GEOM_GLOSSARY.a}</FieldHint>}>
                {(props) => (
                  <Input {...props} fullWidth type="number" value={data.a} onChange={(e) => onChange({ a: e.target.value })} {...bounds('a')} suffix="м" />
                )}
              </Field>
            </div>

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
                <Button variant="secondary" size="sm" iconEnd="chevronDown" onClick={() => setDiagramOpen((o) => !o)}>
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
                <Button variant="secondary" size="sm" iconEnd="chevronDown" onClick={() => setLayersOpen((o) => !o)}>
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
                input={schemeInput}
                layers={layers}
                /* Режим построения только прячет описательные выноски
                   и середины брони — поэтому вместе с «Обычным» он их
                   не отнимает: включены оба набора, значит нужен и тот,
                   что подписывает чертёж словами. */
                construction={buildOn && !normalOn}
                highlight={hoverZone}
                /* Наведение на чертёж называет поле всегда, без настроек.
                   Раньше оно включалось тем же переключателем, что и
                   подсветка участка от полей, — и чертёж по умолчанию
                   молчал: поводить по нему курсором ничего не давало,
                   хотя это первое, что с незнакомым чертежом делают.
                   Режимом остался только обратный ход: подсветка участка
                   при движении курсора по форме мешает, когда просто
                   заполняешь поля. */
                onZoneHover={(key) => setHover(key ? { key, from: 'scheme' } : null)}
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

      {/*
        Переименование машины — не правка поля, а развилка проекта.
        Камеру правят под конкретную машину, и если ей дали другое имя,
        то это уже другая разработка: писать новое имя поверх прежнего
        проекта значило бы задним числом объявить, что расчёт всегда был
        про неё. Поэтому «Сохранить» здесь заводит новый проект — и окно
        говорит об этом до нажатия, а не тостом после.
      */}
      <Modal
        open={renameDraft !== null}
        onClose={() => setRenameDraft(null)}
        title="Название дробилки"
        size="sm"
        footer={
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setRenameDraft(null)}>
              Отмена
            </Button>
            <Button
              variant="primary"
              disabled={!renameReady}
              onClick={() => {
                if (!renameReady || renameDraft === null) return;
                onRenameCrusher(renameDraft.trim());
                setRenameDraft(null);
              }}
            >
              Сохранить
            </Button>
          </Modal.Footer>
        }
      >
        <Stack gap="lg" direction="column">
          <Field label="Название дробилки">
            {(props) => (
              <Input
                {...props}
                fullWidth
                value={renameDraft ?? ''}
                onChange={(e) => setRenameDraft(e.target.value)}
              />
            )}
          </Field>

          <Text variant="bodySm" color="textMuted">
            «Сохранить» создаст новый проект с этой машиной и текущей геометрией камеры и откроет его на первом этапе.
            Исходный проект «{crusherName}» останется таким, какой он есть, вместе со своими расчётами.
          </Text>
        </Stack>
      </Modal>

      <Modal
        open={crusherPickerOpen}
        onClose={() => setCrusherPickerOpen(false)}
        title="Сменить дробилку"
        size="lg"
        footer={
          /* Футер появился ради «Новой» слева: заведение своей машины —
             второстепенное действие, и в полосе над таблицей оно отнимало
             ширину у поиска и условий отбора. Раз футер есть, у окна
             появляется и явное «Отмена» — как у окна выбора пробы. */
          <Modal.Footer
            aside={
              <CatalogCreateButton
                kind="crushers"
                nameLabel="Дробилка"
                onCreated={(name) => {
                  onChangeCrusher(name);
                  setCrusherPickerOpen(false);
                }}
              />
            }
          >
            <Button variant="secondary" onClick={() => setCrusherPickerOpen(false)}>
              Отмена
            </Button>
          </Modal.Footer>
        }
      >
        <CatalogPicker
          specs={CRUSHER_SPECS}
          items={crusherCatalog.items}
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

