/**
 * Момент времени с точностью до минуты — как `nowStamp()` в прототипе.
 * Единственный формат дат в приложении: даты проекта, снимков расчёта
 * и всего, что от них зависит (сортировка, сравнение, вывод в отчётах).
 */
export function formatDate(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(d.getDate())}.${p(d.getMonth() + 1)}.${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
