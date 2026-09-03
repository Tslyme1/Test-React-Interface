import { useEffect, useState } from 'react';
import { Button, Field, Input, Modal, Select, Stack, Stepper, Table, Text } from '@uralmash/design-system';
import type { SelectOption, Step, TableColumn } from '@uralmash/design-system';
import { CatalogPicker } from '@/components/CatalogPicker/CatalogPicker';
import { GranulometryChart } from '@/components/GranulometryChart/GranulometryChart';
import { CRUSHERS, CRUSHER_SPECS } from '@/data/crushers';
import { ORE_SAMPLES, ORE_SPECS } from '@/data/oreSamples';
import { CUSTOMER_OPTIONS } from '@/data/reference';
import { buildComboReport, buildSimplifiedCombos } from '@/domain/simplifiedEstimates';
import type { GranRow, KvRow } from '@/domain/estimates';
import type { Project } from '@/types';
import { ProdStep } from './wizard/ProdStep';
import styles from './SimplifiedProjectModal.module.css';

const STEP_META: Step[] = [{ label: 'Дробилка' }, { label: 'Руда' }, { label: 'Продукт' }];

const kvColumns: TableColumn<KvRow>[] = [
  { key: 'label', title: 'Величина' },
  { key: 'value', title: 'Значение', align: 'end' },
  { key: 'unit', title: 'Ед.', align: 'end' },
];

/** Те же столбцы, что и в шторке инженерного режима: отчёт один на оба. */
const granColumns: TableColumn<GranRow>[] = [
  { key: 'class', title: 'Класс крупности, мм' },
  { key: 'dMid', title: 'D сред', align: 'end' },
  { key: 'gamma', title: 'γ', align: 'end' },
  { key: 'pass', title: 'Выход по минусу, %', align: 'end' },
];

export type SimplifiedProjectModalProps = {
  open: boolean;
  onClose: () => void;
  /** `null` — окно создаёт новый проект; иначе продолжает уже существующий. */
  project: Project | null;
  defaultExecutor: string;
  onCreate: (input: { name: string; customer: string; crusherNames: string[]; executor: string }) => Project;
  onUpdateProject: (id: string, patch: Partial<Project>) => void;
  showToast: (message: string) => void;
};

/**
 * Упрощённый режим целиком — одно окно от выбора дробилки до отчёта.
 *
 * Ничего не закрывается и не открывается заново между шагами: под окном всё
 * время остаётся тот же список проектов, на который открытие проекта в
 * инженерном режиме заменяло бы весь экран. Здесь замены нет — окно меняет
 * содержимое внутри себя (степпер + тело + футер), а список за ним не трогает.
 *
 * Проект создаётся сразу после первого шага (выбора дробилок и заполнения
 * имени/заказчика) — дальше это обычный проект в общем списке, который можно
 * прервать и продолжить, открыв то же окно повторно по строке таблицы.
 */
