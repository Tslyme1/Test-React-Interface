import { useState } from 'react';
import { useSession } from '@/state/useSession';
import { useProjects } from '@/state/useProjects';
import { useToast } from '@/components/Toast/useToast';
import { Toast } from '@/components/Toast/Toast';
import { AppShell } from '@/components/AppShell/AppShell';
import { LoginPage } from '@/pages/LoginPage';
import { ProjectsPage } from '@/pages/ProjectsPage';
import { NewProjectModal } from '@/pages/NewProjectModal';
import { WizardPage } from '@/pages/wizard/WizardPage';
import { defaultWizardData } from '@/data/wizardDefaults';
import type { Project } from '@/types';

export function App() {
  const { user, login, logout } = useSession();
  const { projects, trash, createProject, updateProject, removeProject, restoreProject, purgeProject } =
    useProjects();
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
  const goProjects = () => setProjectShown(false);

  const closeProject = () => {
    setActiveProjectId(null);
    setProjectShown(false);
  };

  return (
    <>
      <AppShell
        user={user}
        project={activeProject ? { name: activeProject.name, active: projectShown } : null}
        onGoProjects={goProjects}
        onOpenProject={() => setProjectShown(true)}
        onCloseProject={activeProject ? closeProject : undefined}
        onRenameProject={
          activeProject ? (name) => updateProject(activeProject.id, { name }) : undefined
        }
        onNewProject={() => setNewProjectOpen(true)}
        onLogout={logout}
      >
        {activeProject && projectShown ? (
          <WizardPage project={activeProject} onUpdateProject={updateProject} showToast={showToast} />
        ) : (
          <ProjectsPage
            projects={projects}
            trash={trash}
            onOpenProject={openProject}
            onRemoveProject={(id) => {
              /* Удалённый проект не может остаться открытым: вкладка вела бы
                 в корзину. */
              if (id === activeProjectId) closeProject();
              removeProject(id);
            }}
            onRestoreProject={restoreProject}
            onPurgeProject={purgeProject}
            onNewProject={() => setNewProjectOpen(true)}
          />
        )}
      </AppShell>

      <NewProjectModal
        open={newProjectOpen}
        onClose={() => setNewProjectOpen(false)}
        defaultExecutor={user.name}
        onCreate={(input) => {
          const project = createProject({ ...input, data: defaultWizardData() });
          setNewProjectOpen(false);
          openProject(project);
          showToast(`Проект «${project.name}» создан`);
          // Проба руды здесь не спрашивается — её выбирают на шаге «Грансостав».
        }}
      />

      <Toast message={message} />
    </>
  );
}
