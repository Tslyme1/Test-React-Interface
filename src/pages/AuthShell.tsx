import type { ReactNode } from 'react';
import { Stack, Surface, Text } from '@uralmash/design-system';
import styles from './AuthShell.module.css';

export function AuthShell({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Stack direction="column" align="center" justify="center" grow>
      <div className={styles.card}>
        <Surface padding="2xl">
          <Stack gap="xl" direction="column">
            <Stack gap="xs" direction="column" align="center">
              <img className={styles.logo} src="/assets/uztm-logo.png" alt="УЗТМ" />
              <Text variant="headingMd" align="center">
                {title}
              </Text>
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
