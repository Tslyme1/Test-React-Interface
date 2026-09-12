import { useState } from 'react';
import { Button, Field, Input, Link, SegmentedControl, Stack, Text } from '@uralmash/design-system';
import type { ProjectMode } from '@/types';
import { AuthShell } from './AuthShell';

export type LoginPageProps = {
  onLogin: (login: string, password: string, mode: ProjectMode) => string | null;
  /** Режим, выбранный в прошлый раз, — форма открывается на нём. */
  defaultMode: ProjectMode;
  onGoRegister: () => void;
  onGoForgot: () => void;
};

export function LoginPage({ onLogin, defaultMode, onGoRegister, onGoForgot }: LoginPageProps) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<ProjectMode>(defaultMode);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const result = onLogin(login, password, mode);
    setError(result);
  };

  return (
    <AuthShell title="Вход в систему">
      <Field label="Логин или почта">
        {(props) => (
          <Input
            {...props}
            fullWidth
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
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
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            autoComplete="current-password"
          />
        )}
      </Field>

      {/* Режим спрашивается здесь, а не после входа: он задаёт форму шагов
          нового проекта, и первое, что пользователь делает после входа, —
          заводит проект. Менять решение потом можно в «Профиле», но начинать
          работу с угаданного за пользователя режима незачем.

          Не `Field` — см. пояснение в `GeometryStep`: `SegmentedControl`
          несёт свой `fieldset` и не принимает `id`, поэтому обёртка
          оставила бы подпись без контрола. */}
      <Stack gap="2xs" direction="column" align="start">
        <Text variant="label">Режим работы</Text>
        <SegmentedControl
          fullWidth
          legend="Режим работы"
          options={[
            { value: 'engineering', label: 'Инженерный' },
            { value: 'simplified', label: 'Упрощённый' },
          ]}
          value={mode}
          onChange={setMode}
        />
        <Text variant="caption" color="textMuted">
          {mode === 'engineering'
            ? 'Все параметры методики вводятся вручную, с расчётом и чертежом камеры.'
            : 'Дробилка и руда подбираются по параметрам, ввод — только крупность продукта.'}
        </Text>
      </Stack>

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

      <Button variant="primary" fullWidth disabled={!login.trim() || !password} onClick={submit}>
        Войти
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
