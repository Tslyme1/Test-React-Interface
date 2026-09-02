import { Box, Stack, Text } from '@uralmash/design-system';
import type { User } from '@/types';
import styles from './ProfilePage.module.css';

export type ProfilePageProps = {
  user: User;
};

/**
 * Только просмотр: правка профиля не входила в задачу, а авторизация здесь
 * демонстрационная (см. README) — заводить форму редактирования для мок-поля
 * значило бы обещать сохранение, которого на самом деле нет.
 *
 * Не `Field`: он рассчитан на контрол, которому передают `id`/`aria-*` для
 * связи с подписью, а здесь нет ни одного контрола — только текст для
 * чтения. Пара подписи и значения — тот же приём, что уже стоит в меню
 * пользователя в шапке (`AppShell`).
 */
export function ProfilePage({ user }: ProfilePageProps) {
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
        </Stack>
      </div>
    </Box>
  );
}
