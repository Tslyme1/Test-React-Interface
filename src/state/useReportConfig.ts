import { useCallback, useEffect, useState } from 'react';
import { REPORT_BLOCKS, defaultReportConfig } from '@/domain/reportConfig';
import type { ReportBlockId, ReportConfig } from '@/domain/reportConfig';

const STORAGE_KEY = 'uztm-reports';

type Stored = Record<string, ReportConfig>;

/**
 * Состав отчёта хранится отдельно от проекта, а не полем внутри него.
 *
 * Проект — это исходные данные и результат расчёта; состав отчёта —
 * то, как этот результат показывают, и меняется он от читателя
 * к читателю, не затрагивая ни одного числа. Отдельный ключ заодно
 * не трогает формат `Project`: добавить туда поле значило бы завести
 * двадцатую версию хранилища и миграцию ради настройки отображения,
 * потеря которой не потеря работы.
 */
function readAll(): Stored {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {};
    return parsed as Stored;
  } catch {
    // Приватный режим или испорченное руками хранилище: отчёт соберётся заново.
    return {};
  }
}

/** Приводит прочитанное к текущей форме: чужие и исчезнувшие разделы отбрасываются. */
function normalize(stored: ReportConfig | undefined): ReportConfig {
  const base = defaultReportConfig();
  if (!stored || typeof stored !== 'object') return base;

  const known = new Set<ReportBlockId>(REPORT_BLOCKS.map((b) => b.id));
  const blocks = Array.isArray(stored.blocks) ? stored.blocks.filter((id) => known.has(id)) : base.blocks;

  return {
    title: typeof stored.title === 'string' ? stored.title : base.title,
    mode: stored.mode === 'custom' ? 'custom' : 'auto',
    blocks,
    meta: stored.meta !== false,
    inputs: stored.inputs !== false,
  };
}

/**
 * Состав отчёта одного проекта. Переживает перезагрузку: собранный
 * под смежника отчёт не должен собираться заново каждый раз, когда
 * проект открыли снова.
 */
export function useReportConfig(projectId: string) {
  const [config, setConfig] = useState<ReportConfig>(() => normalize(readAll()[projectId]));

  /* Открыли другой проект — читаем его состав, а не оставляем на экране
     чужой: состав привязан к проекту, а не к окну. */
  useEffect(() => {
    setConfig(normalize(readAll()[projectId]));
  }, [projectId]);

  const update = useCallback(
    (patch: Partial<ReportConfig>) => {
      setConfig((current) => {
        const next = { ...current, ...patch };
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readAll(), [projectId]: next }));
        } catch {
          // Не сохранилось — отчёт всё равно собран, работа продолжается.
        }
        return next;
      });
    },
    [projectId]
  );

  /** Отметить или снять раздел. Порядок разделов задаёт реестр, а не порядок нажатий. */
  const toggleBlock = useCallback(
    (id: ReportBlockId) => {
      setConfig((current) => {
        const has = current.blocks.includes(id);
        const blocks = has ? current.blocks.filter((b) => b !== id) : [...current.blocks, id];
        const next = { ...current, blocks };
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...readAll(), [projectId]: next }));
        } catch {
          /* см. выше */
        }
        return next;
      });
    },
    [projectId]
  );

  const reset = useCallback(() => update(defaultReportConfig()), [update]);

  return { config, update, toggleBlock, reset };
}
