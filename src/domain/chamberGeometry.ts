/**
 * Чертёж профиля камеры — точки для `ChamberScheme`, полученные из расчёта
 * этапа 1 (`chamberProfile.ts`), а не построенные отдельно от него.
 *
 * Раньше здесь жила собственная геометрия: два контура строились независимо
 * друг от друга («повернуть на β, шагнуть на L» от произвольного якорного
 * луча), а затем `applyCalibration` подгоняла результат под введённые D и H
 * **неравномерным** масштабом по осям и сдвигала конус целиком ради S₀.
 * Неравномерный масштаб меняет каждый угол, поэтому чертёж переставал
 * отвечать введённым β, а зазор наверху был случайным числом.
 *
 * Теперь единственный источник истины — методика: точки контуров это в
 * точности полярные координаты расчётных сечений (R1, α1) и (R4, α4)
 * относительно точки подвеса. Никакого масштабирования под габариты не
 * нужно: D, H и S₀ входят в саму рекурсию и потому выполняются точно.
 */

import { computeChamberProfile } from '@/domain/chamberProfile';
import type { ChamberProfile, ChamberProfileInput } from '@/domain/chamberProfile';

const D2R = Math.PI / 180;
const R2D = 180 / Math.PI;

export type Vec2 = { x: number; y: number };

/** Направление под углом phi от оси дробилки (вниз), положительный отсчёт — влево. */
export function dir(phiDeg: number): Vec2 {
  return { x: -Math.sin(phiDeg * D2R), y: Math.cos(phiDeg * D2R) };
}

/** Угол луча «точка подвеса → p», в той же конвенции, что и `dir`. */
export function phiOf(p: Vec2): number {
  return Math.atan2(-p.x, p.y) / D2R;
}

/** Приводит угол к диапазону (−180, 180]. */
export function norm(deg: number): number {
  let d = deg;
  while (d <= -180) d += 360;
  while (d > 180) d -= 360;
  return d;
}

