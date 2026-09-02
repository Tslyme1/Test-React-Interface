import { useMemo, useState } from 'react';
import { Badge, Button, Drawer, Field, Select, Stack, Table, Text } from '@uralmash/design-system';
import type { SelectOption, TableColumn } from '@uralmash/design-system';
import type { Project, StepKey } from '@/types';
import { estimateGeom, estimateGran, estimateProd } from '@/domain/estimates';
import { buildComboReport, buildSimplifiedCombos } from '@/domain/simplifiedEstimates';
import { STEP_TITLES } from '@/domain/steps';

type KvRow = { label: string; value: string; unit: string };

const kvColumns: TableColumn<KvRow>[] = [
  { key: 'label', title: 'Величина' },
  { key: 'value', title: 'Значение', align: 'end' },
  { key: 'unit', title: 'Ед.', align: 'end' },
];

type GranRow = { class: string; pass: string };

const granColumns: TableColumn<GranRow>[] = [
  { key: 'class', title: 'Класс крупности, мм' },
  { key: 'pass', title: 'Выход по минусу, %', align: 'end' },
];

export function ResultsDrawer({
  open,
  onClose,
  stepKey,
  project,
}: {
  open: boolean;
  onClose: () => void;
  stepKey: StepKey;
  project: Project;
}) {
  // Отчёт упрощённого режима стоит только за шагом «Продукт»: там же
  // выбраны все дробилки и пробы, и там же готова матрица комбинаций.
  // Шаги «Дробилка»/«Руда» в этом режиме — чистый выбор, панель результата
  // им не назначена (см. WizardPage).
  const isCombinedReport = project.mode === 'simplified' && stepKey === 'prod';

  const combos = useMemo(() => (isCombinedReport ? buildSimplifiedCombos(project) : []), [isCombinedReport, project]);
  const [comboIndex, setComboIndex] = useState(0);
  const combo = combos[Math.min(comboIndex, combos.length - 1)];
  const comboReport = combo ? buildComboReport(combo, project) : null;

  const comboOptions: SelectOption[] = combos.map((c, i) => ({
    value: String(i),
    label: `${c.crusherName} — ${c.oreName}`,
  }));

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size="wide"
      title={STEP_TITLES[stepKey]}
      footer={
        <Stack direction="row" justify="end" grow>
          <Button variant="secondary" onClick={onClose}>
            Закрыть
          </Button>
        </Stack>
      }
    >
      <Stack gap="lg" direction="column">
        <Badge tone="success">Рассчитано</Badge>

        <Text variant="bodySm" color="textMuted">
          Значения — иллюстративная оценка на основе введённых параметров, а не результат полной инженерной методики
          дробления.
        </Text>

        {isCombinedReport ? (
          combos.length > 0 && combo && comboReport ? (
            <>
              {combos.length > 1 ? (
                <Field label="Комбинация «дробилка — проба»" fullWidth>
                  {(props) => (
                    <Select
                      {...props}
                      fullWidth
                      options={comboOptions}
                      value={String(comboIndex)}
                      clearable={false}
                      onChange={(v) => setComboIndex(Number(v))}
                    />
                  )}
                </Field>
              ) : (
                <Text variant="label">
                  {combo.crusherName} — {combo.oreName}
                </Text>
              )}

              <Table
                columns={kvColumns}
                rows={comboReport.geom}
                rowKey={(r) => r.label}
                caption="Геометрия камеры (по каталогу дробилки)"
              />
              <Table
                columns={granColumns}
                rows={comboReport.gran}
                rowKey={(r) => r.class}
                caption="Характеристика гранулометрического состава"
              />
              <Table columns={kvColumns} rows={comboReport.prod} rowKey={(r) => r.label} caption="Продукт дробления" />
            </>
          ) : (
            <Text variant="bodySm" color="textMuted">
              Нет ни одной выбранной пары «дробилка — проба».
            </Text>
          )
        ) : (
          <>
            {stepKey === 'geom' ? (
              <Table
                columns={kvColumns}
                rows={estimateGeom(project.data.geom)}
                rowKey={(r) => r.label}
                caption="Вычисляемые значения"
              />
            ) : null}

            {stepKey === 'gran' ? (
              <Table
                columns={granColumns}
                rows={estimateGran(project.data.gran)}
                rowKey={(r) => r.class}
                caption="Характеристика гранулометрического состава"
              />
            ) : null}

            {stepKey === 'prod' ? (
              <Table
                columns={kvColumns}
                rows={estimateProd(project.data.prod, project.data.geom)}
                rowKey={(r) => r.label}
                caption="Продукт дробления"
              />
            ) : null}
          </>
        )}
      </Stack>
    </Drawer>
  );
}
