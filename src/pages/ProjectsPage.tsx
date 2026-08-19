import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  Badge,
  Box,
  Button,
  Drawer,
  EmptyState,
  Field,
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
type FilterField = {
  key: string;
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

  /* Счёт, а не «да/нет»: кнопка «Фильтры» прячет часть условий под собой,
     и сколько именно их применено, из строки уже не видно. */
  const activeCount =
    [crusher, customer, tag, executor].filter((v) => v !== ANY).length +
    (date ? 1 : 0) +
    (search.trim() ? 1 : 0);
  const filtersActive = activeCount > 0;

  const filterFields: FilterField[] = [
    {
      key: 'crusher',
      label: 'Дробилка',
      priority: 1,
      render: (props) => (
        <Select
          {...props}
          fullWidth
          options={crusherOptions}
          value={crusher}
          onChange={(v) => setCrusher(v as string)}
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
          value={customer}
          onChange={(v) => setCustomer(v as string)}
        />
      ),
    },
    {
      key: 'tag',
      label: 'Тег',
      priority: 3,
      render: (props) => (
        <Select {...props} fullWidth options={tagOptions} value={tag} onChange={(v) => setTag(v as string)} />
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
          value={date}
          onChange={(e) => setDate(e.target.value)}
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
          value={executor}
          onChange={(v) => setExecutor(v as string)}
          searchable
        />
      ),
    },
  ];

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
          <Stack gap="2xs" direction="column">
            <Button
              variant="ghost"
              size="sm"
              iconStart="fileText"
              fullWidth
              onClick={(e) => {
                e.stopPropagation();
                setMenuFor(null);
                onOpenProject(row);
              }}
            >
              Открыть проект
            </Button>

            {/* Печать — по одному пункту на посчитанный шаг. Непосчитанный
                шаг печатать нечего: показывать кнопку, которая ничего
                не даст, хуже, чем не показывать её вовсе. */}
            {STEP_KEYS.map((key, i) =>
              row.calc[i] ? (
                <Button
                  key={key}
                  variant="ghost"
                  size="sm"
                  iconStart="print"
                  fullWidth
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuFor(null);
                    printStepReport(row, key);
                  }}
                >
                  Печать: {STEP_LABELS[key]}
                </Button>
              ) : null
            )}

            <Button
              variant="ghost"
              size="sm"
              iconStart="trash"
              fullWidth
              onClick={(e) => {
                e.stopPropagation();
                setMenuFor(null);
                onRemoveProject(row.id);
              }}
            >
              Удалить в корзину
            </Button>
          </Stack>
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
                    {filterFields.map((field) => (
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
                      <Button variant="secondary" iconStart="filter" onClick={() => setFiltersOpen(true)}>
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

      {/* Все фильтры разом. Панель, а не модалка: она не блокирует таблицу,
          и результат фильтрации виден сразу же, слева от панели, — по нему
          и понятно, стоит ли уточнять условие дальше. */}
      <Drawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        size="narrow"
        title="Фильтры"
        footer={
          <Stack direction="row" gap="sm" justify="end" grow>
            <Button variant="secondary" disabled={!filtersActive} onClick={resetFilters}>
              Сбросить
            </Button>
            <Button variant="primary" onClick={() => setFiltersOpen(false)}>
              Готово
            </Button>
          </Stack>
        }
      >
        <Stack gap="lg" direction="column">
          {filterFields.map((field) => (
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
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            )}
          </Field>
        </Stack>
      </Drawer>

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
