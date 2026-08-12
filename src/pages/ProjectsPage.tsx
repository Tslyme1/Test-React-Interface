import { useMemo, useState } from 'react';
import {
  Box,
  Button,
  EmptyState,
  Field,
  Input,
  Stack,
  Table,
  Tag,
  Text,
} from '@uralmash/design-system';
import type { TableColumn, TableSort } from '@uralmash/design-system';
import type { Project } from '@/types';

export type ProjectsPageProps = {
  projects: Project[];
  onOpenProject: (project: Project) => void;
  onRemoveProject: (id: string) => void;
  onNewProject: () => void;
};

export function ProjectsPage({ projects, onOpenProject, onRemoveProject, onNewProject }: ProjectsPageProps) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState<TableSort | null>({ key: 'date', direction: 'desc' });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = q
      ? projects.filter((p) =>
          [p.name, p.customer, p.crusherName, p.ore, p.executor].some((v) => v.toLowerCase().includes(q))
        )
      : projects;

    if (!sort) return rows;
    const sorted = [...rows].sort((a, b) => {
      const av = String(a[sort.key as keyof Project] ?? '');
      const bv = String(b[sort.key as keyof Project] ?? '');
      return av.localeCompare(bv, 'ru');
    });
    return sort.direction === 'desc' ? sorted.reverse() : sorted;
  }, [projects, search, sort]);

  const columns: TableColumn<Project>[] = [
    { key: 'crusherName', title: 'Дробилка', sortable: true },
    { key: 'customer', title: 'Заказчик', sortable: true },
    { key: 'code', title: 'Код проекта' },
    {
      key: 'tag',
      title: 'Тег',
      render: (row) => (row.tag ? <Tag color="steel">{row.tag}</Tag> : <span>—</span>),
    },
    { key: 'ore', title: 'Руда' },
    { key: 'throughput', title: 'Произв., т/ч', align: 'end' },
    { key: 'date', title: 'Дата', sortable: true },
    { key: 'executor', title: 'Исполнитель' },
    {
      key: 'actions',
      title: '',
      align: 'end',
      render: (row) => (
        <Button
          variant="ghost"
          size="sm"
          icon="trash"
          aria-label="Удалить проект"
          onClick={(e) => {
            e.stopPropagation();
            onRemoveProject(row.id);
          }}
        />
      ),
    },
  ];

  return (
    <Box padding="2xl" fullWidth>
      <Stack gap="xl" direction="column">
        <Stack direction="row" align="center" justify="between">
          <Text variant="headingMd" as="h1">
            Проекты
          </Text>
          <Button variant="primary" iconStart="plus" onClick={onNewProject}>
            Новый проект
          </Button>
        </Stack>

        {projects.length > 0 ? (
          <>
            <Box fullWidth>
              <Field label="Поиск">
                {(props) => (
                  <Input
                    {...props}
                    fullWidth
                    placeholder="Дробилка, заказчик, руда, исполнитель…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                )}
              </Field>
            </Box>

            <Table
              columns={columns}
              rows={filtered}
              rowKey={(row) => row.id}
              caption="Список проектов"
              sort={sort}
              onSortChange={setSort}
              onRowClick={onOpenProject}
              empty={
                <EmptyState icon="search" title="Ничего не найдено" description="Измените условия поиска." />
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
    </Box>
  );
}
