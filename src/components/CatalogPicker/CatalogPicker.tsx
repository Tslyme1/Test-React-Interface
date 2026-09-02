import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Checkbox, EmptyState, Input, Modal, RangeSelect, Stack, Table, Text } from '@uralmash/design-system';
import type { Range, TableColumn, TableSort } from '@uralmash/design-system';
import type { CatalogItem, SpecColumn } from '@/data/crushers';
import styles from './CatalogPicker.module.css';

export type CatalogPickerProps = {
  /** Колонки характеристик. Порядок сохраняется как в справочнике. */
  specs: SpecColumn[];
  items: CatalogItem[];
  /** Имя выбранной позиции, если она уже есть. Не используется при `multiple`. */
  value: string | null;
  /**
   * Выбор позиции. `null` — выбор снят: нажатие по уже выбранной строке
   * её отжимает, как и повторное нажатие по флажку. Не вызывается при
   * `multiple` — там набор меняет `onPickMultiple`.
   */
  onPick: (name: string | null) => void;
  /**
   * Множественный выбор — для упрощённого режима, где считают сразу
   * несколько дробилок или проб руды. Флажок строки копит набор вместо
   * одной выбранной строки; `value`/`onPick` в этом режиме не участвуют.
   */
  multiple?: boolean;
  /** Текущий набор при `multiple`. */
  selected?: string[];
  /** Смена набора при `multiple`. */
  onPickMultiple?: (names: string[]) => void;
  /** Подпись первой колонки: «Дробилка», «Проба руды». */
  nameLabel: string;
  searchPlaceholder: string;
  /**
   * Дополнительный фильтр над таблицей — например, семейство машины.
   * Контролы внутри должны быть привязаны к черновику: применяются они
   * не сразу, а по «Готово» (см. `onFiltersApply`).
   */
  filter?: ReactNode;
  /** «Готово» в окне фильтров: черновик пора применить. */
  onFiltersApply?: () => void;
  /** Окно фильтров закрыто мимо «Готово»: черновик пора вернуть к применённому. */
  onFiltersCancel?: () => void;
  /** «Сбросить» в окне фильтров: внешний черновик пора очистить. */
  onFiltersReset?: () => void;
  /**
   * Условие, вынесенное в строку над таблицей. Применяется сразу, поэтому
   * привязывать его надо к применённому значению, а не к черновику окна:
   * оно на виду, и результат виден в тот же момент.
   */
  inlineFilter?: ReactNode;
  /**
   * Какие характеристики вынести в ту же строку — по коротким подписям
   * колонок. Выбор за вызывающим: какая величина в справочнике главная,
   * знает он, а не каталог. Остальные остаются в окне фильтров.
   */
  inlineSpecs?: string[];
  /**
   * Сколько условий из `filter` применено сейчас. Нужен только для счётчика
   * на кнопке: свои условия — диапазоны характеристик — каталог считает сам,
   * а что означает содержимое чужого слота, знает лишь тот, кто его передал.
   */
  filterCount?: number;
  /** То же для черновика: по нему «Сбросить» понимает, есть ли что сбрасывать. */
  filterDraftCount?: number;
  /** Уже отфильтрованный снаружи набор имён. Пусто — показываются все. */
  visibleNames?: string[];
};

/**
 * Границы по короткой подписи колонки.
 *
 * Сам `Range` приходит из системы вместе с `RangeSelect`: поле и хранилище
 * его значения обязаны говорить об одном и том же одним типом.
 */
type RangeMap = Record<string, Range>;

/** Колонка, пригодная для отбора диапазоном, и шкала её значений в справочнике. */
type RangeSpec = { spec: SpecColumn; min: number; max: number };

/** Разобранное условие: `null` — граница не задана. */
type Bound = { key: string; from: number | null; to: number | null };

const EMPTY_RANGE: Range = { from: '', to: '' };

/** Прочерк в справочнике: величина не измерялась. */
const DASH = '—';

/**
 * Выбор позиции справочника таблицей характеристик.
 *
 * Именно таблицей, а не списком: смысл экрана — сравнить машины по столбцам,
 * а это ровно та роль, для которой в системе есть `Table`. Список прячет
 * характеристики, ради которых выбор и делается.
 *
 * Компонент намеренно не модальное окно: его вставляют внутрь уже открытого
 * окна. Модалка в модалке ломает удержание фокуса — у каждой оно своё.
 */
