import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Button,
  Cell,
  DatePicker,
  EmptyState,
  Field,
  Icon,
  Input,
  Modal,
  Popover,
  Select,
  Stack,
  Table,
  Tag,
  Text,
} from '@uralmash/design-system';
import type { SelectOption, TableColumn, TableSort } from '@uralmash/design-system';
import type { Project } from '@/types';
import { oreTypeOf } from '@/data/oreSamples';
import { crusherLabel, oreLabel } from '@/domain/projectLabels';
import { printStepReport } from '@/domain/printReport';
import { STEP_KEYS, STEP_LABELS } from '@/domain/steps';
import { useTags } from '@/state/useTags';
import { NewTagButton } from '@/components/NewTagButton/NewTagButton';
import styles from './ProjectsPage.module.css';

/**
 * Описание одного фильтра. Нужен именно список, а не шесть отдельных кусков
 * разметки: фильтры выводятся в двух местах — строкой под заголовком и
 * списком в панели «Фильтры», — и разойдясь, два набора начнут фильтровать
 * по-разному. Заметить такое можно только сравнив выдачу.
 *
 * `priority` — очередь исчезновения из строки при сужении окна: чем больше
 * число, тем раньше фильтр уходит. Уходит только с экрана; в панели доступны
 * все, поэтому терять доступ к фильтру пользователь не может.
 */
type FilterKey = 'crusher' | 'customer' | 'tag' | 'executor' | 'date';

type FilterValues = Record<FilterKey, string> & { search: string };

type FilterField = {
  key: FilterKey;
  label: string;
  priority: number;
  render: (props: { id?: string }) => ReactNode;
};

export type ProjectsPageProps = {
  projects: Project[];
  onOpenProject: (project: Project) => void;
  onRemoveProject: (id: string) => void;
  onNewProject: () => void;
  /** Заказчик, с которого перешли со страницы «Заказчики» — сеет фильтр один раз при появлении экрана. */
  initialCustomerFilter?: string | null;
  /**
   * Живое значение применённого фильтра «Заказчик» — наружу, а не только
   * внутрь: сайдбар подсвечивает «Заказчики», пока этот фильтр применён
   * (см. `App.tsx`), и обязан узнавать о его смене что при заходе со
   * страницы заказчиков, что при ручном выборе или сбросе прямо здесь.
   */
  onCustomerFilterChange?: (customer: string | null) => void;
  /** Клик по «Заказчики» в хлебной крошке — уход на страницу заказчиков. */
  onGoCustomers?: () => void;
};

/**
 * Пустое значение фильтра.
 *
 * Пустая строка, а не подставной вариант «Дробилка» первой строкой списка.
 * Такой вариант выглядел выбранным с самого начала — галочка стояла против
 * него, и «не отобрано» читалось как «отобрано вот это». Пустое состояние
 * поля система выражает плейсхолдером, а снять выбор умеет повторным
 * нажатием по варианту.
 */
const NONE = '';

function uniqueSorted(values: (string | null)[]): string[] {
  return [...new Set(values.filter((v): v is string => Boolean(v) && v !== '—'))].sort((a, b) =>
    a.localeCompare(b, 'ru')
  );
}

function toOptions(values: string[]): SelectOption[] {
  return values.map((v) => ({ value: v, label: v }));
}

