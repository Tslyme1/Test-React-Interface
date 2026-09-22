import { useState } from 'react';
import { Button, Modal, Text } from '@uralmash/design-system';
import { useSession } from '@/state/useSession';
import { useTheme } from '@/state/useTheme';
import { useFontScale } from '@/state/useFontScale';
import { useProjects } from '@/state/useProjects';
import { useToast } from '@/components/Toast/useToast';
import { Toast } from '@/components/Toast/Toast';
import { commitStaleSteps, discardStaleSteps, hasUncalculatedChanges } from '@/domain/steps';
import { AppShell } from '@/components/AppShell/AppShell';
import type { SidebarView } from '@/components/Sidebar/Sidebar';
import { LoginPage } from '@/pages/LoginPage';
import { ProjectsPage } from '@/pages/ProjectsPage';
import { CustomersPage } from '@/pages/CustomersPage';
import { SettingsPage } from '@/pages/SettingsPage';
import { TrashPage } from '@/pages/TrashPage';
import { NewProjectModal } from '@/pages/NewProjectModal';
import { SimplifiedProjectModal } from '@/pages/SimplifiedProjectModal';
import { WizardPage } from '@/pages/wizard/WizardPage';
import { defaultWizardData } from '@/data/wizardDefaults';
import { applyCrusherToGeom } from '@/domain/crusherGeom';
import type { Project } from '@/types';

