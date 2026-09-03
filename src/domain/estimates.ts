import type { GeomData, GranData, Project, ProdData, StepKey } from '@/types';
import { STEP_TITLES } from './steps';
import { buildChamberSchemeProps } from './chamberInput';
import { applyCalibration, computeChamberGeometry, phiOf } from './chamberGeometry';

/**
 * Значения для экрана результатов.
 *
 * Состав отчёта повторяет распечатку программы-источника (пример расчёта
 * КМД-2200Т6 Мих.ГОК): по шагу «Геометрия» — параметры камеры и таблица
 * профиля по точкам, по «Грансоставу» — массивы D пред / D сред / 0.8·D пред
 * с долями классов, по «Продукту» — характерные крупности, усилия и мощность.
 *
 * Геометрия здесь считается по-настоящему: радиусы, углы лучей, длины
 * сегментов и зазоры — это выход `computeChamberGeometry`, той же цепочки,
 * что рисует схему. Всё остальное — иллюстративные оценки: в прототипе
 * реальных формул дробления не было («dummy formulas so each screen feels
 * calculated»), и честнее показать это прямо, чем выдать приблизительное
 * за инженерную методику.
 */

const toNum = (v: string): number => {
  const n = Number(v.replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

/** Строка «величина — значение — единица». */
export type KvRow = { label: string; value: string; unit: string };

/** Строка таблицы профиля: узел брони чаши и парный ему узел брони конуса. */
export type ProfileRow = {
  point: string;
  /** r₁ — радиус луча «подвес → точка чаши», мм. */
  r1: string;
  /** α₁ — угол этого луча от оси, град. */
  a1: string;
  /** r₄ — радиус луча «подвес → точка конуса», мм. */
  r4: string;
  /** α₄ — угол этого луча от оси, град. */
  a4: string;
  /** Длина сегмента чаши до этой точки, мм. */
  l: string;
  /** Нарастающая длина профиля чаши, мм. */
  lSum: string;
  /** Зазор между бронями в этой паре точек, мм. */
  s: string;
};

/** Строка грансостава: класс крупности и его доля. */
export type GranRow = {
  class: string;
  /** D пред — верхняя граница класса, мм. */
  dTop: string;
  /** D сред — середина класса, мм. */
  dMid: string;
  /** 0.8·D пред — расчётная ширина куска, мм. */
  d08: string;
  /** γ — доля класса. */
  gamma: string;
  /** Выход по минусу, %. */
  pass: string;
};

const NODE_NAMES = ['40 · 10', '41 · 11', '42 · 12', '4i · 1i', '3 · 2'];

/** Профиль камеры по точкам — реальный выход цепочки, а не оценка. */
export function estimateGeomProfile(data: GeomData): ProfileRow[] {
  const { input, calibration } = buildChamberSchemeProps(data);
  const { bowl, cone } = applyCalibration(computeChamberGeometry(input), calibration);

  let sum = 0;
  return bowl.points.map((b, i) => {
    const c = cone.points[i];
    const prev = i > 0 ? bowl.points[i - 1] : null;
    const segment = prev ? Math.hypot(b.x - prev.x, b.y - prev.y) : 0;
    sum += segment;

    return {
      point: NODE_NAMES[i] ?? String(i),
      r1: Math.hypot(b.x, b.y).toFixed(1),
      a1: phiOf(b).toFixed(2),
      r4: Math.hypot(c.x, c.y).toFixed(1),
      a4: phiOf(c).toFixed(2),
      l: segment.toFixed(1),
      lSum: sum.toFixed(1),
      s: Math.hypot(b.x - c.x, b.y - c.y).toFixed(1),
    };
  });
}

export function estimateGeom(data: GeomData): KvRow[] {
  const D = toNum(data.D);
  const H = toNum(data.H);
  const l2 = toNum(data.l2);
  const S0 = toNum(data.S0);
  const theta = toNum(data.theta);

  const profile = estimateGeomProfile(data);
  const last = profile[profile.length - 1];
  /** Угол на нижнюю точку конуса — α₂ распечатки. */
  const alpha2 = last ? Number(last.a4) : 0;
  /** Полная длина профиля брони чаши. */
  const chainLength = last ? Number(last.lSum) : 0;

  /**
   * Объём камеры — усечённый конус между бронями, м³. Оценка по габаритам,
   * а не интеграл по профилю: в распечатке это отдельная величина Q,
   * посчитанная своей методикой.
   */
  const volume = (Math.PI / 4) * Math.pow(D / 1000, 2) * (H / 1000) * 0.33;

  return [
    { label: 'D — диаметр основания', value: D.toFixed(1), unit: 'мм' },
    { label: 'D / 2', value: (D / 2).toFixed(1), unit: 'мм' },
    { label: 'H — высота камеры', value: H.toFixed(1), unit: 'мм' },
    { label: 'h — до нижней точки конуса', value: Math.max(H - l2, 0).toFixed(1), unit: 'мм' },
    { label: 'S₀ — выходная щель', value: S0.toFixed(1), unit: 'мм' },
    { label: 'θ — угол качания', value: theta.toFixed(2), unit: data.angleUnit === 'рад' ? 'рад' : 'град' },
    { label: 'α₂ — угол на нижнюю точку конуса', value: alpha2.toFixed(2), unit: 'град' },
    { label: 'Длина профиля брони чаши', value: chainLength.toFixed(1), unit: 'мм' },
    { label: 'Число зон дробления', value: data.zones, unit: '' },
    { label: 'Q — объём камеры', value: volume.toFixed(4), unit: 'м³' },
  ];
}

/**
 * Шкала классов крупности — геометрическая прогрессия от `dMin` к `dMax`,
 * как «Массив D пред(I)» распечатки: у мелких классов шаг мельче, у крупных
 * крупнее, потому что распределение продукта тоже неравномерно.
 */
/**
 * Классы крупности геометрической прогрессией от `dMin` к `dMax` — общий
 * генератор для питания (`estimateGran`) и продукта (`estimateProdGran`):
 * у обоих один и тот же смысл столбцов, разнится только откуда берутся
 * `dMin`/`dMax` и форма кривой (`k`, `z0`).
 */
function buildGranClasses(dMin: number, dMaxRaw: number, k: number, z0: number): GranRow[] {
  const dMax = Math.max(dMaxRaw, dMin + 1);
  const kSafe = Math.max(k, 0.1);
  const z0Safe = Math.max(z0, 0.1);

  const steps = 8;
  const rows: GranRow[] = [];
  let prevTop = dMin;
  let prevPass = 0;

  for (let i = 1; i <= steps; i += 1) {
    const frac = i / steps;
    // Прогрессия по кубу доли — мелкие классы дробятся чаще крупных.
    const top = dMin + (dMax - dMin) * Math.pow(frac, 1 / z0Safe);
    const mid = (prevTop + top) / 2;
    const pass = Math.min(100 * (1 - Math.exp(-kSafe * frac * 3)), 100);

    rows.push({
      class: `−${top.toFixed(1)} +${prevTop.toFixed(1)}`,
      dTop: top.toFixed(2),
      dMid: mid.toFixed(2),
      d08: (top * 0.8).toFixed(2),
      gamma: ((pass - prevPass) / 100).toFixed(4),
      pass: pass.toFixed(1),
    });

    prevTop = top;
    prevPass = pass;
  }

  return rows;
}

export function estimateGran(data: GranData): GranRow[] {
  return buildGranClasses(toNum(data.dMin), toNum(data.dMax), toNum(data.n0), toNum(data.z0));
}

/**
 * Грансостав ПРОДУКТА — тот же генератор классов, что и у питания, но
 * по границам `dMin`/`dMax` продукта и с формой кривой от работы разрушения
 * `wk` (чем она больше, тем круче кривая — продукт однороднее по крупности).
 * В распечатке программы-источника это отдельный блок расчёта («РАСЧЕТ
 * ГРАНСОСТАВА ПРОДУКТА»), а не побочный вывод усилий и мощности — здесь
 * то же самое: `estimateProd` считает силовые величины, эта функция —
 * состав по классам для таблицы и графика.
 */
export function estimateProdGran(data: ProdData): GranRow[] {
  // `wk` — работа разрушения, на порядок крупнее шкалы `k`, на которой
  // построен `buildGranClasses` (там она играет роль `n0` из GranData,
  // диапазон ~0.5–1.5): без пересчёта кривая выхода насыщалась до 100 %
  // уже на втором классе, и распределение выглядело ступенькой, а не
  // плавной S-образной кривой.
  const k = Math.max(toNum(data.wk) / 15, 0.1);
  return buildGranClasses(toNum(data.dMin), toNum(data.dMax), k, 1);
}

export function estimateProd(data: ProdData, geom: GeomData): KvRow[] {
  const D = toNum(geom.D);
  const S0 = toNum(geom.S0);
  const dMax = toNum(data.dMax);
  const kpd = toNum(data.kpd) || 0.8;

  /** Характерные крупности продукта — D₀₅ и производные от него, как в USILK. */
  const d05 = Math.max(dMax * 0.96, S0);
  const dSred = d05 * 0.63;

  const capacity = (D * S0 * kpd) / 1000;
  /** Усилие дробления — оценка по площади щели и удельному сопротивлению. */
  const force = (D / 1000) * (S0 / 1000) * 24;
  /** Мощность — работа разрушения на производительность, с поправкой на КПД. */
  const power = (capacity * 0.9) / Math.max(kpd, 0.1);

  return [
    { label: 'D₀₅ — крупность 50 % выхода', value: d05.toFixed(2), unit: 'мм' },
    { label: '0.8 · D₀₅', value: (d05 * 0.8).toFixed(2), unit: 'мм' },
    { label: 'D ср — средний диаметр куска', value: dSred.toFixed(2), unit: 'мм' },
    { label: 'Максимальная крупность продукта', value: data.dMax, unit: 'мм' },
    { label: 'Q — производительность', value: capacity.toFixed(1), unit: 'т/ч' },
    { label: 'P — усилие дробления', value: force.toFixed(2), unit: 'МН' },
    { label: 'N — мощность дробления', value: power.toFixed(1), unit: 'кВт' },
    { label: 'КПД привода', value: (kpd * 100).toFixed(0), unit: '%' },
  ];
}

export type StepReport =
  | { kind: 'kv'; title: string; rows: KvRow[]; profile?: ProfileRow[]; gran?: GranRow[] }
  | { kind: 'gran'; title: string; rows: GranRow[] };

/**
 * Одна и та же оценка — что на экране в панели результата, что в печати:
 * оба места собирают отчёт отсюда, а не считают заново каждое по-своему.
 */
export function buildStepReport(project: Project, stepKey: StepKey): StepReport {
  if (stepKey === 'gran') {
    return { kind: 'gran', title: STEP_TITLES.gran, rows: estimateGran(project.data.gran) };
  }
  if (stepKey === 'prod') {
    return {
      kind: 'kv',
      title: STEP_TITLES.prod,
      rows: estimateProd(project.data.prod, project.data.geom),
      gran: estimateProdGran(project.data.prod),
    };
  }
  return {
    kind: 'kv',
    title: STEP_TITLES.geom,
    rows: estimateGeom(project.data.geom),
    profile: estimateGeomProfile(project.data.geom),
  };
}