export function polar(center: Vec2, radius: number, phiDeg: number): Vec2 {
  const d = dir(phiDeg);
  return { x: center.x + d.x * radius, y: center.y + d.y * radius };
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Ломаная дуги от угла a0 до угла a1 (конвенция `dir`) вокруг центра радиусом R — как атрибут `d` у `<path>`. */
export function arcPath(center: Vec2, radius: number, fromDeg: number, toDeg: number): string {
  const delta = norm(toDeg - fromDeg);
  const steps = Math.max(8, Math.round(Math.abs(delta) / 4));
  const parts: string[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const angle = fromDeg + (delta * i) / steps;
    const p = polar(center, radius, angle);
    parts.push(`${i ? 'L' : 'M'}${round2(p.x)} ${round2(p.y)}`);
  }
  return parts.join(' ');
}

export type ChainPointInfo = {
  /** Угол луча «подвес → узел», град. */
  phiRay: number;
  /** Угол сегмента, выходящего из узла вниз, град. */
  phiSeg: number;
  /** Действующий угол образующей (для конуса — с поправкой на нутацию), град. */
  eff: number;
  /** Введённый угол образующей β, град. */
  beta: number;
  /** Длина сегмента, выходящего из узла, мм. */
  length: number;
  /** Последний узел контура — сегмента ниже него нет. */
  terminal?: boolean;
};

export type ChainResult = {
  points: Vec2[];
  info: ChainPointInfo[];
};

export type ChamberGeometry = {
  /** Броня чаши — внешний контур, узлы 40 · 41 · 42 · 4i · 3. */
  bowl: ChainResult;
  /** Броня конуса — внутренний контур, узлы 10 · 11 · 12 · 1i · 2. */
  cone: ChainResult;
  /** Расчёт этапа 1 целиком — из него берутся подписи S1, SOT и таблица отчёта. */
  profile: ChamberProfile;
};

/**
 * Шаг вдоль образующей: угол β отсчитывается от радиального направления,
 * образующая уходит вниз и наружу от оси (в этой системе — в минус по x).
 */
function alongGeneratrix(from: Vec2, beta: number, length: number): Vec2 {
  return { x: from.x - Math.cos(beta) * length, y: from.y + Math.sin(beta) * length };
}

function chainFrom(points: Vec2[], betaDeg: number[], swingDeg: number): ChainResult {
  const info: ChainPointInfo[] = points.map((p, i) => {
    const next = points[i + 1];
    const beta = betaDeg[i];
    const eff = beta - swingDeg;
    const phiRay = phiOf(p);
    /* Угол сегмента берётся по факту — от узла к следующему узлу, а не
       пересчётом из β: дуга угла на чертеже обязана лечь на ту самую линию,
       которая нарисована, иначе подпись β указывает мимо своего сегмента. */
    const phiSeg = next ? phiOf({ x: next.x - p.x, y: next.y - p.y }) : phiOf(dir(90 - eff));
    return {
      phiRay,
      phiSeg,
      eff,
      beta,
      length: next ? Math.hypot(next.x - p.x, next.y - p.y) : 0,
      terminal: next === undefined,
    };
  });
  return { points, info };
}

/**
 * Узлы чертежа — это расчётные сечения 1…KU плюс основание конуса,
 * лежащее на длину зоны калибровки ниже последнего сечения.
 *
 * Сечение 0 в узлы не идёт: оно дублирует первое (шаг 8 методики) и
 * существует только ради строки отчёта с углами зоны входа β₁₀ и β₄₀.
 */
export function buildChamberGeometry(input: ChamberProfileInput): ChamberGeometry {
  const profile = computeChamberProfile(input);
  const { sections, KU } = profile;

  const conePoints: Vec2[] = [];
  const bowlPoints: Vec2[] = [];
  const coneBeta: number[] = [];
  const bowlBeta: number[] = [];

  for (let i = 1; i <= KU; i += 1) {
    const s = sections[i];
    conePoints.push(polar({ x: 0, y: 0 }, s.R1, s.alpha1 * R2D));
    bowlPoints.push(polar({ x: 0, y: 0 }, s.R4, s.alpha4 * R2D));
    coneBeta.push(s.beta1 * R2D);
    bowlBeta.push(s.beta4 * R2D);
  }

  /* Основание дробящего конуса — ровно (D/2, H) из формы: сечение KU
     отстоит от него на зону калибровки вверх по образующей, поэтому оба
     габарита ложатся на этот узел без всякой подгонки. */
  conePoints.push({ x: -input.D / 2, y: input.H });
  bowlPoints.push(alongGeneratrix(bowlPoints[bowlPoints.length - 1], sections[KU].beta4, input.l2));
  coneBeta.push(sections[KU].beta1 * R2D);
  bowlBeta.push(sections[KU].beta4 * R2D);

  return {
    bowl: chainFrom(bowlPoints, bowlBeta, 0),
    cone: chainFrom(conePoints, coneBeta, input.theta * R2D),
    profile,
  };
}

export type ViewBoxArea = { x: number; y: number; w: number; h: number };

export type ChamberTransform = {
  k: number;
  ox: number;
  oy: number;
  point: (p: Vec2) => Vec2;
};

/**
 * Масштаб — отдельным шагом: bbox точек (с учётом подвеса в (0,0)) →
 * фиксированная область viewBox. Масштаб **равномерный** по обеим осям,
 * поэтому все углы чертежа остаются теми, что посчитаны.
 */
export function makeTransform(points: Vec2[], area: ViewBoxArea): ChamberTransform {
  let minX = 0;
  let maxX = 0;
  let minY = 0;
  let maxY = 0;
  for (const p of points) {
    if (p.x < minX) minX = p.x;
    if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.y > maxY) maxY = p.y;
  }
  const bw = Math.max(maxX - minX, 1e-6);
  const bh = Math.max(maxY - minY, 1e-6);
  const k = Math.min(area.w / bw, area.h / bh);
  const ox = area.x + (area.w - bw * k) / 2 - minX * k;
  const oy = area.y + (area.h - bh * k) / 2 - minY * k;
  return {
    k,
    ox,
    oy,
    point: (p) => ({ x: ox + p.x * k, y: oy + p.y * k }),
  };
}
