import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, EmptyState, Stack, Tab, Table, Text } from '@uralmash/design-system';
import type { TableColumn } from '@uralmash/design-system';
import type { Project, StepKey } from '@/types';
import { CatalogNameCell } from '@/components/CatalogNameCell/CatalogNameCell';
import { ChamberScheme } from '@/components/ChamberScheme/ChamberScheme';
import { buildChamberProfileInput, crushingZones } from '@/domain/chamberInput';
import { StepActions, StepMeta, StepReport } from './StepReport';
import styles from './StepOverview.module.css';

export type StepOverviewProps = {
  project: Project;
  stepKey: StepKey;
  calculated: boolean;
  /**
   * Открыть окно ввода. Не передаётся, когда страница показывает
   * не тот этап, на котором сейчас стоит визард: править оттуда данные
   * соседнего этапа значило бы менять не то, на что смотришь.
   */
  onEdit?: () => void;
  onUpdateProject: (id: string, patch: Partial<Project>) => void;
};

/** Пара «величина — значение» в сводке исходных данных. */
type SummaryItem = {
  label: string;
  value: string;
  /** Строка выбранной позиции справочника — рядом с именем стоит её правка. */
  catalog?: { kind: 'crushers' | 'ores'; nameLabel: string };
};

/* Сводка — таблица, а не список пар: это данные, которые читают
   по столбцам («что» и «сколько»), то есть ровно та роль, для которой
   в системе есть `Table`. Своя вёрстка строк повторяла бы её шапку,
   выравнивание и прочерк пустого значения заново. */
const summaryColumns: TableColumn<SummaryItem>[] = [
  { key: 'label', title: 'Величина' },
  {
    key: 'value',
    title: 'Значение',
    align: 'end',
    render: (row) =>
      row.catalog ? <CatalogNameCell kind={row.catalog.kind} name={row.value === '—' ? '' : row.value} nameLabel={row.catalog.nameLabel} /> : row.value,
  },
];

/**
 * Страница этапа: что введено и что из этого вышло.
 *
 * Ввод сюда не вынесен намеренно — он живёт в окне (`onEdit`). Формы
 * этапа занимают экран целиком, а смотрят на них считаные минуты за весь
 * расчёт: дальше нужен результат, и держать под ним три десятка полей
 * значит отдавать место тому, что уже сделано.
 *
 * Сводка читается, а не правится: это ответ на вопрос «с чем считали»,
 * и поле ввода в нём было бы вторым местом, где те же данные меняются,
 * — рядом с окном, которое для этого и открывают.
 */
