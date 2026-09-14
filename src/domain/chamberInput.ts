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
 * Число зон дробления — длина самого набора зон, а не отдельное поле.
 * Ноль зон камерой не является: профиль из одной зоны калибровки —
 * это уже не камера дробления, поэтому минимум один.
 */
export function crushingZones(data: GeomData): number {
  return Math.max(1, data.zones.length);
}

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

  const zones = crushingZones(data);
  /* Пустой набор зон (его в форме не завести, но данные приходят
     и из хранилища) достраивается одной зоной по умолчанию — иначе
     рекурсия считала бы профиль без единого участка дробления. */
  const list = data.zones.length > 0 ? data.zones : [FALLBACK.zones[0]];
  const fb = FALLBACK.zones[0];

  return {
    zones,
    beta10: rad(data.b10, FALLBACK.b10),
    beta1: list.map((zone) => rad(zone.b1, fb.b1)),
    beta2: rad(data.b2, FALLBACK.b2),
    beta40: rad(data.b40, FALLBACK.b40),
    beta4: list.map((zone) => rad(zone.b4, fb.b4)),
    l1: list.map((zone) => mm(zone.l1, fb.l1)),
    l2: mm(data.l2, FALLBACK.l2),
    D: mm(data.D, FALLBACK.D),
    H: mm(data.H, FALLBACK.H),
    S0: mm(data.S0, FALLBACK.S0),
    theta: rad(data.theta, FALLBACK.theta),
  };
}
