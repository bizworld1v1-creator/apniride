'use client';

import { useActionState } from 'react';
import { login, type LoginState } from './actions';

const initial: LoginState = { username: '', error: null };

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(login, initial);

  return (
    <form action={action} className="stack">
      <input type="hidden" name="next" value={next} />
      <label>
        Username
        <input name="username" defaultValue={state.username} autoComplete="username" autoFocus required />
      </label>
      <label>
        Password
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      {state.error ? <p className="error">{state.error}</p> : null}
      <button type="submit" disabled={pending}>
        {pending ? 'Please wait…' : 'Sign in'}
      </button>
    </form>
  );
}