export function App() {
  const { user, mode: defaultMode, setMode: setDefaultMode, login, logout } = useSession();
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
  const { message, tone, showToast } = useToast();
  const { theme, setTheme } = useTheme();
  const { scale: fontScale, setScale: setFontScale } = useFontScale();

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
   * Вкладка, закрытие которой ждёт подтверждения, — id проекта, у которого
   * посчитанный шаг разошёлся со снимком на момент расчёта
   * (`hasUncalculatedChanges`). `null` — подтверждать нечего, крестик
   * закрывает вкладку сразу.
   */
  const [closeConfirmId, setCloseConfirmId] = useState<string | null>(null);

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
          defaultMode={defaultMode}
          onGoRegister={() => showToast('Регистрация — в следующей итерации')}
          onGoForgot={() => showToast('Восстановление пароля — в следующей итерации')}
        />
        <Toast message={message} tone={tone} />
      </>
    );
  }

  /** Открытые вкладки — сами проекты, в порядке `openTabs`. Проект, которого больше нет (удалён), молча выпадает из полосы. */
  const openProjects = openTabs
    .map((id) => projects.find((p) => p.id === id))
    .filter((p): p is Project => Boolean(p));
  const shownProject = projects.find((p) => p.id === shownProjectId) ?? null;

  /**
   * Проект, у которого ещё ничего не посчитано, страницы не занимает.
   *
   * Смотреть на ней нечего: этап отвечает на вопрос «что вышло», и до
   * первого расчёта ответа нет — под окном ввода оставался пустой экран.
   * Поэтому до первого расчёта под окном остаётся список проектов,
   * как и в упрощённом режиме, а полноценный визард открывается,
   * когда есть что показать.
   */
  const started = shownProject?.calc.some(Boolean) ?? false;
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
   * Крестик на вкладке — если в проекте есть посчитанный шаг с правками
   * после расчёта, сперва спрашивает, закрывать ли: иначе расхождение
   * между отчётом и текущими данными уходит из вида молча, вместе
   * с вкладкой, которая на него указывала.
   */
  const requestCloseProject = (id: string) => {
    const project = projects.find((p) => p.id === id);
    if (project && hasUncalculatedChanges(project)) {
      setCloseConfirmId(id);
      return;
    }
    closeProject(id);
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

  /**
   * Выход из системы заодно сбрасывает то, где пользователь находился.
   *
   * Иначе следующий вход возвращает не на список проектов, а туда, откуда
   * разлогинились: вышли из «Настроек» — вошли в «Настройки». Хуже того,
   * вкладки открытых проектов пережили бы смену пользователя и показали
   * бы вошедшему чужую работу. Разделы и вкладки — состояние сеанса,
   * а сеанс кончился.
   */
  const handleLogout = () => {
    setView('projects');
    setShownProjectId(null);
    setOpenTabs([]);
    setCustomerFilter(null);
    setCloseConfirmId(null);
    setNewProjectOpen(false);
    setSimplifiedFlow({ open: false, projectId: null });
    logout();
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
        projectOnScreen={Boolean(shownProject && started)}
        contentKey={shownProject && started ? `project:${shownProject.id}` : `view:${view}`}
        onGoProjects={goProjects}
        onSelectProject={setShownProjectId}
        onCloseProject={requestCloseProject}
        onRenameProject={(id, name) => updateProject(id, { name })}
        onNewProject={startNewProject}
        view={sidebarView}
        onViewChange={goView}
      >
        {shownProject && started ? (
          <WizardPage
            project={shownProject}
            onUpdateProject={updateProject}
            onForkProject={forkProject}
            onOpenProject={openProject}
            showToast={showToast}
          />
        ) : view === 'trash' ? (
          <TrashPage trash={trash} onRestoreProject={restoreProject} onPurgeProject={purgeProject} />
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
            onNewProject={startNewProject}
          />
        ) : view === 'settings' ? (
          <SettingsPage
            user={user}
            mode={defaultMode}
            onModeChange={setDefaultMode}
            theme={theme}
            onThemeChange={setTheme}
            fontScale={fontScale}
            onFontScaleChange={setFontScale}
            onLogout={handleLogout}
            showToast={showToast}
          />
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
            onGoCustomers={() => goView('customers')}
          />
        )}
      </AppShell>

      {/* Ввод первого этапа — окном поверх списка, пока считать нечего.
          Тот же порядок, что в упрощённом режиме: под окном остаётся
          список проектов, а не пустая страница этапа. */}
      {shownProject && !started ? (
        <WizardPage
          overlay
          onLeave={() => setShownProjectId(null)}
          project={shownProject}
          onUpdateProject={updateProject}
          onForkProject={forkProject}
          onOpenProject={openProject}
          showToast={showToast}
        />
      ) : null}

      <NewProjectModal
        open={newProjectOpen}
        onClose={() => setNewProjectOpen(false)}
        defaultExecutor={user.name}
        onCreate={(input) => {
          /*
           * В форму геометрии подставляется диаметр основания выбранной
           * машины — единственное, что про неё известно из паспорта
           * на языке методики (`applyCrusherToGeom`). Открывшееся следом
           * окно правки показывает тогда размер выбранной дробилки,
           * а не чужое число по умолчанию.
           */
          const data = defaultWizardData();
          if (input.crusherName) data.geom = applyCrusherToGeom(data.geom, input.crusherName);

          const project = createProject({ ...input, mode: 'engineering', data });
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

      <Modal
        open={closeConfirmId !== null}
        onClose={() => setCloseConfirmId(null)}
        title="Сохранить изменения?"
        size="sm"
        footer={
          <Modal.Footer aside={
            <Button variant="secondary" onClick={() => setCloseConfirmId(null)}>
              Отмена
            </Button>
          }>
            <Button
              variant="secondary"
              onClick={() => {
                if (closeConfirmId) {
                  const project = projects.find((p) => p.id === closeConfirmId);
                  if (project) updateProject(project.id, discardStaleSteps(project));
                  closeProject(closeConfirmId);
                }
                setCloseConfirmId(null);
              }}
            >
              Не сохранять
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                if (closeConfirmId) {
                  const project = projects.find((p) => p.id === closeConfirmId);
                  if (project) updateProject(project.id, commitStaleSteps(project));
                  closeProject(closeConfirmId);
                  showToast('Изменения сохранены', 'success');
                }
                setCloseConfirmId(null);
              }}
            >
              Сохранить
            </Button>
          </Modal.Footer>
        }
      >
        <Text variant="bodySm" color="textMuted">
          Вы меняли данные после расчёта. Сохранить их в проекте или закрыть, вернув значения к последнему расчёту?
        </Text>
      </Modal>

      <Toast message={message} tone={tone} />
    </>
  );
}