export function CatalogPicker({
  specs,
  items,
  value,
  onPick,
  multiple = false,
  selected,
  onPickMultiple,
  nameLabel,
  searchPlaceholder,
  filter,
  onFiltersApply,
  onFiltersCancel,
  onFiltersReset,
  filterCount = 0,
  filterDraftCount = 0,
  inlineFilter,
  inlineSpecs,
  visibleNames,
}: CatalogPickerProps) {
  const [search, setSearch] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  /**
   * Диапазоны характеристик: применённые и черновик окна фильтров.
   *
   * Ключ — короткая подпись колонки, значение — границы как их ввели,
   * строками: пустая строка означает «граница не задана», а не ноль.
   * Черновик заводится при открытии окна и применяется по «Готово» —
   * тем же правилом, что и условия снаружи.
   */
  const [ranges, setRanges] = useState<RangeMap>({});
  const [rangeDraft, setRangeDraft] = useState<RangeMap>({});

  /**
   * Esc закрывает только верхнее окно.
   *
   * Каталог живёт внутри окна нового проекта, а окно фильтров открывается
   * поверх него — два `Modal` разом. Каждый вешает свой обработчик Esc на
   * `document` в фазе всплытия, и порядок срабатывания у них — порядок
   * подписки: внешнее окно смонтировано раньше, поэтому первым закрывается
   * оно. Нажатие Esc в фильтрах уносило вместе с ними и весь выбор дробилки.
   *
   * Перехватываем на погружении: обработчик на `document` в фазе capture
   * идёт раньше любых всплывающих на том же узле, поэтому здесь событие
   * можно остановить и закрыть ровно то окно, которое сверху. Своё закрытие
   * приходится делать руками — остановленное событие не дойдёт и до
   * собственного обработчика окна фильтров.
   *
   * Это подпорка под дефект системы: `Modal` не проверяет, верхний ли он
   * слой. Заявка в дизайн-систему — отдельно; чинить там, а не здесь.
   */
  useEffect(() => {
    if (!filtersOpen) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      /* Тот же путь, что у крестика и клика по фону: Esc — это отказ,
         и черновик он обязан отбросить. Раньше здесь стояло голое
         закрытие, и невзятое условие доживало до следующего открытия. */
      onFiltersCancel?.();
      setFiltersOpen(false);
    };

    document.addEventListener('keydown', onKeyDown, true);
    return () => document.removeEventListener('keydown', onKeyDown, true);
  }, [filtersOpen, onFiltersCancel]);

  /**
   * Сортировка по первой характеристике — у дробилок это диаметр конуса,
   * у проб руды плотность. Без неё справочник открывается в порядке файла,
   * то есть ни по чему: сравнивать 30 машин глазами проще, когда они уже
   * выстроены по определяющей величине.
   */
  const [sort, setSort] = useState<TableSort | null>(
    specs.length > 0 ? { key: specs[0].short, direction: 'asc' } : null
  );

  /**
   * Колонки, по которым можно отбирать диапазоном.
   *
   * Не все: у дробилок значения числовые целиком («2200», «5-15», «160/250»),
   * а у проб руды половина колонок — словесные («до 170», «X (очень крепкие)»,
   * «высокоабраз. Ка=3.16»). Поле «от — до» над такой колонкой обещало бы
   * отбор, которого не выйдет: сравнивать там нечего. Поэтому набор фильтров
   * выводится из самих значений, а не из списка колонок.
   *
   * Границы шкалы берутся по всему справочнику, а не по текущей выборке:
   * подсказка «от 900» не должна ездить вслед за уже применённым фильтром.
   */
  const rangeSpecs = useMemo<RangeSpec[]>(() => {
    const out: RangeSpec[] = [];

    for (const spec of specs) {
      const values = items.map((item) => item.values[spec.short] ?? '').filter((v) => v && v !== DASH);
      if (values.length === 0 || !values.every(isNumericValue)) continue;

      const numbers = values.flatMap(numbersIn);
      if (numbers.length === 0) continue;

      out.push({ spec, min: Math.min(...numbers), max: Math.max(...numbers) });
    }

    return out;
  }, [specs, items]);

  /* Порядок — как в справочнике, а не как в списке вызывающего: строка
     фильтров обязана читаться в том же порядке, что и колонки таблицы. */
  const inlineRangeSpecs = useMemo(
    () => (inlineSpecs ? rangeSpecs.filter(({ spec }) => inlineSpecs.includes(spec.short)) : []),
    [rangeSpecs, inlineSpecs]
  );

  const activeBounds = useMemo(() => toBounds(rangeSpecs, ranges), [rangeSpecs, ranges]);
  const draftBounds = useMemo(() => toBounds(rangeSpecs, rangeDraft), [rangeSpecs, rangeDraft]);

  const rows = useMemo(() => {
    const allowed = visibleNames ? new Set(visibleNames) : null;
    const query = search.trim().toLowerCase();

    const filtered = items.filter((item) => {
      if (allowed && !allowed.has(item.name)) return false;
      if (!withinBounds(item, activeBounds)) return false;
      if (!query) return true;
      // Ищем и по названию, и по значениям: инженер помнит «2200», а не имя целиком.
      return (
        item.name.toLowerCase().includes(query) ||
        Object.values(item.values).some((v) => v.toLowerCase().includes(query))
      );
    });

    if (!sort) return filtered;

    const sorted = [...filtered].sort((a, b) => {
      const av = sort.key === 'name' ? a.name : (a.values[sort.key] ?? '');
      const bv = sort.key === 'name' ? b.name : (b.values[sort.key] ?? '');
      return compareSpecValues(av, bv);
    });

    return sort.direction === 'desc' ? sorted.reverse() : sorted;
  }, [items, visibleNames, search, sort, activeBounds]);

  /*
   * Одиночный выбор: нажатие по выбранной строке снимает выбор — иначе
   * передумать нельзя, раз отметив машину, снять отметку было нечем.
   * Множественный: строка добавляется в набор или убирается из него.
   */
  const toggle = (name: string) => {
    if (multiple) {
      const current = selected ?? [];
      const next = current.includes(name) ? current.filter((n) => n !== name) : [...current, name];
      onPickMultiple?.(next);
      return;
    }
    onPick(name === value ? null : name);
  };

  const hasFilters = Boolean(filter) || rangeSpecs.length > 0;

  /* Счёт, а не «да/нет»: кнопка прячет условия под собой, и сколько их
     применено, из панели над таблицей не видно. */
  const activeCount = activeBounds.length + filterCount;
  const draftCount = draftBounds.length + filterDraftCount;

  const openFilters = () => {
    /* Черновик заводится от применённого при каждом открытии — поэтому
       отброшенный прошлый раз не всплывает в следующий. */
    setRangeDraft(ranges);
    setFiltersOpen(true);
  };

  const closeFilters = () => {
    onFiltersCancel?.();
    setFiltersOpen(false);
  };

  const applyFilters = () => {
    setRanges(rangeDraft);
    onFiltersApply?.();
    setFiltersOpen(false);
  };

  const resetFilters = () => {
    setRangeDraft({});
    onFiltersReset?.();
  };

  const setDraftRange = (key: string, next: Range) => setRangeDraft((current) => ({ ...current, [key]: next }));

  /* Условие из полосы применяется сразу: своё «Готово» у поля уже нажали,
     и ждать второго — от окна, которое даже не открыто, — нечего. */
  const setAppliedRange = (key: string, next: Range) => setRanges((current) => ({ ...current, [key]: next }));

  const columns: TableColumn<CatalogItem>[] = [
    {
      /* Флажок стоит первым — там, где его ищут глазами. Кнопку строки
         таблица уносит на колонку с названием (`rowActionKey`), поэтому
         флажок не оказывается внутри кнопки и работает сам по себе. */
      key: 'picked',
      title: '',
      render: (item) => (
        <Checkbox
          checked={multiple ? (selected ?? []).includes(item.name) : item.name === value}
          onChange={() => toggle(item.name)}
          aria-label={`Выбрать ${item.name}`}
        />
      ),
    },
    {
      key: 'name',
      title: nameLabel,
      sortable: true,
      /* Кнопка строки живёт здесь, а не на флажке слева: доступным именем
         строки должно быть имя машины, а не подпись «Выбрать КМД-2200Т».

         Ширина колонки задана минимумом у содержимого. Без него таблица
         считает её по самому длинному имени в текущей выборке: «КМД-2200Т6-Д»
         даёт 156px, «КСД-1750Гр» — 141, и при каждой смене фильтра вся
         таблица съезжала вбок. Минимум взят с запасом к самому длинному
         имени справочника.

         `label`, а не `bodySm`: имя машины выделено весом, как в прототипе.
         Веса отдельным пропом в системе нет — его задаёт роль целиком,
         поэтому выделение приходит вместе с размером роли. */
      render: (item) => (
        <Text variant="label">
          <span className={styles.name}>{item.name}</span>
        </Text>
      ),
    },
    ...specs.map<TableColumn<CatalogItem>>((spec) => ({
      key: spec.short,
      title: spec.short,
      align: 'end',
      sortable: true,
      render: (item) => item.values[spec.short] || null,
    })),
  ];

  return (
    <Stack gap="lg" direction="column">
      {/* Поиск занимает левый край и забирает всю свободную ширину: это
          основной способ найти машину в каталоге из тридцати позиций, и
          прятать его за кнопку значило бы прятать главное действие панели.
          Остальные условия отбора уехали под кнопку справа — их немного,
          но каждое, вынесенное в строку, отнимает ширину у поиска. */}
      <div className={styles.toolbar}>
        <div className={styles.search}>
          <Input
            fullWidth
            type="search"
            aria-label={`Поиск: ${nameLabel.toLowerCase()} или значение характеристики`}
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {inlineFilter ? <div className={styles.inlineFilter}>{inlineFilter}</div> : null}

        {/* Характеристика — одно поле, а не пара: диапазон это одно условие,
            и двумя контролами он занимал в полосе место двух. Границы
            вводятся в панели поля и применяются её собственным «Готово». */}
        {inlineRangeSpecs.map(({ spec, min, max }) => (
          <div key={spec.short} className={styles.inlineControl}>
            <RangeSelect
              fullWidth
              size="sm"
              placeholder={spec.short}
              fromHint={formatBound(min)}
              toHint={formatBound(max)}
              value={ranges[spec.short] ?? EMPTY_RANGE}
              onChange={(next) => setAppliedRange(spec.short, next)}
            />
          </div>
        ))}

        {hasFilters ? (
          <Button variant="secondary" iconStart="filter" onClick={openFilters}>
            {activeCount > 0 ? `Фильтры: ${activeCount}` : 'Фильтры'}
          </Button>
        ) : null}
      </div>

      {/* Прокрутка каталога — снаружи таблицы: липкой шапки в системе нет
          намеренно (sticky требует предка с ограниченной высотой, а шкалы
          высот в системе не существует), поэтому шапка уезжает вместе
          со строками. Заявка на «область с ограниченной высотой» — в систему. */}
      <div className={styles.scroll}>
        <Table
          columns={columns}
          rows={rows}
          rowKey={(item) => item.name}
          caption={nameLabel}
          captionHidden
          sort={sort}
          onSortChange={setSort}
          rowActionKey="name"
          onRowClick={(item) => toggle(item.name)}
          empty={
            <EmptyState
              icon="search"
              title="Ничего не найдено"
              description="Измените запрос или снимите фильтр."
            />
          }
        />
      </div>

      {/* Окно общих фильтров. Каталог сам живёт внутри окна, поэтому это
          окно во окне — раскладка та же, что на списке проектов, и разводить
          два разных способа добраться до одних и тех же условий отбора
          не стоит: пользователь запоминает место кнопки, а не её контекст. */}
      {/* Условия применяются по «Готово», а не по каждому нажатию внутри.
          Иначе выборка под окном пересобирается на каждый чих: пользователь
          щёлкает второе условие, а список за окном уже уехал под первым —
          и понять, что именно он отбирает, можно только закрыв окно.
          Закрытие мимо «Готово» — крестиком, по фону, по Esc — черновик
          отбрасывает: закрыть окно и получить применённое молча хуже, чем
          не применить. */}
      <Modal
        open={filtersOpen}
        onClose={closeFilters}
        title="Фильтры"
        size="sm"
        footer={
          <Modal.Footer>
            {/* Сброс правит черновик, а не применённое: иначе одна кнопка
                окна действовала бы сразу, а остальные — по «Готово». */}
            <Button variant="secondary" disabled={draftCount === 0} onClick={resetFilters}>
              Сбросить
            </Button>
            <Button variant="primary" onClick={applyFilters}>
              Готово
            </Button>
          </Modal.Footer>
        }
      >
        <Stack gap="lg" direction="column">
          {filter}

          {/* Отбор по характеристикам — теми же колонками, что стоят в таблице.
              Иначе сравнение упирается в глаза: тридцать машин по девяти
              величинам сужаются только прокруткой, а вопрос у инженера
              обычно поставлен диапазоном — «от 200 кВт», «до 60 т».

              Условие — пересечение, а не попадание целиком: значение в ячейке
              само бывает диапазоном («5-15», «160/250»), и машина с щелью
              5-15 обязана найтись по запросу «от 10». Требовать, чтобы весь
              её диапазон уложился в запрошенный, значило бы прятать ровно
              те машины, которые подходят. */}
          {rangeSpecs.length > 0 ? (
            <Stack gap="sm" direction="column">
              <Text variant="label">Характеристики</Text>

              {/* Все девять — такими же полями, что и в полосе над таблицей:
                  одно поле на характеристику, границы вводятся в его панели.
                  Двумя контролами на условие окно превращалось в сетку из
                  восемнадцати полей, где ни одна пара не читалась как целое. */}
              <Stack gap="xs" direction="column">
                {rangeSpecs.map(({ spec, min, max }) => (
                  <RangeSelect
                    key={spec.short}
                    fullWidth
                    size="sm"
                    placeholder={spec.short}
                    fromHint={formatBound(min)}
                    toHint={formatBound(max)}
                    value={rangeDraft[spec.short] ?? EMPTY_RANGE}
                    onChange={(next) => setDraftRange(spec.short, next)}
                  />
                ))}
              </Stack>
            </Stack>
          ) : null}
        </Stack>
      </Modal>
    </Stack>
  );
}

