import { useState } from 'react';
import { Badge, Box, Button, Modal, Stack, Stepper, Surface, Text } from '@uralmash/design-system';
import type { Step } from '@uralmash/design-system';
import type { GeomData, GranData, ProdData, Project, StepKey } from '@/types';
import { CatalogPicker } from '@/components/CatalogPicker/CatalogPicker';
import { ORE_SPECS } from '@/data/oreSamples';
import { useUserCatalog } from '@/state/userCatalog';
import { CatalogCreateButton } from '@/components/CatalogCreateButton/CatalogCreateButton';
import { GeometryStep } from './GeometryStep';
import { StepOverview } from './StepOverview';
import { GranStep } from './GranStep';
import { ProdStep } from './ProdStep';
import { ResultsDrawer } from './ResultsDrawer';
import { isStepStale, STEP_KEYS } from '@/domain/steps';
import { formatDate } from '@/domain/date';
import styles from './WizardPage.module.css';

const STEP_META: Step[] = [{ label: 'Дробилка' }, { label: 'Руда' }, { label: 'Продукт' }];

export type WizardPageProps = {
  project: Project;
  onUpdateProject: (id: string, patch: Partial<Project>) => void;
  /** Копия проекта поверх посчитанного шага — см. `useProjects.forkProject`. */
  onForkProject: (id: string, patch: Partial<Project>) => Project | null;
  /** Переключение на созданную копию — тот же переход, что и открытие любого проекта из списка. */
  onOpenProject: (project: Project) => void;
  showToast: (message: string) => void;
};

