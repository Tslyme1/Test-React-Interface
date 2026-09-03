import { Button, Stack, Text } from '@uralmash/design-system';
import { OptionCell } from '@/components/OptionCell/OptionCell';
import type { FontScalePreference } from '@/state/useFontScale';
import type { ThemePreference } from '@/state/useTheme';
import type { ProjectMode, User } from '@/types';
import styles from './ProfilePage.module.css';

export type ProfilePageProps = {
  user: User;
  /** Режим следующего нового проекта — переключатель здесь, а не в сайдбаре: это настройка профиля, а не переход. */
  mode: ProjectMode;
  onModeChange: (mode: ProjectMode) => void;
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
  fontScale: FontScalePreference;
  onFontScaleChange: (scale: FontScalePreference) => void;
  onLogout: () => void;
};

const MODE_OPTIONS: { value: ProjectMode; label: string; description: string }[] = [
  { value: 'engineering', label: 'Инженерный', description: 'Ручная настройка всех параметров на каждом этапе.' },
  { value: 'simplified', label: 'Упрощённый', description: 'Три коротких шага и готовый отчёт.' },
];

const THEME_OPTIONS: { value: ThemePreference; label: string; description: string }[] = [
  { value: 'system', label: 'Как в системе', description: 'Меняется вместе с настройкой операционной системы.' },
  { value: 'light', label: 'Светлая', description: 'Всегда светлая, независимо от системы.' },
  { value: 'dark', label: 'Тёмная', description: 'Всегда тёмная, независимо от системы.' },
];

const FONT_SCALE_OPTIONS: { value: FontScalePreference; label: string; description: string }[] = [
  { value: 'sm', label: 'Мелкий', description: '90 % от обычного размера.' },
  { value: 'md', label: 'Обычный', description: 'Размер по умолчанию.' },
  { value: 'lg', label: 'Крупный', description: '115 % от обычного размера.' },
  { value: 'xl', label: 'Очень крупный', description: '130 % от обычного размера.' },
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
export function ProfilePage({
  user,
  mode,
  onModeChange,
  theme,
  onThemeChange,
  fontScale,
  onFontScaleChange,
  onLogout,
}: ProfilePageProps) {
  const rows: { label: string; value: string }[] = [
    { label: 'Имя', value: user.name },
    { label: 'Почта', value: user.email || '—' },
    { label: 'Логин', value: user.login },
    { label: 'Роль', value: user.role },
  ];

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <Text variant="headingMd" as="h1">
          Профиль
        </Text>
      </div>

      <div className={styles.scroll}>
        <div className={styles.page}>
          <Stack gap="2xl" direction="column">
            <Stack gap="lg" direction="column">
              {rows.map((row) => (
                <Stack key={row.label} gap="2xs" direction="column">
                  <Text variant="label" color="textMuted">
                    {row.label}
                  </Text>
                  <Text variant="body">{row.value}</Text>
                </Stack>
              ))}
            </Stack>

            <Stack gap="sm" direction="column">
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

            <Stack gap="sm" direction="column">
              <Text variant="label" color="textMuted">
                Тема оформления
              </Text>
              <Stack direction="column" gap="none">
                {THEME_OPTIONS.map((option) => (
                  <OptionCell
                    key={option.value}
                    label={option.label}
                    description={option.description}
                    checked={theme === option.value}
                    onSelect={() => onThemeChange(option.value)}
                  />
                ))}
              </Stack>
            </Stack>

            <Stack gap="sm" direction="column">
              <Text variant="label" color="textMuted">
                Размер шрифта
              </Text>
              <Stack direction="column" gap="none">
                {FONT_SCALE_OPTIONS.map((option) => (
                  <OptionCell
                    key={option.value}
                    label={option.label}
                    description={option.description}
                    checked={fontScale === option.value}
                    onSelect={() => onFontScaleChange(option.value)}
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
      </div>
    </div>
  );
}
