'use server';

import { createApiClient } from '@apniride/shared';
import { redirect } from 'next/navigation';
import { errorText } from '@/lib/messages';
import { actionApi, API_URL, clearTokens, safeNext, saveTokens } from '@/lib/session';

export interface LoginState {
  username: string;
  error: string | null;
}

const api = () => createApiClient({ baseUrl: API_URL, retries: 1 });

/** Checks the username + password (ADMIN_USERNAME / ADMIN_PASSWORD in backend/.env) and starts the session. */
export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  const username = String(form.get('username') ?? '').trim();
  const password = String(form.get('password') ?? '');
  const next = safeNext(String(form.get('next') ?? '/'));
  try {
    await saveTokens(await api().auth.adminLogin({ username, password }));
  } catch (err) {
    return { username, error: errorText(err) };
  }
  redirect(next);
}

export async function logout() {
  await (await actionApi()).auth.logout();
  await clearTokens();
  redirect('/login');
}
