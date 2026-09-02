import { useState } from 'react';
import type { ReactNode } from 'react';
import {
  AppHeader,
  Button,
  EmptyState,
  Field,
  HeaderButton,
  HeaderDivider,
  HeaderLogo,
  HeaderTab,
  Input,
  Modal,
  Popover,
  Stack,
  Table,
} from '@uralmash/design-system';
import type { Project } from '@/types';
import { Sidebar } from '@/components/Sidebar/Sidebar';
import type { SidebarView } from '@/components/Sidebar/Sidebar';
import logoSrc from '@/uztm-logo.png';
import styles from './AppShell.module.css';

/**
 * Открытый проект. `active` — показан ли он сейчас: проект остаётся открытым
 * и когда пользователь ушёл на главную, поэтому «проект открыт» и «мы в нём»
 * это два разных состояния.
 */
export type ShellProject = { name: string; active: boolean };

export type AppShellProps = {
  project?: ShellProject | null;
  /**
   * Ключ переключаемого содержимого — список проектов и открытый проект
   * получают разные значения. Смена ключа перемонтирует обёртку и
   * проигрывает анимацию входа заново, поэтому и открытие, и закрытие
   * проекта выглядят одинаково плавным переходом, а не мгновенной подменой.
   */
  contentKey: string;
  onGoProjects: () => void;
  /** Вернуться в открытый проект — нажатие по самой вкладке. */
  onOpenProject?: () => void;
  onCloseProject?: () => void;
  onRenameProject?: (name: string) => void;
  onNewProject: () => void;
  /** Раздел приложения — сайдбар слева. Скрыт, пока открытый проект показан на экране: там должен быть виден только он. */
  view: SidebarView;
  onViewChange: (view: SidebarView) => void;
  trash: Project[];
  onRestoreProject: (id: string) => void;
  onPurgeProject: (id: string) => void;
  children: ReactNode;
};

export function AppShell({
  project,
  contentKey,
  onGoProjects,
  onOpenProject,
  onCloseProject,
  onRenameProject,
  onNewProject,
  view,
  onViewChange,
  trash,
  onRestoreProject,
  onPurgeProject,
  children,
}: AppShellProps) {
  const [trashOpen, setTrashOpen] = useState(false);

  return (
    <div className={styles.shell}>
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
                      <Button variant="ghost" size="sm" icon="x" aria-label="Закрыть проект" onClick={onCloseProject} />
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
      </AppHeader>

      <div className={styles.body}>
        {/* Только раздел приложения — не про открытый проект, поэтому
            прячется, когда проект показан на экране: там должен быть виден
            только он, а не список разделов рядом. */}
        {!project?.active ? (
          <Sidebar view={view} onViewChange={onViewChange} trashCount={trash.length} onOpenTrash={() => setTrashOpen(true)} />
        ) : null}

        <main className={styles.main}>
          <div key={contentKey} className={styles.content}>
            {children}
          </div>
        </main>
      </div>

      <Modal
        open={trashOpen}
        onClose={() => setTrashOpen(false)}
        title={`Корзина — ${trash.length}`}
        size="lg"
        footer={
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setTrashOpen(false)}>
              Закрыть
            </Button>
          </Modal.Footer>
        }
      >
        <Table
          columns={[
            { key: 'crusherName', title: 'Дробилка' },
            { key: 'customer', title: 'Заказчик' },
            { key: 'code', title: 'Код проекта' },
            { key: 'date', title: 'Дата' },
            {
              key: 'actions',
              title: '',
              align: 'end',
              render: (row) => (
                <Stack direction="row" gap="2xs" justify="end">
                  <Button variant="ghost" size="sm" iconStart="upload" onClick={() => onRestoreProject(row.id)}>
                    Восстановить
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    icon="trash"
                    aria-label={`Удалить безвозвратно: ${row.crusherName}`}
                    onClick={() => onPurgeProject(row.id)}
                  />
                </Stack>
              ),
            },
          ]}
          rows={trash}
          rowKey={(row) => row.id}
          caption="Удалённые проекты"
          empty={
            <EmptyState
              icon="trash"
              title="Корзина пуста"
              description="Удалённые проекты попадают сюда, и их можно вернуть."
            />
          }
        />
      </Modal>
    </div>
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
        <Button
          variant="ghost"
          size="sm"
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
