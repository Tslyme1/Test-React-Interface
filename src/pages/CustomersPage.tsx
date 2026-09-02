import { useMemo, useState } from 'react';
import { Box, EmptyState, Input, Stack, Table, Tag, Text } from '@uralmash/design-system';
import type { TableColumn, TableSort } from '@uralmash/design-system';
import type { Project } from '@/types';
import styles from './CustomersPage.module.css';

export type CustomersPageProps = {
  projects: Project[];
  onOpenCustomer: (customer: string) => void;
};

type CustomerRow = {
  customer: string;
  count: number;
  executors: string[];
  lastDate: string;
  lastDateMs: number;
};

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
    const latest = rows.reduce((max, r) => Math.max(max, parseProjectDate(r.date)), 0);
    const latestRow = rows.find((r) => parseProjectDate(r.date) === latest);
    return {
      customer,
      count: rows.length,
      executors,
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
export function CustomersPage({ projects, onOpenCustomer }: CustomersPageProps) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<TableSort | null>({ key: 'lastDateMs', direction: 'desc' });

  const rows = useMemo(() => {
    const all = buildCustomerRows(projects);
    const query = search.trim().toLowerCase();
    const filtered = query ? all.filter((r) => r.customer.toLowerCase().includes(query)) : all;

    if (!sort) return filtered;
    const sorted = [...filtered].sort((a, b) => {
      if (sort.key === 'count' || sort.key === 'lastDateMs') {
        return (a[sort.key] as number) - (b[sort.key] as number);
      }
      return String(a[sort.key as keyof CustomerRow]).localeCompare(String(b[sort.key as keyof CustomerRow]), 'ru');
    });
    return sort.direction === 'desc' ? sorted.reverse() : sorted;
  }, [projects, search, sort]);

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
    { key: 'lastDateMs', title: 'Последний проект', render: (row) => row.lastDate, sortable: true },
  ];

  return (
    <div className={styles.root}>
      <div className={styles.page}>
        <Box paddingX="2xl" paddingY="2xl" fullWidth>
          <Stack gap="xl" direction="column">
            <Text variant="headingMd" as="h1">
              Заказчики
            </Text>

            {projects.length > 0 ? (
              <div className={styles.searchBar}>
                <Input
                  fullWidth
                  aria-label="Поиск по заказчикам"
                  placeholder="Поиск…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            ) : null}
          </Stack>
        </Box>

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
                    description="Измените запрос — заказчик под другим именем в списке может найтись."
                  />
                }
              />
            ) : (
              <EmptyState
                icon="users"
                title="Заказчиков пока нет"
                description="Они появятся здесь, как только в проектах будет указан заказчик."
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
