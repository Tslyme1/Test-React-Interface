import { Button, EmptyState, Stack, Table, Text } from '@uralmash/design-system';
import type { TableColumn } from '@uralmash/design-system';
import type { Project } from '@/types';
import styles from './TrashPage.module.css';

export type TrashPageProps = {
  trash: Project[];
  onRestoreProject: (id: string) => void;
  onPurgeProject: (id: string) => void;
};

/**
 * Корзина — отдельный экран, а не окно поверх списка проектов: тот же приём,
 * что и у остальных разделов сайдбара («Проекты», «Заказчики», «Профиль»).
 * Окном она была, пока оставалась редким, вложенным действием над списком;
 * теперь это раздел наравне с остальными — со своей строкой в сайдбаре
 * и подсветкой активности, а не всплывающая поверх текущего экрана панель.
 */
export function TrashPage({ trash, onRestoreProject, onPurgeProject }: TrashPageProps) {
  const columns: TableColumn<Project>[] = [
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
  ];

  return (
    <div className={styles.root}>
      <div className={styles.page}>
        <div className={styles.header}>
          <Text variant="headingMd" as="h1">
            Корзина
          </Text>
        </div>

        <div className={styles.scroll}>
          <div className={styles.tableWrap}>
            {trash.length > 0 ? (
              <Table
                columns={columns}
                rows={trash}
                rowKey={(row) => row.id}
                caption={`Удалённые проекты: ${trash.length}`}
                captionHidden
                stickyHeader
                pinEndKey="actions"
                empty={
                  <EmptyState icon="trash" title="Корзина пуста" description="Удалённые проекты попадают сюда, и их можно вернуть." />
                }
              />
            ) : (
              <EmptyState icon="trash" title="Корзина пуста" description="Удалённые проекты попадают сюда, и их можно вернуть." />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
