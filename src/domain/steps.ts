import type { Project, StepKey } from '@/types';
import { formatDate } from '@/domain/date';

/**
 * Три шага визарда, в порядке, в котором с ними работает `calc: [boolean, boolean, boolean]`
 * у `Project` — индекс в обоих массивах один и тот же ключ шага.
 *
 * Вынесено отдельно, потому что список шагов нужен трём местам, которые
 * иначе держали бы свою копию: степперу визарда, меню действий строки
 * (какие шаги можно распечатать) и самой печати (что писать в заголовок).
 */
export const STEP_KEYS: StepKey[] = ['geom', 'gran', 'prod'];

export const STEP_LABELS: Record<StepKey, string> = {
  geom: 'Геометрия',
  gran: 'Грансостав',
  prod: 'Продукт',
};

export const STEP_TITLES: Record<StepKey, string> = {
  geom: 'Результат: геометрия камеры дробления',
  gran: 'Результат: характеристический грансостав',
  prod: 'Результат: грансостав продукта и усилия',
};

/**
 * Посчитан ли шаг `index`, но данные с тех пор разошлись со снимком на
 * момент расчёта (`project.calcSnapshot`) — то есть отчёт по нему больше
 * не отражает то, что сейчас введено в форме. `null` в `calcSnapshot` —
 * «снимка нет» (шаг не считался или запись старше версии 14 хранилища)
 * и в расхождение не идёт: сравнивать не с чем, предупреждать не о чем.
 */
export function isStepStale(project: Project, index: number): boolean {
  if (!project.calc[index]) return false;
  const snapshot = project.calcSnapshot[index];
  if (snapshot === null) return false;
  return JSON.stringify(project.data[STEP_KEYS[index]]) !== JSON.stringify(snapshot);
}

/** Есть ли в проекте хотя бы один такой шаг — см. `isStepStale`. */
export function hasUncalculatedChanges(project: Project): boolean {
  return STEP_KEYS.some((_key, i) => isStepStale(project, i));
}

/**
 * Снимок каждого разошедшегося (`isStepStale`) шага подтягивается к его
 * текущим данным — без открытия самого визарда. Нужно окну подтверждения
 * при закрытии вкладки («Пересчитать» вместо того, чтобы уходить с
 * закрытием, ничего не решив): пересчитывает не какой-то один шаг
 * (`step` там, где его правят, — у `WizardPage`), а сразу все, что
 * успели разойтись к этому моменту.
 *
 * Уже посчитанные и совпадающие со снимком шаги (и ещё не посчитанные
 * вовсе) не трогает — `calc` не меняется, меняются только даты и снимки
 * тех, что были `isStepStale`.
 */
export function recalculateStaleSteps(project: Project): Pick<Project, 'calc' | 'calcDates' | 'calcSnapshot'> {
  const calc = [...project.calc] as Project['calc'];
  const calcDates = [...project.calcDates] as Project['calcDates'];
  const calcSnapshot = [...project.calcSnapshot] as Project['calcSnapshot'];

  STEP_KEYS.forEach((key, i) => {
    if (!isStepStale(project, i)) return;
    calcDates[i] = formatDate();
    calcSnapshot[i] = project.data[key];
  });

  return { calc, calcDates, calcSnapshot };
}
