import type { ReactNode } from 'react';
import { useState } from 'react';
import { Badge, Button, Popover, Stack, Table, Tag, Text } from '@uralmash/design-system';
import type { TableColumn } from '@uralmash/design-system';
import type { Project, StepKey } from '@/types';
import {
  estimateGeom,
  estimateGeomAlfa,
  estimateGeomChecks,
  estimateGeomProfile,
  estimateGran,
  estimateProd,
  estimateProdGran,
} from '@/domain/estimates';
import type { CheckRow, GranRow, KvRow, ProfileRow } from '@/domain/estimates';
import { exportGeomToKompas, exportStepToExcel } from '@/domain/exportReport';
import { printStepReport } from '@/domain/printReport';
import { STEP_KEYS } from '@/domain/steps';
import { catalogOf } from '@/state/userCatalog';
import { GranulometryChart } from '@/components/GranulometryChart/GranulometryChart';
import { NewTagButton } from '@/components/NewTagButton/NewTagButton';
import { OptionCell } from '@/components/OptionCell/OptionCell';
import { useTags } from '@/state/useTags';

const kvColumns: TableColumn<KvRow>[] = [
  { key: 'label', title: 'Величина' },
  { key: 'value', title: 'Значение', align: 'end' },
  { key: 'unit', title: 'Ед.', align: 'end' },
];

/**
 * Грансостав — теми же массивами, что и в распечатке программы-источника:
 * граница класса, его середина, расчётная ширина куска и доля класса.
 */
const granColumns: TableColumn<GranRow>[] = [
  { key: 'class', title: 'Класс крупности, мм' },
  { key: 'dMid', title: 'D сред', align: 'end' },
  { key: 'd08', title: '0.8·D пред', align: 'end' },
  { key: 'gamma', title: 'γ', align: 'end' },
  { key: 'pass', title: 'Выход по минусу, %', align: 'end' },
];

/**
 * Отображение таблицы «Грансостав» — какие столбцы выхода показывать,
 * независимо друг от друга: по минусу и по плюсу — одна кривая зеркальна
 * другой (`100 − по минусу`), частные классы — доля самого класса, а не
 * накопленный итог. Три независимых флажка, а не выбор одного варианта:
 * сравнить по минусу с частными классами в одной таблице — обычная
 * надобность, не редкий случай.
 */
type GranView = 'minus' | 'plus' | 'classes';

const GRAN_VIEW_COLUMNS: Record<GranView, TableColumn<GranRow>> = {
  minus: { key: 'pass', title: 'Выход по минусу, %', align: 'end' },
  plus: { key: 'over', title: 'Выход по плюсу, %', align: 'end', render: (r) => (100 - Number(r.pass)).toFixed(1) },
  classes: { key: 'gamma', title: 'Частные классы, %', align: 'end', render: (r) => (Number(r.gamma) * 100).toFixed(1) },
};

const GRAN_VIEW_ORDER: { key: GranView; label: string }[] = [
  { key: 'minus', label: 'По минусу' },
  { key: 'plus', label: 'По плюсу' },
  { key: 'classes', label: 'Частные классы' },
];

function granReportColumns(view: Set<GranView>): TableColumn<GranRow>[] {
  return [
    { key: 'class', title: 'Класс крупности, мм' },
    { key: 'dMid', title: 'D сред', align: 'end' },
    { key: 'd08', title: '0.8·D пред', align: 'end' },
    ...GRAN_VIEW_ORDER.filter(({ key }) => view.has(key)).map(({ key }) => GRAN_VIEW_COLUMNS[key]),
  ];
}

/**
 * Профиль камеры по расчётным сечениям — та же таблица, что печатает
 * отчёт этапа 1 методики (§6.2).
 */
const profileColumns: TableColumn<ProfileRow>[] = [
  { key: 'i', title: 'I' },
  { key: 'l', title: 'L1, мм', align: 'end' },
  { key: 'b1', title: 'β₁', align: 'end' },
  { key: 'r1', title: 'R1, мм', align: 'end' },
  { key: 'a1', title: 'α₁', align: 'end' },
  { key: 'b4', title: 'β₄', align: 'end' },
  { key: 'r4', title: 'R4, мм', align: 'end' },
  { key: 'a4', title: 'α₄', align: 'end' },
  { key: 'lSum', title: 'L сум, мм', align: 'end' },
  { key: 's1', title: 'S1, мм', align: 'end' },
  { key: 'sot', title: 'S1 отк, мм', align: 'end' },
];

