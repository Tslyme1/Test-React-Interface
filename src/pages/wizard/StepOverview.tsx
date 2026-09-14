import { useMemo } from 'react';
import { Box, Button, EmptyState, Stack, Text } from '@uralmash/design-system';
import type { Project, StepKey } from '@/types';
import { ChamberScheme } from '@/components/ChamberScheme/ChamberScheme';
import { buildChamberProfileInput, crushingZones } from '@/domain/chamberInput';
import { StepMeta, StepReport } from './StepReport';
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
type SummaryItem = { label: string; value: string };

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
        { label: 'Дробилка', value: project.crusherName || '—' },
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
        { label: 'Проба руды', value: project.ore || '—' },
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

  return (
    <Stack gap="xl" direction="column">
      <Text variant="headingMd">{TITLES[stepKey]}</Text>

      {calculated ? <StepMeta project={project} stepKey={stepKey} onUpdateProject={onUpdateProject} /> : null}

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
          <Stack gap="md" direction="column">
              <Text variant="label">Исходные данные</Text>
              {summary.map((item) => (
                <div key={item.label} className={styles.row}>
                  <Text variant="body" color="textMuted">
                    {item.label}
                  </Text>
                  <Text variant="body">{item.value}</Text>
                </div>
              ))}

              {onEdit ? (
                <Button variant="secondary" iconStart="pencil" fullWidth onClick={onEdit}>
                  Изменить данные
                </Button>
              ) : null}
          </Stack>
        </div>

        <div className={styles.result}>
          {/* Чертёж — часть результата этапа, а не его постоянный фон:
              до расчёта он показывал бы профиль, которого в отчёте ещё
              нет, — а страница отвечает на вопрос «что вышло», и до
              расчёта честный ответ один: ничего. Смотреть на профиль
              по ходу ввода есть где — он стоит рядом с полями в окне. */}
          {stepKey === 'geom' && calculated ? (
            <Box padding="md" border radius="md" fullWidth>
              <ChamberScheme input={schemeInput} testId="chamber-overview" />
            </Box>
          ) : null}

          {calculated ? (
            <StepReport project={project} stepKey={stepKey} />
          ) : (
            <EmptyState
              icon="fileText"
              title="Этап ещё не посчитан"
              description="Откройте исходные данные и запустите расчёт — результат появится здесь."
            />
          )}
        </div>
      </div>
    </Stack>
  );
}

const TITLES: Record<StepKey, string> = {
  geom: 'Геометрия камеры дробления',
  gran: 'Характеристический грансостав',
  prod: 'Грансостав продукта и усилия',
};
