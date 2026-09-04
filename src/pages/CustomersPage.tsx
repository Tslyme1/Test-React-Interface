import { useMemo, useState } from 'react';
import { Button, EmptyState, Input, Select, Stack, Table, Tag, Text } from '@uralmash/design-system';
import type { SelectOption, TableColumn, TableSort } from '@uralmash/design-system';
import type { Project } from '@/types';
import { useTags } from '@/state/useTags';
import styles from './CustomersPage.module.css';

export type CustomersPageProps = {
  projects: Project[];
  onOpenCustomer: (customer: string) => void;
  /**
   * Заказчика отдельной сущностью система не заводит (см. комментарий у
   * `CustomersPage` ниже) — «новый заказчик» здесь означает «новый проект
   * с ещё не встречавшимся именем заказчика», то есть тот же вход, что
   * и кнопка «Новый проект» на «Проектах».
   */
  onNewProject: () => void;
};

type CustomerRow = {
  customer: string;
  count: number;
  executors: string[];
  tags: string[];
  lastDate: string;
  lastDateMs: number;
};

const NONE = '';

function uniqueSorted(values: string[]): string[] {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, 'ru'));
}

function toOptions(values: string[]): SelectOption[] {
  return values.map((v) => ({ value: v, label: v }));
}

/**
 * Дата проекта хранится строкой «ДД.ММ.ГГГГ ЧЧ:ММ» (см. `formatDate` в
 * `useProjects.ts`) — сравнивать такие строки лексикографически нельзя,
 * первым разъезжается день. Разбираем в timestamp только здесь: нигде
 * больше в приложении даты по величине не сравнивают.
 */
function parseProjectDate(value: string): number {
  const [datePart, timePart] = value.split(' ');
  const [day, month, year] = (datePart ?? '').split('.').map(Number);
  const [hours, minutes] = (timePart ?? '0:0').split(':').map(Number);
  if (!day || !month || !year) return 0;
  return new Date(year, month - 1, day, hours || 0, minutes || 0).getTime();
}

function buildCustomerRows(projects: Project[]): CustomerRow[] {
  const byCustomer = new Map<string, Project[]>();
  for (const project of projects) {
    const list = byCustomer.get(project.customer) ?? [];
    list.push(project);
    byCustomer.set(project.customer, list);
  }

  return [...byCustomer.entries()].map(([customer, rows]) => {
    const executors = [...new Set(rows.map((r) => r.executor))].sort((a, b) => a.localeCompare(b, 'ru'));
    const tags = [...new Set(rows.flatMap((r) => r.tags))].sort((a, b) => a.localeCompare(b, 'ru'));
    const latest = rows.reduce((max, r) => Math.max(max, parseProjectDate(r.date)), 0);
    const latestRow = rows.find((r) => parseProjectDate(r.date) === latest);
    return {
      customer,
      count: rows.length,
      executors,
      tags,
      lastDate: latestRow?.date ?? '—',
      lastDateMs: latest,
    };
  });
}

/**
 * Заказчики — свод по тем же проектам, что и на «Проекты», не отдельный
 * справочник: заказчик существует ровно постольку, поскольку у него есть
 * хотя бы один проект. Строка ведёт на «Проекты», уже отфильтрованные на
 * этого заказчика, — сравнивать его историю удобнее в той же таблице,
 * где сравнивают и все остальные проекты, а не в отдельной урезанной копии.
 */
