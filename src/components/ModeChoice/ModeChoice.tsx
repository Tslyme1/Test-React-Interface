import { Icon, Radio, Stack, Text } from '@uralmash/design-system';
import { ModeIllustration } from '@/components/ModeIllustration/ModeIllustration';
import { WORK_MODES } from '@/data/workModes';
import type { ProjectMode } from '@/types';
import styles from './ModeChoice.module.css';

export type ModeChoiceProps = {
  value: ProjectMode;
  onChange: (mode: ProjectMode) => void;
  /**
   * Имя группы переключателей. Разное в разных местах: карточки стоят
   * и на экране входа, и в окне смены режима из «Настроек», а два набора
   * с одним `name` на одной странице выбирались бы как один.
   */
  name: string;
  /** Подпись группы для скринридера — на экране её нет, см. ниже. */
  label: string;
};

/**
 * Выбор режима работы карточками — один и тот же и при входе,
 * и при смене режима в «Настройках».
 *
 * Общий компонент, а не две копии: режим выбирают редко, но выбор
 * этот надолго, и две разные карточки об одном и том же означали бы
 * два разных обещания. Раньше в «Настройках» стояли строки списка
 * с одной подписью на режим, и человек, менявший режим оттуда, видел
 * о нём вдвое меньше, чем при входе.
 *
 * Не `RadioGroup` системы: она рисует видимую `legend`, а в обоих местах
 * заголовок над карточками уже назвал, что выбирают, — подпись под ним
 * была бы вторым тем же самым. Группе нужна подпись для скринридера,
 * а не на экране; варианта со скрытой `legend` в системе нет — это
 * заявка в неё, а не повод оставить дубль. Взаимоисключающими варианты
 * делает общий `name` у самих переключателей, и роль группы объявлена
 * здесь явно.
 */
export function ModeChoice({ value, onChange, name, label }: ModeChoiceProps) {
  return (
    <div role="radiogroup" aria-label={label} className={styles.modes}>
      {WORK_MODES.map((option) => {
        const id = `${name}-${option.value}`;
        return (
          <label key={option.value} className={styles.card} htmlFor={id}>
            {/* Переключатель лежит в левом верхнем углу самой картинки:
                так отметка стоит на том, что выбирают, а не строкой ниже,
                и карточка читается сверху вниз — что это, как называется,
                что даёт. Без `label` у него самого: подпись стоит рядом
                обычным текстом, потому что `<label>` здесь — вся карточка,
                а вложить подпись в подпись нельзя. */}
            <div className={styles.figure}>
              <ModeIllustration mode={option.value} />
              <span className={styles.radio}>
                <Radio
                  id={id}
                  name={name}
                  value={option.value}
                  checked={value === option.value}
                  onChange={() => onChange(option.value)}
                />
              </span>
            </div>

            <Stack direction="column" gap="2xs">
              <Text variant="headingSm">{option.label}</Text>
              <Text variant="bodySm" color="textMuted">
                {option.summary}
              </Text>
            </Stack>

            <Stack direction="column" gap="xs">
              {option.points.map((point) => (
                <div key={point} className={styles.point}>
                  <Icon name="check" size="sm" />
                  <Text variant="bodySm" color="textMuted">
                    {point}
                  </Text>
                </div>
              ))}
            </Stack>
          </label>
        );
      })}
    </div>
  );
}
