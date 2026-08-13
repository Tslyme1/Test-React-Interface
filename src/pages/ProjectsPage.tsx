import { useMemo, useState } from 'react';
import {
  Badge,
  Box,
  Button,
  EmptyState,
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
import styles from './ProjectsPage.module.css';

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

  // Варианты фильтров выводятся из самих проектов: показывать в списке то,
  // чего в таблице нет, — обещать результат, которого не будет.
  const crusherOptions = useMemo(
    () => toOptions(uniqueSorted(projects.map((p) => p.crusherName)), 'Дробилка: любая'),
    [projects]
  );
  const customerOptions = useMemo(
    () => toOptions(uniqueSorted(projects.map((p) => p.customer)), 'Заказчик: любой'),
    [projects]
  );
  const tagOptions = useMemo(() => toOptions(uniqueSorted(projects.map((p) => p.tag)), 'Тег: любой'), [projects]);
  const executorOptions = useMemo(
    () => toOptions(uniqueSorted(projects.map((p) => p.executor)), 'Исполнитель: любой'),
    [projects]
  );

  const filtersActive =
    [crusher, customer, tag, executor].some((v) => v !== ANY) || Boolean(date) || Boolean(search.trim());

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
      if (date && p.date !== new Date(date).toLocaleDateString('ru-RU')) return false;
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
      <Box padding="2xl" fullWidth>
        <div className={styles.page}>
          <Stack gap="xl" direction="column">
            <Text variant="headingMd" as="h1">
              Проекты
            </Text>

            {projects.length > 0 ? (
              <>
                {/* Фильтры без `Field`. Назначение написано внутри самого поля,
                    и оно же служит доступным именем контрола: у `Select` это текст
                    триггера, у поиска — плейсхолдер. Подпись над каждым из шести
                    соседних фильтров дублировала бы то же слово и делала панель
                    вдвое выше — то же исключение, что для строк таблицы. */}
                <div className={styles.filters}>
                  <div className={styles.filterItem}>
                    <Select
                      fullWidth
                      options={crusherOptions}
                      value={crusher}
                      onChange={(v) => setCrusher(v as string)}
                      searchable
                    />
                  </div>
                  <div className={styles.filterItem}>
                    <Select fullWidth options={customerOptions} value={customer} onChange={(v) => setCustomer(v as string)} />
                  </div>
                  <div className={styles.filterItem}>
                    <Select fullWidth options={tagOptions} value={tag} onChange={(v) => setTag(v as string)} />
                  </div>
                  <div className={styles.filterItem}>
                    <Input
                      fullWidth
                      type="date"
                      aria-label="Дата проекта"
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                    />
                  </div>
                  <div className={styles.filterItem}>
                    <Select
                      fullWidth
                      options={executorOptions}
                      value={executor}
                      onChange={(v) => setExecutor(v as string)}
                      searchable
                    />
                  </div>
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
                    <Button variant="secondary" iconStart="filter" disabled={!filtersActive} onClick={resetFilters}>
                      Сбросить
                    </Button>
                    <Button variant="primary" iconStart="plus" onClick={onNewProject}>
                      Новый проект
                    </Button>
                  </div>
                </div>

                <Table
                  columns={columns}
                  rows={rows}
                  rowKey={(row) => row.id}
                  caption={`Проекты: ${rows.length} из ${projects.length}`}
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
