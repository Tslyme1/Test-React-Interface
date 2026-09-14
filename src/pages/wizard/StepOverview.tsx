import { useMemo } from 'react';
import { Box, Button, EmptyState, Stack, Surface, Table, Text } from '@uralmash/design-system';
import type { TableColumn } from '@uralmash/design-system';
import type { Project, StepKey } from '@/types';
import { ChamberScheme } from '@/components/ChamberScheme/ChamberScheme';
import { GranulometryChart } from '@/components/GranulometryChart/GranulometryChart';
import { buildChamberProfileInput, crushingZones } from '@/domain/chamberInput';
import { estimateGeom, estimateGran, estimateProd } from '@/domain/estimates';
import type { GranRow, KvRow } from '@/domain/estimates';
import styles from './StepOverview.module.css';

export type StepOverviewProps = {
  project: Project;
  stepKey: StepKey;
  calculated: boolean;
  /** Открыть окно ввода — единственный способ поправить данные этапа. */
  onEdit: () => void;
};

const kvColumns: TableColumn<KvRow>[] = [
  { key: 'label', title: 'Величина' },
  { key: 'value', title: 'Значение', align: 'end' },
  { key: 'unit', title: 'Ед.', align: 'end' },
];

const granColumns: TableColumn<GranRow>[] = [
  { key: 'class', title: 'Класс крупности, мм' },
  { key: 'dMid', title: 'D сред', align: 'end' },
  { key: 'gamma', title: 'γ', align: 'end' },
  { key: 'pass', title: 'Выход по минусу, %', align: 'end' },
];

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
export function StepOverview({ project, stepKey, calculated, onEdit }: StepOverviewProps) {
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
      <div className={styles.head}>
        <Text variant="headingMd">{TITLES[stepKey]}</Text>
        <Button variant="secondary" iconStart="pencil" onClick={onEdit}>
          Изменить данные
        </Button>
      </div>

      <div className={styles.split}>
        {/* Сводка — узкой колонкой слева: её читают по диагонали, чтобы
            убедиться, что считали с тем, с чем собирались. Место экрана
            отдано результату. */}
        <Surface level="flat" border radius="md" padding="lg">
          <Stack gap="sm" direction="column">
            <Text variant="label">Исходные данные</Text>
            {summary.map((item) => (
              <div key={item.label} className={styles.row}>
                <Text variant="bodySm" color="textMuted">
                  {item.label}
                </Text>
                <Text variant="bodySm">{item.value}</Text>
              </div>
            ))}
          </Stack>
        </Surface>

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
            <Stack gap="md" direction="column">
              <Text variant="label">Результат этапа</Text>
              {stepKey === 'gran' ? (
                <>
                  <Table
                    columns={granColumns}
                    rows={estimateGran(gran)}
                    rowKey={(r) => r.class}
                    caption="Характеристика гранулометрического состава"
                    captionHidden
                  />
                  <GranulometryChart rows={estimateGran(gran)} />
                </>
              ) : (
                <Table
                  columns={kvColumns}
                  rows={stepKey === 'geom' ? estimateGeom(geom) : estimateProd(prod, geom)}
                  rowKey={(r) => r.label}
                  caption="Результат этапа"
                  captionHidden
                />
              )}
            </Stack>
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