export function SimplifiedProjectModal({
  open,
  onClose,
  project,
  defaultExecutor,
  onCreate,
  onUpdateProject,
  showToast,
}: SimplifiedProjectModalProps) {
  const [step, setStep] = useState(0);
  const [resultOpen, setResultOpen] = useState(false);
  const [comboIndex, setComboIndex] = useState(0);

  // Черновик первого шага — существует, только пока проекта ещё нет.
  const [name, setName] = useState('');
  const [suggested, setSuggested] = useState('');
  const [customer, setCustomer] = useState<string | null>(null);
  const [draftCrushers, setDraftCrushers] = useState<string[]>([]);

  const resetPreCreationDraft = () => {
    setName('');
    setSuggested('');
    setCustomer(null);
    setDraftCrushers([]);
  };

  /**
   * Каждое открытие ставит шаг по фактическому прогрессу проекта, а не там,
   * где окно оказалось в прошлый раз перед закрытием: иначе прерванный на
   * шаге «Руда» расчёт при повторном открытии показывал бы уже пройденный
   * шаг «Дробилка» — окно об этом прогрессе прекрасно знает через `calc`.
   */
  useEffect(() => {
    if (!open) return;
    if (!project) {
      setStep(0);
      setResultOpen(false);
      return;
    }
    const firstIncomplete = project.calc.findIndex((done) => !done);
    if (firstIncomplete === -1) {
      setStep(2);
      setResultOpen(true);
    } else {
      setStep(firstIncomplete);
      setResultOpen(false);
    }
    setComboIndex(0);
  }, [open, project?.id]);

  const close = () => {
    resetPreCreationDraft();
    onClose();
  };

  /** Название подсказывается по первой выбранной дробилке, пока его не переписали руками. */
  const pickDraftCrushers = (picked: string[]) => {
    setDraftCrushers(picked);
    if (picked.length === 0) {
      if (name === suggested) {
        setName('');
        setSuggested('');
      }
      return;
    }
    if (!name.trim() || name === suggested) {
      setName(picked[0]);
      setSuggested(picked[0]);
    }
  };

  const canCreate = Boolean(draftCrushers.length > 0 && name.trim() && customer);

  const submitCreate = () => {
    if (!canCreate || !customer) return;
    const created = onCreate({ name: name.trim(), customer, crusherNames: draftCrushers, executor: defaultExecutor });
    // Выбор дробилок и есть завершение шага 0 в этом режиме — отмечаем сразу,
    // иначе прогресс проекта (`calc`) не согласуется с тем, что окно уже
    // показывает шаг «Руда», и повторное открытие вернуло бы на «Дробилка».
    onUpdateProject(created.id, { calc: [true, false, false] });
    showToast(`Проект «${created.name}» создан`);
    setStep(1);
  };

  const available = (i: number) => (project ? i === 0 || project.calc[i - 1] || project.calc[i] : i === 0);
  const calculated = project ? project.calc[step] : false;

  const ready = !project
    ? canCreate
    : step === 0
      ? project.crusherNames.length > 0
      : step === 1
        ? project.oreNames.length > 0
        : Boolean(project.data.prod.dMax);

  const goToStep = (i: number) => {
    if (!project || !available(i)) return;
    setResultOpen(false);
    setStep(i);
  };

  const changeCrusherNames = (names: string[]) =>
    project && onUpdateProject(project.id, { crusherNames: names, crusherName: names[0] ?? '' });
  const changeOreNames = (names: string[]) =>
    project && onUpdateProject(project.id, { oreNames: names, ore: names[0] ?? '' });
  const patchProd = (patch: Partial<Project['data']['prod']>) =>
    project && onUpdateProject(project.id, { data: { ...project.data, prod: { ...project.data.prod, ...patch } } });

  const runCalc = () => {
    if (!project) return;
    const nextCalc = [...project.calc] as Project['calc'];
    nextCalc[step] = true;
    onUpdateProject(project.id, { calc: nextCalc });

    if (step === 2) {
      setResultOpen(true);
      showToast('Шаг «Продукт» рассчитан');
    } else {
      showToast('Выбор сохранён');
      setStep(step + 1);
    }
  };

  const advance = () => {
    if (!project) return;
    if (step === 2) {
      setResultOpen(true);
      return;
    }
    setStep(step + 1);
  };

  const combos = project ? buildSimplifiedCombos(project) : [];
  const combo = combos[Math.min(comboIndex, Math.max(combos.length - 1, 0))];
  const comboReport = combo && project ? buildComboReport(combo, project) : null;
  const comboOptions: SelectOption[] = combos.map((c, i) => ({ value: String(i), label: `${c.crusherName} — ${c.oreName}` }));

  /**
   * Заголовок окна называет сам шаг, а не режим целиком: «Упрощённый расчёт —
   * Дробилка» было понятно только тем, кто уже знает про упрощённый режим,
   * а «Выбор дробилки» говорит, что сейчас нужно сделать, даже до того, как
   * открылось тело окна.
   */
  const title = resultOpen ? 'Результат расчёта' : step === 0 ? 'Выбор дробилки' : step === 1 ? 'Выбор руды' : 'Продукт';

  // Степпер — в футере слева (`aside`), а не в теле: тело в упрощённом
  // режиме и так короткое, и степпер сверху отрывал шаг от кнопки,
  // которая его подтверждает. `aside` — ровно то место, что система
  // отвела второстепенному содержимому слева от действий футера.
  //
  // Показан и до создания проекта — на первом шаге, когда выбираются
  // дробилки: без него казалось, что степпер появляется только на втором
  // шаге, а на самом деле он просто не был передан в футер для этой ветки.
  // «Руда» и «Продукт» отключены до создания — `available` возвращает
  // `i === 0`, пока проекта ещё нет.
  const stepperAside = (
    <Stepper
      steps={STEP_META.map((meta, i) => ({ ...meta, disabled: !available(i), completed: project?.calc[i] }))}
      current={step}
      onStepClick={goToStep}
    />
  );

  return (
    <Modal
      open={open}
      onClose={close}
      title={title}
      size="lg"
      footer={
        !project ? (
          <Modal.Footer aside={stepperAside}>
            <div className={styles.footerFields}>
              <div className={styles.footerField}>
                <Field label="Название проекта" variant="floating" required>
                  {(props) => <Input {...props} fullWidth value={name} onChange={(e) => setName(e.target.value)} />}
                </Field>
              </div>
              <div className={styles.footerField}>
                <Field label="Заказчик" variant="floating" required>
                  {(props) => (
                    <Select
                      {...props}
                      fullWidth
                      options={CUSTOMER_OPTIONS}
                      value={customer}
                      onChange={(v) => setCustomer(v as string)}
                      allowCustom
                    />
                  )}
                </Field>
              </div>
            </div>
            <Button variant="primary" disabled={!canCreate} onClick={submitCreate}>
              Продолжить
            </Button>
          </Modal.Footer>
        ) : resultOpen ? (
          <Modal.Footer aside={stepperAside}>
            <Button variant="secondary" onClick={() => setResultOpen(false)}>
              Назад к шагам
            </Button>
            <Button variant="primary" onClick={close}>
              Готово
            </Button>
          </Modal.Footer>
        ) : (
          <Modal.Footer aside={stepperAside}>
            <Button variant="primary" disabled={!ready} onClick={calculated ? advance : runCalc}>
              {calculated ? 'Далее' : step === 2 ? 'Выполнить расчёт' : 'Продолжить'}
            </Button>
          </Modal.Footer>
        )
      }
    >
      <Stack gap="lg" direction="column">
        {!project ? (
          <Stack gap="md" direction="column">
            <Text variant="bodySm" color="textMuted">
              Выбрано дробилок: {draftCrushers.length}. Можно выбрать несколько — расчёт на шаге «Продукт» пройдёт по
              каждой отдельно.
            </Text>
            <CatalogPicker
              specs={CRUSHER_SPECS}
              items={CRUSHERS}
              value={null}
              onPick={() => {}}
              multiple
              selected={draftCrushers}
              onPickMultiple={pickDraftCrushers}
              nameLabel="Дробилка"
              inlineSpecs={['D, мм', 'Q, т/ч']}
            />
          </Stack>
        ) : resultOpen ? (
          <Stack gap="lg" direction="column">
            <Text variant="bodySm" color="textMuted">
              Значения — иллюстративная оценка на основе введённых параметров, а не результат полной инженерной методики
              дробления.
            </Text>

            {combo && comboReport ? (
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

                <Table columns={kvColumns} rows={comboReport.geom} rowKey={(r) => r.label} caption="Геометрия камеры (по каталогу дробилки)" />
                <Table columns={granColumns} rows={comboReport.gran} rowKey={(r) => r.class} caption="Характеристика гранулометрического состава" />
                <Table columns={kvColumns} rows={comboReport.prod} rowKey={(r) => r.label} caption="Продукт дробления" />
                <Table columns={granColumns} rows={comboReport.prodGran} rowKey={(r) => r.class} caption="Грансостав продукта дробления" />
                <Stack gap="xs" direction="column">
                  <Text variant="label">Суммарные характеристики крупности продукта</Text>
                  <GranulometryChart rows={comboReport.prodGran} />
                </Stack>
              </>
            ) : (
              <Text variant="bodySm" color="textMuted">
                Нет ни одной выбранной пары «дробилка — проба».
              </Text>
            )}
          </Stack>
        ) : step === 0 ? (
          <Stack gap="md" direction="column">
            <Text variant="bodySm" color="textMuted">
              Выбрано дробилок: {project.crusherNames.length}
            </Text>
            <CatalogPicker
              specs={CRUSHER_SPECS}
              items={CRUSHERS}
              value={null}
              onPick={() => {}}
              multiple
              selected={project.crusherNames}
              onPickMultiple={changeCrusherNames}
              nameLabel="Дробилка"
              inlineSpecs={['D, мм', 'Q, т/ч']}
            />
          </Stack>
        ) : step === 1 ? (
          <Stack gap="md" direction="column">
            <Text variant="bodySm" color="textMuted">
              Выбрано проб: {project.oreNames.length}
            </Text>
            <CatalogPicker
              specs={ORE_SPECS}
              items={ORE_SAMPLES}
              value={null}
              onPick={() => {}}
              multiple
              selected={project.oreNames}
              onPickMultiple={changeOreNames}
              nameLabel="Проба руды"
              inlineSpecs={['f', 'ρ, т/м³']}
            />
          </Stack>
        ) : (
          <ProdStep data={project.data.prod} onChange={patchProd} simplified />
        )}
      </Stack>
    </Modal>
  );
}
