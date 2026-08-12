import { Surface, Stack, Text, Icon } from '@uralmash/design-system';
import styles from './Toast.module.css';

export function Toast({ message }: { message: string | null }) {
  if (!message) return null;

  return (
    <div className={styles.host}>
      <Surface level="overlay" radius="md" padding="md" background="surface">
        <Stack direction="row" gap="sm" align="center">
          <Icon name="check" size="sm" color="successText" />
          <Text variant="body">{message}</Text>
        </Stack>
      </Surface>
    </div>
  );
}
