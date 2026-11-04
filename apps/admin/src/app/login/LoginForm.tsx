'use client';

import { useActionState } from 'react';
import { login, type LoginState } from './actions';

const initial: LoginState = { step: 'phone', phone: '', error: null, devCode: null };

export function LoginForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState(login, initial);

  return (
    <form action={action} className="stack">
      <input type="hidden" name="next" value={next} />
      {state.step === 'phone' ? (
        <label>
          Mobile number
          <input name="phone" defaultValue={state.phone} placeholder="0300 1234567" inputMode="tel" autoFocus required />
        </label>
      ) : (
        <>
          <input type="hidden" name="phone" value={state.phone} />
          <p className="muted">If {state.phone} is an admin, we sent a 6-digit code by SMS.</p>
          {state.devCode ? <p className="dev">Dev code: {state.devCode}</p> : null}
          <label>
            Code
            <input name="code" inputMode="numeric" maxLength={6} autoComplete="one-time-code" autoFocus required />
          </label>
        </>
      )}
      {state.error ? <p className="error">{state.error}</p> : null}
      <button type="submit" disabled={pending}>
        {pending ? 'Please wait…' : state.step === 'phone' ? 'Send code' : 'Sign in'}
      </button>
      {state.step === 'code' ? (
        <div className="row">
          <button type="submit" name="intent" value="resend" className="link" formNoValidate disabled={pending}>
            Send a new code
          </button>
          <button type="submit" name="intent" value="restart" className="link" formNoValidate disabled={pending}>
            Change number
          </button>
        </div>
      ) : null}
    </form>
  );
}
