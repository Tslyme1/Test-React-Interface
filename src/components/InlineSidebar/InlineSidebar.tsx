import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import { useRef, useState } from 'react';
import { Button, Stack, Text } from '@uralmash/design-system';
import styles from './InlineSidebar.module.css';

export type InlineSidebarProps = {
  /** Развёрнута или свёрнута в рейку. */
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Заголовок панели — виден развёрнутым и как подпись рейки свёрнутым. */
  title: string;
  /** Действия у заголовка — например, поповеры режима отображения. Видны только развёрнутым. */
  actions?: ReactNode;
  children: ReactNode;
  /**
   * Ширина панели в пикселях, когда её можно тянуть вручную за границу.
   * Без неё панель занимает половину строки (`50cqi`), как и раньше:
   * ручную ширину помнит вызывающий экран, а не эта панель сама по себе —
   * то же значение может понадобиться ему и для других расчётов раскладки.
   */
  width?: number;
  onWidthChange?: (width: number) => void;
  minWidth?: number;
  maxWidth?: number;
};

/**
 * Область экрана, которая выезжает и заезжает обратно, не покидая раскладку.
 *
 * От `Drawer` системы отличается ровно этим: `Drawer` перекрывает рабочую
 * область поверх, а эта панель — часть той же строки, что и соседняя
 * колонка, и раздвигает её собой. Свёрнутая рейка не имеет своей ширины —
 * её задаёт содержимое (кнопка-шеврон и подпись вбок), как и раньше.
 *
 * Содержимое при сворачивании не размонтируется и не переключается на другой
 * вид — просто уезжает за левый край своей полосы (`overflow: hidden`),
 * поэтому раскрытие обратно ничего не пересобирает, только возвращает ширину.
 */
export function InlineSidebar({
  open,
  onOpenChange,
  title,
  actions,
  children,
  width,
  onWidthChange,
  minWidth,
  maxWidth,
}: InlineSidebarProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  /**
   * Перетаскивание идёт без анимации следом за курсором: `.panel` в CSS
   * анимирует смену ширины на сворачивании/раскрытии (`--duration-slow`),
   * и та же переходная анимация, оставленная включённой во время тяги,
   * заставляла бы границу отставать от курсора на треть секунды.
   */
  const [resizing, setResizing] = useState(false);

  const startResize = (e: ReactMouseEvent<HTMLDivElement>) => {
    if (!onWidthChange) return;
    // Не текст и не соседняя кнопка — перетаскивание не должно попутно
    // выделять форму слева, пока тянешь границу через неё.
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = panelRef.current?.getBoundingClientRect().width ?? width ?? 0;
    setResizing(true);

    const clamp = (next: number) => Math.min(maxWidth ?? Infinity, Math.max(minWidth ?? 0, next));

    // Ручка стоит на левом краю панели: тянешь влево — граница уходит
    // в сторону формы, панели остаётся больше места, и наоборот.
    const handleMove = (ev: MouseEvent) => onWidthChange(clamp(startWidth - (ev.clientX - startX)));
    const handleUp = () => {
      setResizing(false);
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
  };

  const customWidth = open && width !== undefined ? width : undefined;
  const widthStyle =
    customWidth !== undefined ? { width: customWidth, transition: resizing ? 'none' : undefined } : undefined;

  return (
    <div className={styles.outer}>
      <div className={styles.root}>
        <div className={styles.rail}>
          <Button
            variant="ghost"
            size="sm"
            icon={open ? 'chevronRight' : 'chevronLeft'}
            aria-label={open ? `Свернуть: ${title}` : `Развернуть: ${title}`}
            aria-expanded={open}
            onClick={() => onOpenChange(!open)}
          />
          {!open ? (
            <div className={styles.railLabel}>
              <Text variant="caption" color="textMuted">
                {title}
              </Text>
            </div>
          ) : null}
        </div>

        <div ref={panelRef} className={styles.panel} data-open={open} aria-hidden={!open} style={widthStyle}>
          {/* Не `Stack` для вертикали: содержимому нужно занять весь остаток
              высоты панели и уметь ужиматься вместе с ней (см. `.panelInner`
              в CSS), а `Stack` раскладывает по содержимому. */}
          <div className={styles.panelInner} style={widthStyle}>
            <Stack direction="row" justify="between" align="center" gap="sm">
              <Text variant="headingMd">{title}</Text>
              {actions ? <Stack direction="row" align="center" gap="xs">{actions}</Stack> : null}
            </Stack>
            <div className={styles.panelContent}>{children}</div>
          </div>
        </div>
      </div>

      {/*
       * Вне `.root` (липкой, короткой по высоте своего содержимого) —
       * граница обязана идти во всю высоту строки, которую задаёт снаружи
       * более высокий сосед (форма слева), а не только высоту схемы.
       * Сделать высоким сам `.root` нельзя: `position: sticky` тогда
       * перестаёт иметь запас хода и почти сразу перестаёт липнуть — см.
       * `.outer` в CSS.
       */}
      {onWidthChange && open ? (
        <div
          className={styles.resizeHandle}
          role="separator"
          aria-orientation="vertical"
          aria-label={`Ширина панели «${title}»`}
          onMouseDown={startResize}
        />
      ) : null}
    </div>
  );
}