export function ProjectsPage({
  projects,
  onOpenProject,
  onRemoveProject,
  onNewProject,
  initialCustomerFilter,
  onCustomerFilterChange,
  onGoCustomers,
}: ProjectsPageProps) {
  /* Теги и их цвета живут отдельно от проектов: цвет заводят один раз,
     и он не должен пропадать вместе с последним проектом, где тег стоял. */
  const { tags, colorOf, addTag } = useTags();

  const [search, setSearch] = useState('');
  const [crusher, setCrusher] = useState<string>(NONE);
  const [customer, setCustomer] = useState<string>(NONE);
  const [tag, setTag] = useState<string>(NONE);
  const [executor, setExecutor] = useState<string>(NONE);
  const [date, setDate] = useState('');
  const [sort, setSort] = useState<TableSort | null>({ key: 'date', direction: 'desc' });

  // Заказчик из «Заказчики» — снаружи управляет тем же полем, что и строка
  // фильтров над таблицей, но только в одну сторону: приход сюда с именем
  // заказчика выставляет фильтр, а сброс снаружи (уход на «Проекты» по
  // сайдбару — см. `goView` в App.tsx) снимает его. Обратное направление —
  // не эффект, а прямой вызов в точке изменения (`setCustomerAndNotify`
  // ниже): эффект, реагирующий на `customer` и одновременно им же
  // управляемый эффектом выше, был бы взаимным контуром без устойчивой
  // точки — оба меняют одно и то же значение туда-сюда до бесконечности,
  // потому что в один и тот же коммит второй эффект видит ещё не
  // обновлённое состояние первого.
  useEffect(() => {
    setCustomer(initialCustomerFilter || NONE);
  }, [initialCustomerFilter]);

  /**
   * Наружу — только когда заказчика меняют здесь, а не эхом на приход
   * извне: сайдбар подсвечивает «Заказчики», пока этот фильтр применён,
   * и должен узнавать о ручном выборе в строке фильтров или о сбросе
   * через панель. Используется вместо `setCustomer` в `setters.customer`
   * ниже — то есть ровно в тех местах, где заказчика меняет сам человек.
   */
  const setCustomerAndNotify = (value: string) => {
    setCustomer(value);
    onCustomerFilterChange?.(value || null);
  };

  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  /**
   * Черновик панели «Фильтры». Не `null` ровно пока панель открыта.
   *
   * Условия из панели применяются по «Готово», а не по каждому нажатию:
   * иначе таблица слева пересобирается на каждый щелчок, и понять, что
   * именно отбираешь, можно только закрыв панель. Закрытие мимо «Готово»
   * черновик отбрасывает.
   *
   * Фильтры, оставшиеся в строке, применяются сразу — они и так на виду,
   * и результат виден в тот же момент.
   */
  const [draft, setDraft] = useState<FilterValues | null>(null);

  // Варианты фильтров выводятся из самих проектов: показывать в списке то,
  // чего в таблице нет, — обещать результат, которого не будет.
  const crusherOptions = useMemo(() => toOptions(uniqueSorted(projects.map((p) => p.crusherName))), [projects]);
  const customerOptions = useMemo(() => toOptions(uniqueSorted(projects.map((p) => p.customer))), [projects]);
  /**
   * Теги показываются тегами — теми же, что стоят в таблице. Список слов
   * заставлял держать в голове, какой из них какого цвета: цвет тега виден
   * в строке, а выбирают тег в списке, где цвета не было.
   *
   * В списке и те теги, которых пока нет ни у одного проекта: заведённый
   * тег обязан быть виден там, где теги выбирают, иначе непонятно, завёлся
   * ли он вообще.
   */
  const tagOptions = useMemo<SelectOption[]>(() => {
    const names = uniqueSorted([...projects.flatMap((p) => p.tags), ...tags.map((t) => t.name)]);
    return names.map((name) => ({
      value: name,
      label: name,
      content: <Tag color={colorOf(name)}>{name}</Tag>,
    }));
  }, [projects, tags, colorOf]);
  const executorOptions = useMemo(() => toOptions(uniqueSorted(projects.map((p) => p.executor))), [projects]);

  /** Применённые условия одним объектом — их же вид принимает черновик панели. */
  const applied: FilterValues = { crusher, customer, tag, executor, date, search };

  const EMPTY: FilterValues = { crusher: NONE, customer: NONE, tag: NONE, executor: NONE, date: '', search: '' };

  const setters: Record<keyof FilterValues, (value: string) => void> = {
    crusher: setCrusher,
    customer: setCustomerAndNotify,
    tag: setTag,
    executor: setExecutor,
    date: setDate,
    search: setSearch,
  };

  const applyAll = (values: FilterValues) => {
    (Object.keys(setters) as (keyof FilterValues)[]).forEach((key) => setters[key](values[key]));
  };

  // «Заказчик», зафиксированный названием страницы, не в счёт: это не
  // условие, наложенное через панель, а контекст самого экрана — тот же
  // повод, по которому его поле убрано из обеих панелей выше.
  const countActive = (values: FilterValues) =>
    [values.crusher, customer === NONE ? values.customer : NONE, values.tag, values.executor].filter(
      (v) => v !== NONE
    ).length +
    (values.date ? 1 : 0) +
    (values.search.trim() ? 1 : 0);

  /* Счёт, а не «да/нет»: кнопка «Фильтры» прячет часть условий под собой,
     и сколько именно их применено, из строки уже не видно. */
  const activeCount = countActive(applied);

  const openFilters = () => {
    setDraft(applied);
    setFiltersOpen(true);
  };

  const closeFilters = () => {
    setDraft(null);
    setFiltersOpen(false);
  };

  const commitFilters = () => {
    if (draft) applyAll(draft);
    closeFilters();
  };

  /**
   * Один набор описаний на два места: строку под заголовком и панель
   * «Фильтры». Значения и способ их менять приходят снаружи — строка правит
   * применённое сразу, панель правит черновик до «Готово».
   */
  const buildFilterFields = (
    values: FilterValues,
    set: (key: keyof FilterValues, value: string) => void
  ): FilterField[] => [
    {
      key: 'crusher',
      label: 'Дробилка',
      priority: 1,
      render: (props) => (
        <Select
          {...props}
          fullWidth
          options={crusherOptions}
          placeholder="Дробилка"
          value={values.crusher || null}
          onChange={(v) => set('crusher', (v as string | null) ?? NONE)}
          searchable
        />
      ),
    },
    {
      key: 'customer',
      label: 'Заказчик',
      priority: 2,
      render: (props) => (
        <Select
          {...props}
          fullWidth
          options={customerOptions}
          placeholder="Заказчик"
          value={values.customer || null}
          onChange={(v) => set('customer', (v as string | null) ?? NONE)}
        />
      ),
    },
    {
      key: 'tag',
      label: 'Тег',
      priority: 3,
      render: (props) => (
        <Select
          {...props}
          fullWidth
          options={tagOptions}
          placeholder="Тег"
          value={values.tag || null}
          onChange={(v) => set('tag', (v as string | null) ?? NONE)}
          /* Закреплённая строка внизу списка — место для «добавить»,
             оговорённое системой. Новый тег заводят там же, где теги
             выбирают: отдельный экран управления тегами ради одного
             поля и шести цветов был бы дороже самой задачи. */
          footer={<NewTagButton onCreate={addTag} />}
        />
      ),
    },
    {
      key: 'date',
      label: 'Дата проекта',
      priority: 4,
      render: (props) => (
        <DatePicker
          {...props}
          fullWidth
          aria-label="Дата проекта"
          value={values.date || null}
          onChange={(next) => set('date', next ?? '')}
        />
      ),
    },
    {
      key: 'executor',
      label: 'Исполнитель',
      priority: 5,
      render: (props) => (
        <Select
          {...props}
          fullWidth
          options={executorOptions}
          placeholder="Исполнитель"
          value={values.executor || null}
          onChange={(v) => set('executor', (v as string | null) ?? NONE)}
          searchable
        />
      ),
    },
  ];

  /**
   * Фильтр «Заказчик» скрыт, пока экран и так показывает ровно одного —
   * хлебная крошка в заголовке уже называет его, а рядом висящий селект
   * с тем же самым значением читался как два разных места правки одного
   * условия и путал: непонятно, что случится, если тронуть выпадающий
   * список, если заказчик и так «зафиксирован» названием страницы.
   */
  const withoutCustomerFilter = (fields: FilterField[]) =>
    customer !== NONE ? fields.filter((f) => f.key !== 'customer') : fields;

  /** Строка под заголовком: правки применяются сразу — результат тут же виден. */
  const rowFields = withoutCustomerFilter(buildFilterFields(applied, (key, value) => setters[key](value)));

  /** Панель: правки копятся в черновике до «Готово». */
  const draftValues = draft ?? applied;
  const draftFields = withoutCustomerFilter(
    buildFilterFields(draftValues, (key, value) => setDraft((current) => ({ ...(current ?? applied), [key]: value })))
  );

  /**
   * Сброс не трогает заказчика: пока его поле скрыто (зафиксировано
   * названием страницы), «Сбросить» относится к тому, что всё ещё видно
   * и доступно для правки, а не к уходу со страницы этого заказчика.
   */
  const resetFilters = () => {
    setSearch('');
    setCrusher(NONE);
    setTag(NONE);
    setExecutor(NONE);
    setDate('');
  };

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = projects.filter((p) => {
      if (crusher !== NONE && p.crusherName !== crusher) return false;
      if (customer !== NONE && p.customer !== customer) return false;
      if (tag !== NONE && !p.tags.includes(tag)) return false;
      if (executor !== NONE && p.executor !== executor) return false;
      // `p.date` несёт минуты («24.07.2026 14:32»), фильтр — только календарный день.
      if (date && p.date.split(' ')[0] !== new Date(date).toLocaleDateString('ru-RU')) return false;
      if (!query) return true;
      return [p.name, p.crusherName, p.customer, p.ore, p.executor, p.code, oreTypeOf(p.ore)].some((v) =>
        v.toLowerCase().includes(query)
      );
    });

    if (!sort) return filtered;
    const sorted = [...filtered].sort((a, b) => {
      const av = String(a[sort.key as keyof Project] ?? '');
      const bv = String(b[sort.key as keyof Project] ?? '');
      return av.localeCompare(bv, 'ru', { numeric: true });
    });
    return sort.direction === 'desc' ? sorted.reverse() : sorted;
  }, [projects, search, crusher, customer, tag, executor, date, sort]);

  const columns: TableColumn<Project>[] = [
    // `render` — не сама строка `crusherName`/`ore`: в упрощённом режиме
    // их может быть несколько, и первая молча вместо всех была бы неправдой
    // о содержимом проекта. Сортировка при этом остаётся по `crusherName`/
    // `ore` — по первой выбранной, как и до `render`.
    { key: 'crusherName', title: 'Дробилка', sortable: true, render: (row) => crusherLabel(row) },
    { key: 'customer', title: 'Заказчик', sortable: true },
    { key: 'code', title: 'Код проекта' },
    {
      key: 'tags',
      title: 'Теги',
      render: (row) =>
        row.tags.length > 0 ? (
          <Stack direction="row" gap="2xs" wrap>
            {row.tags.map((name) => (
              <Tag key={name} color={colorOf(name)}>
                {name}
              </Tag>
            ))}
          </Stack>
        ) : null,
    },
    { key: 'oreType', title: 'Руда', render: (row) => oreTypeOf(row.ore) },
    { key: 'ore', title: 'Месторождение', sortable: true, render: (row) => oreLabel(row) },
    { key: 'oreIn', title: 'Руда, вход' },
    { key: 'oreOut', title: 'Руда, выход' },
    { key: 'throughput', title: 'Произв., т/ч', align: 'end' },
    { key: 'date', title: 'Дата', sortable: true },
    { key: 'executor', title: 'Исполнитель', sortable: true },
    {
      key: 'actions',
      title: '',
      align: 'end',
      width: '56px',
      /* Обёртка нужна ради высоты строки: поповер строчный, и под ним
         оставалось место под выносные элементы — строка с меню стояла
         на два пикселя выше соседних таблиц системы. */
      render: (row) => (
        <div className={styles.rowMenu}>
        <Popover
          open={menuFor === row.id}
          onClose={() => setMenuFor(null)}
          placement="bottom-end"
          width="sm"
          trigger={
            /* Набор иконок системы закрыт, вертикального многоточия в нём нет —
               берём горизонтальное. Роль та же: меню действий над строкой. */
            <Button
              variant="ghost"
              size="sm"
              icon="moreHorizontal"
              aria-label={`Действия: ${crusherLabel(row)}`}
              onClick={(e) => {
                e.stopPropagation();
                setMenuFor(menuFor === row.id ? null : row.id);
              }}
            />
          }
        >
          {/* Всплытие гасится на каждом пункте. Панель поповера живёт внутри
              ячейки, а на строке висит переход в проект — без этого «Удалить
              в корзину» заодно открывало бы удаляемый проект. */}
          {/* Пункты — `Cell`, а не кнопки. У кнопки содержимое стоит по центру,
              и в столбце подписи разной длины не выстраиваются в колонку:
              перечень читался как набор обрывков. `Cell` задаёт эту строку
              один раз на всю систему — слот под иконку фиксирован по ширине.

              Без `role`: `Cell` тогда рисуется кнопкой — тем, чем пункт и
              является. `menuitem` здесь был бы неправдой, роль требует
              родителя с `role="menu"`, а панель поповера объявлена диалогом.

              Всплытие гасится один раз на обёртке, а не в каждом пункте:
              `Cell` отдаёт `onClick` без события, гасить внутри нечем.
              Без этого нажатие на «Удалить в корзину» заодно открывало бы
              удаляемый проект — панель поповера лежит в React-дереве ячейки,
              а на строке таблицы висит переход в проект, и портал событию
              не помеха. */}
          <div onClick={(e) => e.stopPropagation()}>
            <Stack gap="none" direction="column">
              <Cell
                size="sm"
                leading={<Icon name="fileText" size="sm" />}
                onClick={() => {
                  setMenuFor(null);
                  onOpenProject(row);
                }}
              >
                Открыть проект
              </Cell>

              {/* Печать — по одному пункту на посчитанный шаг. Непосчитанный
                  шаг печатать нечего: показывать пункт, который ничего
                  не даст, хуже, чем не показывать его вовсе. */}
              {STEP_KEYS.map((key, i) =>
                row.calc[i] ? (
                  <Cell
                    key={key}
                    size="sm"
                    leading={<Icon name="print" size="sm" />}
                    onClick={() => {
                      setMenuFor(null);
                      printStepReport(row, key);
                    }}
                  >
                    Печать: {STEP_LABELS[key]}
                  </Cell>
                ) : null
              )}

              {/* `danger` — строка, разрушающая данные. Удаление мягкое, но
                  красный здесь про направление действия, а не про необратимость. */}
              <Cell
                size="sm"
                tone="danger"
                leading={<Icon name="trash" size="sm" />}
                onClick={() => {
                  setMenuFor(null);
                  onRemoveProject(row.id);
                }}
              >
                Удалить в корзину
              </Cell>
            </Stack>
          </div>
        </Popover>
        </div>
      ),
    },
  ];

  return (
    <>
      <div className={styles.root}>
        <div className={styles.page}>
          {/* Заголовок и панель фильтров стоят вне скролл-зоны — прокручивается
              только таблица ниже (`.scroll`), как и на шагах визарда. */}
          <div className={styles.header}>
            <Stack gap="xl" direction="column">
              {/* Заказчик из фильтра — хлебной крошкой в заголовке, а не
                  заменой ему: пришли ли сюда со страницы «Заказчики» или
                  выбрали его прямо в строке фильтров, экран в обоих случаях
                  показывает проекты именно этого заказчика, и крошка это
                  называет. Один `<h1>`, а не два соседних текста — иначе
                  скринридер объявит два безымянных заголовка вместо одного. */}
              <Text variant="headingMd" as="h1">
                {customer !== NONE ? (
                  <>
                    <button type="button" className={styles.breadcrumbLink} onClick={onGoCustomers}>
                      Заказчики
                    </button>
                    <span className={styles.breadcrumbMuted}> / </span>
                    {customer}
                  </>
                ) : (
                  'Проекты'
                )}
              </Text>

              {projects.length > 0 ? (
                /* В строке фильтры идут без `Field`. Назначение написано внутри
                    самого поля, и оно же служит доступным именем контрола: у `Select`
                    это текст триггера, у поиска — плейсхолдер. Подпись над каждым из
                    шести соседних фильтров дублировала бы то же слово и делала панель
                    вдвое выше — то же исключение, что для строк таблицы.

                    В панели «Фильтры» — наоборот, через `Field`: там фильтры идут
                    столбцом, места по вертикали хватает, и исключение теряет
                    основание. Правило системы — подпись через `Field`; в строке
                    от него отступают ровно из-за плотности. */
                <div className={styles.filtersBar}>
                  <div className={styles.filters}>
                    {rowFields.map((field) => (
                      <div key={field.key} className={styles.filterItem} data-filter-priority={field.priority}>
                        {field.render({})}
                      </div>
                    ))}

                    <div className={styles.filterSearch}>
                      <Input
                        fullWidth
                        aria-label="Поиск по проектам"
                        placeholder="Поиск…"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                      />
                    </div>

                    <div className={styles.filterActions}>
                      {/* Кнопка не «Сбросить», а вход во все фильтры: сброс —
                          действие над применённым, а нужен доступ к тому,
                          что в строку не поместилось. Сброс уехал в панель,
                          где ему и место — рядом с тем, что он сбрасывает. */}
                      <Button variant="secondary" iconStart="filter" onClick={openFilters}>
                        {activeCount > 0 ? `Фильтры: ${activeCount}` : 'Фильтры'}
                      </Button>
                      <Button variant="primary" iconStart="plus" onClick={onNewProject}>
                        Новый проект
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}
            </Stack>
          </div>

          <div className={styles.scroll}>
            <div className={styles.tableWrap}>
              {projects.length > 0 ? (
                <Table
                  columns={columns}
                  rows={rows}
                  rowKey={(row) => row.id}
                  caption={`Проекты: ${rows.length} из ${projects.length}`}
                  /* Счётчик убран с экрана: таблицу называет заголовок
                     «Проекты» над ней, и вторая подпись прямо под ним
                     занимала полосу, ничего не добавляя. В разметке счётчик
                     остался — он служит таблице именем, а в этом файле
                     таблиц две (вторая — корзина). */
                  captionHidden
                  sort={sort}
                  onSortChange={setSort}
                  onRowClick={onOpenProject}
                  /* Шапка таблицы остаётся на месте при прокрутке строк —
                     предок с ограниченной высотой и своей прокруткой уже
                     есть (`.scroll`), это ровно тот случай, под который
                     проп задуман. */
                  stickyHeader
                  /* Колонка «Меню» остаётся доступна одним кликом при сужении
                     вьюпорта — без этого её приходилось сначала докручивать
                     до правого края таблицы каждый раз заново. */
                  pinEndKey="actions"
                  empty={
                    <EmptyState
                      icon="search"
                      title="Ничего не найдено"
                      description="Измените условия отбора или сбросьте фильтры."
                      action={
                        <Button variant="secondary" size="sm" onClick={resetFilters}>
                          Сбросить фильтры
                        </Button>
                      }
                    />
                  }
                />
              ) : (
                <EmptyState
                  icon="folder"
                  title="Проектов пока нет"
                  description="Создайте первый расчёт — он появится в списке."
                  action={
                    <Button variant="primary" iconStart="plus" onClick={onNewProject}>
                      Новый проект
                    </Button>
                  }
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Все фильтры разом — окном, а не выдвижной панелью. Панель оставляла
          таблицу видимой, но занимала её край и сдвигала колонки; к тому же
          на списке проектов и в каталоге дробилок кнопка «Фильтры» одна и та
          же, а открывала разное. Один вход — один вид: пользователь запоминает
          место кнопки, а не то, в каком экране он сейчас находится. */}
      {/* Условия применяются по «Готово», а не по каждому нажатию внутри.
          Иначе таблица под окном пересобирается на каждый щелчок: щёлкаешь
          второе условие, а список уже уехал под первым, и понять, что именно
          отбираешь, можно только закрыв окно. Закрытие мимо «Готово» —
          крестиком, по фону, по Esc — черновик отбрасывает.

          Фильтры, оставшиеся в строке под заголовком, применяются сразу:
          они на виду, и результат виден в тот же момент. */}
      <Modal
        open={filtersOpen}
        onClose={closeFilters}
        title="Фильтры"
        size="sm"
        footer={
          <Modal.Footer>
            {/* Сброс правит черновик, а не применённое: иначе одна кнопка
                окна действовала бы сразу, а остальные — по «Готово».
                Заказчик — не в EMPTY: его поля здесь и так нет (см.
                `withoutCustomerFilter`), сбрасывать в черновике нечего. */}
            <Button
              variant="secondary"
              disabled={countActive(draftValues) === 0}
              onClick={() => setDraft({ ...EMPTY, customer })}
            >
              Сбросить
            </Button>
            <Button variant="primary" onClick={commitFilters}>
              Готово
            </Button>
          </Modal.Footer>
        }
      >
        <Stack gap="lg" direction="column">
          {draftFields.map((field) => (
            <Field key={field.key} label={field.label} fullWidth>
              {(props) => field.render(props)}
            </Field>
          ))}

          <Field label="Поиск по проектам" fullWidth>
            {(props) => (
              <Input
                {...props}
                fullWidth
                placeholder="Поиск…"
                value={draftValues.search}
                onChange={(e) => setDraft((current) => ({ ...(current ?? applied), search: e.target.value }))}
              />
            )}
          </Field>
        </Stack>
      </Modal>
    </>
  );
}
