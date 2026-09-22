import { useState } from 'react';
import { Button, Field, Icon, Input, Link, Radio, RadioGroup, Stack, Text } from '@uralmash/design-system';
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
      <AuthShell
        title="Режим работы"
        subtitle="Поменять решение можно в «Настройках» — уже созданные проекты останутся в своём режиме."
        wide
      >
        {/* Подпись группы уточняет заголовок, а не повторяет его: режим
            выбирается здесь один раз и действует на следующий новый
            проект, а не на приложение целиком. Та же формулировка, что
            у этого же переключателя в «Настройках». */}
        <RadioGroup name="login-mode" legend="Режим работы нового проекта">
          <div className={styles.modes}>
            {WORK_MODES.map((option) => (
              <label key={option.value} className={styles.card} htmlFor={`login-mode-${option.value}`}>
                <ModeIllustration mode={option.value} />

                <Stack direction="row" gap="sm" align="start">
                  {/* Без `label` у самого переключателя: подпись стоит рядом
                      обычным текстом, потому что `<label>` здесь — вся
                      карточка, а вложить подпись в подпись нельзя. */}
                  <Radio
                    id={`login-mode-${option.value}`}
                    value={option.value}
                    checked={mode === option.value}
                    onChange={() => setMode(option.value)}
                  />
                  <Stack direction="column" gap="2xs">
                    <Text variant="headingSm">{option.label}</Text>
                    <Text variant="bodySm" color="textMuted">
                      {option.summary}
                    </Text>
                  </Stack>
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
        </RadioGroup>

        <Stack direction="row" gap="sm" justify="between" align="center" wrap>
          <Button variant="secondary" iconStart="arrowLeft" onClick={() => setStage('credentials')}>
            Назад
          </Button>
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
      <Button variant="secondary" fullWidth onClick={onGoRegister}>
        Нет аккаунта? Зарегистрироваться
      </Button>

      <Text variant="caption" color="textMuted" align="center">
        Демо-доступы: ivanov / 1234, admin / admin
      </Text>
    </AuthShell>
  );
}
