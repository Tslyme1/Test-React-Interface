import type { ReactNode } from 'react';
import { useState } from 'react';
import { Badge, Button, Cell, Checkbox, Drawer, Popover, Stack, Table, Tag, Text } from '@uralmash/design-system';
import type { TableColumn } from '@uralmash/design-system';
import type { Project, StepKey } from '@/types';
import { estimateGeom, estimateGran, estimateProd } from '@/domain/estimates';
import { STEP_KEYS, STEP_TITLES } from '@/domain/steps';
import { CRUSHERS } from '@/data/crushers';
import { NewTagButton } from '@/components/NewTagButton/NewTagButton';
import { useTags } from '@/state/useTags';

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

/** Пара подписи и значения в строке метаданных — тот же приём, что в `ProfilePage`. */
function MetaField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Stack gap="2xs" direction="column" align="start">
      <Text variant="label" color="textMuted">
        {label}
      </Text>
      {children}
    </Stack>
  );
}

/**
 * Теги проекта — сами метки в ряд, а не селект с их именами: метки этого
 * проекта видны сразу, без открытия панели, и снимаются прямо на месте
 * (`Tag.onRemove`). Добавление — отдельной кнопкой «+»: она открывает тот
 * же список, что и `Select multiple`, тем же приёмом (`Cell` с флажком),
 * но без вечно пустого поля-триггера, которое здесь нечем было бы
 * подписать — тегов может быть и три, и ни одного.
 */
function TagsField({ project, onUpdateProject }: { project: Project; onUpdateProject: (id: string, patch: Partial<Project>) => void }) {
  const { tags, colorOf, addTag } = useTags();
  const [pickerOpen, setPickerOpen] = useState(false);

  const toggleTag = (name: string) => {
    const next = project.tags.includes(name) ? project.tags.filter((t) => t !== name) : [...project.tags, name];
    onUpdateProject(project.id, { tags: next });
  };

  return (
    <Stack direction="row" gap="2xs" wrap align="center">
      {project.tags.map((name) => (
        <Tag key={name} color={colorOf(name)} onRemove={() => toggleTag(name)}>
          {name}
        </Tag>
      ))}

      <Popover
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        placement="bottom-start"
        width="sm"
        trigger={
          <Button
            variant="ghost"
            size="sm"
            icon="plus"
            aria-label="Добавить тег"
            onClick={() => setPickerOpen((v) => !v)}
          />
        }
        footer={
          <NewTagButton
            onCreate={(name, color) => {
              // Заведённый здесь тег сразу становится тегом этого проекта —
              // в отличие от фильтра списка проектов, где «Новый тег» только
              // заполняет справочник. Здесь заводят тег ради конкретного
              // проекта в руках.
              const created = addTag(name, color);
              if (created) onUpdateProject(project.id, { tags: [...project.tags, name] });
              return created;
            }}
          />
        }
      >
        <Stack direction="column" gap="none">
          {tags.map((t) => {
            const checked = project.tags.includes(t.name);
            return (
              <Cell
                key={t.name}
                size="sm"
                role="option"
                aria-selected={checked}
                selected={checked}
                trailing={<Checkbox checked={checked} readOnly tabIndex={-1} />}
                onClick={() => toggleTag(t.name)}
              >
                <Tag color={t.color}>{t.name}</Tag>
              </Cell>
            );
          })}
        </Stack>
      </Popover>
    </Stack>
  );
}

export function ResultsDrawer({
  open,
  onClose,
  stepKey,
  project,
  onUpdateProject,
}: {
  open: boolean;
  onClose: () => void;
  stepKey: StepKey;
  project: Project;
  onUpdateProject: (id: string, patch: Partial<Project>) => void;
}) {
  const power = CRUSHERS.find((c) => c.name === project.crusherName)?.values['N, кВт'];

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

        {/*
         * Кто, когда и на какой машине — контекст расчёта, который не виден
         * из самих цифр ниже. Дата и дробилка — по этому шагу конкретно
         * (`calcDates[stepKey]`), а не по проекту в целом: шаги считаются
         * не одновременно, и дата последнего расчёта другого шага была бы
         * неправдой здесь.
         */}
        <Stack direction="row" wrap gap="xl">
          <MetaField label="Дата расчёта">
            <Text variant="body">{project.calcDates[STEP_KEYS.indexOf(stepKey)] ?? '—'}</Text>
          </MetaField>
          <MetaField label="Дробилка">
            <Text variant="body">{project.crusherName || '—'}</Text>
          </MetaField>
          <MetaField label="Мощность">
            <Text variant="body">{power ? `${power} кВт` : '—'}</Text>
          </MetaField>
          <MetaField label="Исполнитель">
            <Text variant="body">{project.executor}</Text>
          </MetaField>
          <MetaField label="Теги">
            <TagsField project={project} onUpdateProject={onUpdateProject} />
          </MetaField>
        </Stack>

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
