import type { GeomData, GranData, Project } from '@/types';
import { defaultWizardData } from '@/data/wizardDefaults';
import { CRUSHERS } from '@/data/crushers';
import { estimateGeom, estimateGran, estimateProd, estimateProdGran } from './estimates';

function firstNumber(value: string | undefined): number | null {
  if (!value) return null;
  const match = value.replace(',', '.').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

/**
 * Геометрия камеры в упрощённом режиме не вводится руками — берём, что
 * можно, из каталога выбранной дробилки (диаметр конуса, разгрузочная
 * щель), остальные параметры методики оставляем на значениях по умолчанию,
 * как и везде в приложении для полей, которых пользователь не заполнял.
 */
export function deriveGeomFromCrusher(crusherName: string): GeomData {
  const base = defaultWizardData().geom;
  const specs = CRUSHERS.find((c) => c.name === crusherName)?.values;
  const D = firstNumber(specs?.['D, мм']);
  const S0 = firstNumber(specs?.['S, мм']);
  return {
    ...base,
    D: D !== null ? String(D) : base.D,
    S0: S0 !== null ? String(S0) : base.S0,
  };
}

/**
 * Характеристики пробы (плотность, крепость, абразивность…) не входят
 * в формулы характеристического грансостава этого приложения ни в
 * инженерном режиме — там они тоже вводятся отдельно, а не выводятся из
 * каталога проб. Проба в упрощённом режиме поэтому определяет, ПО какой
 * руде считается комбинация, а не числа самого распределения — те берутся
 * значениями по умолчанию методики, как и везде, где параметр не введён.
 */
export function deriveGranFromOre(): GranData {
  return defaultWizardData().gran;
}

export type SimplifiedCombo = {
  crusherName: string;
  oreName: string;
  geom: GeomData;
  gran: GranData;
};

/** Матрица «каждая дробилка × каждая проба» — расчёт упрощённого режима считает её целиком. */
export function buildSimplifiedCombos(project: Project): SimplifiedCombo[] {
  const crushers = project.crusherNames;
  const ores = project.oreNames;

  return crushers.flatMap((crusherName) =>
    ores.map((oreName) => ({
      crusherName,
      oreName,
      geom: deriveGeomFromCrusher(crusherName),
      gran: deriveGranFromOre(),
    }))
  );
}

/** Отчёт по одной комбинации — та же иллюстративная оценка, что и в инженерном режиме, но по выведенным данным. */
export function buildComboReport(combo: SimplifiedCombo, project: Project) {
  return {
    geom: estimateGeom(combo.geom),
    gran: estimateGran(combo.gran),
    prod: estimateProd(project.data.prod, combo.geom),
    prodGran: estimateProdGran(project.data.prod),
  };
}
