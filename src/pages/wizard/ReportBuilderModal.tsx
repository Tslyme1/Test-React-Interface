import { useMemo, useRef } from 'react';
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  Modal,
  SegmentedControl,
  Stack,
  Text,
} from '@uralmash/design-system';
import type { Project, StepKey } from '@/types';
import { REPORT_BLOCKS, calculatedSteps, reportTitle, resolveReportBlocks } from '@/domain/reportConfig';
import type { ReportMode } from '@/domain/reportConfig';
import { STEP_KEYS, STEP_TITLES } from '@/domain/steps';
import { stepSummary } from '@/domain/stepSummary';
import { exportProjectReport } from '@/domain/exportReport';
import { printProjectReport } from '@/domain/printProjectReport';
import { useReportConfig } from '@/state/useReportConfig';
import { OptionCell } from '@/components/OptionCell/OptionCell';
import { ReportBlockView, ReportInputs, ReportMetaField } from './ReportBlockView';
import styles from './ReportBuilderModal.module.css';

export type ReportBuilderModalProps = {
  open: boolean;
  onClose: () => void;
  project: Project;
};

/** Подписи этапов в списке разделов — те же, что у шагов степпера. */
const STEP_GROUP: Record<StepKey, string> = {
  geom: 'Дробилка',
  gran: 'Руда',
  prod: 'Продукт',
};

const MODE_OPTIONS = [
  { value: 'auto', label: 'Автоматический' },
  { value: 'custom', label: 'Настраиваемый' },
];

/**
 * Сборка отчёта по проекту: слева состав, справа сам отчёт.
 *
 * До этого отчёт существовал только поэтапно — «Печать: Геометрия»,
 * «Печать: Грансостав», — то есть тремя документами, каждый из которых
 * печатал всё, что у этапа есть. Отдать смежнику один документ было
 * нельзя, убрать из него лишнее — тоже.
 *
 * Два режима, а не один список с флажками: в большинстве случаев нужен
 * отчёт «как посчитано», и требовать ради него решений по десяти
 * разделам значит брать плату за обычное. «Автоматический» поэтому
 * и стоит по умолчанию: состав следует расчёту сам, и список разделов
 * при нём показан, но не трогается — видно, что войдёт, и видно, что
 * выбирать нечего.
 *
 * Предпросмотр — не картинка отчёта, а сам отчёт: печать снимает ровно
 * этот узел (`printProjectReport`). Второй сборки документа для печати
 * нет, и разойтись экрану с бумагой не на чем.
 */
