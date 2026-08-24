import { useMemo } from 'react';
import type { ChamberCalibration, ChamberGeometryInput, Vec2 } from '@/domain/chamberGeometry';
import { applyCalibration, arcPath, computeChamberGeometry, makeTransform, phiOf } from '@/domain/chamberGeometry';
import styles from './ChamberScheme.module.css';

/**
 * Видимость групп элементов схемы — соответствует меню «Слои» на панели.
 * Все группы включены по умолчанию, поэтому вызов без пропа не меняет
 * прежний внешний вид схемы.
 */
export type ChamberSchemeLayers = {
  /** Профиль и точки брони чаши. */
  bowl?: boolean;
  /** Профиль и точки брони конуса. */
  cone?: boolean;
  /** Ось конуса, дуга и подпись угла качания θ. */
  theta?: boolean;
  /** Зазор S₀ и заливка зоны калибровки. */
  gap?: boolean;
  /** Выносные размеры D/2 и h. */
  dims?: boolean;
};

const DEFAULT_LAYERS: Required<ChamberSchemeLayers> = { bowl: true, cone: true, theta: true, gap: true, dims: true };

/**
 * Параметр формы, за который отвечает участок схемы — соответствие для
 * подсветки при наведении (режим отображения «Подсветка участка»
 * на шаге «Геометрия»). Не все поля формы имеют собственный видимый
 * участок (например, `R`, `a`, число зон) — для них подсветки нет.
 */
export type ChamberHighlightKey = 'D' | 'H' | 'S0' | 'theta' | 'beta10' | 'beta40' | 'beta2' | 'l2';

export type ChamberSchemeProps = {
  /** Полный набор параметров профиля — как в `st` прототипа-источника. */
  input: ChamberGeometryInput;
  /** Целевые D, H, S0 — независимый ввод формы, накладывается поверх построенной цепочки. */
  calibration?: ChamberCalibration;
  /** Какие группы элементов рисовать. Непереданные группы — видимы. */
  layers?: ChamberSchemeLayers;
  /**
   * Режим «Линии построения»: поверх обычной схемы — лучи от точки
   * подвеса к каждой точке профиля, тот же приём «повернуть на β,
   * шагнуть на L», которым строится цепочка в `computeChamberGeometry`.
   */
  construction?: boolean;
  /** Параметр, чей участок сейчас подсвечен наведением на поле формы. */
  highlight?: ChamberHighlightKey | null;
  className?: string;
};

const VB = { w: 1180, h: 840 };
/** Рабочая область построения внутри viewBox — те же пропорции, что и в прототипе-источнике. */
const AREA = { x: 168, y: 44, w: 560, h: 620 };

const NAMES_B = ['40', '41', '42', '4i', '3'];
const NAMES_C = ['10', '11', '12', '1i', '2'];
const SEGMENT_LABELS = ['l₁₁', 'l₁₂', 'l₁ᵢ', 'l₂'];

function round(v: number): number {
  return Math.round(v * 10) / 10;
}

function fmt(v: number): string {
  return round(v).toLocaleString('ru-RU');
}

function pathFrom(points: Vec2[]): string {
  return points.map((p, i) => `${i ? 'L' : 'M'}${round(p.x)} ${round(p.y)}`).join(' ');
}

function polygonFrom(points: Vec2[]): string {
  return `${pathFrom(points)} Z`;
}

/**
 * Параметрическая схема профиля камеры дробления. Декларативный React-SVG,
 * без единой строки, собранной через `dangerouslySetInnerHTML` — весь
 * профиль строится как обычное дерево `<path>` / `<circle>` / `<text>` из
 * точек, посчитанных `computeChamberGeometry` (см. `src/domain/chamberGeometry.ts`).
 */
