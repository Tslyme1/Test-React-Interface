import type { ChamberProfileInput } from '@/domain/chamberProfile';
import type { GeomData } from '@/types';
import { defaultWizardData } from '@/data/wizardDefaults';

/**
 * Значения по умолчанию для узлов профиля — те же, что и в форме
 * (`defaultWizardData().geom`), а не отдельный список чисел рядом.
 * Нужны только как запасной вариант для неразобранного поля: пустая
 * строка или «abc» в узле не должны обрушить весь расчёт.
 */
const FALLBACK = defaultWizardData().geom;

/**
 * Число зон дробления задано самим набором полей: три длины (l₁₁, l₁₂, l₁ᵢ)
 * плюс зона калибровки l₂ — ровно структура контрольного примера методики
 * и ровно пять узлов, которые рисует чертёж.
 */
export const CRUSHING_ZONES = 3;

function toNum(raw: string, fallback: string): number {
  const parsed = Number(String(raw ?? '').replace(',', '.'));
  if (Number.isFinite(parsed)) return parsed;
  const backup = Number(fallback.replace(',', '.'));
  return Number.isFinite(backup) ? backup : 0;
}

/**
 * Форма шага «Геометрия» → исходные данные этапа 1.
 *
 * Соответствие прямое: каждое поле формы — одна величина методики.
 * Величины, которые методика выводит сама (радиус-векторы и их углы,
 * длины сегментов чаши, терминальный угол β₃ = β₂ − θ), в форме больше
 * не спрашиваются — иначе профиль переопределён и спорит сам с собой.
 *
 * Углы приводятся к радианам: вся математика профиля ведётся в них,
 * как и в самой методике.
 */
export function buildChamberProfileInput(data: GeomData): ChamberProfileInput {
  const rad = (raw: string, fallback: string): number => {
    const value = toNum(raw, fallback);
    return data.angleUnit === 'рад' ? value : (value * Math.PI) / 180;
  };
  const mm = (raw: string, fallback: string): number => toNum(raw, fallback);

  return {
    zones: CRUSHING_ZONES,
    beta10: rad(data.b10, FALLBACK.b10),
    beta1: [rad(data.b11, FALLBACK.b11), rad(data.b12, FALLBACK.b12), rad(data.b1i, FALLBACK.b1i)],
    beta2: rad(data.b2, FALLBACK.b2),
    beta40: rad(data.b40, FALLBACK.b40),
    beta4: [rad(data.b41, FALLBACK.b41), rad(data.b42, FALLBACK.b42), rad(data.b4i, FALLBACK.b4i)],
    l1: [mm(data.l11, FALLBACK.l11), mm(data.l12, FALLBACK.l12), mm(data.l1i, FALLBACK.l1i)],
    l2: mm(data.l2, FALLBACK.l2),
    D: mm(data.D, FALLBACK.D),
    H: mm(data.H, FALLBACK.H),
    S0: mm(data.S0, FALLBACK.S0),
    theta: rad(data.theta, FALLBACK.theta),
  };
}
