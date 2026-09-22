import type { Project } from '@/types';

/**
 * Дробилка/проба для отображения в списке. В инженерном режиме их всегда
 * ровно по одной — `crusherName`/`ore` и есть ответ. В упрощённом их может
 * быть несколько; показывать только первую молча значило бы прятать
 * остальные, поэтому добавляем счёт «+N».
 */
export function crusherLabel(project: Project): string {
  if (project.mode !== 'simplified' || project.crusherNames.length <= 1) return project.crusherName || '—';
  return `${project.crusherNames[0]} +${project.crusherNames.length - 1}`;
}

export function oreLabel(project: Project): string {
  if (project.mode !== 'simplified' || project.oreNames.length <= 1) return project.ore || '—';
  return `${project.oreNames[0]} +${project.oreNames.length - 1}`;
}
