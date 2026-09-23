import { useState } from 'react';
import { Button, Field, Icon, Input, Link, Radio, Stack, Text } from '@uralmash/design-system';
import { ModeIllustration } from '@/components/ModeIllustration/ModeIllustration';
import { WORK_MODES } from '@/data/workModes';
import type { ProjectMode } from '@/types';
import { AuthShell } from './AuthShell';
import styles from './LoginPage.module.css';

export type LoginPageProps = {
  onLogin: (login: string, password: string, mode: ProjectMode) => string | null;
  /** Режим, выбранный в прошлый раз, — второй шаг открывается на нём. */
  defaultMode: ProjectMode;
  onGoRegister: () => void;
  onGoForgot: () => void;
};

/**
 * Вход разделён на два шага: сначала учётные данные, потом режим работы.
 *
 * Раньше переключатель «Инженерный / Упрощённый» стоял третьим полем той
 * же формы — рядом с логином и паролем, то есть выглядел как ещё одна
 * строка учётной записи. Но это не она: режим задаёт форму всех трёх
 * шагов расчёта и держится между сеансами отдельным ключом (`useSession`).
 * Разным по природе решениям — разные шаги, и тогда у второго появляется
 * место, чтобы объяснить, из чего выбирают: схема, строка-сводка и четыре
 * пункта на каждый режим вместо одной подписи под сегментом.
 *
 * Порядок именно такой: пароль спрашивают первым, потому что до него
 * разговор о режиме преждевременен — человек может не пройти дальше.
 */
type Stage = 'credentials' | 'mode';

export function LoginPage({ onLogin, defaultMode, onGoRegister, onGoForgot }: LoginPageProps) {
  const [stage, setStage] = useState<Stage>('credentials');
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<ProjectMode>(defaultMode);
  const [error, setError] = useState<string | null>(null);

  const filled = Boolean(login.trim() && password);

  const goToMode = () => {
    if (!filled) return;
    setError(null);
    setStage('mode');
  };

  const submit = () => {
    const result = onLogin(login, password, mode);
    /* Ошибка относится к паролю — и показана она у пароля. Значит,
       и вернуться надо туда, где он стоит, иначе сообщение окажется
       на шаге, где исправлять его нечем. */
    if (result) {
      setError(result);
      setStage('credentials');
    }
  };

  if (stage === 'mode') {
    return (
      <AuthShell title="Режим работы" wide>
        {/*
          Не `RadioGroup` системы: она рисует видимую `legend`, а здесь
          это был бы третий раз одно и то же — заголовок экрана уже
          говорит «Режим работы», и подпись под ним только удваивала
          высоту шапки. Группе нужна подпись для скринридера, а не на
          экране; варианта со скрытой `legend` в системе нет — это заявка
          в неё, а не повод оставить дубль. Взаимоисключающими варианты
          делает общий `name` у самих переключателей, и роль группы здесь
          объявлена явно.
        */}
        <div role="radiogroup" aria-label="Режим работы нового проекта" className={styles.modes}>
          {WORK_MODES.map((option) => (
            <label key={option.value} className={styles.card} htmlFor={`login-mode-${option.value}`}>
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
                    id={`login-mode-${option.value}`}
                    name="login-mode"
                    value={option.value}
                    checked={mode === option.value}
                    onChange={() => setMode(option.value)}
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
          ))}
        </div>

        {/* Только «Войти»: возврата к логину с паролем на этом шаге нет.
            Шаг один и без выбора — из него либо входят, либо не входят,
            и вторая кнопка рядом с главной предлагала бы отменить то,
            что ещё не сделано. Опечатку в логине исправляют выходом
            и новым входом: вход здесь демонстрационный и пускает любую
            пару (см. «Что здесь мок» в CLAUDE.md). */}
        <Stack direction="row" justify="end">
          <Button variant="primary" onClick={submit}>
            Войти
          </Button>
        </Stack>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Вход в систему">
      <Field label="Логин или почта">
        {(props) => (
          <Input
            {...props}
            fullWidth
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && goToMode()}
            autoComplete="username"
          />
        )}
      </Field>

      <Field label="Пароль" error={error ?? undefined}>
        {(props) => (
          <Input
            {...props}
            fullWidth
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && goToMode()}
            autoComplete="current-password"
          />
        )}
      </Field>

      <Link
        tone="muted"
        href="#"
        onClick={(e) => {
          e.preventDefault();
          onGoForgot();
        }}
      >
        Забыли пароль?
      </Link>

      <Button variant="primary" fullWidth iconEnd="arrowRight" disabled={!filled} onClick={goToMode}>
        Продолжить
      </Button>

      {/* Вопрос вынесен из подписи кнопки наверх: подпись кнопки называет
          действие, а «Нет аккаунта?» — это условие, при котором кнопку
          вообще стоит нажимать. Вместе они читались как одно длинное
          действие, хотя половина строки к нажатию не относится. */}
      <Stack gap="2xs" direction="column">
        <Text variant="caption" color="textMuted" align="center">
          Нет аккаунта?
        </Text>
        <Button variant="secondary" fullWidth onClick={onGoRegister}>
          Зарегистрироваться
        </Button>
      </Stack>
    </AuthShell>
  );
}