export function StepOverview({ project, stepKey, calculated, onEdit, onUpdateProject }: StepOverviewProps) {
  const { geom, gran, prod } = project.data;

  const summary = useMemo<SummaryItem[]>(() => {
    if (stepKey === 'geom') {
      const angle = geom.angleUnit === 'рад' ? 'рад' : '°';
      return [
        { label: 'Дробилка', value: project.crusherName || '—', catalog: { kind: 'crushers', nameLabel: 'Дробилка' } },
        { label: 'Диаметр основания D', value: `${geom.D} мм` },
        { label: 'Высота H от подвеса', value: `${geom.H} мм` },
        { label: 'Разгрузочная щель S₀', value: `${geom.S0} мм` },
        { label: 'Угол нутации θ', value: `${geom.theta} ${angle}` },
        { label: 'Зон дробления', value: String(crushingZones(geom)) },
        { label: 'Длина зоны калибровки l₂', value: `${geom.l2} мм` },
        { label: 'Углы зоны входа β₁₀ · β₄₀', value: `${geom.b10} · ${geom.b40} ${angle}` },
      ];
    }

    if (stepKey === 'gran') {
      return [
        { label: 'Проба руды', value: project.ore || '—', catalog: { kind: 'ores', nameLabel: 'Проба руды' } },
        { label: 'Минимальная крупность Dmin', value: `${gran.dMin} мм` },
        { label: 'Кондиционная крупность Dk', value: `${gran.dk} мм` },
        { label: 'Максимальная крупность Dmax', value: `${gran.dMax} мм` },
        { label: 'Параметр Z0', value: gran.z0 },
        { label: 'Параметр S00', value: gran.s00 },
        { label: 'Параметр N0', value: gran.n0 },
        { label: 'Форма куска a₀ · Va₀', value: `${gran.a0 || '—'} · ${gran.va0 || '—'}` },
      ];
    }

    return [
      { label: 'Тип питания', value: prod.feedType === 'wet' ? 'Влажное' : 'Сухое' },
      { label: 'Минимальная крупность продукта', value: `${prod.dMin} мм` },
      { label: 'Максимальная крупность продукта', value: `${prod.dMax} мм` },
      { label: 'Работа разрушения Wk', value: prod.wk },
      { label: 'Работа измельчения Wm', value: prod.wm },
      { label: 'КПД дробления', value: prod.kpd },
    ];
  }, [stepKey, project.crusherName, project.ore, geom, gran, prod]);

  const schemeInput = useMemo(() => buildChamberProfileInput(geom), [geom]);

  /*
   * Отчёты на странице: сперва этого этапа, под ним — посчитанных до него,
   * от ближнего к первому. Продукт посчитан из руды, руда — на камере
   * дробилки, и сверяться с ними нужно здесь же, не уходя на их страницы.
   */
  const stages = useMemo<StepKey[]>(() => {
    if (!calculated) return [];
    const index = STEP_ORDER.indexOf(stepKey);
    const earlier = STEP_ORDER.slice(0, index)
      .filter((_, i) => project.calc[i])
      .reverse();
    return [stepKey, ...earlier];
  }, [calculated, stepKey, project.calc]);

  const { resultRef, tabsRef, stageRef, activeStage, goToStage } = useStageScrollSpy(stages);

  return (
    <div className={styles.page}>
      {/* Шапка на всю ширину: чей это отчёт, когда посчитан и чем его
          выгрузить. Отделена чертой — под ней начинаются две колонки
          со своим вертикальным разделителем, и без черты они выглядели
          бы продолжением шапки, а не отдельной частью экрана. */}
      <div className={styles.header}>
        <Stack direction="row" justify="between" align="start" gap="xl" wrap>
          <Stack gap="md" direction="column">
            <Text variant="headingMd">Результаты: {TITLES[stepKey]}</Text>
            {calculated ? <StepMeta project={project} stepKey={stepKey} onUpdateProject={onUpdateProject} /> : null}
          </Stack>

          {calculated ? <StepActions project={project} stepKey={stepKey} /> : null}
        </Stack>
      </div>

      <div className={styles.split}>
        {/* Сводка — узкой колонкой слева: её читают по диагонали, чтобы
            убедиться, что считали с тем, с чем собирались. Место экрана
            отдано результату.

            Колонка не уезжает при прокрутке: отчёт длинный, а вопрос
            «с чем это посчитано» возникает не на первом экране, а как раз
            где-нибудь посреди таблицы профиля. Кнопка правки живёт здесь
            же — она относится к этим самым данным, и держать её наверху
            страницы значило бы отрывать действие от того, над чем оно
            совершается. */}
        <div className={styles.summary}>
          <Stack gap="lg" direction="column">
            {/* Подпись вынесена из таблицы наружу, как и в отчёте справа,
                а правка стоит рядом с ней: действие относится к этим самым
                данным, и под таблицей оно читалось бы как её продолжение. */}
            <Stack direction="row" justify="between" align="center" gap="sm" wrap>
              <Text variant="headingSm">Исходные данные</Text>
              {onEdit ? (
                <Button variant="secondary" size="sm" iconStart="pencil" onClick={onEdit}>
                  Изменить данные
                </Button>
              ) : null}
            </Stack>

            <Table
              columns={summaryColumns}
              rows={summary}
              rowKey={(item) => item.label}
              caption="Исходные данные"
              captionHidden
            />
          </Stack>
        </div>

        <div className={stages.length > 1 ? `${styles.result} ${styles.resultTabbed}` : styles.result} ref={resultRef}>
          {/* Табы — оглавление отчётов, закреплённое над ними: отчёт этапа
              длинный, и до предыдущих иначе не долистать, не потеряв, где
              находишься. Подсвечивается тот, до чьего отчёта докрутили.
              С одним отчётом оглавлять нечего — табов нет. */}
          {stages.length > 1 ? (
            <nav className={styles.tabs} ref={tabsRef} aria-label="Отчёты этапов">
              <Stack direction="row" gap="none">
                {stages.map((key) => (
                  <Tab key={key} active={key === activeStage} onClick={() => goToStage(key)}>
                    {TAB_LABELS[key]}
                  </Tab>
                ))}
              </Stack>
            </nav>
          ) : null}

          {calculated ? (
            stages.map((key) => (
              <section key={key} ref={stageRef(key)} className={styles.stage} aria-label={`Результаты: ${TITLES[key]}`}>
                <Stack gap="lg" direction="column">
                  {stages.length > 1 ? (
                    <Text variant="headingMd">
                      Этап {STEP_ORDER.indexOf(key) + 1}. {TITLES[key]}
                    </Text>
                  ) : null}

                  <StepReport project={project} stepKey={key} />

                  {/* Чертёж — последним разделом отчёта «Дробилка», а не его
                      шапкой: таблицы отвечают на вопрос «какие числа вышли»,
                      и начинать отчёт картинкой значило бы отодвигать их
                      на второй экран. */}
                  {key === 'geom' ? (
                    <Stack gap="sm" direction="column">
                      <Text variant="headingSm">Схема профиля камеры дробления</Text>
                      {/* Не `Box`: чертёж рисуется в своём масштабе и выносными
                          линиями выходил за рамку — блок обязан его обрезать. */}
                      <div className={styles.scheme}>
                        <ChamberScheme input={schemeInput} testId={key === stepKey ? 'chamber-overview' : undefined} />
                      </div>
                    </Stack>
                  ) : null}
                </Stack>
              </section>
            ))
          ) : (
            <EmptyState
              icon="fileText"
              title="Этап ещё не посчитан"
              description="Откройте исходные данные и запустите расчёт — результат появится здесь."
            />
          )}
        </div>
      </div>
    </div>
  );
}

