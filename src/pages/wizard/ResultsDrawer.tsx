import type { ReactNode } from 'react';
import { useEffect, useRef, useState } from 'react';
import { Badge, Button, Cell, Checkbox, Drawer, Popover, Stack, Tab, Table, Tag, Text } from '@uralmash/design-system';
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
import { STEP_KEYS, STEP_TITLES } from '@/domain/steps';
import { catalogOf } from '@/state/userCatalog';
import { GranulometryChart } from '@/components/GranulometryChart/GranulometryChart';
import { NewTagButton } from '@/components/NewTagButton/NewTagButton';
import { OptionCell } from '@/components/OptionCell/OptionCell';
import { useTags } from '@/state/useTags';
import styles from './ResultsDrawer.module.css';

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
 * Отображение таблицы на шаге «Грансостав» — какие столбцы выхода
 * показывать, независимо друг от друга: по минусу и по плюсу — одна
 * кривая зеркальна другой (`100 − по минусу`), частные классы — доля
 * самого класса, а не накопленный итог. Три независимых флажка, а не
 * выбор одного варианта: сравнить, например, по минусу с частными
 * классами в одной таблице — обычная надобность, не редкий случай.
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

function granDrawerColumns(view: Set<GranView>): TableColumn<GranRow>[] {
  return [
    { key: 'class', title: 'Класс крупности, мм' },
    { key: 'dMid', title: 'D сред', align: 'end' },
    { key: 'd08', title: '0.8·D пред', align: 'end' },
    ...GRAN_VIEW_ORDER.filter(({ key }) => view.has(key)).map(({ key }) => GRAN_VIEW_COLUMNS[key]),
  ];
}

/**
 * Разделы шторки «Продукт» — единственный шаг с несколькими разделами
 * подряд (свой отчёт, затем этапы 1 и 2 целиком, см. ниже). Навигация по
 * ним — переключатель, который прокручивает к разделу по клику и сам
 * переключается по мере прокрутки (`IntersectionObserver` в компоненте).
 */
const PROD_SECTIONS = [
  { key: 'product', label: 'Продукт' },
  { key: 'stage1', label: 'Этап 1' },
  { key: 'stage2', label: 'Этап 2' },
] as const;
type ProdSection = (typeof PROD_SECTIONS)[number]['key'];

