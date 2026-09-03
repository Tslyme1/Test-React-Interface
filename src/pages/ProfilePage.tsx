import { Box, Button, Stack, Text } from '@uralmash/design-system';
import { OptionCell } from '@/components/OptionCell/OptionCell';
import type { ProjectMode, User } from '@/types';
import styles from './ProfilePage.module.css';

export type ProfilePageProps = {
  user: User;
  /** Режим следующего нового проекта — переключатель здесь, а не в сайдбаре: это настройка профиля, а не переход. */
  mode: ProjectMode;
  onModeChange: (mode: ProjectMode) => void;
  onLogout: () => void;
};

const MODE_OPTIONS: { value: ProjectMode; label: string; description: string }[] = [
  { value: 'engineering', label: 'Инженерный', description: 'Ручная настройка всех параметров на каждом этапе.' },
  { value: 'simplified', label: 'Упрощённый', description: 'Три коротких шага и готовый отчёт.' },
];

/**
 * Только просмотр данных пользователя: правка профиля не входила в задачу,
 * а авторизация здесь демонстрационная (см. README) — заводить форму
 * редактирования для мок-поля значило бы обещать сохранение, которого на
 * самом деле нет.
 *
 * Не `Field` для данных пользователя: он рассчитан на контрол, которому
 * передают `id`/`aria-*` для связи с подписью, а здесь нет ни одного
 * контрола — только текст для чтения. Пара подписи и значения — тот же
 * приём, что раньше стоял в меню пользователя в шапке.
 */
export function ProfilePage({ user, mode, onModeChange, onLogout }: ProfilePageProps) {
  const rows: { label: string; value: string }[] = [
    { label: 'Имя', value: user.name },
    { label: 'Почта', value: user.email || '—' },
    { label: 'Логин', value: user.login },
    { label: 'Роль', value: user.role },
  ];

  return (
    <Box paddingX="2xl" paddingY="2xl" fullWidth>
      <div className={styles.page}>
        <Stack gap="xl" direction="column">
          <Text variant="headingMd" as="h1">
            Профиль
          </Text>

          <Stack gap="md" direction="column">
            {rows.map((row) => (
              <Stack key={row.label} gap="2xs" direction="column">
                <Text variant="label" color="textMuted">
                  {row.label}
                </Text>
                <Text variant="body">{row.value}</Text>
              </Stack>
            ))}
          </Stack>

          <Stack gap="2xs" direction="column">
            <Text variant="label" color="textMuted">
              Режим работы нового проекта
            </Text>
            <Stack direction="column" gap="none">
              {MODE_OPTIONS.map((option) => (
                <OptionCell
                  key={option.value}
                  label={option.label}
                  description={option.description}
                  checked={mode === option.value}
                  onSelect={() => onModeChange(option.value)}
                />
              ))}
            </Stack>
          </Stack>

          <div>
            <Button variant="secondary" iconStart="logOut" onClick={onLogout}>
              Выйти
            </Button>
          </div>
        </Stack>
      </div>
    </Box>
  );
}
