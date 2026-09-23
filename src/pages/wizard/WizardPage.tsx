import { useEffect, useState } from 'react';
import { Badge, Button, Modal, Stack, Stepper, Surface, Text } from '@uralmash/design-system';
import type { Step } from '@uralmash/design-system';
import type { GeomData, GranData, ProdData, Project } from '@/types';
import { CatalogPicker } from '@/components/CatalogPicker/CatalogPicker';
import { ORE_SPECS } from '@/data/oreSamples';
import { useUserCatalog } from '@/state/userCatalog';
import { CatalogCreateButton } from '@/components/CatalogCreateButton/CatalogCreateButton';
import { GeometryStep } from './GeometryStep';
import { StepOverview } from './StepOverview';
import { GranStep } from './GranStep';
import { ProdStep } from './ProdStep';
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
  /**
   * Только окна, без страницы и футера: так визард показывается поверх
   * списка проектов, пока у проекта ничего не посчитано и страницу
   * занимать нечем.
   */
  overlay?: boolean;
  /**
   * Уйти из проекта. Нужен только в `overlay`: там окно ввода —
   * единственное, что от проекта на экране есть, и его закрытие
   * означает «вернуться к списку», а не «остаться на пустом месте».
   */
  onLeave?: () => void;
};

/** Последний посчитанный этап до `step`. `null` — считать ещё нечего. */
function lastCalculatedBefore(project: Project, step: number): number | null {
  for (let i = step - 1; i >= 0; i -= 1) {
    if (project.calc[i]) return i;
  }
  return null;
}

