import { useCallback, useEffect, useState } from 'react';
import type { ProdData, Project, WizardData } from '@/types';
import { defaultWizardData } from '@/data/wizardDefaults';

const STORAGE_KEY = 'uztm-projects';

/**
 * Версия формата хранения. Меняется, когда меняется форма `Project`.
 *
 * Версия 2 добавила параметры формы куска (`a0`, `va0`, `shapeMode`,
 * `sieveRows`). Данные версии 1 не выбрасываются, а дополняются значениями
 * по умолчанию: проекты — это работа пользователя, и терять её из-за того,
 * что мы дописали поле, нельзя.
 */
const SCHEMA_VERSION = 2;

type StoredPayload = { version: number; projects: Project[] };

/**
 * Проекты хранятся общим списком, а не по пользователю — как локальная
 * история в исходном прототипе. Настоящей многопользовательской работы
 * здесь нет: вход демонстрационный.
 */
function readProjects(): Project[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];

    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null) return [];

    const payload = parsed as Partial<StoredPayload>;
    if (!Array.isArray(payload.projects)) return [];

    if (payload.version === SCHEMA_VERSION) return payload.projects;
    if (payload.version === 1) return payload.projects.map(migrateFromV1);

    // Версия из будущего или мусор — читать нечего.
    return [];
  } catch {
    // Битое или недоступное хранилище не должно мешать открыть приложение.
    return [];
  }
}

/** Поля, которых в формате версии 1 ещё не было. */
type ProdFieldsAddedInV2 = 'a0' | 'va0' | 'shapeMode' | 'sieveRows';

/** Проект версии 1: у параметров продукта нет параметров формы куска. */
type ProjectV1 = Omit<Project, 'data'> & {
  data: Omit<WizardData, 'prod'> & { prod: Omit<ProdData, ProdFieldsAddedInV2> };
};

/**
 * Дополняет проект версии 1 недостающими полями. Остальное не трогаем:
 * задача миграции — довести форму до текущей, а не переосмыслить данные.
 */
function migrateFromV1(project: ProjectV1): Project {
  const fallback = defaultWizardData().prod;
  return {
    ...project,
    data: {
      ...project.data,
      prod: {
        ...project.data.prod,
        a0: fallback.a0,
        va0: fallback.va0,
        shapeMode: fallback.shapeMode,
        sieveRows: fallback.sieveRows,
      },
    },
  };
}

function writeProjects(projects: Project[]): void {
  try {
    const payload: StoredPayload = { version: SCHEMA_VERSION, projects };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  } catch {
    // Переполненное хранилище или приватный режим — потеря сохранения,
    // но не потеря работающего приложения.
  }
}

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

/** Хранилище проектов. Переживает перезагрузку страницы, бэкенда нет. */
export function useProjects() {
  const [projects, setProjects] = useState<Project[]>(readProjects);

  // Пишем на каждое изменение списка: точек изменения несколько
  // (создание, правка данных визарда, удаление), и сохранять в каждой
  // из них — значит однажды забыть в одной.
  useEffect(() => {
    writeProjects(projects);
  }, [projects]);

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
