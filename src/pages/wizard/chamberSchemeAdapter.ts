import type { ChamberCalibration, ChamberGeometryInput } from '@/domain/chamberGeometry';
import type { GeomData } from '@/types';

/**
 * Значения по умолчанию для узлов профиля, которых нет в форме шага
 * «Геометрия» (`GeomData`). Перенесены из демонстрационного объекта `st`
 * прототипа-источника (`legacy-prototype/uploads/cone-crusher-chamber.html`)
 * — те же самые числа, никакой новой методики.
 */
export const DEFAULT_CHAMBER_GEOMETRY: ChamberGeometryInput = {
  bowl: {
    anchorAngle: 84.5,
    anchorRadius: 1300,
    beta: [100, 143.5, 138, 157],
    length: [480, 368, 347, 535],
    terminalBeta: 150,
  },
  cone: {
    anchorAngle: 58,
    anchorRadius: 820,
    beta: [163, 171, 161, 167],
    length: [460, 350, 380, 520],
    terminalBeta: 165,
  },
  theta: 2,
  invert: false,
};

function toNum(raw: string): number {
  const n = Number(raw.replace(',', '.'));
  return Number.isFinite(n) ? n : NaN;
}

/**
 * `GeomData` — упрощённое подмножество параметров: 13 полей против ~24
 * в полной цепочке прототипа. Прямое соответствие есть только у части
 * полей:
 *
 * - `theta` → θ (тот же смысл, тот же узел `computeChamberGeometry`).
 * - `beta10` → первый узловой угол брони конуса (β10 прототипа).
 * - `beta40` → первый узловой угол брони чаши (β40 прототипа).
 * - `beta2` → терминальный угол брони конуса, «угол на выходе конуса»
 *   (β2 прототипа).
 * - `l2` → длина последнего сегмента брони чаши (4i→3, «длина параллельной
 *   зоны» — тот же калибровочный сегмент l2, что и в прототипе).
 * - `l11` → длина первого сегмента брони чаши (40→41).
 * - `l12` → длина второго сегмента брони чаши (41→42). Подставляется только
 *   при `zones === '2'` — при одной зоне дробления прототип второй сегмент
 *   не выделяет отдельным полем, и здесь остаётся значение по умолчанию.
 *
 * `D`, `H`, `S0` в прототипе — производные величины (считаются из уже
 * построенной цепочки), а не входные параметры узла. В форме визарда они,
 * наоборот, независимый ввод. Поэтому они не подставляются в узлы цепочки,
 * а идут в `ChamberCalibration` — калибровку поверх готового профиля (см.
 * комментарий у `applyCalibration`).
 *
 * `R` и `a` в форме есть (перенесены из группы «Геометрия камеры» прототипа),
 * но в прототипе они относятся к другой части методики (грансостав/усилия),
 * а не к цепочке профиля — `computeChamberGeometry` их не использует.
 *
 * Остальные узлы (r40, r10, a40, a10, промежуточные β и L, терминальный β3)
 * в `GeomData` не заведены — используются значения по умолчанию.
 * «Инвертировать направление β» из прототипа тоже не имеет отдельного поля
 * в форме — направление фиксировано (`invert: false`, как и в прототипе).
 */
export function buildChamberSchemeProps(data: GeomData): { input: ChamberGeometryInput; calibration: ChamberCalibration } {
  const toDeg = (raw: string): number => {
    const n = toNum(raw);
    if (!Number.isFinite(n)) return NaN;
    return data.angleUnit === 'рад' ? (n * 180) / Math.PI : n;
  };

  const theta = toDeg(data.theta);
  const beta10 = toDeg(data.beta10);
  const beta40 = toDeg(data.beta40);
  const beta2 = toDeg(data.beta2);
  const l2 = toNum(data.l2);
  const l11 = toNum(data.l11);
  const l12 = toNum(data.l12);
  const targetDiameter = toNum(data.D);
  const targetHeight = toNum(data.H);
  const targetGap0 = toNum(data.S0);

  const defaults = DEFAULT_CHAMBER_GEOMETRY;

  const input: ChamberGeometryInput = {
    bowl: {
      ...defaults.bowl,
      beta: [Number.isFinite(beta40) ? beta40 : defaults.bowl.beta[0], defaults.bowl.beta[1], defaults.bowl.beta[2], defaults.bowl.beta[3]],
      length: [
        Number.isFinite(l11) && l11 > 0 ? l11 : defaults.bowl.length[0],
        data.zones === '2' && Number.isFinite(l12) && l12 > 0 ? l12 : defaults.bowl.length[1],
        defaults.bowl.length[2],
        Number.isFinite(l2) && l2 > 0 ? l2 : defaults.bowl.length[3],
      ],
    },
    cone: {
      ...defaults.cone,
      beta: [Number.isFinite(beta10) ? beta10 : defaults.cone.beta[0], defaults.cone.beta[1], defaults.cone.beta[2], defaults.cone.beta[3]],
      terminalBeta: Number.isFinite(beta2) ? beta2 : defaults.cone.terminalBeta,
    },
    theta: Number.isFinite(theta) ? theta : defaults.theta,
    invert: defaults.invert,
  };

  const calibration: ChamberCalibration = {
    targetDiameter: Number.isFinite(targetDiameter) && targetDiameter > 0 ? targetDiameter : undefined,
    targetHeight: Number.isFinite(targetHeight) && targetHeight > 0 ? targetHeight : undefined,
    targetGap0: Number.isFinite(targetGap0) && targetGap0 >= 0 ? targetGap0 : undefined,
  };

  return { input, calibration };
}
