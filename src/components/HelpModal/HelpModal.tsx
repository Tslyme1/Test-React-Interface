import { Modal, Stack, Text } from '@uralmash/design-system';
import { HELP_SECTIONS } from '@/data/paramGlossary';

export type HelpModalProps = {
  open: boolean;
  onClose: () => void;
};

/**
 * Справка по параметрам — та же информация, что и во всплывающих
 * подсказках у полей (`Field.labelHint`), собранная в один список по
 * шагам визарда. Открывается значком вопроса в шапке — для тех, кто
 * готов прочитать всё сразу, а не наводить на каждое поле по очереди.
 */
export function HelpModal({ open, onClose }: HelpModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Справка по параметрам" size="lg">
      <Stack gap="2xl" direction="column">
        {HELP_SECTIONS.map((section) => (
          <Stack key={section.title} gap="lg" direction="column">
            <Text variant="headingSm">{section.title}</Text>
            <Stack gap="md" direction="column">
              {section.items.map((item) => (
                <Stack key={item.label} gap="xs" direction="column">
                  <Text variant="label">{item.label}</Text>
                  <Text variant="bodySm" color="textMuted">
                    {item.text}
                  </Text>
                </Stack>
              ))}
            </Stack>
          </Stack>
        ))}
      </Stack>
    </Modal>
  );
}
