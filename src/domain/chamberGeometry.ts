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
  /** Угол образующей к горизонтали в том положении, в котором она нарисована, град. */
  eff: number;
  /** Он же — оставлен как есть, наклон уже учтён при построении. */
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
 * Шаг вдоль образующей: угол β отсчитывается от радиального направления
 * (от горизонтали), образующая уходит вниз и наружу от оси — в этой
 * системе координат в минус по x.
 */
function alongGeneratrix(from: Vec2, beta: number, length: number): Vec2 {
  return { x: from.x - Math.cos(beta) * length, y: from.y + Math.sin(beta) * length };
}

/**
 * Узел j несёт угол образующей, приходящей в него СВЕРХУ, — так подписан
 * и чертёж методики: β₄₀ стоит у узла 40, над которым только зона входа,
 * а β₃ — у самого нижнего узла 3, над которым зона калибровки. Поэтому
 * `betaDeg[j]` — это угол участка (j−1)→j, а у верхнего узла — угол
 * стенки приёмной части.
 */
function chainFrom(points: Vec2[], betaDeg: number[]): ChainResult {
  const info: ChainPointInfo[] = points.map((p, i) => {
    const prev = points[i - 1];
    const beta = betaDeg[i];
    const phiRay = phiOf(p);
    /* Направление берётся по факту — от предыдущего узла к этому, а не
       пересчётом из β: дуга обязана лечь на ту самую линию, которая
       нарисована, иначе подпись указывает мимо своего участка. У верхнего
       узла участка выше нет, там направление строится из самого β. */
    const phiSeg = prev ? phiOf({ x: p.x - prev.x, y: p.y - prev.y }) : 90 - beta;
    return {
      phiRay,
      phiSeg,
      eff: beta,
      beta,
      length: prev ? Math.hypot(p.x - prev.x, p.y - prev.y) : 0,
      terminal: i === 0,
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
  const theta = input.theta;

  const conePoints: Vec2[] = [];
  const bowlPoints: Vec2[] = [];
  const coneBeta: number[] = [];
  const bowlBeta: number[] = [];

  for (let i = 1; i <= KU; i += 1) {
    const s = sections[i];
    /*
     * Ключевая тонкость: α₁ отсчитывается от оси КОНУСА, а α₄ — от оси
     * дробилки. Оси расходятся на угол нутации θ, поэтому в общей системе
     * чертежа узел конуса стоит под α₁ + θ.
     *
     * Это не косметика. Формула шага 6 выводит R4 из треугольника
     * «подвес — узел конуса — узел чаши», в котором сторона между узлами
     * равна раскрытию S1. Сходится она только в рабочем положении: при
     * α₁ + θ хорда между парными узлами совпадает с S1 до последнего
     * знака на всех сечениях контрольного примера, а при α₁ расходится
     * (43 против 75 мм в разгрузочной кромке). Отсюда же и подписи
     * методики «β₁ᵢ − θ»: повёрнутый конус даёт именно такой наклон
     * образующей к горизонтали.
     */
    conePoints.push(polar({ x: 0, y: 0 }, s.R1, (s.alpha1 + theta) * R2D));
    bowlPoints.push(polar({ x: 0, y: 0 }, s.R4, s.alpha4 * R2D));
    /* Угол берётся у сечения на единицу выше: узел несёт наклон образующей,
       приходящей в него сверху (см. `chainFrom`). У верхнего узла это
       сечение 0 — зона входа с её β₁₀ и β₄₀. */
    const above = sections[i - 1];
    coneBeta.push((above.beta1 - theta) * R2D);
    bowlBeta.push(above.beta4 * R2D);
  }

  /* Основание дробящего конуса: в нейтральном положении это ровно
     (D/2, H) из формы, здесь — оно же, повёрнутое вместе с конусом.
     Поворот жёсткий, вокруг точки подвеса, поэтому длина зоны калибровки
     и диаметр основания остаются теми, что введены. */
  const baseR = Math.hypot(input.D / 2, input.H);
  const baseAlpha = Math.atan2(input.D / 2, input.H) + theta;
  conePoints.push(polar({ x: 0, y: 0 }, baseR, baseAlpha * R2D));
  bowlPoints.push(alongGeneratrix(bowlPoints[bowlPoints.length - 1], sections[KU].beta4, input.l2));
  /* Основание несёт угол зоны калибровки — участка, приходящего в него. */
  coneBeta.push((sections[KU].beta1 - theta) * R2D);
  bowlBeta.push(sections[KU].beta4 * R2D);

  return {
    /* `swing` больше не вычитается внутри: наклон уже учтён в самих углах,
       поэтому подписи показывают ровно то, что нарисовано. */
    bowl: chainFrom(bowlPoints, bowlBeta),
    cone: chainFrom(conePoints, coneBeta),
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
