import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Badge,
  Box,
  Button,
  Cell,
  EmptyState,
  Field,
  Icon,
  Input,
  Modal,
  Popover,
  Select,
  Stack,
  Surface,
  Table,
  Tag,
  Text,
} from '@uralmash/design-system';
import type { SelectOption, TableColumn, TableSort } from '@uralmash/design-system';
import type { Project } from '@/types';
import { oreTypeOf } from '@/data/oreSamples';
import { printStepReport } from '@/domain/printReport';
import { STEP_KEYS, STEP_LABELS } from '@/domain/steps';
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
  trash: Project[];
  onOpenProject: (project: Project) => void;
  onRemoveProject: (id: string) => void;
  onRestoreProject: (id: string) => void;
  onPurgeProject: (id: string) => void;
  onNewProject: () => void;
};

/** Пустое значение фильтра. `Select` не различает «не выбрано» и «выбрано пустое». */
const ANY = '__any__';

function uniqueSorted(values: (string | null)[]): string[] {
  return [...new Set(values.filter((v): v is string => Boolean(v) && v !== '—'))].sort((a, b) =>
    a.localeCompare(b, 'ru')
  );
}

function toOptions(values: string[], anyLabel: string): SelectOption[] {
  return [{ value: ANY, label: anyLabel }, ...values.map((v) => ({ value: v, label: v }))];
}

