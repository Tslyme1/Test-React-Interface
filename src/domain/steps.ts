import type { Project, StepKey } from '@/types';

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
