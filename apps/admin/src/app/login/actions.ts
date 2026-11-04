'use server';

import { ApiError, createApiClient } from '@apniride/shared';
import { redirect } from 'next/navigation';
import { errorText } from '@/lib/messages';
import { actionApi, API_URL, clearTokens, safeNext, saveTokens } from '@/lib/session';

export interface LoginState {
  step: 'phone' | 'code';
  phone: string;
  error: string | null;
  /** Local development only (OTP_DEV_ECHO=true on the backend). */
  devCode: string | null;
}

const api = () => createApiClient({ baseUrl: API_URL, retries: 1 });

/** One action for both steps: send the code, then check it and start the session. */
export async function login(prev: LoginState, form: FormData): Promise<LoginState> {
  const phone = String(form.get('phone') ?? prev.phone).trim();
  const next = safeNext(String(form.get('next') ?? '/'));

  if (form.get('intent') === 'restart') return { step: 'phone', phone, error: null, devCode: null };

  if (prev.step === 'phone' || form.get('intent') === 'resend') {
    try {
      const res = await api().auth.requestOtp({ phone, role: 'admin' });
      return { step: 'code', phone, error: null, devCode: res.devCode ?? null };
    } catch (err) {
      return { ...prev, phone, error: errorText(err) };
    }
  }

  try {
    const session = await api().auth.verifyOtp({ phone, role: 'admin', code: String(form.get('code') ?? '').trim() });
    await saveTokens(session);
  } catch (err) {
    const notAdminHint =
      err instanceof ApiError && err.code === 'code_expired'
        ? ' If no SMS arrived, this number may not be an admin.'
        : '';
    return { ...prev, error: errorText(err) + notAdminHint };
  }
  redirect(next);
}

export async function logout() {
  await (await actionApi()).auth.logout();
  await clearTokens();
  redirect('/login');
}