/** Инженерный визард — три шага с вводом данных. Упрощённый режим ведёт `SimplifiedProjectModal`, сюда не заходит. */
export function WizardPage({ project, onUpdateProject, onForkProject, onOpenProject, showToast }: WizardPageProps) {
  const [step, setStep] = useState(0);
  // Переход на шаг «Руда» без выбранной пробы не переключает степпер туда —
  // он остаётся на шаге 0, а поверх него открывается выбор пробы. Показывать
  // шаг заглушкой «нечем считать» хуже, чем сразу дать выбрать.
  const [orePickerOpen, setOrePickerOpen] = useState(false);
  /**
   * Окно ввода исходных данных этапа. Страница показывает, что введено
   * и что из этого вышло, а правят данные здесь — формы занимают экран
   * целиком, а смотрят на них считаные минуты за весь расчёт.
   */
  const [editOpen, setEditOpen] = useState(false);

  /* Справочник проб с правками пользователя — один на приложение:
     заведённая в упрощённом режиме проба обязана находиться и здесь. */
  const oreCatalog = useUserCatalog('ores');
  const [resultOpen, setResultOpen] = useState(false);
  // Последний непустой шаг результата держим отдельно от `resultOpen`:
  // при закрытии контент не должен мигать на пустое, пока `Drawer`
  // (в этой версии дизайн-системы) убирает панель.
  const [resultStep, setResultStep] = useState<StepKey>('geom');
  // Правка данных уже посчитанного шага не переписывает проект на месте —
  // она предлагает форк (см. `applyOrFork`). Черновик копится здесь и
  // применяется только по подтверждению в окне ниже.
  const [pendingFork, setPendingFork] = useState<{ calcIndex: number; patch: Partial<Project> } | null>(null);

  const available = (i: number) => i === 0 || project.calc[i - 1] || project.calc[i];
  const stepKey = STEP_KEYS[step];
  const calculated = project.calc[step];
  // Числовая правка на посчитанном шаге не форкает (см. `patchGeom` ниже) —
  // отчёт по нему остаётся тем, что был на момент расчёта, пока не нажали
  // «Пересчитать» ещё раз.
  const stale = isStepStale(project, step);

  // Шаг «Грансостав» без пробы руды считать нечего: форма ещё закрыта
  // заглушкой, и активная кнопка расчёта обещала бы результат из пустоты.
  const ready = stepKey !== 'gran' || Boolean(project.ore);

  const steps: Step[] = STEP_META.map((meta, i) => ({ ...meta, disabled: !available(i), completed: project.calc[i] }));

  const goToStep = (i: number) => {
    if (i === 1 && !project.ore) {
      setOrePickerOpen(true);
      return;
    }
    if (!available(i)) return;
    setStep(i);
    /* Переход на непосчитанный этап сразу открывает ввод: считать нечего,
       пока данные не введены, и первое, что там делают, — вводят их.
       На посчитанный — без окна: там смотрят результат, а правка данных
       это уже отдельное намерение.

       Только по переходу, а не при каждом появлении этапа на экране:
       иначе окно вставало бы поперёк и при открытии проекта из списка,
       и при переключении вкладок — там, где пользователь шёл смотреть,
       а не вводить. */
    setEditOpen(!project.calc[i]);
  };

  /**
   * Правка данных шага, который уже посчитан, не пишется поверх — она
   * предлагает создать копию проекта. Ещё не посчитанный шаг правится
   * как обычно: до расчёта это черновик, а не результат, который жалко
   * потерять молча.
   */
  const applyOrFork = (calcIndex: number, patch: Partial<Project>) => {
    if (project.calc[calcIndex]) {
      setPendingFork({ calcIndex, patch });
      return;
    }
    onUpdateProject(project.id, patch);
  };

  const confirmFork = () => {
    if (!pendingFork) return;
    const nextCalc = [...project.calc] as Project['calc'];
    const nextCalcDates = [...project.calcDates] as Project['calcDates'];
    const nextCalcSnapshot = [...project.calcSnapshot] as Project['calcSnapshot'];
    // Форк начинает расчёт заново с изменённого шага: посчитанное дальше
    // относилось к прежним данным и не может остаться отмеченным как есть.
    for (let i = pendingFork.calcIndex; i < nextCalc.length; i += 1) {
      nextCalc[i] = false;
      nextCalcDates[i] = null;
      nextCalcSnapshot[i] = null;
    }

    const forked = onForkProject(project.id, {
      ...pendingFork.patch,
      calc: nextCalc,
      calcDates: nextCalcDates,
      calcSnapshot: nextCalcSnapshot,
    });

    setPendingFork(null);
    if (forked) {
      onOpenProject(forked);
      showToast(`Изменения сохранены в новом проекте «${forked.name}»`);
    }
  };

  const pickOre = (ore: string) => {
    setOrePickerOpen(false);
    setStep(1);
    applyOrFork(1, { ore });
    /* Проба выбрана — дальше на этом этапе вводят параметры грансостава,
       и окно ввода открывается сразу, как и при обычном переходе
       на непосчитанный этап. */
    if (!project.calc[1]) setEditOpen(true);
  };

  /*
   * Числовые поля применяются напрямую, без форка, даже на посчитанном
   * шаге: форк на каждое нажатие клавиши держал бы значение поля
   * замороженным на старом вводе, пока не подтверждено окно, — печатать
   * в поле стало бы невозможно. Прозрачность правки после расчёта здесь
   * уже даёт режим «Дельта» в `GeometryStep` («было: X»); форк защищает
   * более крупные, дискретные решения — саму дробилку или пробу руды.
   */
  const patchGeom = (patch: Partial<GeomData>) => {
    onUpdateProject(project.id, { data: { ...project.data, geom: { ...project.data.geom, ...patch } } });
  };
  const patchGran = (patch: Partial<GranData>) => {
    onUpdateProject(project.id, { data: { ...project.data, gran: { ...project.data.gran, ...patch } } });
  };
  const patchProd = (patch: Partial<ProdData>) => {
    onUpdateProject(project.id, { data: { ...project.data, prod: { ...project.data.prod, ...patch } } });
  };

  const runCalc = () => {
    const nextCalc = [...project.calc] as Project['calc'];
    nextCalc[step] = true;
    const nextCalcDates = [...project.calcDates] as Project['calcDates'];
    nextCalcDates[step] = formatDate();
    // Снимок данных этого шага прямо сейчас — опора для предупреждения
    // «есть непересчитанные изменения» при закрытии проекта (см. `App.tsx`
    // и `hasUncalculatedChanges`).
    const nextCalcSnapshot = [...project.calcSnapshot] as Project['calcSnapshot'];
    nextCalcSnapshot[step] = project.data[stepKey];
    onUpdateProject(project.id, { calc: nextCalc, calcDates: nextCalcDates, calcSnapshot: nextCalcSnapshot });
    showToast(`Шаг «${STEP_META[step].label}» рассчитан`);
  };

  return (
    <div className={styles.root}>
      <div className={styles.body}>
        {/* `paddingX`+`paddingY`, а не `padding` — см. комментарий у `Box`
            в `ProjectsPage.tsx`: в этой версии компонента одиночный `padding`
            гасит сам себя. */}
        <Box paddingX="2xl" paddingY="2xl" fullWidth>
          <StepOverview
            project={project}
            stepKey={stepKey}
            calculated={calculated}
            onEdit={() => setEditOpen(true)}
          />
        </Box>
      </div>

      <Surface level="flat" border radius="none" padding="lg" fullWidth>
        <Stack direction="row" justify="between" align="center" gap="xl">
          <Stepper steps={steps} current={step} onStepClick={goToStep} />

          {calculated ? (
            <Stack direction="row" align="center" gap="sm">
              {/* Правка числового поля после расчёта не форкает (см.
                  `patchGeom`/`patchGran`/`patchProd` выше) — отчёт остаётся
                  тем, что был на момент расчёта, пока не нажали «Пересчитать».
                  Бейдж — постоянная подсказка, что расхождение есть, не
                  дожидаясь попытки закрыть проект. */}
              {stale ? <Badge tone="warning">Есть непересчитанные изменения</Badge> : null}
              {/* Вторичная — «Смотреть результат» рядом уже несёт основное
                  действие этого состояния, а эта лишь подсказывает, куда
                  идти дальше, когда шаг посчитан и это не очевидно само
                  по себе. Только пока следующий шаг вообще есть — на
                  «Продукте» идти уже некуда. */}
              {step < 2 ? (
                <Button variant="secondary" iconEnd="chevronRight" onClick={() => goToStep(step + 1)}>
                  Следующий этап
                </Button>
              ) : null}
              <Button
                variant={stale ? 'secondary' : 'primary'}
                iconStart="fileText"
                onClick={() => {
                  setResultStep(stepKey);
                  setResultOpen(true);
                }}
              >
                Смотреть результат {step + 1} этапа
              </Button>
              {/* Основное действие смещается сюда, когда результат уже
                  устарел, — «Смотреть результат» в этот момент показал бы
                  старые цифры, и предлагать его как главное действие
                  неправильно. */}
              {stale ? (
                <Button variant="primary" onClick={runCalc}>
                  Пересчитать
                </Button>
              ) : null}
            </Stack>
          ) : (
            /* На непосчитанном этапе главное действие — ввести данные:
               считать нечего, пока их нет. Сам расчёт запускается из окна
               ввода — там, где видно, что именно уходит в расчёт. */
            <Button variant="primary" iconStart="pencil" onClick={() => setEditOpen(true)}>
              Ввести данные
            </Button>
          )}
        </Stack>
      </Surface>

      {/* Рендерится безусловно, как `Modal`/`Popover` в остальном приложении —
          снятие панели отдаём целиком компоненту дизайн-системы, а не гасим
          её снаружи ещё раз. */}
      <ResultsDrawer
        open={resultOpen}
        onClose={() => setResultOpen(false)}
        stepKey={resultStep}
        project={project}
        onUpdateProject={onUpdateProject}
      />

      {/* Форма этапа целиком — та же, что раньше занимала страницу.
          Ширина `lg`: на шаге «Геометрия» рядом с полями стоит чертёж,
          и связь «поле ↔ участок» работает только когда оба на виду. */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title={`Исходные данные: ${STEP_META[step].label}`}
        size="lg"
        footer={
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setEditOpen(false)}>
              Закрыть
            </Button>
            {/* Расчёт запускается отсюда, а не с футера страницы: там он
                стоял бы под окном, которое для этого и открыли, — и путь
                «ввёл → посчитал» разрывался бы закрытием окна. */}
            <Button
              variant="primary"
              disabled={!ready}
              onClick={() => {
                runCalc();
                setEditOpen(false);
              }}
            >
              {calculated ? 'Пересчитать' : 'Выполнить расчёт'}
            </Button>
          </Modal.Footer>
        }
      >
        <div className={styles.editorBody}>
        {stepKey === 'geom' ? (
          <GeometryStep
            data={project.data.geom}
            onChange={patchGeom}
            baseline={project.initialData.geom}
            crusherName={project.crusherName}
            onChangeCrusher={(crusherName) => applyOrFork(0, { crusherName })}
          />
        ) : stepKey === 'gran' ? (
          <GranStep
            data={project.data.gran}
            onChange={patchGran}
            baseline={project.initialData.gran}
            ore={project.ore}
            onRequestOrePicker={() => setOrePickerOpen(true)}
            showToast={showToast}
          />
        ) : (
          <ProdStep data={project.data.prod} onChange={patchProd} baseline={project.initialData.prod} />
        )}
        </div>
      </Modal>

      {/* Живёт здесь, а не внутри `GranStep`: переход на шаг «Руда» без
          выбранной пробы должен открыть это окно поверх шага «Дробилка»,
          не переключая степпер, — то есть окно обязано существовать
          независимо от того, смонтирован ли `GranStep` вообще. */}
      <Modal
        open={orePickerOpen}
        onClose={() => setOrePickerOpen(false)}
        title="Выбор пробы руды"
        size="lg"
        footer={
          /* Слева внизу — заведение своей пробы: второстепенное действие,
             и в полосе над таблицей оно отнимало ширину у поиска. */
          <Modal.Footer
            aside={
              <CatalogCreateButton
                kind="ores"
                nameLabel="Проба руды"
                onCreated={(name) => pickOre(name)}
              />
            }
          >
            <Button variant="secondary" onClick={() => setOrePickerOpen(false)}>
              Отмена
            </Button>
          </Modal.Footer>
        }
      >
        <CatalogPicker
          specs={ORE_SPECS}
          items={oreCatalog.items}
          value={project.ore || null}
          onPick={(picked) => {
            /* Снятие выбора здесь ничего не даёт: шаг без пробы закрыт
               заглушкой, и уйти из окна ни с чем можно крестиком. */
            if (!picked) return;
            pickOre(picked);
          }}
          nameLabel="Проба руды"
          inlineSpecs={['f', 'ρ, т/м³']}
        />
      </Modal>

      <Modal
        open={pendingFork !== null}
        onClose={() => setPendingFork(null)}
        title="Шаг уже посчитан"
        size="sm"
        footer={
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setPendingFork(null)}>
              Отмена
            </Button>
            <Button variant="primary" onClick={confirmFork}>
              Создать копию
            </Button>
          </Modal.Footer>
        }
      >
        <Text variant="bodySm" color="textMuted">
          Изменения на посчитанном шаге не переписывают его результат — вместо этого создаётся копия проекта с уже
          применённой правкой. Исходный проект останется таким, каким был на момент расчёта.
        </Text>
      </Modal>
    </div>
  );
}
