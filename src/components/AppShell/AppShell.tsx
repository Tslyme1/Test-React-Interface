import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  AppHeader,
  Button,
  Cell,
  Field,
  HeaderButton,
  HeaderDivider,
  HeaderLogo,
  HeaderTab,
  Icon,
  Input,
  Popover,
  Stack,
  Text,
} from '@uralmash/design-system';
import type { User } from '@/types';
import logoSrc from '@/uztm-logo.png';
import styles from './AppShell.module.css';

/**
 * Открытый проект. `active` — показан ли он сейчас: проект остаётся открытым
 * и когда пользователь ушёл на главную, поэтому «проект открыт» и «мы в нём»
 * это два разных состояния.
 */
export type ShellProject = { name: string; active: boolean };

export type AppShellProps = {
  user: User;
  project?: ShellProject | null;
  onGoProjects: () => void;
  /** Вернуться в открытый проект — нажатие по самой вкладке. */
  onOpenProject?: () => void;
  onCloseProject?: () => void;
  onRenameProject?: (name: string) => void;
  onNewProject: () => void;
  onLogout: () => void;
  children: ReactNode;
};

export function AppShell({
  user,
  project,
  onGoProjects,
  onOpenProject,
  onCloseProject,
  onRenameProject,
  onNewProject,
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
          <HeaderLogo label="УЗТМ" active={!project?.active} onClick={onGoProjects}>
            <img className={styles.logo} src={logoSrc} alt="" />
          </HeaderLogo>

          {/* Вкладка открытого проекта и действия над ним — одной ячейкой.
              Создание нового проекта стоит после неё: это следующий проект
              по счёту, а не действие над открытым, и стоя перед вкладкой
              оно разрывало бы проект и его же кнопки. */}
          {project ? (
            <>
              <HeaderDivider />
              <HeaderTab
                active={project.active}
                onClick={onOpenProject}
                actions={
                  <>
                    <RenameProject name={project.name} onRename={onRenameProject} />
                    {onCloseProject ? (
                      <HeaderButton chrome="close" aria-label="Закрыть проект" onClick={onCloseProject} />
                    ) : null}
                  </>
                }
              >
                {project.name}
              </HeaderTab>
              <HeaderDivider />
            </>
          ) : null}

          <HeaderButton icon="plus" aria-label="Новый проект" onClick={onNewProject} />
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

/**
 * Переименование проекта — поповер у шеврона внутри вкладки.
 *
 * Имя правится там же, где стоит: уводить ради одного поля в модальное окно
 * значило бы закрыть собой то самое место, к которому имя относится.
 *
 * Правка применяется по «Сохранить», а не на каждое нажатие клавиши: иначе
 * вкладка переписывается посреди набора и проходит через пустое имя между
 * стиранием старого и вводом нового.
 */
function RenameProject({ name, onRename }: { name: string; onRename?: (next: string) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(name);

  if (!onRename) return null;

  const start = () => {
    /* Черновик заводится от текущего имени при каждом открытии: брошенная
       в прошлый раз правка не должна всплывать в следующий. */
    setDraft(name);
    setOpen(true);
  };

  const save = () => {
    const clean = draft.trim();
    /* Пустое имя не сохраняется: вкладка без подписи — та, которую нельзя
       ни узнать, ни найти. */
    if (clean) onRename(clean);
    setOpen(false);
  };

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      placement="bottom-start"
      width="md"
      trigger={
        <HeaderButton
          icon="chevronDown"
          aria-label="Переименовать проект"
          onClick={() => (open ? setOpen(false) : start())}
        />
      }
    >
      <Stack gap="md" direction="column">
        <Field label="Название проекта" fullWidth>
          {(props) => (
            <Input
              {...props}
              fullWidth
              size="sm"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                /* Иначе нажатие доигрывается дальше: панель к этому моменту
                   закрыта, и действие по умолчанию достаётся тому, что
                   оказалось под фокусом. */
                event.preventDefault();
                save();
              }}
            />
          )}
        </Field>

        <Button variant="primary" size="sm" fullWidth disabled={!draft.trim()} onClick={save}>
          Сохранить
        </Button>
      </Stack>
    </Popover>
  );
}
