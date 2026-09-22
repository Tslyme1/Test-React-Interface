import { Box, Cell, Icon, Stack } from '@uralmash/design-system';
import styles from './Sidebar.module.css';

export type SidebarView = 'projects' | 'customers' | 'settings' | 'trash';

export type SidebarProps = {
  view: SidebarView;
  onViewChange: (view: SidebarView) => void;
};

/**
 * Разделы приложения — отдельно от шапки сервиса (`AppHeader`). Шапка несёт
 * бренд и вкладку открытого проекта — про открытый документ. Сайдбар — про
 * разделы, и скрывается целиком, когда открытый проект показан на экране
 * (см. `AppShell`): внутри проекта должен быть виден только он.
 *
 * «Настройки» и «Корзина» — редкие разделы, прижаты к низу распоркой
 * (`.spacer`): «Проекты» и «Заказчики» открывают чаще, и то, что открывают
 * чаще, стоит выше и ближе к верху списка.
 *
 * Не `Surface` для фона и рамки: `Surface` не растягивается на всю высоту
 * родителя (его собственная разметка — по содержимому), а сайдбар обязан
 * стоять во весь рост колонки рядом. Фон и рамка — тем же приёмом, что уже
 * есть в `AppShell.module.css` (`var(--color-surface)`, `var(--color-border)`
 * напрямую в CSS-модуле), только по правому краю, а не со всех сторон.
 */
export function Sidebar({ view, onViewChange }: SidebarProps) {
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
          {/* «Настройки», а не «Профиль»: за пунктом стоят тема, размер
              шрифта и режим работы, а данные учётной записи — лишь четыре
              строки над ними. Имя раздела по одной его строке уводило
              от того места, где отображение и меняют. Значок — `settings`
              по той же причине: `user` обещал бы карточку пользователя. */}
          <Cell
            leading={<Icon name="settings" size="sm" />}
            selected={view === 'settings'}
            onClick={() => onViewChange('settings')}
          >
            Настройки
          </Cell>
          <Cell
            leading={<Icon name="trash" size="sm" />}
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
