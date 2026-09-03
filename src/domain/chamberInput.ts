import type { ChamberCalibration, ChamberGeometryInput } from '@/domain/chamberGeometry';
import type { GeomData } from '@/types';
import { defaultWizardData } from '@/data/wizardDefaults';

/**
 * Значения по умолчанию для узлов профиля — те же, что и в форме
 * (`defaultWizardData().geom`), а не отдельный список чисел рядом.
 * Нужны только как запасной вариант для неразобранного поля: пустая
 * строка или «abc» в узле не должны обрушить всю цепочку.
 */
const FALLBACK = defaultWizardData().geom;

function toNum(raw: string, fallback: string): number {
  const parsed = Number(raw.replace(',', '.'));
  if (Number.isFinite(parsed)) return parsed;
  const backup = Number(fallback.replace(',', '.'));
  return Number.isFinite(backup) ? backup : 0;
}

/**
 * Форма шага «Геометрия» → входные данные схемы.
 *
 * Соответствие теперь прямое, один к одному: каждый узел цепочки —
 * своё поле формы, с теми же именами, что и подписи на чертеже. Раньше
 * форма несла тринадцать упрощённых полей, недостающие узлы брались из
 * зашитого здесь `DEFAULT_CHAMBER_GEOMETRY`, и половина чертежа не
 * отвечала ни на какое поле — подсвечивать при наведении было нечего.
 *
 * `D`, `H`, `S0` остаются особняком: в прототипе это производные
 * величины (считаются из построенной цепочки), а в визарде — независимый
 * ввод. Поэтому они идут не в узлы, а в `ChamberCalibration` —
 * калибровку поверх готового профиля (см. `applyCalibration`).
 *
 * `R`, `a` и число зон в цепочке не участвуют: они из другой части
 * методики (грансостав и усилия), а не из построения профиля.
 */
export function buildChamberSchemeProps(data: GeomData): { input: ChamberGeometryInput; calibration: ChamberCalibration } {
  /** Углы формы приводятся к градусам: цепочка строится только в них. */
  const deg = (raw: string, fallback: string): number => {
    const value = toNum(raw, fallback);
    return data.angleUnit === 'рад' ? (value * 180) / Math.PI : value;
  };

  const input: ChamberGeometryInput = {
    bowl: {
      anchorAngle: deg(data.a40, FALLBACK.a40),
      anchorRadius: toNum(data.r40, FALLBACK.r40),
      beta: [
        deg(data.b40, FALLBACK.b40),
        deg(data.b41, FALLBACK.b41),
        deg(data.b42, FALLBACK.b42),
        deg(data.b4i, FALLBACK.b4i),
      ],
      length: [
        toNum(data.l11, FALLBACK.l11),
        toNum(data.l12, FALLBACK.l12),
        toNum(data.l1i, FALLBACK.l1i),
        toNum(data.l2, FALLBACK.l2),
      ],
      terminalBeta: deg(data.b3, FALLBACK.b3),
    },
    cone: {
      anchorAngle: deg(data.a10, FALLBACK.a10),
      anchorRadius: toNum(data.r10, FALLBACK.r10),
      beta: [
        deg(data.b10, FALLBACK.b10),
        deg(data.b11, FALLBACK.b11),
        deg(data.b12, FALLBACK.b12),
        deg(data.b1i, FALLBACK.b1i),
      ],
      length: [
        toNum(data.L10, FALLBACK.L10),
        toNum(data.L11, FALLBACK.L11),
        toNum(data.L12, FALLBACK.L12),
        toNum(data.L1i, FALLBACK.L1i),
      ],
      terminalBeta: deg(data.b2, FALLBACK.b2),
    },
    theta: deg(data.theta, FALLBACK.theta),
    /* Направление построения в визарде не переключается: в прототипе это
       был отладочный флажок, а не параметр машины. */
    invert: false,
  };

  const targetDiameter = Number(data.D.replace(',', '.'));
  const targetHeight = Number(data.H.replace(',', '.'));
  const targetGap0 = Number(data.S0.replace(',', '.'));

  const calibration: ChamberCalibration = {
    targetDiameter: Number.isFinite(targetDiameter) && targetDiameter > 0 ? targetDiameter : undefined,
    targetHeight: Number.isFinite(targetHeight) && targetHeight > 0 ? targetHeight : undefined,
    targetGap0: Number.isFinite(targetGap0) && targetGap0 >= 0 ? targetGap0 : undefined,
  };

  return { input, calibration };
}
