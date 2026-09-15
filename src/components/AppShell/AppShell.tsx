import { Fragment, useState } from 'react';
import type { ReactNode } from 'react';
import { AppHeader, Button, Field, HeaderButton, HeaderDivider, HeaderLogo, HeaderTab, Input, Popover, Stack } from '@uralmash/design-system';
import { HelpModal } from '@/components/HelpModal/HelpModal';
import { Sidebar } from '@/components/Sidebar/Sidebar';
import type { SidebarView } from '@/components/Sidebar/Sidebar';
import logoSrc from '@/uztm-logo.png';
import styles from './AppShell.module.css';

/**
 * Открытая вкладка инженерного проекта. Список — потому что открытых
 * одновременно может быть несколько, как вкладок браузера: закрытие одной
 * не закрывает остальные, а уход на список не закрывает ни одну из них.
 */
export type ShellProjectTab = { id: string; name: string };

export type AppShellProps = {
  /** Открытые вкладки, в порядке открытия. Пусто — ни одна не открыта. */
  projectTabs: ShellProjectTab[];
  /**
   * id вкладки, которая сейчас показана на экране. `null` — показан раздел
   * приложения (сайдбар и его содержимое), а не открытый проект: вкладка
   * может оставаться открытой и не быть показанной, поэтому «открыта»
   * и «показана» — два разных состояния, как и раньше для одного проекта.
   */
  shownProjectId: string | null;
  /**
   * Страница проекта занимает экран. Не то же, что `shownProjectId`:
   * проект без единого расчёта показан окном ввода поверх списка, и под
   * окном остаётся обычный раздел приложения — вместе с сайдбаром.
   */
  projectOnScreen: boolean;
  /**
   * Ключ переключаемого содержимого — список проектов и каждый открытый
   * проект получают разные значения. Смена ключа перемонтирует обёртку и
   * проигрывает анимацию входа заново, поэтому и открытие, и закрытие
   * проекта, и переключение между вкладками выглядят одинаково плавным
   * переходом, а не мгновенной подменой.
   */
  contentKey: string;
  onGoProjects: () => void;
  /** Переключение на вкладку — клик по ней. */
  onSelectProject: (id: string) => void;
  onCloseProject: (id: string) => void;
  onRenameProject: (id: string, name: string) => void;
  onNewProject: () => void;
  /** Раздел приложения — сайдбар слева. Скрыт, пока открытый проект показан на экране: там должен быть виден только он. */
  view: SidebarView;
  onViewChange: (view: SidebarView) => void;
  children: ReactNode;
};

export function AppShell({
  projectTabs,
  shownProjectId,
  projectOnScreen,
  contentKey,
  onGoProjects,
  onSelectProject,
  onCloseProject,
  onRenameProject,
  onNewProject,
  view,
  onViewChange,
  children,
}: AppShellProps) {
  const [helpOpen, setHelpOpen] = useState(false);

  return (
    <div className={styles.shell}>
      <AppHeader>
        <AppHeader.Left>
          {/* Знак и есть переход на главную. Отдельной ячейки «домой» рядом
              нет — это было бы одно действие двумя элементами подряд. */}
          <HeaderLogo label="УЗТМ" active={!shownProjectId} onClick={onGoProjects}>
            <img className={styles.logo} src={logoSrc} alt="" />
          </HeaderLogo>

          {/* Вкладка проекта и действия над ним — одной ячейкой на каждый
              открытый проект, как вкладки браузера. Создание нового проекта
              стоит после всех: это следующий проект по счёту, а не действие
              над каким-то из открытых, и стоя перед вкладками оно разрывало
              бы их и их же кнопки. */}
          {projectTabs.length > 0 ? (
            <>
              <HeaderDivider />
              {projectTabs.map((tab, index) => (
                <Fragment key={tab.id}>
                  {index > 0 ? <HeaderDivider /> : null}
                  <HeaderTab
                    active={tab.id === shownProjectId}
                    onClick={() => onSelectProject(tab.id)}
                    actions={
                      <>
                        <RenameProject name={tab.name} onRename={(next) => onRenameProject(tab.id, next)} />
                        <Button
                          variant="ghost"
                          size="sm"
                          icon="x"
                          aria-label={`Закрыть проект: ${tab.name}`}
                          onClick={() => onCloseProject(tab.id)}
                        />
                      </>
                    }
                  >
                    {tab.name}
                  </HeaderTab>
                </Fragment>
              ))}
              <HeaderDivider />
            </>
          ) : null}

          <HeaderButton icon="plus" aria-label="Новый проект" onClick={onNewProject} />
        </AppHeader.Left>

        <AppHeader.Right>
          <HeaderButton icon="help" aria-label="Справка по параметрам" onClick={() => setHelpOpen(true)} />
        </AppHeader.Right>
      </AppHeader>

      <div className={styles.body}>
        {/* Только раздел приложения — не про открытый проект, поэтому
            прячется, когда проект показан на экране: там должен быть виден
            только он, а не список разделов рядом. Окно ввода поверх списка
            сайдбар не прячет: под окном по-прежнему раздел, а не проект. */}
        {!projectOnScreen ? (
          <Sidebar view={view} onViewChange={onViewChange} />
        ) : null}

        <main className={styles.main}>
          <div key={contentKey} className={styles.content}>
            {children}
          </div>
        </main>
      </div>

      <HelpModal open={helpOpen} onClose={() => setHelpOpen(false)} />
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
function RenameProject({ name, onRename }: { name: string; onRename: (next: string) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(name);

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
