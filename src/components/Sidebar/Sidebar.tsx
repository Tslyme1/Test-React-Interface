import { Box, Cell, Icon, SegmentedControl, Stack, Surface, Text } from '@uralmash/design-system';
import type { ProjectMode } from '@/types';
import styles from './Sidebar.module.css';

export type SidebarView = 'projects' | 'customers' | 'profile';

export type SidebarProps = {
  view: SidebarView;
  onViewChange: (view: SidebarView) => void;
  mode: ProjectMode;
  /**
   * Проект открыт — режим у него уже зафиксирован и правится только через
   * приведённое здесь состояние `mode`/`onModeChange` для смены на будущее,
   * а сам открытый проект переключатель не трогает.
   */
  modeLocked: boolean;
  onModeChange: (mode: ProjectMode) => void;
  trashCount: number;
  onOpenTrash: () => void;
};

const MODE_OPTIONS: { value: ProjectMode; label: string }[] = [
  { value: 'engineering', label: 'Инженерный' },
  { value: 'simplified', label: 'Упрощённый' },
];

/**
 * Разделы приложения — отдельно от шапки сервиса (`AppHeader`). Шапка несёт
 * бренд, вкладку открытого проекта и его действия — про открытый документ.
 * Сайдбар — про разделы, между которыми переключаются независимо от того,
 * открыт ли сейчас какой-то проект.
 *
 * «Режим работы» — не переход, а переключатель: он не ведёт ни в какой
 * раздел, а задаёт форму шагов визарда для следующего нового проекта
 * (или показывает — уже не меняя — режим открытого).
 */
export function Sidebar({ view, onViewChange, mode, modeLocked, onModeChange, trashCount, onOpenTrash }: SidebarProps) {
  return (
    <div className={styles.sidebar}>
      <Surface level="flat" border fullWidth>
      <Box paddingX="sm" paddingY="lg" fullWidth>
        <Stack direction="column" gap="lg">
          <Stack direction="column" gap="none">
            <Cell
              leading={<Icon name="user" size="sm" />}
              selected={view === 'profile'}
              onClick={() => onViewChange('profile')}
            >
              Профиль
            </Cell>
          </Stack>

          <Stack direction="column" gap="xs">
            <Box paddingX="sm">
              <Stack direction="row" gap="xs" align="center">
                <Icon name="settings" size="sm" color="textMuted" />
                <Text variant="label">Режим работы</Text>
              </Stack>
            </Box>
            <Box paddingX="sm">
              <SegmentedControl
                legend="Режим работы"
                fullWidth
                size="sm"
                options={MODE_OPTIONS.map((o) => ({ ...o, disabled: modeLocked }))}
                value={mode}
                onChange={onModeChange}
              />
            </Box>
            {modeLocked ? (
              <Box paddingX="sm">
                <Text variant="caption" color="textMuted">
                  Режим открытого проекта задан при создании и дальше не меняется.
                </Text>
              </Box>
            ) : null}
          </Stack>

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
            <Cell
              leading={<Icon name="trash" size="sm" />}
              trailing={
                trashCount > 0 ? (
                  <Text variant="caption" color="textMuted">
                    {trashCount}
                  </Text>
                ) : null
              }
              onClick={onOpenTrash}
            >
              Корзина
            </Cell>
          </Stack>
        </Stack>
      </Box>
      </Surface>
    </div>
  );
}