export function ChamberScheme({ input, calibration, layers, construction, highlight, className }: ChamberSchemeProps) {
  const L = { ...DEFAULT_LAYERS, ...layers };
  const accent = 'var(--color-accent)';
  const accentText = 'var(--color-accent-text)';
  const geometry = useMemo(() => computeChamberGeometry(input), [input]);
  const calibrated = useMemo(() => applyCalibration(geometry, calibration ?? {}), [geometry, calibration]);

  const transform = useMemo(
    () => makeTransform([{ x: 0, y: 0 }, ...calibrated.bowl.points, ...calibrated.cone.points], AREA),
    [calibrated],
  );

  const apex = transform.point({ x: 0, y: 0 });
  const bowlRaw = calibrated.bowl.points;
  const coneRaw = calibrated.cone.points;

  /**
   * Габариты (D/2, h, S₀) читаются с откалиброванного профиля — там они по
   * построению равны введённым.
   *
   * А вот лучи точек — `r` и `α` — берутся до калибровки. Калибровка тянет
   * профиль по осям с разными коэффициентами, чтобы попасть в заданные D и H,
   * и в растянутых координатах длина луча и его угол перестают быть теми
   * величинами, что задал пользователь: это уже артефакт отрисовки. Подсказка
   * с числом обязана показывать величину, а не следствие масштаба.
   */
  const bowlTrue = geometry.bowl.points;
  const coneTrue = geometry.cone.points;
  const bowlPts = bowlRaw.map(transform.point);
  const conePts = coneRaw.map(transform.point);

  const top = AREA.y - 20;
  const bottom = AREA.y + AREA.h + 26;
  const coneAxisEnd = { x: apex.x - (bottom - apex.y) * Math.sin(input.theta * (Math.PI / 180)), y: bottom };

  /**
   * Выносные размеры показывают введённые величины, а не измеренные
   * по чертежу.
   *
   * Измерять их по профилю нельзя: калибровка сначала растягивает его
   * под заданные D и H, а затем сдвигает конус целиком ради S₀ — и после
   * сдвига конус уже не там, где по нему мерили диаметр. Подпись начинала
   * противоречить полю формы: в поле 1750, на чертеже 3535,6.
   *
   * Замер остаётся запасным вариантом, когда цель не задана.
   */
  const gapRaw =
    calibration?.targetGap0 ?? Math.hypot(bowlRaw[4].x - coneRaw[4].x, bowlRaw[4].y - coneRaw[4].y);
  const diameterRaw = calibration?.targetDiameter ?? Math.abs(coneRaw[4].x) * 2;
  const heightRaw = calibration?.targetHeight ?? coneRaw[4].y;

  /**
   * Залита только зона калибровки — та, где стоит размер S₀, ради которого
   * на схему и смотрят. Остальные зоны различаются границами и подписями.
   *
   * Заливка площадей отсюда убрана намеренно. `surfaceSunken` для зоны
   * дробления в светлой теме давал едва заметный тон, а в тёмной оказывался
   * темнее не только схемы, но и фона страницы — зона читалась как дыра
   * в чертеже. Роль эта описана для шапки таблицы и фона disabled,
   * а не для площадной заливки, и в двух темах её вес расходится.
   * Заявка на роль «мягкая заливка области» — в систему; здесь обходимся
   * без неё, тем более что язык системы и так линейный, а не заливочный.
   */
  const zones = [
    {
      key: 'zone-cal',
      title: 'Зона калибровки — здесь задаётся выходная щель S₀',
      poly: [bowlPts[3], bowlPts[4], conePts[4], conePts[3]],
      fill: 'var(--color-accent-subtle)',
    },
  ];

  return (
    <svg
      viewBox={`0 0 ${VB.w} ${VB.h}`}
      role="img"
      aria-label="Схема профиля камеры дробления: броня чаши и броня конуса"
      className={[styles.scheme, className].filter(Boolean).join(' ')}
      data-testid="chamber-scheme"
    >
      <defs>
        <marker id="chamber-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
          <path d="M0,1 L10,5 L0,9 Z" fill="var(--color-text-muted)" />
        </marker>
      </defs>

      <rect x={0} y={0} width={VB.w} height={VB.h} fill="var(--color-surface)" />

      {/* ── зоны ── */}
      {L.gap
        ? zones.map((z) => (
            <path key={z.key} d={polygonFrom(z.poly)} fill={z.fill} stroke="none">
              <title>{z.title}</title>
            </path>
          ))
        : null}

      {/* ── оси ── */}
      <line x1={apex.x} y1={top} x2={apex.x} y2={bottom} stroke="var(--color-border-strong)" strokeWidth={1}>
        <title>Ось дробилки</title>
      </line>
      {L.theta ? (
        <>
          <line
            x1={apex.x}
            y1={top}
            x2={coneAxisEnd.x}
            y2={coneAxisEnd.y}
            stroke={highlight === 'theta' ? accent : 'var(--color-text-muted)'}
            strokeWidth={highlight === 'theta' ? 2 : 1}
            strokeDasharray="14 4 2 4"
          >
            <title>Ось конуса (наклонена на угол качания θ)</title>
          </line>
          {input.theta !== 0 ? (
            <path
              d={arcPath(apex, (bottom - apex.y) * 0.18, 0, input.theta)}
              fill="none"
              stroke={highlight === 'theta' ? accent : 'var(--color-text-muted)'}
              strokeWidth={highlight === 'theta' ? 2 : 1}
            >
              <title>θ — угол качания конуса: {fmt(input.theta)}°</title>
            </path>
          ) : null}
          <text
            x={apex.x - 8}
            y={top + (bottom - top) * 0.18 - 6}
            textAnchor="end"
            fontSize={13}
            fontStyle="italic"
            fill={highlight === 'theta' ? accentText : 'var(--color-text-muted)'}
          >
            θ
          </text>
        </>
      ) : null}

      {/* ── линии построения: лучи от точки подвеса к каждой точке профиля ── */}
      {construction ? (
        <g>
          {bowlPts.map((p, i) => (
            <line
              key={`build-b-${NAMES_B[i]}`}
              x1={apex.x}
              y1={apex.y}
              x2={p.x}
              y2={p.y}
              stroke="var(--color-border-strong)"
              strokeWidth={0.6}
              strokeDasharray="2 3"
            />
          ))}
          {conePts.map((p, i) => (
            <line
              key={`build-c-${NAMES_C[i]}`}
              x1={apex.x}
              y1={apex.y}
              x2={p.x}
              y2={p.y}
              stroke="var(--color-border-strong)"
              strokeWidth={0.6}
              strokeDasharray="2 3"
            />
          ))}
        </g>
      ) : null}

      {/* ── профиль брони чаши ── */}
      {L.bowl ? (
        <>
          <path d={pathFrom(bowlPts)} fill="none" stroke="var(--color-text)" strokeWidth={1.6} strokeLinejoin="round">
            <title>Броня чаши — неподвижный профиль камеры</title>
          </path>
          {SEGMENT_LABELS.map((label, i) => {
            const a = bowlPts[i];
            const b = bowlPts[i + 1];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const len = Math.hypot(dx, dy) || 1;
            const nx = dy / len;
            const ny = -dx / len;
            const off = 20;
            const mid = { x: (a.x + b.x) / 2 - nx * off, y: (a.y + b.y) / 2 - ny * off };
            // Единственный сегмент с полем в форме — l2, последний (4i→3).
            const isL2 = i === SEGMENT_LABELS.length - 1;
            const active = isL2 && highlight === 'l2';
            return (
              <text
                key={label}
                x={mid.x}
                y={mid.y}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={active ? 13 : 11.5}
                fontStyle="italic"
                fill={active ? accentText : 'var(--color-text-muted)'}
              >
                {label}
              </text>
            );
          })}
        </>
      ) : null}

      {/* ── профиль брони конуса ── */}
      {L.cone ? (
        <path d={pathFrom(conePts)} fill="none" stroke="var(--color-text)" strokeWidth={1.6} strokeLinejoin="round">
          <title>Броня конуса — гирационный профиль камеры</title>
        </path>
      ) : null}

      {/* ── зазор S0 в зоне калибровки ── */}
      {L.gap ? (
        <>
          <line
            x1={bowlPts[4].x}
            y1={bowlPts[4].y}
            x2={conePts[4].x}
            y2={conePts[4].y}
            stroke={accent}
            strokeWidth={highlight === 'S0' ? 2.8 : 1.8}
          >
            <title>S₀ — выходная щель: {fmt(gapRaw)} мм</title>
          </line>
          <text
            x={(bowlPts[4].x + conePts[4].x) / 2 + 10}
            y={(bowlPts[4].y + conePts[4].y) / 2}
            fontSize={highlight === 'S0' ? 13 : 11.5}
            fontStyle="italic"
            fill={accentText}
          >
            S₀
          </text>
        </>
      ) : null}

      {/* ── точки профиля ── */}
      {/* β40 — узловой угол точки «40» (первая точка брони чаши), β2 — узловой угол точки «2» (последняя точка брони конуса). */}
      {L.bowl
        ? bowlPts.map((p, i) => {
            const active = NAMES_B[i] === '40' && highlight === 'beta40';
            return (
              <g key={`b-${NAMES_B[i]}`}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={active ? 4.6 : 3.4}
                  fill="var(--color-surface)"
                  stroke={active ? accent : 'var(--color-text)'}
                  strokeWidth={active ? 1.8 : 1.2}
                />
                <circle cx={p.x} cy={p.y} r={1.1} fill={active ? accent : 'var(--color-text)'} />
                <text x={p.x - 9} y={p.y + 3} textAnchor="end" fontSize={10.5} fill={active ? accentText : 'var(--color-text)'}>
                  {NAMES_B[i]}
                </text>
                <title>{`Точка ${NAMES_B[i]} · r = ${fmt(Math.hypot(bowlTrue[i].x, bowlTrue[i].y))} мм · α = ${fmt(phiOf(bowlTrue[i]))}°`}</title>
              </g>
            );
          })
        : null}
      {L.cone
        ? conePts.map((p, i) => {
            const active = (NAMES_C[i] === '10' && highlight === 'beta10') || (NAMES_C[i] === '2' && highlight === 'beta2');
            return (
              <g key={`c-${NAMES_C[i]}`}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r={active ? 4.6 : 3.4}
                  fill="var(--color-surface)"
                  stroke={active ? accent : 'var(--color-text)'}
                  strokeWidth={active ? 1.8 : 1.2}
                />
                <circle cx={p.x} cy={p.y} r={1.1} fill={active ? accent : 'var(--color-text)'} />
                <text x={p.x - 8} y={p.y + 14} textAnchor="end" fontSize={10.5} fill={active ? accentText : 'var(--color-text)'}>
                  {NAMES_C[i]}
                </text>
                <title>{`Точка ${NAMES_C[i]} · r = ${fmt(Math.hypot(coneTrue[i].x, coneTrue[i].y))} мм · α = ${fmt(phiOf(coneTrue[i]))}°`}</title>
              </g>
            );
          })
        : null}

      {/* точка подвеса */}
      <g>
        <circle cx={apex.x} cy={apex.y} r={3.4} fill="var(--color-surface)" stroke="var(--color-text)" strokeWidth={1.2} />
        <circle cx={apex.x} cy={apex.y} r={1.1} fill="var(--color-text)" />
        <text x={apex.x + 8} y={apex.y - 8} fontSize={11.5} fill="var(--color-text-muted)">
          Точка подвеса
        </text>
        <title>Точка подвеса — начало отсчёта всех лучей</title>
      </g>

      {/* ── размеры D/2 и h ── */}
      {L.dims ? (
        <>
          <line
            x1={apex.x - 58}
            y1={apex.y}
            x2={apex.x - 58}
            y2={conePts[4].y}
            stroke={highlight === 'H' ? accent : 'var(--color-text-muted)'}
            strokeWidth={highlight === 'H' ? 1.8 : 1}
            markerStart="url(#chamber-arrow)"
            markerEnd="url(#chamber-arrow)"
          >
            <title>h = {fmt(heightRaw)} мм</title>
          </line>
          <line x1={apex.x} y1={apex.y} x2={apex.x - 66} y2={apex.y} stroke="var(--color-text-muted)" strokeWidth={0.7} />
          <line x1={conePts[4].x} y1={conePts[4].y} x2={apex.x - 66} y2={conePts[4].y} stroke="var(--color-text-muted)" strokeWidth={0.7} />
          <text
            x={apex.x - 64}
            y={(apex.y + conePts[4].y) / 2}
            textAnchor="end"
            dominantBaseline="middle"
            fontSize={13}
            fontStyle="italic"
            fill={highlight === 'H' ? accentText : 'var(--color-text-muted)'}
          >
            h
          </text>

          <line
            x1={conePts[4].x}
            y1={conePts[4].y + 36}
            x2={apex.x}
            y2={conePts[4].y + 36}
            stroke={highlight === 'D' ? accent : 'var(--color-text-muted)'}
            strokeWidth={highlight === 'D' ? 1.8 : 1}
            markerStart="url(#chamber-arrow)"
            markerEnd="url(#chamber-arrow)"
          >
            <title>D/2 = {fmt(Math.abs(coneRaw[4].x))} мм</title>
          </line>
          <line x1={conePts[4].x} y1={conePts[4].y} x2={conePts[4].x} y2={conePts[4].y + 44} stroke="var(--color-text-muted)" strokeWidth={0.7} />
          <text
            x={(conePts[4].x + apex.x) / 2}
            y={conePts[4].y + 29}
            textAnchor="middle"
            fontSize={highlight === 'D' ? 13 : 11.5}
            fontStyle="italic"
            fill={highlight === 'D' ? accentText : 'var(--color-text-muted)'}
          >
            D / 2
          </text>
        </>
      ) : null}

      <text x={apex.x + 6} y={top + 14} fontSize={12} fill="var(--color-text-muted)">
        Ось дробилки
      </text>
      <text
        x={Math.min(bowlPts[0].x, conePts[0].x) - 14}
        y={Math.min(bowlPts[0].y, conePts[0].y) - 10}
        textAnchor="end"
        fontSize={12}
        fill="var(--color-text-muted)"
      >
        D = {fmt(diameterRaw)} мм
      </text>
    </svg>
  );
}
