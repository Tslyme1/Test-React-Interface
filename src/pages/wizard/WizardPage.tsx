import { useState } from 'react';
import { Box, Button, Stack, Stepper, Surface } from '@uralmash/design-system';
import type { Step } from '@uralmash/design-system';
import type { GeomData, GranData, ProdData, Project, StepKey } from '@/types';
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
  showToast: (message: string) => void;
};

export function WizardPage({ project, onUpdateProject, showToast }: WizardPageProps) {
  const [step, setStep] = useState(0);
  const [resultOpen, setResultOpen] = useState(false);
  // Последний непустой шаг результата держим отдельно от `resultOpen`:
  // при закрытии контент не должен мигать на пустое, пока `Drawer`
  // (в этой версии дизайн-системы) убирает панель.
  const [resultStep, setResultStep] = useState<StepKey>('geom');

  const available = (i: number) => i === 0 || project.calc[i - 1] || project.calc[i];
  const stepKey = STEP_KEYS[step];
  const calculated = project.calc[step];

  // Шаг «Грансостав» без пробы руды считать нечего: форма ещё закрыта
  // заглушкой, и активная кнопка расчёта обещала бы результат из пустоты.
  const ready = stepKey !== 'gran' || Boolean(project.ore);

  const steps: Step[] = STEP_META.map((meta, i) => ({ ...meta, disabled: !available(i) }));

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
              onChangeCrusher={(crusherName) => onUpdateProject(project.id, { crusherName })}
            />
          ) : stepKey === 'gran' ? (
            <GranStep
              data={project.data.gran}
              onChange={patchGran}
              ore={project.ore}
              onPickOre={(ore) => onUpdateProject(project.id, { ore })}
            />
          ) : (
            <ProdStep data={project.data.prod} onChange={patchProd} showToast={showToast} />
          )}
        </Box>
      </div>

      <Surface level="flat" border padding="lg" fullWidth>
        <Stack direction="row" justify="between" align="center" gap="xl">
          <Stepper steps={steps} current={step} onStepClick={(i) => available(i) && setStep(i)} />

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
    </div>
  );
}
