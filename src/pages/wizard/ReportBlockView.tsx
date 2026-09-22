import { useMemo } from 'react';
import { Stack, Text } from '@uralmash/design-system';
import type { Project } from '@/types';
import type { ReportBlock } from '@/domain/reportConfig';
import {
  estimateGeom,
  estimateGeomAlfa,
  estimateGeomChecks,
  estimateGeomProfile,
  estimateGran,
  estimateProd,
  estimateProdGran,
} from '@/domain/estimates';
import { buildChamberProfileInput } from '@/domain/chamberInput';
import { ChamberScheme } from '@/components/ChamberScheme/ChamberScheme';
import { GranulometryChart } from '@/components/GranulometryChart/GranulometryChart';
import { Section, SectionTable, checkColumns, granColumns, kvColumns, profileColumns } from './reportTables';
import styles from './ReportBlockView.module.css';

export type ReportBlockViewProps = {
  project: Project;
  block: ReportBlock;
};

/**
 * Один раздел отчёта — то же самое, что показывает страница этапа,
 * но выбираемое поштучно.
 *
 * Значения считаются теми же `estimate*`, а столбцы берутся из
 * `reportTables` — общих со `StepReport`. Отдельного «отчётного» расчёта
 * нет и быть не должно: отчёт обязан показывать ровно то, что посчитал
 * этап, иначе распечатка и экран начнут расходиться, и заметить это
 * можно будет только сложив их рядом.
 *
 * Переключателя столбцов грансостава («по минусу / по плюсу / частные
 * классы») здесь нет: на странице это режим просмотра, который живёт
 * ровно столько, сколько на него смотрят, а в отчёте состав столбцов
 * — часть документа. Отчёт печатает канонический набор методики,
 * а сравнивать кривые удобнее на графике, который тут же рядом.
 */
export function ReportBlockView({ project, block }: ReportBlockViewProps) {
  const { geom, gran, prod } = project.data;
  const schemeInput = useMemo(() => buildChamberProfileInput(geom), [geom]);

  return (
    <Section title={block.title}>
      {block.id === 'geom.params' ? (
        <SectionTable title={block.title} columns={kvColumns} rows={estimateGeom(geom)} rowKey={(r) => r.label} />
      ) : null}

      {block.id === 'geom.profile' ? (
        <SectionTable title={block.title} columns={profileColumns} rows={estimateGeomProfile(geom)} rowKey={(r) => r.i} />
      ) : null}

      {block.id === 'geom.alfa' ? (
        <SectionTable title={block.title} columns={kvColumns} rows={estimateGeomAlfa(geom)} rowKey={(r) => r.label} />
      ) : null}

      {block.id === 'geom.checks' ? (
        <SectionTable title={block.title} columns={checkColumns} rows={estimateGeomChecks(geom)} rowKey={(r) => r.label} />
      ) : null}

      {block.id === 'geom.scheme' ? (
        /* Не `Box`: чертёж рисуется в своём масштабе, и выносные линии
           выходят за рамку — блок обязан его обрезать. Тот же приём,
           что на странице этапа. */
        <div className={styles.scheme}>
          <ChamberScheme input={schemeInput} />
        </div>
      ) : null}

      {block.id === 'gran.table' ? (
        <SectionTable title={block.title} columns={granColumns} rows={estimateGran(gran)} rowKey={(r) => r.class} />
      ) : null}

      {block.id === 'gran.chart' ? <GranulometryChart rows={estimateGran(gran)} label="питание" /> : null}

      {block.id === 'prod.params' ? (
        <SectionTable title={block.title} columns={kvColumns} rows={estimateProd(prod, geom)} rowKey={(r) => r.label} />
      ) : null}

      {block.id === 'prod.gran' ? (
        <SectionTable title={block.title} columns={granColumns} rows={estimateProdGran(prod)} rowKey={(r) => r.class} />
      ) : null}

      {block.id === 'prod.chart' ? <GranulometryChart rows={estimateProdGran(prod)} label="продукт" /> : null}
    </Section>
  );
}

/**
 * Сводка исходных данных этапа в отчёте — та же пара «величина —
 * значение», что и в левой колонке страницы этапа (`stepSummary`).
 * Заголовок приходит снаружи: в отчёте таких сводок до трёх, и общая
 * подпись «Исходные данные» у всех трёх не сказала бы, к какому этапу
 * относится которая.
 */
export function ReportInputs({ title, rows }: { title: string; rows: { label: string; value: string }[] }) {
  return (
    <Section title={title}>
      <SectionTable
        title={title}
        columns={[
          { key: 'label', title: 'Величина' },
          { key: 'value', title: 'Значение', align: 'end' },
        ]}
        rows={rows}
        rowKey={(r) => r.label}
      />
    </Section>
  );
}

/** Строка шапки отчёта: подпись сверху, значение под ней — как в `StepMeta`. */
export function ReportMetaField({ label, value }: { label: string; value: string }) {
  return (
    <Stack gap="2xs" direction="column" align="start">
      <Text variant="label" color="textMuted">
        {label}
      </Text>
      <Text variant="body">{value}</Text>
    </Stack>
  );
}
