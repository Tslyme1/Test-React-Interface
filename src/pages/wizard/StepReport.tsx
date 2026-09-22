import type { ReactNode } from 'react';
import { useState } from 'react';
import { Button, Popover, Stack, Tag, Text } from '@uralmash/design-system';
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
import type { GranRow } from '@/domain/estimates';
import { exportGeomToKompas, exportStepToExcel } from '@/domain/exportReport';
import { printStepReport } from '@/domain/printReport';
import { STEP_KEYS } from '@/domain/steps';
import { catalogOf } from '@/state/userCatalog';
import { GranulometryChart } from '@/components/GranulometryChart/GranulometryChart';
import { NewTagButton } from '@/components/NewTagButton/NewTagButton';
import { OptionCell } from '@/components/OptionCell/OptionCell';
import { useTags } from '@/state/useTags';
import { Section, SectionTable, checkColumns, granColumns, kvColumns, profileColumns } from './reportTables';
import { ReportBuilderModal } from './ReportBuilderModal';

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

/** Пара подписи и значения в строке метаданных — тот же приём, что в `SettingsPage`. */
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
 * Что можно сделать с готовым отчётом: собрать отчёт по проекту,
 * выгрузить этап и напечатать его.
 *
 * Стоит в левой колонке, под исходными данными, а не над таблицами:
 * это действия над этапом целиком, и в потоке отчёта они отделяли бы
 * первую таблицу от остальных, будто относятся только к ней. В строку,
 * а не столбцом: кнопки во всю ширину колонки читались как список
 * разделов, а не как панель действий.
 *
 * «Отчёт по проекту» стоит первым: остальные три кнопки про этот этап,
 * а он — про проект целиком, то есть про документ, ради которого расчёт
 * и вели. Выгрузка и печать этапа остаются рядом: они быстрее, когда
 * нужен ровно этот этап и ничего больше.
 *
 * Не `primary`, хотя по смыслу он здесь главный: `primary` на этой
 * странице уже занята — в футере стоит «Следующий этап», и две главные
 * кнопки на экране означали бы, что главное действие не выбрано.
 *
 * КОМПАС-3D — только для «Геометрии»: у неё есть профиль камеры, который
 * и передают в CAD, у остальных этапов параметров модели нет.
 */
export function StepActions({ project, stepKey }: StepActionsProps) {
  const [reportOpen, setReportOpen] = useState(false);

  return (
    <>
      <Stack direction="row" gap="sm" wrap>
        <Button variant="secondary" iconStart="fileText" onClick={() => setReportOpen(true)}>
          Отчёт по проекту
        </Button>
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

      <ReportBuilderModal open={reportOpen} onClose={() => setReportOpen(false)} project={project} />
    </>
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
            <SectionTable
              title="Параметры камеры дробления"
              columns={kvColumns}
              rows={estimateGeom(project.data.geom)}
              rowKey={(r) => r.label}
            />
          </Section>
          <Section title="Профиль камеры по расчётным сечениям">
            <SectionTable
              title="Профиль камеры по расчётным сечениям"
              columns={profileColumns}
              rows={estimateGeomProfile(project.data.geom)}
              rowKey={(r) => r.i}
            />
          </Section>
          <Section title="Критические углы поворота эксцентрика">
            <SectionTable
              title="Критические углы поворота эксцентрика"
              columns={kvColumns}
              rows={estimateGeomAlfa(project.data.geom)}
              rowKey={(r) => r.label}
            />
          </Section>
          <Section title="Контроль корректности профиля">
            <SectionTable
              title="Контроль корректности профиля"
              columns={checkColumns}
              rows={estimateGeomChecks(project.data.geom)}
              rowKey={(r) => r.label}
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
          <SectionTable
            title="Характеристика гранулометрического состава"
            columns={granReportColumns(granView)}
            rows={estimateGran(project.data.gran)}
            rowKey={(r) => r.class}
          />
        </Section>
      ) : null}

      {stepKey === 'gran' ? (
        /* Та же пара «таблица + кривая», что и у продукта ниже: питание
           и продукт сравнивают именно по этим двум кривым, и показывать
           её только у одного из них значило бы оставить сравнение
           наполовину. */
        <Section title="Суммарные характеристики крупности питания">
          <GranulometryChart rows={estimateGran(project.data.gran)} label="питание" />
        </Section>
      ) : null}

      {stepKey === 'prod' ? (
        <>
          <Section title="Продукт дробления">
            <SectionTable
              title="Продукт дробления"
              columns={kvColumns}
              rows={estimateProd(project.data.prod, project.data.geom)}
              rowKey={(r) => r.label}
            />
          </Section>
          <Section title="Грансостав продукта дробления">
            <SectionTable
              title="Грансостав продукта дробления"
              columns={granColumns}
              rows={estimateProdGran(project.data.prod)}
              rowKey={(r) => r.class}
            />
          </Section>
          <Section title="Суммарные характеристики крупности продукта">
            <GranulometryChart rows={estimateProdGran(project.data.prod)} label="продукт" />
          </Section>
        </>
      ) : null}
    </Stack>
  );
}
