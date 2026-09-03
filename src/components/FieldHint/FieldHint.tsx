import { Button, Tooltip } from '@uralmash/design-system';

export type FieldHintProps = {
  /** Текст глоссария — что физически означает параметр. */
  children: string;
};

/**
 * Значок-подсказка для `Field.labelHint` — глоссарий термина по наведению
 * или фокусу, отдельно от `hint` под полем (тот занят подсказкой «было: X»
 * в режиме «Дельта»). См. запись о `labelHint` в `Docs/Changelog`
 * дизайн-системы.
 *
 * Доступное имя кнопки — общее, без подписи поля: кнопка лежит внутри
 * `<label>` самого поля и сидит в порядке фокуса сразу за его текстом,
 * так что имя поля читатель экрана уже озвучил секундой раньше. Подпись
 * поля в имени кнопки, наоборот, вредила бы — `getByLabel(labelТекст)`
 * в тестах ищет по вхождению подстроки и находил бы заодно и эту кнопку.
 */
export function FieldHint({ children }: FieldHintProps) {
  return (
    <Tooltip content={children}>
      <Button variant="ghost" size="sm" icon="info" aria-label="Что означает этот параметр" />
    </Tooltip>
  );
}
