import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  AppHeader,
  HeaderButton,
  HeaderDivider,
  HeaderSpacer,
  Popover,
  Stack,
  Text,
  Button,
} from '@uralmash/design-system';
import type { User } from '@/types';

export type AppShellProps = {
  user: User;
  currentProjectName?: string | null;
  onGoProjects: () => void;
  onNewProject: () => void;
  onCloseProject?: () => void;
  onLogout: () => void;
  children: ReactNode;
};

export function AppShell({
  user,
  currentProjectName,
  onGoProjects,
  onNewProject,
  onCloseProject,
  onLogout,
  children,
}: AppShellProps) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
    <Stack direction="column" grow>
      <AppHeader>
        <HeaderButton icon="home" active={!currentProjectName} onClick={onGoProjects}>
          Проекты
        </HeaderButton>
        <HeaderButton icon="plus" aria-label="Новый проект" onClick={onNewProject} />

        {currentProjectName ? (
          <>
            <HeaderDivider />
            <HeaderButton active>{currentProjectName}</HeaderButton>
            {onCloseProject ? (
              <HeaderButton icon="x" aria-label="Закрыть проект" onClick={onCloseProject} />
            ) : null}
          </>
        ) : null}

        <HeaderSpacer />

        <Popover
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          placement="bottom-end"
          width="sm"
          trigger={
            <HeaderButton icon="user" expandable onClick={() => setMenuOpen((v) => !v)}>
              {user.name.split(' ')[0]}
            </HeaderButton>
          }
        >
          <Stack gap="xs" direction="column">
            <Stack gap="none" direction="column">
              <Text variant="label">{user.name}</Text>
              <Text variant="caption" color="textMuted">
                {user.role}
              </Text>
            </Stack>
            <Button
              variant="ghost"
              size="sm"
              iconStart="logOut"
              fullWidth
              onClick={() => {
                setMenuOpen(false);
                onLogout();
              }}
            >
              Выйти
            </Button>
          </Stack>
        </Popover>
      </AppHeader>

      <Stack direction="column" grow as="main">
        {children}
      </Stack>
    </Stack>
  );
}