/**
 * Профиль камеры по расчётным сечениям — та же таблица, что печатает
 * отчёт этапа 1 методики (§6.2). Раньше здесь было пять столбцов из
 * восьми и радиусы стояли перепутанными местами: r₁ подписывался как
 * броня чаши, хотя в методике это внутренний контур — броня конуса.
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
  const power = catalogOf('crushers').find((c) => c.name === project.crusherName)?.values['N, кВт'];

  // ── отображение таблицы «Грансостав» — см. `granDrawerColumns` выше ──
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

  // ── навигация по разделам шторки «Продукт» — см. `PROD_SECTIONS` выше ──
  const contentRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLDivElement>(null);
  const sectionRefs = useRef<Record<ProdSection, HTMLDivElement | null>>({ product: null, stage1: null, stage2: null });
  const [activeSection, setActiveSection] = useState<ProdSection>('product');
  // Подавляет обновления от наблюдателя во время программной прокрутки
  // по клику — иначе переключатель на середине пути дёргался бы между
  // разделом, который проезжает мимо, и тем, куда едет клик.
  const scrollingToSection = useRef(false);

  useEffect(() => {
    if (stepKey !== 'prod' || !open) return;
    // `.content` дизайн-системы — прокручиваемый предок, которого сама
    // шторка не отдаёт наружу: это родитель обёртки, которую рендерит
    // сюда `Drawer` как `children` (см. её анатомию в инвентаре).
    const container = contentRef.current?.parentElement;
    if (!container) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (scrollingToSection.current) return;
        const visible = entries.filter((e) => e.isIntersecting);
        if (visible.length === 0) return;
        const topMost = visible.reduce((a, b) => (a.boundingClientRect.top < b.boundingClientRect.top ? a : b));
        const key = (topMost.target as HTMLElement).dataset.section as ProdSection | undefined;
        if (key) setActiveSection(key);
      },
      // Полоса-триггер — верхняя треть области прокрутки: раздел становится
      // активным, когда его заголовок входит в неё, а не только когда
      // целиком попадает в видимую область (иначе короткий раздел «Продукт»
      // никогда не активировался бы целиком одновременно с длинным «Этап 1»).
      { root: container, rootMargin: '0px 0px -66% 0px', threshold: 0 }
    );

    PROD_SECTIONS.forEach(({ key }) => {
      const el = sectionRefs.current[key];
      if (el) observer.observe(el);
    });

    return () => observer.disconnect();
  }, [stepKey, open]);

  const scrollToSection = (key: ProdSection) => {
    const el = sectionRefs.current[key];
    const container = contentRef.current?.parentElement;
    if (!el || !container) return;

    scrollingToSection.current = true;
    setActiveSection(key);
    const containerRect = container.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    // Выше цели ровно на высоту закреплённой панели навигации — иначе
    // заголовок раздела оказывался бы под ней, а не сразу под кромкой.
    const navHeight = navRef.current?.offsetHeight ?? 0;
    container.scrollTo({ top: container.scrollTop + (elRect.top - containerRect.top) - navHeight, behavior: 'smooth' });
    // Прокрутка smooth не даёт единого события «закончилось» без доп. API —
    // фиксированная задержка проще, чем ловить конец инерции.
    window.setTimeout(() => {
      scrollingToSection.current = false;
    }, 500);
  };

  return (
    <Drawer
      open={open}
      onClose={onClose}
      size="wide"
      title={STEP_TITLES[stepKey]}
      footer={
        <Stack direction="row" justify="between" align="center" grow>
          {/* Экспорт и печать — слева: это действия над отчётом, а «Закрыть»
              справа — действие над самой шторкой, и их не стоит путать в ряд
              на одну сторону. КОМПАС-3D — только для «Геометрии»: у неё есть
              профиль камеры, который и передают в CAD, у остальных шагов
              параметров модели нет. */}
          <Stack direction="row" gap="sm">
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
          <Button variant="secondary" onClick={onClose}>
            Закрыть
          </Button>
        </Stack>
      }
    >
      <div ref={contentRef}>
      <Stack gap="lg" direction="column">
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

        {stepKey === 'prod' ? (
          <nav ref={navRef} className={styles.nav} aria-label="Навигация по отчёту">
            {PROD_SECTIONS.map(({ key, label }) => (
              <Tab key={key} active={activeSection === key} onClick={() => scrollToSection(key)}>
                {label}
              </Tab>
            ))}
          </nav>
        ) : null}

        {stepKey === 'geom' ? (
          <>
            <Table columns={kvColumns} rows={estimateGeom(project.data.geom)} rowKey={(r) => r.label} caption="Параметры камеры дробления" />
            <Table
              columns={profileColumns}
              rows={estimateGeomProfile(project.data.geom)}
              rowKey={(r) => r.i}
              caption="Профиль камеры по расчётным сечениям"
            />
            <Table
              columns={kvColumns}
              rows={estimateGeomAlfa(project.data.geom)}
              rowKey={(r) => r.label}
              caption="Критические углы поворота эксцентрика"
            />
            <Table
              columns={checkColumns}
              rows={estimateGeomChecks(project.data.geom)}
              rowKey={(r) => r.label}
              caption="Контроль корректности профиля"
            />
          </>
        ) : null}

        {stepKey === 'gran' ? (
          <Table
            columns={granDrawerColumns(granView)}
            rows={estimateGran(project.data.gran)}
            rowKey={(r) => r.class}
            caption="Характеристика гранулометрического состава"
            captionActions={
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
          />
        ) : null}

        {stepKey === 'prod' ? (
          <>
            <div ref={(el: HTMLDivElement | null) => (sectionRefs.current.product = el)} data-section="product">
            <Stack gap="lg" direction="column">
              <Table
                columns={kvColumns}
                rows={estimateProd(project.data.prod, project.data.geom)}
                rowKey={(r) => r.label}
                caption="Продукт дробления"
              />
              <Table
                columns={granColumns}
                rows={estimateProdGran(project.data.prod)}
                rowKey={(r) => r.class}
                caption="Грансостав продукта дробления"
              />
              <Stack gap="xs" direction="column">
                <Text variant="label">Суммарные характеристики крупности продукта</Text>
                <GranulometryChart rows={estimateProdGran(project.data.prod)} />
              </Stack>
            </Stack>
            </div>

            {/*
             * Продукт — последний шаг цепочки, и его отчёт по смыслу продолжает
             * два предыдущих: усилия и грансостав продукта посчитаны из
             * геометрии камеры и грансостава питания, которые здесь же и
             * стоит увидеть, не открывая шторки этих шагов отдельно.
             */}
            <div ref={(el: HTMLDivElement | null) => (sectionRefs.current.stage1 = el)} data-section="stage1">
            <Stack gap="lg" direction="column">
              <Text variant="headingSm">Этап 1. Геометрия камеры дробления</Text>
              <Table
                columns={kvColumns}
                rows={estimateGeom(project.data.geom)}
                rowKey={(r) => r.label}
                caption="Параметры камеры дробления"
              />
              <Table
                columns={profileColumns}
                rows={estimateGeomProfile(project.data.geom)}
                rowKey={(r) => r.i}
                caption="Профиль камеры по точкам"
              />
            </Stack>
            </div>

            <div ref={(el: HTMLDivElement | null) => (sectionRefs.current.stage2 = el)} data-section="stage2">
            <Stack gap="lg" direction="column">
              <Text variant="headingSm">Этап 2. Характеристический грансостав</Text>
              <Table
                columns={granColumns}
                rows={estimateGran(project.data.gran)}
                rowKey={(r) => r.class}
                caption="Характеристика гранулометрического состава"
              />
              <Stack gap="xs" direction="column">
                <Text variant="label">Суммарные характеристики крупности питания</Text>
                <GranulometryChart rows={estimateGran(project.data.gran)} />
              </Stack>
            </Stack>
            </div>
          </>
        ) : null}
      </Stack>
      </div>
    </Drawer>
  );
}