/**
 * Сравнение значений характеристик.
 *
 * Значения инженерные и неоднородные: «2200», «5-15», «160/250», «—».
 * Сортировка по строке поставила бы «1200» выше «900», поэтому сравниваем
 * по первому числу, а к строковому сравнению падаем только когда числа нет.
 * Прочерк всегда уходит вниз: отсутствие величины — не наименьшее значение.
 */
function compareSpecValues(a: string, b: string): number {
  const DASH = '—';
  if (a === DASH && b === DASH) return 0;
  if (a === DASH) return 1;
  if (b === DASH) return -1;

  const na = leadingNumber(a);
  const nb = leadingNumber(b);
  if (na !== null && nb !== null && na !== nb) return na - nb;

  return a.localeCompare(b, 'ru', { numeric: true });
}

function leadingNumber(value: string): number | null {
  const match = value.replace(',', '.').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

/**
 * Годится ли колонка для отбора диапазоном.
 *
 * Годится, когда каждое её значение состоит из чисел и разделителей —
 * «2200», «5-15», «160/250», «16.8 (15-18)». Любая буква означает словесную
 * величину («до 170», «высокоабраз. Ка=3.16»), а её нельзя ни сравнить,
 * ни отобрать по границам; предложить над такой колонкой поле «от — до»
 * значило бы пообещать отбор, которого не выйдет.
 *
 * Классы записаны через 0-9, а не через сокращения: в них не должно
 * оказаться ни букв, ни знаков, которых мы не разбираем.
 */
function isNumericValue(value: string): boolean {
  return /[0-9]/.test(value) && /^[0-9 .,()/–—-]+$/.test(value);
}

/** Все числа значения по порядку. Знак не разбирается: отрицательных величин в справочниках нет. */
function numbersIn(value: string): number[] {
  return [...value.matchAll(/[0-9]+(?:[.,][0-9]+)?/g)].map((m) => Number(m[0].replace(',', '.')));
}

/**
 * Отрезок, который занимает значение ячейки: «5-15» — это [5, 15], «2200» —
 * точка [2200, 2200]. Прочерк отрезка не даёт: неизмеренная величина
 * ни в какие границы не попадает.
 */
function spanOf(value: string | undefined): { lo: number; hi: number } | null {
  if (!value || value === DASH) return null;
  const numbers = numbersIn(value);
  if (numbers.length === 0) return null;
  return { lo: Math.min(...numbers), hi: Math.max(...numbers) };
}

/** Введённая граница. Пустая строка и нечисло — «не задано», а не ноль. */
function parseBound(input: string): number | null {
  const raw = input.trim().replace(',', '.');
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Условия, которые действительно что-то ограничивают: пустая пара полей условием не является. */
function toBounds(rangeSpecs: RangeSpec[], map: RangeMap): Bound[] {
  return rangeSpecs
    .map(({ spec }) => {
      const range = map[spec.short] ?? EMPTY_RANGE;
      return { key: spec.short, from: parseBound(range.from), to: parseBound(range.to) };
    })
    .filter((bound) => bound.from !== null || bound.to !== null);
}

/** Пересекается ли значение строки с запрошенными границами — по каждому условию. */
function withinBounds(item: CatalogItem, bounds: Bound[]): boolean {
  return bounds.every((bound) => {
    const span = spanOf(item.values[bound.key]);
    if (!span) return false;
    if (bound.from !== null && span.hi < bound.from) return false;
    if (bound.to !== null && span.lo > bound.to) return false;
    return true;
  });
}

/** Подсказка в поле: целое — без хвоста, дробное — с запятой, как в справочнике. */
function formatBound(value: number): string {
  return Number.isInteger(value) ? String(value) : String(value).replace('.', ',');
}
