import { useCallback, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Button, Checkbox, EmptyState, Input, Modal, RangeSelect, Stack, Table, Text } from '@uralmash/design-system';
import type { Range, TableColumn, TableSort } from '@uralmash/design-system';
import type { CatalogItem, SpecColumn } from '@/data/crushers';
import {
  EMPTY_RANGE,
  compareSpecValues,
  formatBound,
  matchesQuery,
  rangeSpecsOf,
  toBounds,
  withinBounds,
} from '@/domain/catalogFilter';
import type { RangeMap, RangeSpec } from '@/domain/catalogFilter';
import { useTopEscape } from '@/hooks/useTopEscape';
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

  /* Окно фильтров открывается поверх окна, в котором живёт сам каталог, —
     Esc обязан закрыть только его. Тот же путь, что у крестика и клика
     по фону: Esc — это отказ, и черновик он обязан отбросить. */
  const escapeFilters = useCallback(() => {
    onFiltersCancel?.();
    setFiltersOpen(false);
  }, [onFiltersCancel]);
  useTopEscape(filtersOpen, escapeFilters);

  /**
   * Сортировка по первой характеристике — у дробилок это диаметр конуса,
   * у проб руды плотность. Без неё справочник открывается в порядке файла,
   * то есть ни по чему: сравнивать 30 машин глазами проще, когда они уже
   * выстроены по определяющей величине.
   */
  const [sort, setSort] = useState<TableSort | null>(
    specs.length > 0 ? { key: specs[0].short, direction: 'asc' } : null
  );

  /** Колонки, пригодные для отбора диапазоном, — см. `rangeSpecsOf`. */
  const rangeSpecs = useMemo<RangeSpec[]>(() => rangeSpecsOf(specs, items), [specs, items]);

  /* Порядок — как в справочнике, а не как в списке вызывающего: строка
     фильтров обязана читаться в том же порядке, что и колонки таблицы. */
  const inlineRangeSpecs = useMemo(
    () => (inlineSpecs ? rangeSpecs.filter(({ spec }) => inlineSpecs.includes(spec.short)) : []),
    [rangeSpecs, inlineSpecs]
  );

  const activeBounds = useMemo(() => toBounds(rangeSpecs, ranges), [rangeSpecs, ranges]);
  const draftBounds = useMemo(() => toBounds(rangeSpecs, rangeDraft), [rangeSpecs, rangeDraft]);

  /**
   * Позиции, заведённые через «+ Новая»: их выбрали (`value`/`selected`),
   * но в `items` такого имени нет. Синтезируем для них строку без
   * характеристик — `values: {}` — чтобы своя дробилка вела себя в таблице
   * как любая каталожная: её видно отмеченной, её можно снять тем же
   * флажком, и `toggle()` для неё работает без отдельной ветки.
   */
  const virtualItems = useMemo<CatalogItem[]>(() => {
    const known = new Set(items.map((item) => item.name));
    const names = multiple ? (selected ?? []) : value ? [value] : [];
    return names.filter((name) => !known.has(name)).map((name) => ({ name, values: {} }));
  }, [items, multiple, selected, value]);

  const rows = useMemo(() => {
    const allowed = visibleNames ? new Set(visibleNames) : null;
    const query = search.trim().toLowerCase();

    const filtered = items.filter((item) => {
      if (allowed && !allowed.has(item.name)) return false;
      if (!withinBounds(item, activeBounds)) return false;
      return matchesQuery(item, query);
    });

    /* Свои позиции — вне поиска и фильтров по характеристикам: у них этих
       характеристик нет, и обычный числовой фильтр («от 900») спрятал бы
       собственный выбор пользователя так, что не понять, почему он исчез
       из уже применённого выбора. Они остаются на виду независимо от того,
       чем сейчас сужен справочник. */
    const combined = [...filtered, ...virtualItems];

    if (!sort) return combined;

    const sorted = [...combined].sort((a, b) => {
      const av = sort.key === 'name' ? a.name : (a.values[sort.key] ?? '');
      const bv = sort.key === 'name' ? b.name : (b.values[sort.key] ?? '');
      return compareSpecValues(av, bv);
    });

    return sort.direction === 'desc' ? sorted.reverse() : sorted;
  }, [items, virtualItems, visibleNames, search, sort, activeBounds]);

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
          /* Клик по флажку не должен доигрываться до строки: `onRowClick`
             в системе висит на самом `<tr>`, и всплывший клик переключал бы
             выбор второй раз — то есть возвращал бы его обратно. */
          onClick={(event) => event.stopPropagation()}
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
          {/* Плейсхолдер — «Поиск», а не примеры значений: примеры вида
              «КМД-2200, 2200, 500-655…» читались как уже введённый запрос
              и занимали место, ничего не объясняя. Что именно ищется,
              сказано в доступном имени поля. */}
          <Input
            fullWidth
            type="search"
            aria-label={`Поиск: ${nameLabel.toLowerCase()} или значение характеристики`}
            placeholder="Поиск"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        {inlineFilter ? <div className={styles.inlineFilter}>{inlineFilter}</div> : null}

        {/* Характеристика — одно поле, а не пара: диапазон это одно условие,
            и двумя контролами он занимал в полосе место двух. Границы
            вводятся в панели поля и применяются её собственным «Готово». */}
        {/* Размер не задан — тот же, что у поля поиска слева (`md` по умолчанию):
            в одной полосе поле и условия обязаны быть одной высоты, иначе
            строка читается как два разных ряда контролов, слепленных вместе. */}
        {inlineRangeSpecs.map(({ spec, min, max }) => (
          <div key={spec.short} className={styles.inlineControl}>
            <RangeSelect
              fullWidth
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

      {/* `.scroll` — фиксированная высота (52vh) и собственный `overflow-y`:
          ровно предок с ограниченной высотой, которого требует `stickyHeader`,
          так что шапка каталога остаётся на месте при прокрутке тридцати
          строк, а не уезжает вместе с ними. */}
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
          stickyHeader
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
