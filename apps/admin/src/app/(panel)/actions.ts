'use server';

import { ApiError, type FareRateBody } from '@apniride/shared';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { errorText } from '@/lib/messages';
import { actionApi } from '@/lib/session';

export interface ActionState {
  error: string | null;
  ok: string | null;
}

/** A signed-out admin (session gone) goes to the login page; every other error is shown on the form. */
async function run(fn: () => Promise<string>): Promise<ActionState> {
  try {
    return { error: null, ok: await fn() };
  } catch (err) {
    if (err instanceof ApiError && err.status === 401) redirect('/login');
    if (err instanceof ApiError && err.code === 'not_admin') redirect('/login?error=not_admin');
    return { error: errorText(err), ok: null };
  }
}

export async function reviewDriver(_prev: ActionState, form: FormData): Promise<ActionState> {
  const id = String(form.get('id'));
  const action = String(form.get('action'));
  const reason = String(form.get('reason') ?? '');
  return run(async () => {
    const api = (await actionApi()).admin;
    if (action === 'approve') await api.approve(id);
    else if (action === 'reject') await api.reject(id, { reason });
    else if (action === 'suspend') await api.suspend(id, { reason });
    else throw new Error('unknown action');
    revalidatePath(`/drivers/${id}`);
    return action === 'approve' ? 'Approved. The driver can go online now.' : 'Done. The driver sees your reason in the app.';
  });
}

export async function updateFareRate(_prev: ActionState, form: FormData): Promise<ActionState> {
  const city = String(form.get('city'));
  const vehicleType = String(form.get('vehicleType'));
  const body: FareRateBody = {
    baseFare: String(form.get('baseFare')),
    perKm: String(form.get('perKm')),
    perMin: String(form.get('perMin')),
    minimumFare: String(form.get('minimumFare')),
    avgSpeedKmh: String(form.get('avgSpeedKmh')),
    active: form.get('active') === 'on',
  };
  return run(async () => {
    await (await actionApi()).admin.updateFareRate(city, vehicleType, body);
    revalidatePath('/fares');
    return 'Saved. New fare quotes use these rates within a minute.';
  });
}
