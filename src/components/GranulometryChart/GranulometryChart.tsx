import { useMemo } from 'react';
import { Stack, Text } from '@uralmash/design-system';
import type { GranRow } from '@/domain/estimates';
import { CHART_BOX, CHART_PAD, buildGranChart } from '@/domain/granChart';
import styles from './GranulometryChart.module.css';

export type GranulometryChartProps = {
  rows: GranRow[];
  /**
   * Что показывает график — питание или продукт дробления. Уходит
   * в доступное имя: на странице отчёта их теперь может быть два,
   * и одинаковая подпись у обоих оставила бы читателя с экрана
   * без единого способа их различить.
   */
  label?: string;
};

/**
 * Суммарные характеристики крупности — «по плюсу» и «по минусу».
 *
 * Тот же график, что в методичках по гранулометрии: по минусу — выход
 * зёрен мельче заданного размера (кривая растёт от 0 к 100 %), по плюсу —
 * крупнее (убывает от 100 к 0 %); одна кривая — зеркало другой. Классы
 * приходят готовыми из `estimateGran`/`estimateProdGran`, координаты —
 * из `buildGranChart`: здесь только отрисовка, без своих формул и своей
 * шкалы. Шкала вынесена в домен, потому что тот же график печатается
 * в отчёте, а у печатного документа нет ни React, ни токенов.
 *
 * Свой SVG, а не сторонняя библиотека графиков: график один, простой
 * (две ломаные и оси), а зависимость тянула бы за собой пакет ради
 * компонента, который проще написать самим — так же, как `ChamberScheme`.
 */
export function GranulometryChart({ rows, label }: GranulometryChartProps) {
  const model = useMemo(() => buildGranChart(rows), [rows]);

  if (!model) return null;

  return (
    <Stack gap="sm" direction="column">
      <svg
        className={styles.chart}
        viewBox={`0 0 ${CHART_BOX.w} ${CHART_BOX.h}`}
        role="img"
        aria-label={`Суммарные характеристики крупности${label ? ` (${label})` : ''} — по плюсу и по минусу`}
      >
        {model.yTicks.map((tick) => (
          <g key={`y-${tick.value}`}>
            <line
              x1={model.axisX}
              y1={tick.y}
              x2={model.plotRight}
              y2={tick.y}
              stroke="var(--color-border)"
              strokeWidth={1}
            />
            <text x={model.axisX - 8} y={tick.y + 4} textAnchor="end" fontSize={11} fill="var(--color-text-muted)">
              {tick.value}
            </text>
          </g>
        ))}

        {model.xTicks.map((tick) => (
          <text
            key={`x-${tick.value}`}
            x={tick.x}
            y={tick.y + 18}
            textAnchor="middle"
            fontSize={11}
            fill="var(--color-text-muted)"
          >
            {tick.value}
          </text>
        ))}

        <line
          x1={model.axisX}
          y1={model.plotTop}
          x2={model.axisX}
          y2={model.axisY}
          stroke="var(--color-border-strong)"
          strokeWidth={1}
        />
        <line
          x1={model.axisX}
          y1={model.axisY}
          x2={model.plotRight}
          y2={model.axisY}
          stroke="var(--color-border-strong)"
          strokeWidth={1}
        />

        <text
          x={(model.axisX + model.plotRight) / 2}
          y={CHART_BOX.h - 6}
          textAnchor="middle"
          fontSize={12}
          fill="var(--color-text-muted)"
        >
          Размер класса, мм
        </text>
        <text
          x={16}
          y={(CHART_PAD.top + model.axisY) / 2}
          textAnchor="middle"
          fontSize={12}
          fill="var(--color-text-muted)"
          transform={`rotate(-90 16 ${(CHART_PAD.top + model.axisY) / 2})`}
        >
          Выход, %
        </text>

        <path d={model.overPath} fill="none" stroke="var(--color-warning-text)" strokeWidth={2} strokeDasharray="7 4" />
        <path d={model.underPath} fill="none" stroke="var(--color-accent)" strokeWidth={2} />
      </svg>

      <Stack direction="row" gap="lg" wrap>
        <Stack direction="row" gap="2xs" align="center">
          <span className={styles.swatchUnder} />
          <Text variant="caption" color="textMuted">
            По минусу — выход зёрен мельче размера
          </Text>
        </Stack>
        <Stack direction="row" gap="2xs" align="center">
          <span className={styles.swatchOver} />
          <Text variant="caption" color="textMuted">
            По плюсу — выход зёрен крупнее размера
          </Text>
        </Stack>
      </Stack>
    </Stack>
  );
}
