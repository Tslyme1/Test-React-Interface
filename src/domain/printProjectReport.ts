/**
 * Печать собранного отчёта — снимком с того же узла, который показан
 * в окне сборки.
 *
 * Не вторая сборка документа из данных, как в `printStepReport`: состав
 * отчёта задаёт пользователь, в него входят чертёж камеры и графики,
 * и собирать их второй раз в HTML-строке значило бы написать вторую
 * отрисовку SVG рядом с первой — с собственными ошибками и собственной
 * шкалой. Здесь печатается ровно то, что видно в предпросмотре, и
 * разойтись им не с чем.
 *
 * Чтобы разметка выглядела как в приложении, в новое окно переносятся
 * таблицы стилей текущего документа — и `<link>`, и `<style>` (в сборке
 * Vite это файл, в разработке — теги, вписанные скриптом). Переносится
 * и признак темы на `<html>`: без него страница печаталась бы тёмной,
 * если пользователь работает в тёмной теме, — то есть чёрным листом.
 * Печатают всегда на белом, поэтому тема принудительно светлая.
 */
export function printProjectReport(node: HTMLElement, documentTitle: string): void {
  // Без `noopener`: с ним `window.open` по спецификации возвращает `null`,
  // и писать в открытое окно уже нечем. Документ открываем свой же.
  const win = window.open('', '_blank', 'width=900,height=1200');
  if (!win) return; // блокировщик всплывающих окон — молча, без падения интерфейса

  /*
   * У `<link>` берётся разрешённый `href`, а не разметка как есть:
   * в собранном приложении путь к таблице стилей относительный
   * (`/assets/index-*.css`), а у нового окна своего адреса нет — по
   * относительному пути оно не нашло бы ничего, и отчёт печатался бы
   * голой разметкой. `<style>` (так Vite отдаёт стили в разработке)
   * переносится целиком.
   */
  const styles = Array.from(document.querySelectorAll<HTMLElement>('link[rel="stylesheet"], style'))
    .map((el) =>
      el instanceof HTMLLinkElement ? `<link rel="stylesheet" href="${escapeHtml(el.href)}">` : el.outerHTML
    )
    .join('\n');

  win.document.write(`<!doctype html>
<html lang="ru" data-theme="light">
<head>
<meta charset="utf-8">
<title>${escapeHtml(documentTitle)}</title>
${styles}
<style>
  /* Лист, а не окно приложения: своя ширина, свои поля, разрывы страниц
     по разделам. Значения — в миллиметрах и процентах: это размеры бумаги,
     которых в шкале интерфейса нет и быть не должно. */
  body { background: white; margin: 0; padding: 12mm; } /* ds-lint-disable: поля листа, а не отступы интерфейса — в шкале системы миллиметров нет */
  .report { max-width: 100%; }
  /* Раздел не разрывается посреди таблицы, если помещается целиком. */
  .report section, .report table, .report svg { break-inside: avoid; }
  @page { margin: 12mm; } /* ds-lint-disable: поля печатной страницы */
</style>
</head>
<body>
<div class="report">${node.innerHTML}</div>
</body>
</html>`);
  win.document.close();

  /*
   * Печать — после того, как окно догрузит перенесённые стили: без них
   * таблицы уходят на печать голой разметкой. `onload` у части браузеров
   * не срабатывает для документа, написанного через `document.write`
   * в уже открытое окно, поэтому есть и запасной срок; вызов — один раз,
   * каким бы путём событие ни пришло.
   */
  let printed = false;
  const printOnce = () => {
    if (printed) return;
    printed = true;
    win.print();
  };
  win.onload = printOnce;
  setTimeout(printOnce, 600);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
