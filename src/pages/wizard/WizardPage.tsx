import { useState } from 'react';
import { Box, Button, Modal, Stack, Stepper, Surface, Text } from '@uralmash/design-system';
import type { Step } from '@uralmash/design-system';
import type { GeomData, GranData, ProdData, Project, StepKey } from '@/types';
import { CatalogPicker } from '@/components/CatalogPicker/CatalogPicker';
import { ORE_SAMPLES, ORE_SPECS } from '@/data/oreSamples';
import { GeometryStep } from './GeometryStep';
import { GranStep } from './GranStep';
import { ProdStep } from './ProdStep';
import { ResultsDrawer } from './ResultsDrawer';
import { STEP_KEYS } from '@/domain/steps';
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

  // Шаг «Грансостав» без пробы руды считать нечего: форма ещё закрыта
  // заглушкой, и активная кнопка расчёта обещала бы результат из пустоты.
  const ready = stepKey !== 'gran' || Boolean(project.ore);

  const steps: Step[] = STEP_META.map((meta, i) => ({ ...meta, disabled: !available(i) }));

  const goToStep = (i: number) => {
    if (i === 1 && !project.ore) {
      setOrePickerOpen(true);
      return;
    }
    if (available(i)) setStep(i);
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
    // Форк начинает расчёт заново с изменённого шага: посчитанное дальше
    // относилось к прежним данным и не может остаться отмеченным как есть.
    for (let i = pendingFork.calcIndex; i < nextCalc.length; i += 1) nextCalc[i] = false;

    const forked = onForkProject(project.id, {
      ...pendingFork.patch,
      calc: nextCalc,
      geomBaseline: pendingFork.calcIndex === 0 ? null : project.geomBaseline,
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
    onUpdateProject(project.id, {
      calc: nextCalc,
      // Снимок геометрии на момент расчёта — опора для режима отображения
      // «Дельта» на шаге «Геометрия»: он сравнивает текущие поля с тем,
      // что было в форме в момент именно этого расчёта.
      ...(stepKey === 'geom' ? { geomBaseline: { ...project.data.geom } } : {}),
    });
    showToast(`Шаг «${STEP_META[step].label}» рассчитан`);
  };

  return (
    <div className={styles.root}>
      <div className={styles.body}>
        {/* `paddingX`+`paddingY`, а не `padding` — см. комментарий у `Box`
            в `ProjectsPage.tsx`: в этой версии компонента одиночный `padding`
            гасит сам себя. */}
        <Box paddingX="2xl" paddingY="2xl" fullWidth>
          {stepKey === 'geom' ? (
            <GeometryStep
              data={project.data.geom}
              onChange={patchGeom}
              baseline={project.geomBaseline}
              crusherName={project.crusherName}
              onChangeCrusher={(crusherName) => applyOrFork(0, { crusherName })}
            />
          ) : stepKey === 'gran' ? (
            <GranStep
              data={project.data.gran}
              onChange={patchGran}
              ore={project.ore}
              onRequestOrePicker={() => setOrePickerOpen(true)}
            />
          ) : (
            <ProdStep data={project.data.prod} onChange={patchProd} showToast={showToast} />
          )}
        </Box>
      </div>

      <Surface level="flat" border padding="lg" fullWidth>
        <Stack direction="row" justify="between" align="center" gap="xl">
          <Stepper steps={steps} current={step} onStepClick={goToStep} />

          {calculated ? (
            <Button
              variant="primary"
              iconStart="fileText"
              onClick={() => {
                setResultStep(stepKey);
                setResultOpen(true);
              }}
            >
              Смотреть результат
            </Button>
          ) : (
            <Button variant="primary" disabled={!ready} onClick={runCalc}>
              Выполнить расчёт
            </Button>
          )}
        </Stack>
      </Surface>

      {/* Рендерится безусловно, как `Modal`/`Popover` в остальном приложении —
          снятие панели отдаём целиком компоненту дизайн-системы, а не гасим
          её снаружи ещё раз. */}
      <ResultsDrawer open={resultOpen} onClose={() => setResultOpen(false)} stepKey={resultStep} project={project} />

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
          <Modal.Footer>
            <Button variant="secondary" onClick={() => setOrePickerOpen(false)}>
              Отмена
            </Button>
          </Modal.Footer>
        }
      >
        <CatalogPicker
          specs={ORE_SPECS}
          items={ORE_SAMPLES}
          value={project.ore || null}
          onPick={(picked) => {
            /* Снятие выбора здесь ничего не даёт: шаг без пробы закрыт
               заглушкой, и уйти из окна ни с чем можно крестиком. */
            if (!picked) return;
            pickOre(picked);
          }}
          nameLabel="Проба руды"
          searchPlaceholder="Костомукшская, X, 14-16…"
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
