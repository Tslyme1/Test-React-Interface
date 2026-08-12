import { useState } from 'react';
import { Field, Input, Modal, Button, Select, Stack } from '@uralmash/design-system';
import { CRUSHER_OPTIONS, CUSTOMER_OPTIONS, ORE_OPTIONS } from '@/data/reference';

export type NewProjectModalProps = {
  open: boolean;
  onClose: () => void;
  defaultExecutor: string;
  onCreate: (input: { name: string; customer: string; crusherName: string; ore: string; executor: string }) => void;
};

export function NewProjectModal({ open, onClose, defaultExecutor, onCreate }: NewProjectModalProps) {
  const [name, setName] = useState('');
  const [customer, setCustomer] = useState<string | null>(null);
  const [crusherName, setCrusherName] = useState<string | null>(null);
  const [ore, setOre] = useState<string | null>(null);
  const [executor, setExecutor] = useState(defaultExecutor);

  const canCreate = Boolean(name.trim() && customer && crusherName && ore);

  const reset = () => {
    setName('');
    setCustomer(null);
    setCrusherName(null);
    setOre(null);
    setExecutor(defaultExecutor);
  };

  const submit = () => {
    if (!canCreate || !customer || !crusherName || !ore) return;
    onCreate({ name: name.trim(), customer, crusherName, ore, executor: executor.trim() || defaultExecutor });
    reset();
  };

  return (
    <Modal
      open={open}
      onClose={() => {
        reset();
        onClose();
      }}
      title="Новый проект"
      size="sm"
      footer={
        <Modal.Footer>
          <Button
            variant="secondary"
            onClick={() => {
              reset();
              onClose();
            }}
          >
            Отмена
          </Button>
          <Button variant="primary" disabled={!canCreate} onClick={submit}>
            Создать проект
          </Button>
        </Modal.Footer>
      }
    >
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

        <Field label="Дробилка" required>
          {(props) => (
            <Select
              {...props}
              fullWidth
              options={CRUSHER_OPTIONS}
              value={crusherName}
              onChange={(v) => setCrusherName(v as string)}
              searchable
              placeholder="Выберите дробилку"
            />
          )}
        </Field>

        <Field label="Проба руды" required>
          {(props) => (
            <Select
              {...props}
              fullWidth
              options={ORE_OPTIONS}
              value={ore}
              onChange={(v) => setOre(v as string)}
              placeholder="Выберите пробу руды"
            />
          )}
        </Field>

        <Field label="Исполнитель">
          {(props) => <Input {...props} fullWidth value={executor} onChange={(e) => setExecutor(e.target.value)} />}
        </Field>
      </Stack>
    </Modal>
  );
}
