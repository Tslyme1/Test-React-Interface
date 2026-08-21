import { useCallback, useEffect, useState } from 'react';
import type { TagColorToken } from '@uralmash/design-system';

export type TagDef = { name: string; color: TagColorToken };

const STORAGE_KEY = 'uztm-tags';

/**
 * Палитра тегов, с которой приложение стартует.
 *
 * Ровно те теги, что стоят у проектов-примеров. Цвет здесь — не украшение:
 * по нему тег узнают в таблице боковым зрением, и назначать его каждый раз
 * заново пользователю незачем.
 *
 * Раньше цвет считался прямо в ячейке — «Черновик» жёлтый, всё остальное
 * стальное. Это работало ровно до второго тега: любой новый оказывался того
 * же цвета, что и все прочие.
 */
const DEFAULT_TAGS: TagDef[] = [
  { name: 'Рабочий', color: 'steel' },
  { name: 'Черновик', color: 'amber' },
  { name: 'Архив', color: 'slate' },
];

/** Шкала цветов тегов системы — закрытая, шестью значениями. */
export const TAG_COLORS: TagColorToken[] = ['steel', 'sage', 'amber', 'clay', 'violet', 'slate'];

/** Цвет тега, о котором ничего не известно: не выдумываем, берём нейтральный. */
const FALLBACK: TagColorToken = 'steel';

function readTags(): TagDef[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_TAGS;

    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_TAGS;

    const tags = parsed.filter(
      (item): item is TagDef =>
        typeof item === 'object' &&
        item !== null &&
        typeof (item as TagDef).name === 'string' &&
        TAG_COLORS.includes((item as TagDef).color)
    );

    return tags.length > 0 ? tags : DEFAULT_TAGS;
  } catch {
    // Хранилище может быть недоступно (приватный режим) или испорчено руками.
    return DEFAULT_TAGS;
  }
}

/**
 * Теги проектов и их цвета.
 *
 * Отдельно от проектов, а не полем внутри них: тег живёт дольше проекта,
 * которому его поставили, и заведённый цвет не должен исчезать вместе
 * с удалением последнего проекта с этим тегом.
 */
export function useTags() {
  const [tags, setTags] = useState<TagDef[]>(readTags);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tags));
    } catch {
      // Не сохранилось — работа продолжается в памяти. Падать из-за тега нельзя.
    }
  }, [tags]);

  const colorOf = useCallback(
    (name: string | null): TagColorToken => tags.find((tag) => tag.name === name)?.color ?? FALLBACK,
    [tags]
  );

  /**
   * Добавляет тег. Возвращает `false`, когда добавлять нечего: пустое имя
   * или тег с таким именем уже есть. Второй тег «Рабочий» другого цвета
   * означал бы, что один и тот же тег в таблице выглядит по-разному.
   */
  const addTag = useCallback(
    (name: string, color: TagColorToken): boolean => {
      const clean = name.trim();
      if (!clean) return false;
      if (tags.some((tag) => tag.name.toLowerCase() === clean.toLowerCase())) return false;

      setTags((current) => [...current, { name: clean, color }]);
      return true;
    },
    [tags]
  );

  return { tags, colorOf, addTag };
}