export function ReportBuilderModal({ open, onClose, project }: ReportBuilderModalProps) {
  const { config, update, toggleBlock, reset } = useReportConfig(project.id);
  /** Узел документа — он же и уходит на печать. */
  const documentRef = useRef<HTMLDivElement | null>(null);

  const steps = useMemo(() => calculatedSteps(project), [project]);
  const blocks = useMemo(() => resolveReportBlocks(project, config), [project, config]);
  const title = reportTitle(project, config);

  /* Разделы непосчитанных этапов в списке не показываются вовсе:
     отметить «включить в отчёт» то, чего ещё не посчитали, — обещание,
     которое печать не сдержит. */
  const offered = REPORT_BLOCKS.filter((block) => steps.includes(block.step));
  const auto = config.mode === 'auto';

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Отчёт по проекту"
      size="lg"
      /* Своего отступа у содержимого нет: колонки рисуют края сами,
         а общий отступ окна оторвал бы разделитель между ними от футера. */
      contentFlush
      footer={
        <Modal.Footer
          aside={
            <Button variant="ghost" onClick={reset}>
              Сбросить состав
            </Button>
          }
        >
          {/* «Закрыть» в футере нет: окно закрывается крестиком в шапке,
              кликом по фону и клавишей Esc — четвёртый способ уйти ничего
              не добавлял бы, но занимал место рядом с действиями, ради
              которых окно и открывали. Тот же счёт, что в «Новом проекте». */}
          <Button
            variant="secondary"
            iconStart="download"
            disabled={blocks.length === 0}
            onClick={() => exportProjectReport(project, config)}
          >
            Экспорт в Excel
          </Button>
          <Button
            variant="primary"
            iconStart="print"
            disabled={blocks.length === 0}
            onClick={() => {
              if (documentRef.current) printProjectReport(documentRef.current, title);
            }}
          >
            Печать
          </Button>
        </Modal.Footer>
      }
    >
      <div className={styles.split}>
        <div className={styles.settings}>
          <Stack direction="column" gap="xl">
            <Field label="Заголовок отчёта" hint={`Пусто — берётся имя проекта: «${project.name}»`}>
              {(props) => (
                <Input
                  {...props}
                  fullWidth
                  value={config.title}
                  placeholder={project.name}
                  onChange={(e) => update({ title: e.target.value })}
                />
              )}
            </Field>

            {/* Не `Field`: `SegmentedControl` несёт свой `fieldset` и не
                принимает `id`, поэтому обёртка оставила бы подпись без
                контрола. Тот же случай, что в `GeometryStep`. */}
            <Stack gap="2xs" direction="column" align="start">
              <Text variant="label">Состав</Text>
              <SegmentedControl
                fullWidth
                legend="Состав отчёта"
                options={MODE_OPTIONS}
                value={config.mode}
                onChange={(next) => update({ mode: next as ReportMode })}
              />
              <Text variant="caption" color="textMuted">
                {auto
                  ? 'Все разделы посчитанных этапов. Посчитаете следующий этап — он войдёт сам.'
                  : 'В отчёт идут только отмеченные разделы. Состав больше не меняется сам.'}
              </Text>
            </Stack>

            <Stack gap="sm" direction="column">
              <Text variant="label" color="textMuted">
                Шапка и исходные данные
              </Text>
              <Stack direction="column" gap="none">
                <OptionCell
                  kind="checkbox"
                  label="Шапка расчёта"
                  description="Проект, код, заказчик, дробилка, исполнитель"
                  checked={config.meta}
                  onSelect={() => update({ meta: !config.meta })}
                />
                <OptionCell
                  kind="checkbox"
                  label="Исходные данные"
                  description="С чем считали каждый этап"
                  checked={config.inputs}
                  onSelect={() => update({ inputs: !config.inputs })}
                />
              </Stack>
            </Stack>

            {steps.length === 0 ? (
              <Text variant="bodySm" color="textMuted">
                Разделы появятся, когда будет посчитан хотя бы один этап.
              </Text>
            ) : (
              STEP_KEYS.filter((step) => steps.includes(step)).map((step) => (
                <Stack key={step} gap="sm" direction="column">
                  <Text variant="label" color="textMuted">
                    {STEP_GROUP[step]}
                  </Text>
                  <Stack direction="column" gap="none">
                    {offered
                      .filter((block) => block.step === step)
                      .map((block) => (
                        <OptionCell
                          key={block.id}
                          kind="checkbox"
                          label={block.title}
                          /* Чертёж и графики видны на экране и печатаются,
                             но в CSV им места нет — сказать об этом надо
                             до нажатия «Экспорт», а не после. */
                          description={block.kind === 'chart' ? 'Картинка: печатается, но в CSV не выгружается' : undefined}
                          /* В автоматическом режиме отмечено всё, что
                             посчитано, независимо от сохранённого набора:
                             список показывает состав отчёта, а не черновик
                             настраиваемого режима под ним. */
                          checked={auto || config.blocks.includes(block.id)}
                          disabled={auto}
                          onSelect={() => toggleBlock(block.id)}
                        />
                      ))}
                  </Stack>
                </Stack>
              ))
            )}
          </Stack>
        </div>

        <div className={styles.preview}>
          {blocks.length === 0 ? (
            <EmptyState
              icon="fileText"
              title="В отчёте пока ничего нет"
              description={
                steps.length === 0
                  ? 'Посчитайте хотя бы один этап — его разделы появятся здесь.'
                  : 'Отметьте слева разделы, которые должны войти в отчёт.'
              }
            />
          ) : (
            <div className={styles.document} ref={documentRef}>
              <Stack direction="column" gap="xl">
                <Stack direction="column" gap="md">
                  <Text variant="headingMd" as="h1">
                    {title}
                  </Text>

                  {config.meta ? (
                    <Stack direction="row" wrap gap="xl">
                      <ReportMetaField label="Код проекта" value={project.code} />
                      <ReportMetaField label="Заказчик" value={project.customer} />
                      <ReportMetaField label="Дробилка" value={project.crusherName || '—'} />
                      <ReportMetaField label="Проба руды" value={project.ore || '—'} />
                      <ReportMetaField label="Исполнитель" value={project.executor} />
                    </Stack>
                  ) : null}

                  {/* Та же оговорка, что в печати по этапам: этапы 2 и 3
                      считаются иллюстративной оценкой, и отчёт не должен
                      выдавать её за инженерную методику. */}
                  <Badge tone="warning" icon="alertTriangle">
                    Этапы «Руда» и «Продукт» — иллюстративная оценка, не полная методика дробления
                  </Badge>
                </Stack>

                {config.inputs
                  ? STEP_KEYS.filter((step) => steps.includes(step)).map((step) => (
                      <ReportInputs
                        key={step}
                        title={`Исходные данные: ${STEP_TITLES[step].replace('Результат: ', '')}`}
                        rows={stepSummary(project, step).map(({ label, value }) => ({ label, value }))}
                      />
                    ))
                  : null}

                {blocks.map((block) => (
                  <ReportBlockView key={block.id} project={project} block={block} />
                ))}
              </Stack>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
