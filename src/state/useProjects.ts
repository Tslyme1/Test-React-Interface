import { useCallback, useState } from 'react';
import type { Project, WizardData } from '@/types';

function makeId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function formatDate(): string {
  return new Date().toLocaleDateString('ru-RU');
}

export type NewProjectInput = {
  name: string;
  customer: string;
  crusherName: string;
  ore: string;
  executor: string;
  data: WizardData;
};

/** Хранилище проектов текущей сессии — держится в памяти, без бэкенда. */
export function useProjects() {
  const [projects, setProjects] = useState<Project[]>([]);

  const createProject = useCallback((input: NewProjectInput): Project => {
    const project: Project = {
      id: makeId(),
      name: input.name,
      customer: input.customer,
      crusherName: input.crusherName,
      ore: input.ore,
      code: `УЗТМ-${Math.floor(1000 + Math.random() * 9000)}`,
      tag: null,
      date: formatDate(),
      executor: input.executor,
      oreIn: '—',
      oreOut: '—',
      throughput: '—',
      calc: [false, false, false],
      data: input.data,
    };
    setProjects((prev) => [project, ...prev]);
    return project;
  }, []);

  const updateProject = useCallback((id: string, patch: Partial<Project>) => {
    setProjects((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  }, []);

  const removeProject = useCallback((id: string) => {
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }, []);

  return { projects, createProject, updateProject, removeProject };
}