/**
 * Встроенные проверки профиля (§3.4 методики). Методика прямо называет их
 * признаком ошибки в исходных данных, поэтому они стоят рядом с таблицей,
 * а не прячутся: посчитать три этапа по не замкнувшемуся профилю можно,
 * но верить результату нельзя.
 */
const checkColumns: TableColumn<CheckRow>[] = [
  { key: 'label', title: 'Проверка' },
  { key: 'value', title: 'Значение', align: 'end' },
  {
    key: 'ok',
    title: '',
    align: 'end',
    /* `Badge`, а не `Tag`: это статус системы, а не пользовательская метка —
       так и записано в самой системе у `Tag`. Иконка дублирует смысл цвета,
       чтобы результат читался и без различения цветов. */
    render: (row) =>
      row.ok ? (
        <Badge tone="success" icon="check">
          сходится
        </Badge>
      ) : (
        <Badge tone="danger" icon="alertTriangle">
          ошибка
        </Badge>
      ),
  },
];

/**
 * Раздел отчёта: белый подзаголовок и таблица под ним.
 *
 * Подпись вынесена из самой таблицы наружу: `caption` набирается
 * приглушённым и читается как служебная строка внутри рамки, а разделов
 * в отчёте до семи — рядом они должны выстраиваться в оглавление, а не
 * теряться в шапках. Скринридеру таблица остаётся подписанной той же
 * строкой (`caption` + `captionHidden`).
 */
function Section({ title, actions, children }: { title: string; actions?: ReactNode; children: ReactNode }) {
  return (
    <Stack gap="sm" direction="column">
      <Stack direction="row" justify="between" align="center" gap="sm" wrap>
        <Text variant="headingSm">{title}</Text>
        {actions}
      </Stack>
      {children}
    </Stack>
  );
}

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
function TagsField({
  project,
  onUpdateProject,
}: {
  project: Project;
  onUpdateProject: (id: string, patch: Partial<Project>) => void;
}) {
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
          {tags.map((tag) => (
            <OptionCell
              key={tag.name}
              kind="checkbox"
              label={tag.name}
              checked={project.tags.includes(tag.name)}
              onSelect={() => toggleTag(tag.name)}
            />
          ))}
        </Stack>
      </Popover>
    </Stack>
  );
}

export type StepMetaProps = {
  project: Project;
  stepKey: StepKey;
  onUpdateProject: (id: string, patch: Partial<Project>) => void;
};

/**
 * Кто, когда и на какой машине — контекст расчёта, который не виден
 * из самих цифр отчёта. Стоит под заголовком этапа, а не внутри отчёта:
 * это шапка экрана результата, и относится она к нему целиком, а не
 * к первой из его таблиц.
 *
 * Дата и дробилка — по этому этапу конкретно (`calcDates[stepKey]`),
 * а не по проекту в целом: этапы считаются не одновременно, и дата
 * последнего расчёта другого была бы здесь неправдой.
 */
export function StepMeta({ project, stepKey, onUpdateProject }: StepMetaProps) {
  const power = catalogOf('crushers').find((c) => c.name === project.crusherName)?.values['N, кВт'];

  return (
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
  );
}

export type StepActionsProps = {
  project: Project;
  stepKey: StepKey;
};

/**
 * Что можно сделать с готовым отчётом: выгрузить и напечатать.
 *
 * Стоит в левой колонке, под исходными данными, а не над таблицами:
 * это действия над этапом целиком, и в потоке отчёта они отделяли бы
 * первую таблицу от остальных, будто относятся только к ней. В строку,
 * а не столбцом: три кнопки во всю ширину колонки читались как список
 * разделов, а не как панель действий.
 *
 * КОМПАС-3D — только для «Геометрии»: у неё есть профиль камеры, который
 * и передают в CAD, у остальных этапов параметров модели нет.
 */
export function StepActions({ project, stepKey }: StepActionsProps) {
  return (
    <Stack direction="row" gap="sm" wrap>
      <Button variant="secondary" iconStart="download" onClick={() => exportStepToExcel(project, stepKey)}>
        Экспорт в Excel
      </Button>
      {stepKey === 'geom' ? (
        <Button variant="secondary" iconStart="download" onClick={() => exportGeomToKompas(project)}>
          Экспорт в Компас 3D
        </Button>
      ) : null}
      <Button variant="secondary" iconStart="print" onClick={() => printStepReport(project, stepKey)}>
        Печать
      </Button>
    </Stack>
  );
}

