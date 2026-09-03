import { Box, Cell, Icon, Stack, Text } from '@uralmash/design-system';
import styles from './Sidebar.module.css';

export type SidebarView = 'projects' | 'customers' | 'profile' | 'trash';

export type SidebarProps = {
  view: SidebarView;
  onViewChange: (view: SidebarView) => void;
  trashCount: number;
};

/**
 * Разделы приложения — отдельно от шапки сервиса (`AppHeader`). Шапка несёт
 * бренд и вкладку открытого проекта — про открытый документ. Сайдбар — про
 * разделы, и скрывается целиком, когда открытый проект показан на экране
 * (см. `AppShell`): внутри проекта должен быть виден только он.
 *
 * «Профиль» и «Корзина» — редкие разделы, прижаты к низу распоркой
 * (`.spacer`): «Проекты» и «Заказчики» открывают чаще, и то, что открывают
 * чаще, стоит выше и ближе к верху списка.
 *
 * Не `Surface` для фона и рамки: `Surface` не растягивается на всю высоту
 * родителя (его собственная разметка — по содержимому), а сайдбар обязан
 * стоять во весь рост колонки рядом. Фон и рамка — тем же приёмом, что уже
 * есть в `AppShell.module.css` (`var(--color-surface)`, `var(--color-border)`
 * напрямую в CSS-модуле), только по правому краю, а не со всех сторон.
 */
export function Sidebar({ view, onViewChange, trashCount }: SidebarProps) {
  return (
    <div className={styles.sidebar}>
      <Box paddingX="sm" paddingY="lg" fullWidth>
        <Stack direction="column" gap="none">
          <Cell
            leading={<Icon name="folder" size="sm" />}
            selected={view === 'projects'}
            onClick={() => onViewChange('projects')}
          >
            Проекты
          </Cell>
          <div className={styles.divider} />
          <Cell
            leading={<Icon name="users" size="sm" />}
            selected={view === 'customers'}
            onClick={() => onViewChange('customers')}
          >
            Заказчики
          </Cell>
        </Stack>
      </Box>

      <div className={styles.spacer} />

      <Box paddingX="sm" paddingY="lg" fullWidth>
        <Stack direction="column" gap="none">
          <Cell
            leading={<Icon name="user" size="sm" />}
            selected={view === 'profile'}
            onClick={() => onViewChange('profile')}
          >
            Профиль
          </Cell>
          <div className={styles.divider} />
          <Cell
            leading={<Icon name="trash" size="sm" />}
            trailing={
              trashCount > 0 ? (
                <Text variant="caption" color="textMuted">
                  {trashCount}
                </Text>
              ) : null
            }
            selected={view === 'trash'}
            onClick={() => onViewChange('trash')}
          >
            Корзина
          </Cell>
        </Stack>
      </Box>
    </div>
  );
}