/** Инженерный визард — три шага с вводом данных. Упрощённый режим ведёт `SimplifiedProjectModal`, сюда не заходит. */
export function WizardPage({
  project,
  onUpdateProject,
  onForkProject,
  onOpenProject,
  showToast,
  overlay = false,
  onLeave,
}: WizardPageProps) {
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

  /** Закрытие окна ввода. Поверх списка это заодно и выход из проекта. */
  const closeEditor = () => {
    setEditOpen(false);
    if (overlay) onLeave?.();
  };

  /**
   * Куда форма этапа рисует свои действия — плашку выбранного объекта
   * и «Отображение».
   *
   * Узлом, а не готовой разметкой: сами действия принадлежат форме
   * (это её режимы отображения и её выбор дробилки), а место им —
   * в шапке окна, рядом с заголовком. Поднимать ради этого состояние
   * формы сюда значило бы размазать её по двум файлам; проще дать ей
   * точку, куда она отрисуется порталом. Тот же приём, которым сама
   * система уводит поповеры внутрь окна (`LayerRootProvider`).
   */
  const [headerSlot, setHeaderSlot] = useState<HTMLDivElement | null>(null);

  /**
   * Куда форма рисует плашку выбранного объекта — дробилки или пробы.
   *
   * В футере слева: это не действие над формой, а напоминание, для чего
   * считаем, — и стоять ему рядом с кнопкой расчёта уместнее, чем среди
   * полей. Подпись («Дробилка», «Проба руды») ставит сама форма: у окна
   * этапа объект свой.
   */
  const [objectSlot, setObjectSlot] = useState<HTMLDivElement | null>(null);

  /**
   * Непосчитанный этап всегда показан с окном ввода.
   *
   * Страница этапа отвечает на вопрос «что вышло», и до расчёта ответа
   * у неё нет — попасть на неё раньше времени значит упереться в пустое
   * место там, где ждали работу. Поэтому окно открывается на каждом
   * появлении такого этапа: и при переходе по степперу, и при открытии
   * проекта из списка, и при переключении вкладок.
   *
   * Посчитанный — наоборот, без окна: там смотрят результат, а правка
   * данных это уже отдельное намерение («Изменить данные»).
   */
  useEffect(() => {
    setEditOpen(!project.calc[step]);
  }, [step, project.id]);

  /* Справочник проб с правками пользователя — один на приложение:
     заведённая в упрощённом режиме проба обязана находиться и здесь. */
  const oreCatalog = useUserCatalog('ores');
  // Правка данных уже посчитанного шага не переписывает проект на месте —
  // она предлагает форк (см. `applyOrFork`). Черновик копится здесь и
  // применяется только по подтверждению в окне ниже.
  const [pendingFork, setPendingFork] = useState<{ calcIndex: number; patch: Partial<Project> } | null>(null);

  const available = (i: number) => i === 0 || project.calc[i - 1] || project.calc[i];
  const stepKey = STEP_KEYS[step];
  const calculated = project.calc[step];

  /**
   * Какой этап показан страницей.
   *
   * Не обязательно текущий: пока данные нового этапа вводят, за окном
   * должен оставаться последний посчитанный — то, над чем пользователь
   * только что работал. Пустая страница «Этап ещё не посчитан» за окном
   * ввода не сообщает ничего, а место занимает; «проваливаться» на новый
   * этап правильно после расчёта, а не до него.
   *
   * Если посчитанных этапов ещё нет, показывать нечего — тогда это сам
   * текущий этап, и его пустая страница целиком закрыта окном ввода.
   */
  const shownStep = calculated ? step : lastCalculatedBefore(project, step) ?? step;
  const shownStepKey = STEP_KEYS[shownStep];
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

  /**
   * Переименование машины — всегда новый проект, а не правка на месте.
   *
   * Камеру правят под конкретную машину; другое имя означает, что это
   * уже другая разработка, и писать его поверх прежнего проекта значило
   * бы задним числом объявить, что расчёт всегда был про неё. В отличие
   * от смены дробилки (`applyOrFork`) окна «Шаг уже посчитан» здесь нет:
   * про новый проект сказано прямо в окне переименования, до нажатия.
   *
   * Посчитанное сбрасывается целиком: изменилась машина, к которой
   * относился весь расчёт, — держать её результаты отмеченными нельзя.
   */
  const renameCrusher = (crusherName: string) => {
    const forked = onForkProject(project.id, {
      crusherName,
      crusherNames: [crusherName],
      /* Имя проекта идёт за машиной, только если оно и было её именем,
         то есть подставлено при создании. Своё, написанное руками,
         переименование машины не трогает. */
      name: project.name === project.crusherName ? crusherName : project.name,
      calc: [false, false, false],
      calcDates: [null, null, null],
      calcSnapshot: [null, null, null],
    });

    if (!forked) return;
    onOpenProject(forked);
    showToast(`Создан новый проект «${forked.name}» с дробилкой «${crusherName}»`);
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

  /* Поверх списка проектов страницы и футера нет: смотреть на них
     нечего, пока не посчитан ни один этап, — а окно ввода рисуется
     в портал и от разметки вокруг не зависит. */
  const page = overlay ? null : (
    <div className={styles.root}>
      <div className={styles.body}>
        {/* Без обёртки-`Box`: внешний отступ страницы отдавал снизу полосу
            пустоты над футером, а колонкам он и не нужен одинаковый —
            каждая отмеряет свой (см. `StepOverview.module.css`). */}
          <StepOverview
            project={project}
            stepKey={shownStepKey}
            calculated={project.calc[shownStep]}
            onEdit={shownStep === step ? () => setEditOpen(true) : undefined}
            onUpdateProject={onUpdateProject}
          />
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
              {/* «Смотреть результат» здесь больше нет: отчёт и так на
                  экране — кнопка предлагала бы посмотреть на уже
                  показанное. Осталось то, чего на странице нет: переход
                  дальше и пересчёт, когда результат устарел. */}
              {step < 2 ? (
                <Button
                  variant={stale ? 'secondary' : 'primary'}
                  iconEnd="chevronRight"
                  onClick={() => goToStep(step + 1)}
                >
                  Следующий этап: {STEP_META[step + 1].label}
                </Button>
              ) : null}
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
    </div>
  );

  return (
    <>
      {page}

      {/* Форма этапа целиком — та же, что раньше занимала страницу.
          Ширина `lg`: на шаге «Геометрия» рядом с полями стоит чертёж,
          и связь «поле ↔ участок» работает только когда оба на виду. */}
      <Modal
        open={editOpen}
        onClose={closeEditor}
        title={stepKey === 'gran' ? 'Ввод данных руды' : `Исходные данные: ${STEP_META[step].label}`}
        /* Широкое окно нужно только «Геометрии»: там рядом с полями стоит
           чертёж, и связь «поле ↔ участок» работает, лишь когда оба на
           виду. «Руде» — тоже: слева от полей стоит паспорт выбранной
           пробы. «Продукту» хватает узкого — там полдесятка полей, и
           широкое растянуло бы их на всю ширину экрана. */
        size={stepKey === 'prod' ? 'sm' : 'lg'}
        headerActions={<div ref={setHeaderSlot} />}
        /* Своего отступа у содержимого нет: форма и панель со схемой
           рисуют края сами, а общий отступ окна отрывал бы чертёж
           от его футера и правой кромки. */
        contentFlush
        footer={
          <Modal.Footer aside={<div ref={setObjectSlot} />}>
            <Button variant="secondary" onClick={closeEditor}>
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
        <div className={stepKey === 'geom' ? styles.editorBody : stepKey === 'gran' ? undefined : styles.editorForm}>
        {stepKey === 'geom' ? (
          <GeometryStep
            data={project.data.geom}
            onChange={patchGeom}
            baseline={project.initialData.geom}
            crusherName={project.crusherName}
            onChangeCrusher={(crusherName) => applyOrFork(0, { crusherName })}
            onRenameCrusher={renameCrusher}
            actionsSlot={headerSlot}
            objectSlot={objectSlot}
          />
        ) : stepKey === 'gran' ? (
          <GranStep
            data={project.data.gran}
            onChange={patchGran}
            baseline={project.initialData.gran}
            ore={project.ore}
            onRequestOrePicker={() => setOrePickerOpen(true)}
            showToast={showToast}
            actionsSlot={headerSlot}
            objectSlot={objectSlot}
          />
        ) : (
          /* Своих действий у формы «Продукт» нет — плашки объекта тоже:
             ни дробилку, ни пробу на этом этапе не выбирают. */
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
    </>
  );
}
