import { useState } from 'react';
import { Button, Cell, Field, Icon, Modal, Stack, Text } from '@uralmash/design-system';
import type { ToastTone } from '@uralmash/design-system';
import { ModeChoice } from '@/components/ModeChoice/ModeChoice';
import { OptionCell } from '@/components/OptionCell/OptionCell';
import { HowToModal } from '@/components/HowToModal/HowToModal';
import type { FontScalePreference } from '@/state/useFontScale';
import type { ThemePreference } from '@/state/useTheme';
import { workMode } from '@/data/workModes';
import type { ProjectMode, User } from '@/types';
import styles from './SettingsPage.module.css';

export type SettingsPageProps = {
  user: User;
  /** Режим следующего нового проекта — переключатель здесь, а не в сайдбаре: это настройка профиля, а не переход. */
  mode: ProjectMode;
  onModeChange: (mode: ProjectMode) => void;
  theme: ThemePreference;
  onThemeChange: (theme: ThemePreference) => void;
  fontScale: FontScalePreference;
  onFontScaleChange: (scale: FontScalePreference) => void;
  onLogout: () => void;
  showToast: (message: string, tone?: ToastTone) => void;
};

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
 * «Настройки», а не «Профиль»: на странице четыре строки учётной записи
 * и четыре группы настроек — тема, размер шрифта, режим работы, справка.
 * Раздел, названный по одной своей строке, отвечал на вопрос «где менять
 * отображение» отрицательно, хотя менять его надо именно здесь.
 *
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
export function SettingsPage({
  user,
  mode,
  onModeChange,
  theme,
  onThemeChange,
  fontScale,
  onFontScaleChange,
  onLogout,
  showToast,
}: SettingsPageProps) {
  const rows: { label: string; value: string }[] = [
    { label: 'Имя', value: user.name },
    { label: 'Почта', value: user.email || '—' },
    { label: 'Логин', value: user.login },
    { label: 'Роль', value: user.role },
  ];

  /**
   * Выбор внутри окна, ещё не применённый. `null` — окно закрыто.
   *
   * Отдельно от применённого режима, потому что окно открывается на
   * текущем значении и до «Сменить» ничего не меняет: режим определяет
   * форму всех трёх шагов визарда, и уехать в другой режим, просто
   * заглянув в карточки, нельзя.
   */
  const [pendingMode, setPendingMode] = useState<ProjectMode | null>(null);
  const [howToOpen, setHowToOpen] = useState(false);

  const confirmModeChange = () => {
    if (!pendingMode) return;
    /* Открыли окно, посмотрели и закрыли «Сменить», ничего не выбрав, —
       менять нечего, и сообщать об изменении тем более. */
    if (pendingMode === mode) {
      setPendingMode(null);
      return;
    }
    onModeChange(pendingMode);
    setPendingMode(null);
    showToast(`Режим работы изменён на «${workMode(pendingMode).label}»`, 'success');
  };

  return (
    <div className={styles.root}>
      <div className={styles.header}>
        <Text variant="headingMd" as="h1">
          Настройки
        </Text>
      </div>

      <div className={styles.scroll}>
        <div className={styles.page}>
          <Stack gap="2xl" direction="column">
            <Stack gap="sm" direction="column">
              {/* Подпись группы — та же, что у настроек ниже: под общим
                  заголовком «Настройки» четыре строки учётной записи без
                  неё читались бы как первая настройка. */}
              <Text variant="label" color="textMuted">
                Учётная запись
              </Text>
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
            </Stack>

            <Cell leading={<Icon name="help" size="sm" />} onClick={() => setHowToOpen(true)}>
              Как пользоваться программой
            </Cell>

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

            {/* Одно поле, а не две строки на всю ширину: режим меняют
                редко, и развёрнутый выбор занимал в списке настроек
                столько же места, сколько тема и кегль вместе. Разбор,
                чем режимы отличаются, переехал в окно — там для него
                есть место, и это те же карточки, что при входе, а не
                вторая, более короткая версия объяснения. */}
            <Field label="Режим работы нового проекта" hint="Затрагивает только следующий новый проект">
              {(props) => (
                <Button
                  {...props}
                  variant="secondary"
                  fullWidth
                  iconEnd="chevronDown"
                  aria-haspopup="dialog"
                  onClick={() => setPendingMode(mode)}
                >
                  {workMode(mode).label}
                </Button>
              )}
            </Field>

            <div>
              <Button variant="secondary" iconStart="logOut" onClick={onLogout}>
                Выйти
              </Button>
            </div>
          </Stack>
        </div>
      </div>

      <Modal
        open={pendingMode !== null}
        onClose={() => setPendingMode(null)}
        /* Заголовок окна — действие, а не имя поля под ним: одинаковая
           строка на поле, окне и группе внутри него означала бы для
           скринридера три разных элемента с одним именем. */
        title="Сменить режим работы"
        size="lg"
        footer={
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setPendingMode(null)}>
              Отмена
            </Button>
            <Button variant="primary" onClick={confirmModeChange}>
              Сменить
            </Button>
          </Modal.Footer>
        }
      >
        <Stack gap="lg" direction="column">
          {/* Те же карточки, что на втором шаге входа: выбор один и тот же,
              и объяснять его двумя разными способами значило бы дать два
              разных обещания. */}
          <ModeChoice
            name="settings-mode"
            label="Режим работы"
            value={pendingMode ?? mode}
            onChange={setPendingMode}
          />

          <Text variant="bodySm" color="textMuted">
            Затрагивает только следующий новый проект — уже созданные останутся в своём режиме.
          </Text>
        </Stack>
      </Modal>

      <HowToModal open={howToOpen} onClose={() => setHowToOpen(false)} mode={mode} />
    </div>
  );
}
