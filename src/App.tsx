import { useState } from 'react';
import { useSession } from '@/state/useSession';
import { useProjects } from '@/state/useProjects';
import { useToast } from '@/components/Toast/useToast';
import { Toast } from '@/components/Toast/Toast';
import { AppShell } from '@/components/AppShell/AppShell';
import type { SidebarView } from '@/components/Sidebar/Sidebar';
import { LoginPage } from '@/pages/LoginPage';
import { ProjectsPage } from '@/pages/ProjectsPage';
import { CustomersPage } from '@/pages/CustomersPage';
import { ProfilePage } from '@/pages/ProfilePage';
import { NewProjectModal } from '@/pages/NewProjectModal';
import { SimplifiedProjectModal } from '@/pages/SimplifiedProjectModal';
import { WizardPage } from '@/pages/wizard/WizardPage';
import { defaultWizardData } from '@/data/wizardDefaults';
import type { Project, ProjectMode } from '@/types';

export function App() {
  const { user, login, logout } = useSession();
  const {
    projects,
    trash,
    createProject,
    updateProject,
    forkProject,
    removeProject,
    restoreProject,
    purgeProject,
  } = useProjects();
  const { message, showToast } = useToast();

  /**
   * Открытые вкладки инженерных проектов — как вкладки браузера: список id
   * в порядке открытия, и какая из них показана сейчас. Несколько проектов
   * могут быть открыты одновременно; закрывает вкладку только крестик на
   * ней самой, а не переключение на другую или уход на список. Касается
   * только инженерного режима: упрощённый работает через `simplifiedFlow`
   * ниже и никогда не занимает собой весь экран, поэтому вкладок не заводит.
   *
   * `shownProjectId: null` — виден раздел приложения (сайдбар и его
   * содержимое), а не какой-то из открытых проектов; открытые вкладки при
   * этом никуда не деваются, только временно не показаны.
   *
   * В памяти, а не в хранилище: перезагрузка страницы — это начало сеанса
   * заново, и восстанавливать поверх неё открытые вкладки значило бы решать
   * за пользователя, где он остановился.
   */
  const [openTabs, setOpenTabs] = useState<string[]>([]);
  const [shownProjectId, setShownProjectId] = useState<string | null>(null);
  const [newProjectOpen, setNewProjectOpen] = useState(false);

  /**
   * Упрощённый режим целиком живёт в одном окне (`SimplifiedProjectModal`):
   * список проектов остаётся на экране, окно поверх него открывает,
   * продолжает и завершает расчёт, не подменяя собой главную. `projectId`
   * пуст, пока проект создаётся — окно в этот момент ещё не привязано
   * ни к какой записи.
   */
  const [simplifiedFlow, setSimplifiedFlow] = useState<{ open: boolean; projectId: string | null }>({
    open: false,
    projectId: null,
  });

  /** Раздел сайдбара. Открытый и показанный инженерный проект временно перекрывает его — сайдбар в этот момент скрыт целиком. */
  const [view, setView] = useState<SidebarView>('projects');
  /** Режим следующего нового проекта — задаётся переключателем в «Профиле». */
  const [defaultMode, setDefaultMode] = useState<ProjectMode>('engineering');
  /**
   * Заказчик, из которого провалились со страницы «Заказчики» — держится,
   * пока список проектов им отфильтрован, а не на один переход: пока фильтр
   * активен, в сайдбаре должен подсвечиваться пункт «Заказчики», а не
   * «Проекты», хотя сам список рисует `ProjectsPage`.
   */
  const [customerFilter, setCustomerFilter] = useState<string | null>(null);
  /** Пункт сайдбара с поправкой на «мы всё ещё внутри заказчика». */
  const sidebarView: SidebarView = customerFilter !== null ? 'customers' : view;

  if (!user) {
    return (
      <>
        <LoginPage
          onLogin={login}
          onGoRegister={() => showToast('Регистрация — в следующей итерации')}
          onGoForgot={() => showToast('Восстановление пароля — в следующей итерации')}
        />
        <Toast message={message} />
      </>
    );
  }

  /** Открытые вкладки — сами проекты, в порядке `openTabs`. Проект, которого больше нет (удалён), молча выпадает из полосы. */
  const openProjects = openTabs
    .map((id) => projects.find((p) => p.id === id))
    .filter((p): p is Project => Boolean(p));
  const shownProject = projects.find((p) => p.id === shownProjectId) ?? null;
  const simplifiedProject = projects.find((p) => p.id === simplifiedFlow.projectId) ?? null;

  const openProject = (project: Project) => {
    if (project.mode === 'simplified') {
      setSimplifiedFlow({ open: true, projectId: project.id });
      return;
    }
    setOpenTabs((prev) => (prev.includes(project.id) ? prev : [...prev, project.id]));
    setShownProjectId(project.id);
  };

  /** Уход на список. Открытые вкладки остаются — их закрывает только крестик на них самих. */
  const goProjects = () => {
    setShownProjectId(null);
    setView('projects');
  };

  /**
   * Закрытие вкладки. Если закрыли ту, что была показана, — переключение
   * на соседнюю справа (а если закрыли последнюю — на соседнюю слева), тем
   * же приёмом, что и у вкладок браузера: человек чаще продолжает работать
   * рядом с тем, что только что закрыл, чем возвращается к списку.
   */
  const closeProject = (id: string) => {
    const idx = openTabs.indexOf(id);
    const nextTabs = openTabs.filter((t) => t !== id);
    setOpenTabs(nextTabs);
    if (shownProjectId === id) {
      setShownProjectId(nextTabs[idx] ?? nextTabs[idx - 1] ?? null);
    }
  };

  /**
   * Переход по сайдбару — раздел приложения, а не открытый проект: открытые
   * вкладки остаются, но ни одна не показана. Клик по сайдбару всегда
   * осознанный уход из текущего места, поэтому попутно снимает фильтр по
   * заказчику — иначе клик по «Проекты» из отфильтрованного списка не
   * отличался бы от простого пролистывания той же страницы.
   */
  const goView = (next: SidebarView) => {
    setView(next);
    setShownProjectId(null);
    setCustomerFilter(null);
  };

  const startNewProject = () => {
    if (defaultMode === 'simplified') {
      setSimplifiedFlow({ open: true, projectId: null });
    } else {
      setNewProjectOpen(true);
    }
  };

  return (
    <>
      <AppShell
        projectTabs={openProjects.map((p) => ({ id: p.id, name: p.name }))}
        shownProjectId={shownProjectId}
        contentKey={shownProject ? `project:${shownProject.id}` : `view:${view}`}
        onGoProjects={goProjects}
        onSelectProject={setShownProjectId}
        onCloseProject={closeProject}
        onRenameProject={(id, name) => updateProject(id, { name })}
        onNewProject={startNewProject}
        view={sidebarView}
        onViewChange={goView}
        trash={trash}
        onRestoreProject={restoreProject}
        onPurgeProject={purgeProject}
      >
        {shownProject ? (
          <WizardPage
            project={shownProject}
            onUpdateProject={updateProject}
            onForkProject={forkProject}
            onOpenProject={openProject}
            showToast={showToast}
          />
        ) : view === 'customers' ? (
          <CustomersPage
            projects={projects}
            onOpenCustomer={(customer) => {
              /*
               * Не через `goView`: тот всегда снимает фильтр по заказчику,
               * а сюда мы как раз его ставим. Раздел контента переключается
               * на «Проекты» (`view`), а сайдбар всё равно подсветит
               * «Заказчики» — это делает `sidebarView` выше, глядя на сам
               * `customerFilter`, а не на `view`.
               */
              setView('projects');
              setCustomerFilter(customer);
            }}
          />
        ) : view === 'profile' ? (
          <ProfilePage user={user} mode={defaultMode} onModeChange={setDefaultMode} onLogout={logout} />
        ) : (
          <ProjectsPage
            projects={projects}
            onOpenProject={openProject}
            onRemoveProject={(id) => {
              /* Удалённый проект не может остаться открытым: вкладка вела бы
                 в корзину. */
              if (openTabs.includes(id)) closeProject(id);
              removeProject(id);
            }}
            onNewProject={startNewProject}
            initialCustomerFilter={customerFilter}
            onCustomerFilterChange={setCustomerFilter}
          />
        )}
      </AppShell>

      <NewProjectModal
        open={newProjectOpen}
        onClose={() => setNewProjectOpen(false)}
        defaultExecutor={user.name}
        onCreate={(input) => {
          const project = createProject({ ...input, mode: 'engineering', data: defaultWizardData() });
          setNewProjectOpen(false);
          openProject(project);
          showToast(`Проект «${project.name}» создан`);
          // Проба руды здесь не спрашивается — её выбирают на шаге «Грансостав».
        }}
      />

      <SimplifiedProjectModal
        open={simplifiedFlow.open}
        onClose={() => setSimplifiedFlow({ open: false, projectId: null })}
        project={simplifiedProject}
        defaultExecutor={user.name}
        onCreate={(input) => {
          const project = createProject({ ...input, mode: 'simplified', data: defaultWizardData() });
          setSimplifiedFlow({ open: true, projectId: project.id });
          return project;
        }}
        onUpdateProject={updateProject}
        showToast={showToast}
      />

      <Toast message={message} />
    </>
  );
}
