import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  AppHeader,
  Cell,
  HeaderButton,
  HeaderDivider,
  HeaderLogo,
  Icon,
  Popover,
  Stack,
  Text,
} from '@uralmash/design-system';
import type { User } from '@/types';
import logoSrc from '@/uztm-logo.png';
import styles from './AppShell.module.css';

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
        <AppHeader.Left>
          {/* Знак и есть переход на главную. Отдельной ячейки «домой» рядом
              нет — это было бы одно действие двумя элементами подряд. */}
          <HeaderLogo label="УЗТМ" active={!currentProjectName} onClick={onGoProjects}>
            <img className={styles.logo} src={logoSrc} alt="" />
          </HeaderLogo>

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
        </AppHeader.Left>

        <AppHeader.Right>
          {/* Ячейки «Проекты» здесь нет: на главную ведёт знак слева, и
              вторая точка входа в то же место стояла в полосе просто так —
              из неё нельзя было понять, чем она отличается от знака. */}
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
              {/* Строка меню — `Cell`, а не кнопка: у кнопки содержимое стоит
                  по центру, и в списке подписи не выстраиваются в столбец. */}
              <Cell
                leading={<Icon name="logOut" size="sm" />}
                onClick={() => {
                  setMenuOpen(false);
                  onLogout();
                }}
              >
                Выйти
              </Cell>
            </Stack>
          </Popover>
        </AppHeader.Right>
      </AppHeader>

      <main className={styles.main}>{children}</main>
    </Stack>
  );
}
