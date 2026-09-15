import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Stack } from '@uralmash/design-system';

/**
 * Рисует часть формы в другом месте окна, если окно дало для неё узел.
 *
 * Речь о том, что принадлежит форме по смыслу — её режимы отображения
 * и её выбор объекта, — но по месту относится к окну целиком: режимы
 * стоят у заголовка, плашка объекта — в футере. Поднимать ради этого
 * состояние формы наверх значило бы размазать её по двум файлам; портал
 * оставляет состояние на месте и переносит только разметку. Контекст
 * при этом не теряется: он идёт по дереву React, а не по DOM, — поповер
 * внутри по-прежнему рисуется в то же окно (`LayerRootProvider` системы).
 *
 * Узла нет (форма показана не в окне) — содержимое остаётся на месте,
 * строкой над самой формой.
 */
export function portalSlot(slot: HTMLElement | null | undefined, content: ReactNode): ReactNode {
  const row = (
    <Stack direction="row" justify="end" align="center" gap="sm" wrap>
      {content}
    </Stack>
  );

  return slot ? createPortal(content, slot) : row;
}
