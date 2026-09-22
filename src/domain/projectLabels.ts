import type { Project } from '@/types';

/**
 * Дробилка/проба для отображения в списке. В инженерном режиме их всегда
 * ровно по одной — `crusherName`/`ore` и есть ответ. В упрощённом их может
 * быть несколько; показывать только первую молча значило бы прятать
 * остальные, поэтому добавляем счёт «+N».
 */
export function crusherLabel(project: Project): string {
  if (project.mode !== 'simplified' || project.crusherNames.length <= 1) {
    /* Инженерный проект без машины — не «данных пока нет», а осознанный
       выбор: новое проектирование начинается с чистой геометрии камеры,
       и дробилки из каталога у него не будет никогда. Прочерк на этом
       месте читался бы как «ещё не выбрали». */
    if (project.crusherName) return project.crusherName;
    return project.mode === 'engineering' ? NEW_DESIGN_LABEL : '—';
  }
  return `${project.crusherNames[0]} +${project.crusherNames.length - 1}`;
}

/** Как называется машина, которой ещё нет: проект начат «с нуля», без каталога. */
export const NEW_DESIGN_LABEL = 'Новая разработка';

export function oreLabel(project: Project): string {
  if (project.mode !== 'simplified' || project.oreNames.length <= 1) return project.ore || '—';
  return `${project.oreNames[0]} +${project.oreNames.length - 1}`;
}
