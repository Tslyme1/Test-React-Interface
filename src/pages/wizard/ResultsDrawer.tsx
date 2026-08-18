import { Badge, Button, Drawer, Stack, Table, Text } from '@uralmash/design-system';
import type { TableColumn } from '@uralmash/design-system';
import type { Project, StepKey } from '@/types';
import { estimateGeom, estimateGran, estimateProd } from '@/domain/estimates';

const STEP_TITLES: Record<StepKey, string> = {
  geom: 'Результат: геометрия камеры дробления',
  gran: 'Результат: характеристический грансостав',
  prod: 'Результат: грансостав продукта и усилия',
};

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

        {stepKey === 'geom' ? (
          <Table columns={kvColumns} rows={estimateGeom(project.data.geom)} rowKey={(r) => r.label} caption="Вычисляемые значения" />
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
      </Stack>
    </Drawer>
  );
}
