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
  const { projects, createProject, updateProject, removeProject } = useProjects();
  const { message, showToast } = useToast();

  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
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

  const openProject = (project: Project) => setActiveProjectId(project.id);
  const goProjects = () => setActiveProjectId(null);

  return (
    <>
      <AppShell
        user={user}
        currentProjectName={activeProject?.name}
        onGoProjects={goProjects}
        onNewProject={() => setNewProjectOpen(true)}
        onCloseProject={activeProject ? goProjects : undefined}
        onLogout={logout}
      >
        {activeProject ? (
          <WizardPage project={activeProject} onUpdateProject={updateProject} showToast={showToast} />
        ) : (
          <ProjectsPage
            projects={projects}
            onOpenProject={openProject}
            onRemoveProject={(id) => {
              if (id === activeProjectId) setActiveProjectId(null);
              removeProject(id);
            }}
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
          setActiveProjectId(project.id);
          showToast(`Проект «${project.name}» создан`);
        }}
      />

      <Toast message={message} />
    </>
  );
}
