/**
 * Геометрия профиля камеры дробления конусной дробилки.
 *
 * Математика (`dir`, `buildChain`, `computeChamberGeometry`, `makeTransform`)
 * перенесена 1:1 из `legacy-prototype/uploads/cone-crusher-chamber.html` —
 * принцип «повернуть на β, шагнуть на L» от точки подвеса. Отличие от
 * прототипа только в форме: там строка HTML собиралась через innerHTML,
 * здесь — чистые функции, которые потребляет декларативный React-компонент
 * (`ChamberScheme`).
 *
 * `applyCalibration` в прототипе не было: это добавка для связи схемы с
 * полями шага «Геометрия» (D, H, S0), которые в прототипе были производными
 * значениями, а в визарде — независимым вводом пользователя. Подробности —
 * в комментарии у функции.
 */

const D2R = Math.PI / 180;

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

export type ChainNode = { beta: number; length: number };

export type ChainPointInfo = {
  phiRay: number;
  phiSeg: number;
  eff: number;
  beta: number;
  length: number;
  terminal?: boolean;
};

export type ChainResult = {
  /** Точки профиля, включая якорную (первую) и терминальную (последнюю). */
  points: Vec2[];
  info: ChainPointInfo[];
};

/**
 * Строит цепочку точек профиля: первая точка задаётся якорем (alpha, r),
 * каждая следующая — поворотом на угол β относительно луча «точка подвеса →
 * предыдущая точка» и шагом на длину L. Действующий угол узла — β − swingAngle
 * (для брони конуса swingAngle = θ, для брони чаши — 0).
 */
export function buildChain(
  anchorAngle: number,
  anchorRadius: number,
  nodes: ChainNode[],
  terminalBeta: number,
  swingAngle: number,
  invert: boolean,
): ChainResult {
  const sign = invert ? -1 : 1;
  const d0 = dir(anchorAngle);
  let p: Vec2 = { x: d0.x * anchorRadius, y: d0.y * anchorRadius };
  const points: Vec2[] = [p];
  const info: ChainPointInfo[] = [];

  for (const node of nodes) {
    const phiRay = phiOf(p);
    const eff = node.beta - swingAngle;
    const phiSeg = phiRay - sign * (180 - eff);
    const d = dir(phiSeg);
    const q: Vec2 = { x: p.x + d.x * node.length, y: p.y + d.y * node.length };
    info.push({ phiRay, phiSeg, eff, beta: node.beta, length: node.length });
    points.push(q);
    p = q;
  }

  // терминальный узел — без сегмента, только направление для наглядности
  const phiRay = phiOf(p);
  const effTerm = terminalBeta - swingAngle;
  info.push({
    phiRay,
    phiSeg: phiRay - sign * (180 - effTerm),
    eff: effTerm,
    beta: terminalBeta,
    length: 0,
    terminal: true,
  });

  return { points, info };
}

/** Узлы одной цепочки профиля: якорь + 4 сегмента + терминальный угол. */
export type ChainSpec = {
  /** α — угол первой (якорной) точки от оси дробилки, град. */
  anchorAngle: number;
  /** r — длина луча до первой точки, мм. */
  anchorRadius: number;
  /** β в каждом из 4 узлов, град. */
  beta: [number, number, number, number];
  /** L каждого из 4 сегментов, мм. */
  length: [number, number, number, number];
  /** β терминального узла (без сегмента), град. */
  terminalBeta: number;
};

export type ChamberGeometryInput = {
  /** Броня чаши — неподвижный профиль 40·41·42·4i·3. */
  bowl: ChainSpec;
  /** Броня конуса — гирационный профиль 10·11·12·1i·2. */
  cone: ChainSpec;
  /** θ — угол качания (гирации) конуса, град. Действующий угол узла конуса — β − θ. */
  theta: number;
  /** Направление построения (знак поворота на β) — неоднозначно без исходной методики. */
  invert?: boolean;
};

export type ChamberGeometry = {
  bowl: ChainResult;
  cone: ChainResult;
};

