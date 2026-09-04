import { Modal, Stack, Text } from '@uralmash/design-system';
import { HELP_SECTIONS } from '@/data/paramGlossary';
import styles from './HelpModal.module.css';

export type HelpModalProps = {
  open: boolean;
  onClose: () => void;
};

/**
 * Справка по параметрам — та же информация, что и во всплывающих
 * подсказках у полей (`Field.labelHint`), собранная в один список по
 * шагам визарда. Открывается значком вопроса в шапке — для тех, кто
 * готов прочитать всё сразу, а не наводить на каждое поле по очереди.
 *
 * Узкая (`sm`) — список одноколоночный, широкая модалка растягивала бы
 * строки текста шире, чем удобно читать.
 */
export function HelpModal({ open, onClose }: HelpModalProps) {
  return (
    <Modal open={open} onClose={onClose} title="Справка по параметрам" size="sm">
      <Stack gap="2xl" direction="column">
        {HELP_SECTIONS.map((section) => (
          <div key={section.title} className={styles.section}>
            <Stack gap="lg" direction="column">
              <Text variant="headingSm">{section.title}</Text>
              <Stack gap="lg" direction="column">
                {section.items.map((item) => (
                  <Stack key={item.label} gap="sm" direction="column">
                    <Text variant="label">{item.label}</Text>
                    <Text variant="bodySm" color="textMuted">
                      {item.text}
                    </Text>
                  </Stack>
                ))}
              </Stack>
            </Stack>
          </div>
        ))}
      </Stack>
    </Modal>
  );
}
