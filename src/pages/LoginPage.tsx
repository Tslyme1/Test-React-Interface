import { useState } from 'react';
import { Field, Input, Button, Link, Text } from '@uralmash/design-system';
import { AuthShell } from './AuthShell';

export type LoginPageProps = {
  onLogin: (login: string, password: string) => string | null;
  onGoRegister: () => void;
  onGoForgot: () => void;
};

export function LoginPage({ onLogin, onGoRegister, onGoForgot }: LoginPageProps) {
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const result = onLogin(login, password);
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