const STEP_ORDER: StepKey[] = ['geom', 'gran', 'prod'];

/** Подписи табов — те же, что у этапов в степпере. */
const TAB_LABELS: Record<StepKey, string> = {
  geom: 'Дробилка',
  gran: 'Руда',
  prod: 'Продукт',
};

/**
 * Табы по отчётам этапов в прокручиваемой колонке.
 *
 * Активный — последний отчёт, чей верх уже поднялся под полосу табов;
 * у самого низа колонки — последний отчёт, иначе короткий последний
 * не подсветился бы никогда: докрутить его верх до табов не хватает
 * высоты. Клик прокручивает к отчёту и на время прокрутки перестаёт
 * следить за ней — иначе подсветка пробегала бы по всем промежуточным.
 */
function useStageScrollSpy(stages: StepKey[]) {
  const resultRef = useRef<HTMLDivElement | null>(null);
  const tabsRef = useRef<HTMLElement | null>(null);
  const sections = useRef(new Map<StepKey, HTMLElement>());
  const lockUntil = useRef(0);
  const [activeStage, setActiveStage] = useState<StepKey | null>(stages[0] ?? null);

  const stageRef = useCallback(
    (key: StepKey) => (node: HTMLElement | null) => {
      if (node) sections.current.set(key, node);
      else sections.current.delete(key);
    },
    []
  );

  /* Высота полосы табов плюс зазор колонки под ней — заголовок отчёта
     после перехода встаёт с тем же воздухом, что и между разделами,
     а не вплотную к линии табов. */
  const tabsOffset = () => {
    const container = resultRef.current;
    const gap = container ? parseFloat(getComputedStyle(container).rowGap) || 0 : 0;
    return (tabsRef.current?.offsetHeight ?? 0) + gap;
  };

  useEffect(() => {
    setActiveStage(stages[0] ?? null);
    const container = resultRef.current;
    if (!container || stages.length < 2) return;

    const update = () => {
      if (Date.now() < lockUntil.current) return;
      if (container.scrollTop + container.clientHeight >= container.scrollHeight - 2) {
        setActiveStage(stages[stages.length - 1]);
        return;
      }
      const line = container.getBoundingClientRect().top + tabsOffset() + 1;
      let current = stages[0];
      for (const key of stages) {
        const node = sections.current.get(key);
        if (node && node.getBoundingClientRect().top <= line) current = key;
      }
      setActiveStage(current);
    };

    container.addEventListener('scroll', update, { passive: true });
    return () => container.removeEventListener('scroll', update);
  }, [stages]);

  const goToStage = (key: StepKey) => {
    const container = resultRef.current;
    const node = sections.current.get(key);
    if (!container || !node) return;
    setActiveStage(key);
    lockUntil.current = Date.now() + 700;
    const top = node.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
    container.scrollTo({ top: Math.max(0, top - tabsOffset()), behavior: 'smooth' });
  };

  return { resultRef, tabsRef, stageRef, activeStage, goToStage };
}

const TITLES: Record<StepKey, string> = {
  geom: 'Геометрия камеры дробления',
  gran: 'Характеристический грансостав',
  prod: 'Грансостав продукта и усилия',
};