export function CustomersPage({ projects, onOpenCustomer, onNewProject }: CustomersPageProps) {
  /* Цвет тега — тот же справочник, что красит теги на «Проектах»: один
     и тот же тег обязан выглядеть одинаково на обоих экранах. */
  const { colorOf } = useTags();
  const [search, setSearch] = useState('');
  const [executor, setExecutor] = useState<string>(NONE);
  const [tag, setTag] = useState<string>(NONE);
  const [sort, setSort] = useState<TableSort | null>({ key: 'lastDateMs', direction: 'desc' });

  const executorOptions = useMemo(() => toOptions(uniqueSorted(projects.map((p) => p.executor))), [projects]);
  /**
   * Теги показываются тегами — тем же приёмом, что и в фильтрах «Проектов»:
   * список слов заставлял бы держать в голове, какой тег какого цвета,
   * а цвет виден только в самой таблице ниже.
   */
  const tagOptions = useMemo<SelectOption[]>(
    () =>
      uniqueSorted(projects.flatMap((p) => p.tags)).map((name) => ({
        value: name,
        label: name,
        content: <Tag color={colorOf(name)}>{name}</Tag>,
      })),
    [projects, colorOf]
  );

  const rows = useMemo(() => {
    const all = buildCustomerRows(projects);
    const query = search.trim().toLowerCase();

    const filtered = all.filter((r) => {
      if (query && !r.customer.toLowerCase().includes(query)) return false;
      // Отбор по своду заказчика — «хотя бы у одного его проекта есть этот
      // исполнитель/тег», а не «у всех сразу»: заказчик — общая история
      // проектов, и исполнитель/тег ищут в ней, а не в единственной записи.
      if (executor !== NONE && !r.executors.includes(executor)) return false;
      if (tag !== NONE && !r.tags.includes(tag)) return false;
      return true;
    });

    if (!sort) return filtered;
    const sorted = [...filtered].sort((a, b) => {
      if (sort.key === 'count' || sort.key === 'lastDateMs') {
        return (a[sort.key] as number) - (b[sort.key] as number);
      }
      return String(a[sort.key as keyof CustomerRow]).localeCompare(String(b[sort.key as keyof CustomerRow]), 'ru');
    });
    return sort.direction === 'desc' ? sorted.reverse() : sorted;
  }, [projects, search, executor, tag, sort]);

  const columns: TableColumn<CustomerRow>[] = [
    { key: 'customer', title: 'Заказчик', sortable: true },
    { key: 'count', title: 'Проектов', align: 'end', sortable: true },
    {
      key: 'executors',
      title: 'Исполнители',
      render: (row) => (
        <Stack direction="row" gap="2xs" wrap>
          {row.executors.map((name) => (
            <Tag key={name} color="steel">
              {name}
            </Tag>
          ))}
        </Stack>
      ),
    },
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
    { key: 'lastDateMs', title: 'Последний проект', render: (row) => row.lastDate, sortable: true },
  ];

  return (
    <div className={styles.root}>
      <div className={styles.page}>
        <div className={styles.header}>
          <Stack gap="xl" direction="column">
            <Text variant="headingMd" as="h1">
              Заказчики
            </Text>

            {projects.length > 0 ? (
              <div className={styles.filters}>
                <div className={styles.filterItem}>
                  <Select
                    fullWidth
                    options={executorOptions}
                    placeholder="Исполнитель"
                    value={executor || null}
                    onChange={(v) => setExecutor((v as string | null) ?? NONE)}
                    searchable
                  />
                </div>
                <div className={styles.filterItem}>
                  <Select
                    fullWidth
                    options={tagOptions}
                    placeholder="Тег"
                    value={tag || null}
                    onChange={(v) => setTag((v as string | null) ?? NONE)}
                  />
                </div>

                <div className={styles.searchBar}>
                  <Input
                    fullWidth
                    aria-label="Поиск по заказчикам"
                    placeholder="Поиск…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>

                <div className={styles.filterActions}>
                  <Button variant="primary" iconStart="plus" onClick={onNewProject}>
                    Новый заказчик
                  </Button>
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
                rowKey={(row) => row.customer}
                caption={`Заказчики: ${rows.length}`}
                captionHidden
                sort={sort}
                onSortChange={setSort}
                onRowClick={(row) => onOpenCustomer(row.customer)}
                stickyHeader
                empty={
                  <EmptyState
                    icon="search"
                    title="Ничего не найдено"
                    description="Измените условия отбора или сбросьте фильтры."
                    action={
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => {
                          setSearch('');
                          setExecutor(NONE);
                          setTag(NONE);
                        }}
                      >
                        Сбросить фильтры
                      </Button>
                    }
                  />
                }
              />
            ) : (
              <EmptyState
                icon="users"
                title="Заказчиков пока нет"
                description="Они появятся здесь, как только в проектах будет указан заказчик."
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
  );
}
