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
   * Открытый проект и то, показан ли он сейчас, — два разных состояния.
   *
   * Возврат на главную закрывал проект: вкладка исчезала из шапки, и всё,
   * что человек считал открытым, приходилось открывать заново. Уход
   * на список — это переключение, а не закрытие; закрывает проект только
   * крестик на его вкладке.
   *
   * В памяти, а не в хранилище: перезагрузка страницы — это начало сеанса
   * заново, и восстанавливать поверх неё открытую вкладку значило бы решать
   * за пользователя, где он остановился.
   */
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
  const [projectShown, setProjectShown] = useState(false);
  const [newProjectOpen, setNewProjectOpen] = useState(false);

  /** Раздел сайдбара. Открытый и показанный проект временно перекрывает его — так же, как раньше перекрывал список. */
  const [view, setView] = useState<SidebarView>('projects');
  /** Режим следующего нового проекта — задаётся переключателем в сайдбаре, пока ни один проект не открыт. */
  const [defaultMode, setDefaultMode] = useState<ProjectMode>('engineering');
  /** Заказчик, с которого перешли со страницы «Заказчики» — на один переход. */
  const [customerFilter, setCustomerFilter] = useState<string | null>(null);

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

  const activeProject = projects.find((p) => p.id === activeProjectId) ?? null;

  const openProject = (project: Project) => {
    setActiveProjectId(project.id);
    setProjectShown(true);
  };

  /** Уход на список. Проект остаётся открытым — его вкладка никуда не девается. */
  const goProjects = () => {
    setProjectShown(false);
    setView('projects');
  };

  const closeProject = () => {
    setActiveProjectId(null);
    setProjectShown(false);
  };

  /** Переход по сайдбару — раздел приложения, а не открытый проект: вкладка проекта остаётся, но с глаз уходит. */
  const goView = (next: SidebarView) => {
    setView(next);
    setProjectShown(false);
  };

  return (
    <>
      <AppShell
        user={user}
        project={activeProject ? { name: activeProject.name, active: projectShown } : null}
        contentKey={activeProject && projectShown ? `project:${activeProject.id}` : `view:${view}`}
        onGoProjects={goProjects}
        onOpenProject={() => setProjectShown(true)}
        onCloseProject={activeProject ? closeProject : undefined}
        onRenameProject={
          activeProject ? (name) => updateProject(activeProject.id, { name }) : undefined
        }
        onNewProject={() => setNewProjectOpen(true)}
        onLogout={logout}
        view={view}
        onViewChange={goView}
        mode={activeProject ? activeProject.mode : defaultMode}
        modeLocked={Boolean(activeProject)}
        onModeChange={setDefaultMode}
        trash={trash}
        onRestoreProject={restoreProject}
        onPurgeProject={purgeProject}
      >
        {activeProject && projectShown ? (
          <WizardPage
            project={activeProject}
            onUpdateProject={updateProject}
            onForkProject={forkProject}
            onOpenProject={openProject}
            showToast={showToast}
          />
        ) : view === 'customers' ? (
          <CustomersPage
            projects={projects}
            onOpenCustomer={(customer) => {
              setCustomerFilter(customer);
              goView('projects');
            }}
          />
        ) : view === 'profile' ? (
          <ProfilePage user={user} />
        ) : (
          <ProjectsPage
            projects={projects}
            onOpenProject={openProject}
            onRemoveProject={(id) => {
              /* Удалённый проект не может остаться открытым: вкладка вела бы
                 в корзину. */
              if (id === activeProjectId) closeProject();
              removeProject(id);
            }}
            onNewProject={() => setNewProjectOpen(true)}
            initialCustomerFilter={customerFilter}
            onConsumeInitialCustomerFilter={() => setCustomerFilter(null)}
          />
        )}
      </AppShell>

      <NewProjectModal
        open={newProjectOpen}
        onClose={() => setNewProjectOpen(false)}
        defaultExecutor={user.name}
        mode={defaultMode}
        onCreate={(input) => {
          const project = createProject({ ...input, data: defaultWizardData() });
          setNewProjectOpen(false);
          openProject(project);
          showToast(`Проект «${project.name}» создан`);
          // Проба руды здесь не спрашивается — её выбирают на шаге «Грансостав»/«Руда».
        }}
      />

      <Toast message={message} />
    </>
  );
}
