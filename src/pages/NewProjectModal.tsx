import { useState } from 'react';
import {
  Button,
  Chip,
  Field,
  Input,
  Modal,
  SegmentedControl,
  Select,
  Stack,
  Text,
} from '@uralmash/design-system';
import { CatalogPicker } from '@/components/CatalogPicker/CatalogPicker';
import { CRUSHERS, CRUSHER_SPECS, crusherFamily } from '@/data/crushers';
import { ORE_SAMPLES, ORE_SPECS } from '@/data/oreSamples';
import { CUSTOMER_OPTIONS } from '@/data/reference';

export type NewProjectModalProps = {
  open: boolean;
  onClose: () => void;
  defaultExecutor: string;
  onCreate: (input: { name: string; customer: string; crusherName: string; ore: string; executor: string }) => void;
};

/**
 * Окно живёт в трёх видах: форма и два выбора из справочника.
 * Виды сменяются внутри одного окна, а не открываются вложенными:
 * у каждой модалки своё удержание фокуса, и вложенные начинают спорить.
 */
type View = 'form' | 'crusher' | 'ore';

type Family = 'all' | 'КМД' | 'КСД';

export function NewProjectModal({ open, onClose, defaultExecutor, onCreate }: NewProjectModalProps) {
  const [view, setView] = useState<View>('form');
  const [name, setName] = useState('');
  const [customer, setCustomer] = useState<string | null>(null);
  const [crusherName, setCrusherName] = useState<string | null>(null);
  const [ore, setOre] = useState<string | null>(null);
  const [executor, setExecutor] = useState(defaultExecutor);
  const [family, setFamily] = useState<Family>('all');

  const canCreate = Boolean(name.trim() && customer && crusherName && ore);

  const reset = () => {
    setView('form');
    setName('');
    setCustomer(null);
    setCrusherName(null);
    setOre(null);
    setExecutor(defaultExecutor);
    setFamily('all');
  };

  const close = () => {
    reset();
    onClose();
  };

  const submit = () => {
    if (!canCreate || !customer || !crusherName || !ore) return;
    onCreate({ name: name.trim(), customer, crusherName, ore, executor: executor.trim() || defaultExecutor });
    reset();
  };

  const visibleCrushers =
    family === 'all' ? undefined : CRUSHERS.filter((c) => crusherFamily(c.name) === family).map((c) => c.name);

  const title =
    view === 'crusher' ? 'Выбор дробилки' : view === 'ore' ? 'Выбор пробы руды' : 'Новый проект';

  const footer =
    view === 'form' ? (
      <Modal.Footer>
        <Button variant="secondary" onClick={close}>
          Отмена
        </Button>
        <Button variant="primary" disabled={!canCreate} onClick={submit}>
          Создать проект
        </Button>
      </Modal.Footer>
    ) : (
      <Modal.Footer>
        <Button variant="secondary" iconStart="arrowLeft" onClick={() => setView('form')}>
          Назад к проекту
        </Button>
      </Modal.Footer>
    );

  return (
    <Modal
      open={open}
      onClose={view === 'form' ? close : () => setView('form')}
      title={title}
      size={view === 'form' ? 'sm' : 'lg'}
      footer={footer}
    >
      {view === 'crusher' ? (
        <CatalogPicker
          specs={CRUSHER_SPECS}
          items={CRUSHERS}
          value={crusherName}
          onPick={(picked) => {
            setCrusherName(picked);
            setView('form');
          }}
          nameLabel="Дробилка"
          searchPlaceholder="КМД-2200, 2200, 500-655…"
          visibleNames={visibleCrushers}
          filter={
            /* Не `Field`: у SegmentedControl свой fieldset с legend, а id он
               не принимает — обёртка оставила бы подпись без контрола. */
            <Stack gap="2xs" direction="column" align="start">
              <Text variant="label">Семейство</Text>
              <SegmentedControl
                legend="Семейство машины"
                options={[
                  { value: 'all', label: 'Все' },
                  { value: 'КМД', label: 'КМД' },
                  { value: 'КСД', label: 'КСД' },
                ]}
                value={family}
                onChange={setFamily}
              />
            </Stack>
          }
        />
      ) : view === 'ore' ? (
        <CatalogPicker
          specs={ORE_SPECS}
          items={ORE_SAMPLES}
          value={ore}
          onPick={(picked) => {
            setOre(picked);
            setView('form');
          }}
          nameLabel="Проба руды"
          searchPlaceholder="Костомукшская, X, 14-16…"
        />
      ) : (
        <Stack gap="lg" direction="column">
          <Field label="Название проекта" required>
            {(props) => <Input {...props} fullWidth value={name} onChange={(e) => setName(e.target.value)} />}
          </Field>

          <Field label="Заказчик" required>
            {(props) => (
              <Select
                {...props}
                fullWidth
                options={CUSTOMER_OPTIONS}
                value={customer}
                onChange={(v) => setCustomer(v as string)}
                allowCustom
                placeholder="Выберите или введите заказчика"
              />
            )}
          </Field>

          {/* Плашка показывает выбранный объект и ведёт к окну замены — роль `Chip`.
              В `Field` не заворачивается: он не принимает id, подпись повисла бы. */}
          <Stack gap="2xs" direction="column" align="start">
            <Text variant="label">Дробилка *</Text>
            {crusherName ? (
              <Chip
                icon="settings"
                active
                onClick={() => setView('crusher')}
                action={{ icon: 'pencil', label: 'Сменить дробилку', onClick: () => setView('crusher') }}
              >
                {crusherName}
              </Chip>
            ) : (
              <Button variant="secondary" iconStart="search" onClick={() => setView('crusher')}>
                Выбрать из каталога — {CRUSHERS.length} машин
              </Button>
            )}
          </Stack>

          <Stack gap="2xs" direction="column" align="start">
            <Text variant="label">Проба руды *</Text>
            {ore ? (
              <Chip
                icon="folder"
                active
                onClick={() => setView('ore')}
                action={{ icon: 'pencil', label: 'Сменить пробу руды', onClick: () => setView('ore') }}
              >
                {ore}
              </Chip>
            ) : (
              <Button variant="secondary" iconStart="search" onClick={() => setView('ore')}>
                Выбрать из справочника — {ORE_SAMPLES.length} проб
              </Button>
            )}
          </Stack>

          <Field label="Исполнитель">
            {(props) => <Input {...props} fullWidth value={executor} onChange={(e) => setExecutor(e.target.value)} />}
          </Field>
        </Stack>
      )}
    </Modal>
  );
}