export type StepReportProps = {
  project: Project;
  stepKey: StepKey;
};

/**
 * Отчёт посчитанного этапа — то, что раньше показывала шторка результата.
 *
 * Шторки больше нет: страница этапа и так отвечает на вопрос «что вышло»,
 * и кнопка «Смотреть результат», открывавшая поверх неё то же самое,
 * предлагала посмотреть на уже показанное. Отчёт переехал на страницу
 * целиком — вместе с метаданными расчёта и тегами, без которых из одних
 * цифр не видно, кто и когда считал.
 */
export function StepReport({ project, stepKey }: StepReportProps) {
  const [granViewOpen, setGranViewOpen] = useState(false);
  const [granView, setGranView] = useState<Set<GranView>>(new Set<GranView>(['minus']));
  const toggleGranView = (key: GranView) => {
    setGranView((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <Stack gap="lg" direction="column">
      {stepKey === 'geom' ? (
        <>
          <Section title="Параметры камеры дробления">
              <Table columns={kvColumns} rows={estimateGeom(project.data.geom)} rowKey={(r) => r.label} caption="Параметры камеры дробления"
              captionHidden
            />
          </Section>
          <Section title="Профиль камеры по расчётным сечениям">
              <Table
              columns={profileColumns}
              rows={estimateGeomProfile(project.data.geom)}
              rowKey={(r) => r.i}
              caption="Профиль камеры по расчётным сечениям"
              captionHidden
            />
          </Section>
          <Section title="Критические углы поворота эксцентрика">
              <Table
              columns={kvColumns}
              rows={estimateGeomAlfa(project.data.geom)}
              rowKey={(r) => r.label}
              caption="Критические углы поворота эксцентрика"
              captionHidden
            />
          </Section>
          <Section title="Контроль корректности профиля">
              <Table
              columns={checkColumns}
              rows={estimateGeomChecks(project.data.geom)}
              rowKey={(r) => r.label}
              caption="Контроль корректности профиля"
              captionHidden
            />
          </Section>
        </>
      ) : null}

      {stepKey === 'gran' ? (
        <Section
          title="Характеристика гранулометрического состава"
          /* Переключатель столбцов — у подзаголовка, а не у самой таблицы:
             `captionActions` системы живут в видимой подписи, а подпись
             отсюда вынесена наружу (см. `Section`). */
          actions={
            <Popover
              open={granViewOpen}
              onClose={() => setGranViewOpen(false)}
              placement="bottom-end"
              width="sm"
              title="Отображение"
              trigger={
                <Button variant="secondary" size="sm" iconEnd="chevronDown" onClick={() => setGranViewOpen((o) => !o)}>
                  Отображение
                </Button>
              }
            >
              <Stack direction="column" gap="none">
                {GRAN_VIEW_ORDER.map(({ key, label }) => (
                  <OptionCell
                    key={key}
                    kind="checkbox"
                    label={label}
                    checked={granView.has(key)}
                    onSelect={() => toggleGranView(key)}
                  />
                ))}
              </Stack>
            </Popover>
          }
        >
          <Table
            columns={granReportColumns(granView)}
            rows={estimateGran(project.data.gran)}
            rowKey={(r) => r.class}
            caption="Характеристика гранулометрического состава"
            captionHidden
          />
        </Section>
      ) : null}

      {stepKey === 'prod' ? (
        <>
          <Section title="Продукт дробления">
              <Table
              columns={kvColumns}
              rows={estimateProd(project.data.prod, project.data.geom)}
              rowKey={(r) => r.label}
              caption="Продукт дробления"
              captionHidden
            />
          </Section>
          <Section title="Грансостав продукта дробления">
              <Table
              columns={granColumns}
              rows={estimateProdGran(project.data.prod)}
              rowKey={(r) => r.class}
              caption="Грансостав продукта дробления"
              captionHidden
            />
          </Section>
          <Section title="Суммарные характеристики крупности продукта">
            <GranulometryChart rows={estimateProdGran(project.data.prod)} />
          </Section>

        </>
      ) : null}
    </Stack>
  );
}
