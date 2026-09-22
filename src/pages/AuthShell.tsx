import type { ReactNode } from 'react';
import { Stack, Surface, Text } from '@uralmash/design-system';
import logoSrc from '@/uztm-logo.png';
import styles from './AuthShell.module.css';

export type AuthShellProps = {
  title: string;
  /**
   * Строка под заголовком — чего от пользователя ждут на этом шаге.
   * Нужна с тех пор, как вход разделён надвое: без неё второй шаг
   * («Режим работы») выглядел бы началом другого экрана, а не
   * продолжением того же входа.
   */
  subtitle?: string;
  /**
   * Широкая карточка — для шага выбора режима: в нём две карточки
   * со схемами стоят рядом, и в ширине формы входа они не помещаются.
   */
  wide?: boolean;
  children: ReactNode;
};

export function AuthShell({ title, subtitle, wide = false, children }: AuthShellProps) {
  return (
    <Stack direction="column" align="center" justify="center" grow>
      <div className={wide ? `${styles.card} ${styles.wide}` : styles.card}>
        <Surface padding="2xl">
          <Stack gap="xl" direction="column">
            <Stack gap="xs" direction="column" align="center">
              <img className={styles.logo} src={logoSrc} alt="УЗТМ" />
              <Text variant="headingMd" align="center">
                {title}
              </Text>
              {subtitle ? (
                <Text variant="bodySm" color="textMuted" align="center">
                  {subtitle}
                </Text>
              ) : null}
            </Stack>
            <Stack gap="lg" direction="column">
              {children}
            </Stack>
          </Stack>
        </Surface>
      </div>
    </Stack>
  );
}