export function computeChamberGeometry(input: ChamberGeometryInput): ChamberGeometry {
  const invert = input.invert ?? false;
  const bowlNodes: ChainNode[] = input.bowl.beta.map((beta, i) => ({ beta, length: input.bowl.length[i] }));
  const coneNodes: ChainNode[] = input.cone.beta.map((beta, i) => ({ beta, length: input.cone.length[i] }));

  const bowl = buildChain(input.bowl.anchorAngle, input.bowl.anchorRadius, bowlNodes, input.bowl.terminalBeta, 0, invert);
  const cone = buildChain(input.cone.anchorAngle, input.cone.anchorRadius, coneNodes, input.cone.terminalBeta, input.theta, invert);

  return { bowl, cone };
}

export type ViewBoxArea = { x: number; y: number; w: number; h: number };

export type ChamberTransform = {
  k: number;
  ox: number;
  oy: number;
  point: (p: Vec2) => Vec2;
};

/** Масштаб — отдельным шагом: bbox точек (с учётом подвеса в (0,0)) → фиксированная область viewBox. */
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

export type ChamberCalibration = {
  /** D, мм — целевой габарит по горизонтали (диаметр основания, удвоенное расстояние от оси до нижней точки конуса). */
  targetDiameter?: number;
  /** H, мм — целевой габарит по вертикали (высота камеры до нижней точки конуса). */
  targetHeight?: number;
  /** S0, мм — целевая ширина зазора в зоне калибровки (между терминальными точками профилей). */
  targetGap0?: number;
};

/**
 * В прототипе-источнике D/2, h и S0 — производные величины (считаются из
 * уже построенной цепочки, полей для них в панели нет). В визарде эти три
 * поля, наоборот, — независимый ввод пользователя («Диаметр основания D»,
 * «Высота камеры H», «Ширина разгрузочной щели S0»), а не параметры узла
 * цепочки buildChain.
 *
 * Чтобы поля были не просто цифрами, а видимо влияли на схему, здесь
 * применяется калибровка поверх уже построенного профиля — отдельным
 * шагом, не трогающим `buildChain`:
 *  1) равномерный по осям (анизотропный) масштаб всей пары профилей так,
 *     чтобы нижняя точка конуса (2) оказалась на целевых D/2 и H;
 *  2) после масштаба — жёсткий сдвиг брони конуса вдоль линии зазора
 *     между терминальными точками (3 брони чаши и 2 брони конуса) так,
 *     чтобы их расстояние стало равно целевому S0. Физически это похоже
 *     на регулировку разгрузочной щели эксцентриком: неподвижная броня
 *     чаши остаётся на месте, конус сдвигается целиком, без искажения
 *     собственной формы.
 *
 * Если целевое значение не задано (пустое/невалидное поле формы), тот шаг
 * калибровки пропускается и профиль остаётся как построен `buildChain`.
 */
export function applyCalibration(geometry: ChamberGeometry, calibration: ChamberCalibration): ChamberGeometry {
  const bottom = geometry.cone.points[geometry.cone.points.length - 1];
  const rawD2 = Math.abs(bottom.x) || 1e-6;
  const rawH = bottom.y || 1e-6;

  const sx = calibration.targetDiameter && calibration.targetDiameter > 0 ? calibration.targetDiameter / 2 / rawD2 : 1;
  const sy = calibration.targetHeight && calibration.targetHeight > 0 ? calibration.targetHeight / rawH : 1;

  const scale = (p: Vec2): Vec2 => ({ x: p.x * sx, y: p.y * sy });
  const bowlPoints = geometry.bowl.points.map(scale);
  const conePoints = geometry.cone.points.map(scale);

  let calibratedCone = conePoints;
  if (calibration.targetGap0 !== undefined && calibration.targetGap0 >= 0) {
    const bowlEnd = bowlPoints[bowlPoints.length - 1];
    const coneEnd = conePoints[conePoints.length - 1];
    const gapVec = { x: coneEnd.x - bowlEnd.x, y: coneEnd.y - bowlEnd.y };
    const gapLen = Math.hypot(gapVec.x, gapVec.y);
    if (gapLen > 1e-6) {
      const unit = { x: gapVec.x / gapLen, y: gapVec.y / gapLen };
      const delta = calibration.targetGap0 - gapLen;
      calibratedCone = conePoints.map((p) => ({ x: p.x + unit.x * delta, y: p.y + unit.y * delta }));
    }
  }

  return {
    bowl: { points: bowlPoints, info: geometry.bowl.info },
    cone: { points: calibratedCone, info: geometry.cone.info },
  };
}
