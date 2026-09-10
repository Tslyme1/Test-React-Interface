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
 * Число зон дробления — исходное данное методики: оно задаёт, сколько
 * троек «длина зоны + угол конуса + угол чаши» читается из формы.
 * Разбор строкой, потому что в форме это `Select` со строковым значением.
 *
 * Потолок — две зоны: столько троек есть в `GeomData`. Ограничение
 * формы, а не методики — сам `computeChamberProfile` считает любое число
 * зон, и контрольный пример §7 с тремя проверяется на нём напрямую.
 */
export function crushingZones(data: GeomData): number {
  const parsed = Number(data.zones);
  return Number.isFinite(parsed) && parsed >= 1 ? Math.min(2, Math.round(parsed)) : 1;
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
  /* Массивы обрезаются по числу зон: поля второй зоны при одной зоне
     в форме не показываются и в расчёт идти не должны, иначе профиль
     получил бы участок, которого пользователь не задавал. */
  return {
    zones,
    beta10: rad(data.b10, FALLBACK.b10),
    beta1: [rad(data.b11, FALLBACK.b11), rad(data.b12, FALLBACK.b12)].slice(0, zones),
    beta2: rad(data.b2, FALLBACK.b2),
    beta40: rad(data.b40, FALLBACK.b40),
    beta4: [rad(data.b41, FALLBACK.b41), rad(data.b42, FALLBACK.b42)].slice(0, zones),
    l1: [mm(data.l11, FALLBACK.l11), mm(data.l12, FALLBACK.l12)].slice(0, zones),
    l2: mm(data.l2, FALLBACK.l2),
    D: mm(data.D, FALLBACK.D),
    H: mm(data.H, FALLBACK.H),
    S0: mm(data.S0, FALLBACK.S0),
    theta: rad(data.theta, FALLBACK.theta),
  };
}