export function ProjectsPage({
  projects,
  trash,
  onOpenProject,
  onRemoveProject,
  onRestoreProject,
  onPurgeProject,
  onNewProject,
}: ProjectsPageProps) {
  const [search, setSearch] = useState('');
  const [crusher, setCrusher] = useState<string>(ANY);
  const [customer, setCustomer] = useState<string>(ANY);
  const [tag, setTag] = useState<string>(ANY);
  const [executor, setExecutor] = useState<string>(ANY);
  const [date, setDate] = useState('');
  const [sort, setSort] = useState<TableSort | null>({ key: 'date', direction: 'desc' });
  const [menuFor, setMenuFor] = useState<string | null>(null);
  const [trashOpen, setTrashOpen] = useState(false);
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
  const crusherOptions = useMemo(
    () => toOptions(uniqueSorted(projects.map((p) => p.crusherName)), 'Дробилка'),
    [projects]
  );
  const customerOptions = useMemo(
    () => toOptions(uniqueSorted(projects.map((p) => p.customer)), 'Заказчик'),
    [projects]
  );
  const tagOptions = useMemo(() => toOptions(uniqueSorted(projects.map((p) => p.tag)), 'Тег'), [projects]);
  const executorOptions = useMemo(
    () => toOptions(uniqueSorted(projects.map((p) => p.executor)), 'Исполнитель'),
    [projects]
  );

  /** Применённые условия одним объектом — их же вид принимает черновик панели. */
  const applied: FilterValues = { crusher, customer, tag, executor, date, search };

  const EMPTY: FilterValues = { crusher: ANY, customer: ANY, tag: ANY, executor: ANY, date: '', search: '' };

  const setters: Record<keyof FilterValues, (value: string) => void> = {
    crusher: setCrusher,
    customer: setCustomer,
    tag: setTag,
    executor: setExecutor,
    date: setDate,
    search: setSearch,
  };

  const applyAll = (values: FilterValues) => {
    (Object.keys(setters) as (keyof FilterValues)[]).forEach((key) => setters[key](values[key]));
  };

  const countActive = (values: FilterValues) =>
    [values.crusher, values.customer, values.tag, values.executor].filter((v) => v !== ANY).length +
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
          value={values.crusher}
          onChange={(v) => set('crusher', v as string)}
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
          value={values.customer}
          onChange={(v) => set('customer', v as string)}
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
          value={values.tag}
          onChange={(v) => set('tag', v as string)}
        />
      ),
    },
    {
      key: 'date',
      label: 'Дата проекта',
      priority: 4,
      render: (props) => (
        <Input
          {...props}
          fullWidth
          type="date"
          aria-label="Дата проекта"
          value={values.date}
          onChange={(e) => set('date', e.target.value)}
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
          value={values.executor}
          onChange={(v) => set('executor', v as string)}
          searchable
        />
      ),
    },
  ];

  /** Строка под заголовком: правки применяются сразу — результат тут же виден. */
  const rowFields = buildFilterFields(applied, (key, value) => setters[key](value));

  /** Панель: правки копятся в черновике до «Готово». */
  const draftValues = draft ?? applied;
  const draftFields = buildFilterFields(draftValues, (key, value) =>
    setDraft((current) => ({ ...(current ?? applied), [key]: value }))
  );

  const resetFilters = () => {
    setSearch('');
    setCrusher(ANY);
    setCustomer(ANY);
    setTag(ANY);
    setExecutor(ANY);
    setDate('');
  };

  const rows = useMemo(() => {
    const query = search.trim().toLowerCase();

    const filtered = projects.filter((p) => {
      if (crusher !== ANY && p.crusherName !== crusher) return false;
      if (customer !== ANY && p.customer !== customer) return false;
      if (tag !== ANY && p.tag !== tag) return false;
      if (executor !== ANY && p.executor !== executor) return false;
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
    { key: 'crusherName', title: 'Дробилка', sortable: true },
    { key: 'customer', title: 'Заказчик', sortable: true },
    { key: 'code', title: 'Код проекта' },
    {
      key: 'tag',
      title: 'Тег',
      render: (row) => (row.tag ? <Tag color={row.tag === 'Черновик' ? 'amber' : 'steel'}>{row.tag}</Tag> : null),
    },
    { key: 'oreType', title: 'Руда', render: (row) => oreTypeOf(row.ore) },
    { key: 'ore', title: 'Месторождение', sortable: true },
    { key: 'oreIn', title: 'Руда, вход' },
    { key: 'oreOut', title: 'Руда, выход' },
    { key: 'throughput', title: 'Произв., т/ч', align: 'end' },
    { key: 'date', title: 'Дата', sortable: true },
    { key: 'executor', title: 'Исполнитель', sortable: true },
    {
      key: 'actions',
      title: '',
      align: 'end',
      render: (row) => (
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
              aria-label={`Действия: ${row.crusherName}`}
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
      ),
    },
  ];

  return (
    <>
      {/* `paddingX`+`paddingY`, а не единый `padding`: в этой версии `Box`
          проп `padding` сам себя гасит — компонент дописывает в объект стиля
          `paddingLeft/Right/Top/Bottom: undefined`, и React применяет их
          после шорткода, обнуляя уже поставленный отступ. `paddingX`/`paddingY`
          через тот же баг не проходят, потому что заполняют как раз те самые
          длинные свойства. Заявка в дизайн-систему подана отдельно. */}
      <Box paddingX="2xl" paddingY="2xl" fullWidth>
        <div className={styles.page}>
          <Stack gap="xl" direction="column">
            <Text variant="headingMd" as="h1">
              Проекты
            </Text>

            {projects.length > 0 ? (
              <>
                {/* В строке фильтры идут без `Field`. Назначение написано внутри
                    самого поля, и оно же служит доступным именем контрола: у `Select`
                    это текст триггера, у поиска — плейсхолдер. Подпись над каждым из
                    шести соседних фильтров дублировала бы то же слово и делала панель
                    вдвое выше — то же исключение, что для строк таблицы.

                    В панели «Фильтры» — наоборот, через `Field`: там фильтры идут
                    столбцом, места по вертикали хватает, и исключение теряет
                    основание. Правило системы — подпись через `Field`; в строке
                    от него отступают ровно из-за плотности. */}
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
              </>
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
          </Stack>
        </div>
      </Box>

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
                окна действовала бы сразу, а остальные — по «Готово». */}
            <Button
              variant="secondary"
              disabled={countActive(draftValues) === 0}
              onClick={() => setDraft(EMPTY)}
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

      {/* Корзина. Показывается всегда: пустая объясняет, что удалённое
          не пропадает сразу, — это снимает страх перед удалением. */}
      <div className={styles.trashDock}>
        <Surface level="raised" radius="md" padding="2xs" background="surface">
          <Stack direction="row" gap="2xs" align="center">
            <Button
              variant="ghost"
              size="sm"
              icon="trash"
              aria-label={`Корзина: ${trash.length}`}
              onClick={() => setTrashOpen(true)}
            />
            {trash.length > 0 ? <Badge tone="neutral">{String(trash.length)}</Badge> : null}
          </Stack>
        </Surface>
      </div>

      <Modal
        open={trashOpen}
        onClose={() => setTrashOpen(false)}
        title={`Корзина — ${trash.length}`}
        size="lg"
        footer={
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setTrashOpen(false)}>
              Закрыть
            </Button>
          </Modal.Footer>
        }
      >
        <Table
          columns={[
            { key: 'crusherName', title: 'Дробилка' },
            { key: 'customer', title: 'Заказчик' },
            { key: 'code', title: 'Код проекта' },
            { key: 'date', title: 'Дата' },
            {
              key: 'actions',
              title: '',
              align: 'end',
              render: (row) => (
                <Stack direction="row" gap="2xs" justify="end">
                  <Button variant="ghost" size="sm" iconStart="upload" onClick={() => onRestoreProject(row.id)}>
                    Восстановить
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon="trash"
                    aria-label={`Удалить безвозвратно: ${row.crusherName}`}
                    onClick={() => onPurgeProject(row.id)}
                  />
                </Stack>
              ),
            },
          ]}
          rows={trash}
          rowKey={(row) => row.id}
          caption="Удалённые проекты"
          empty={
            <EmptyState
              icon="trash"
              title="Корзина пуста"
              description="Удалённые проекты попадают сюда, и их можно вернуть."
            />
          }
        />
      </Modal>
    </>
  );
}
