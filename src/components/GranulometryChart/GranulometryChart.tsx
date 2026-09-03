import { useMemo } from 'react';
import { Stack, Text } from '@uralmash/design-system';
import type { GranRow } from '@/domain/estimates';
import styles from './GranulometryChart.module.css';

export type GranulometryChartProps = {
  rows: GranRow[];
};

const VB = { w: 640, h: 300 };
const PAD = { left: 52, right: 20, top: 16, bottom: 40 };
const PLOT_W = VB.w - PAD.left - PAD.right;
const PLOT_H = VB.h - PAD.top - PAD.bottom;

function round(v: number): number {
  return Math.round(v * 10) / 10;
}

/**
 * Суммарные характеристики крупности — «по плюсу» и «по минусу».
 *
 * Тот же график, что в методичках по гранулометрии: по минусу — выход
 * зёрен мельче заданного размера (кривая растёт от 0 к 100 %), по плюсу —
 * крупнее (убывает от 100 к 0 %); одна кривая — зеркало другой. Классы
 * приходят готовыми из `estimateGran`/`estimateProdGran` — здесь только
 * отрисовка, без своих формул.
 *
 * Свой SVG, а не сторонняя библиотека графиков: график один, простой
 * (две ломаные и оси), а зависимость тянула бы за собой пакет ради
 * компонента, который проще написать самим — так же, как `ChamberScheme`.
 */
export function GranulometryChart({ rows }: GranulometryChartProps) {
  const points = useMemo(() => {
    const sorted = [...rows]
      .map((r) => ({ size: Number(r.dTop), under: Number(r.pass) }))
      .filter((p) => Number.isFinite(p.size) && Number.isFinite(p.under))
      .sort((a, b) => a.size - b.size);

    // Первый класс сам по себе не начинается с нуля — у него уже есть
    // накопленный выход по минусу. Без точки (0, 0) синяя кривая (и
    // зеркальная ей красная) обрывалась бы на середине высоты графика,
    // не доходя ни до нуля, ни до сотни у левого края.
    if (sorted.length > 0 && sorted[0].size > 0) {
      return [{ size: 0, under: 0 }, ...sorted];
    }
    return sorted;
  }, [rows]);

  if (points.length === 0) return null;

  const maxSize = Math.max(...points.map((p) => p.size), 1);
  const x = (size: number) => PAD.left + (size / maxSize) * PLOT_W;
  const y = (percent: number) => PAD.top + PLOT_H - (percent / 100) * PLOT_H;

  // Кривая «по плюсу» начинается там же, где «по минусу» заканчивается
  // на предыдущем классе — те же точки, зеркальные по Y.
  const underPath = points.map((p, i) => `${i ? 'L' : 'M'}${round(x(p.size))} ${round(y(p.under))}`).join(' ');
  const overPath = points.map((p, i) => `${i ? 'L' : 'M'}${round(x(p.size))} ${round(y(100 - p.under))}`).join(' ');

  const yTicks = [0, 20, 40, 60, 80, 100];
  const xTicks = Array.from({ length: 5 }, (_, i) => round((maxSize / 4) * i));

  return (
    <Stack gap="sm" direction="column">
      <svg
        className={styles.chart}
        viewBox={`0 0 ${VB.w} ${VB.h}`}
        role="img"
        aria-label="Суммарные характеристики крупности — по плюсу и по минусу"
      >
        {yTicks.map((t) => (
          <g key={`y-${t}`}>
            <line x1={PAD.left} y1={y(t)} x2={VB.w - PAD.right} y2={y(t)} stroke="var(--color-border)" strokeWidth={1} />
            <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" fontSize={11} fill="var(--color-text-muted)">
              {t}
            </text>
          </g>
        ))}

        {xTicks.map((t) => (
          <text key={`x-${t}`} x={x(t)} y={VB.h - PAD.bottom + 18} textAnchor="middle" fontSize={11} fill="var(--color-text-muted)">
            {t}
          </text>
        ))}

        <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={VB.h - PAD.bottom} stroke="var(--color-border-strong)" strokeWidth={1} />
        <line
          x1={PAD.left}
          y1={VB.h - PAD.bottom}
          x2={VB.w - PAD.right}
          y2={VB.h - PAD.bottom}
          stroke="var(--color-border-strong)"
          strokeWidth={1}
        />

        <text x={(PAD.left + VB.w - PAD.right) / 2} y={VB.h - 6} textAnchor="middle" fontSize={12} fill="var(--color-text-muted)">
          Размер класса, мм
        </text>
        <text
          x={16}
          y={(PAD.top + VB.h - PAD.bottom) / 2}
          textAnchor="middle"
          fontSize={12}
          fill="var(--color-text-muted)"
          transform={`rotate(-90 16 ${(PAD.top + VB.h - PAD.bottom) / 2})`}
        >
          Выход, %
        </text>

        <path d={overPath} fill="none" stroke="var(--color-warning-text)" strokeWidth={2} strokeDasharray="7 4" />
        <path d={underPath} fill="none" stroke="var(--color-accent)" strokeWidth={2} />
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
