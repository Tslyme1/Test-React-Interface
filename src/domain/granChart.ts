import type { GranRow } from './estimates';

/**
 * Геометрия графика суммарных характеристик крупности — отдельно от его
 * отрисовки.
 *
 * Разделено, потому что рисуют его двое: компонент `GranulometryChart`
 * (в интерфейсе, цветами системы) и печатный документ, у которого нет
 * ни React, ни токенов. Пока считалось внутри компонента, печать графика
 * означала бы второй экземпляр той же математики — и первое же изменение
 * шкалы разошлось бы между экраном и бумагой молча.
 */
export const CHART_BOX = { w: 640, h: 300 } as const;
export const CHART_PAD = { left: 52, right: 20, top: 16, bottom: 40 } as const;

const PLOT_W = CHART_BOX.w - CHART_PAD.left - CHART_PAD.right;
const PLOT_H = CHART_BOX.h - CHART_PAD.top - CHART_PAD.bottom;

function round(v: number): number {
  return Math.round(v * 10) / 10;
}

export type ChartTick = { value: number; x: number; y: number };

export type GranChartModel = {
  /** Кривая «по минусу» — выход зёрен мельче размера. */
  underPath: string;
  /** Кривая «по плюсу» — зеркальная ей. */
  overPath: string;
  /** Деления оси выхода, 0…100 %. */
  yTicks: ChartTick[];
  /** Деления оси размера, 0…максимум. */
  xTicks: ChartTick[];
  /** Координаты осей — левая вертикаль и нижняя горизонталь. */
  axisX: number;
  axisY: number;
  plotRight: number;
  plotTop: number;
};

/**
 * Модель графика по классам крупности. `null` — рисовать нечего:
 * классов нет или все их границы нечисловые.
 */
export function buildGranChart(rows: GranRow[]): GranChartModel | null {
  const sorted = [...rows]
    .map((r) => ({ size: Number(r.dTop), under: Number(r.pass) }))
    .filter((p) => Number.isFinite(p.size) && Number.isFinite(p.under))
    .sort((a, b) => a.size - b.size);

  /* Первый класс сам по себе не начинается с нуля — у него уже есть
     накопленный выход по минусу. Без точки (0, 0) кривая «по минусу»
     (и зеркальная ей «по плюсу») обрывалась бы на середине высоты
     графика, не доходя ни до нуля, ни до сотни у левого края. */
  const points = sorted.length > 0 && sorted[0].size > 0 ? [{ size: 0, under: 0 }, ...sorted] : sorted;
  if (points.length === 0) return null;

  const maxSize = Math.max(...points.map((p) => p.size), 1);
  const x = (size: number) => CHART_PAD.left + (size / maxSize) * PLOT_W;
  const y = (percent: number) => CHART_PAD.top + PLOT_H - (percent / 100) * PLOT_H;

  return {
    underPath: points.map((p, i) => `${i ? 'L' : 'M'}${round(x(p.size))} ${round(y(p.under))}`).join(' '),
    overPath: points.map((p, i) => `${i ? 'L' : 'M'}${round(x(p.size))} ${round(y(100 - p.under))}`).join(' '),
    yTicks: [0, 20, 40, 60, 80, 100].map((value) => ({ value, x: CHART_PAD.left, y: y(value) })),
    xTicks: Array.from({ length: 5 }, (_, i) => {
      const value = round((maxSize / 4) * i);
      return { value, x: x(value), y: CHART_BOX.h - CHART_PAD.bottom };
    }),
    axisX: CHART_PAD.left,
    axisY: CHART_BOX.h - CHART_PAD.bottom,
    plotRight: CHART_BOX.w - CHART_PAD.right,
    plotTop: CHART_PAD.top,
  };
}
