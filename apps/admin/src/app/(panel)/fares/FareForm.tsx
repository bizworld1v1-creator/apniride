'use client';

import type { AdminFareRate } from '@apniride/shared';
import { useActionState } from 'react';
import { type ActionState, updateFareRate } from '../actions';

const initial: ActionState = { error: null, ok: null };

const FIELDS = [
  { name: 'baseFare', label: 'Base fare (Rs)' },
  { name: 'perKm', label: 'Per km (Rs)' },
  { name: 'perMin', label: 'Per minute (Rs)' },
  { name: 'minimumFare', label: 'Minimum fare (Rs)' },
  { name: 'avgSpeedKmh', label: 'Average city speed (km/h)' },
] as const;

export function FareForm({ rate }: { rate: AdminFareRate }) {
  const [state, action, pending] = useActionState(updateFareRate, initial);
  return (
    <form action={action} className="stack fare">
      <input type="hidden" name="city" value={rate.city} />
      <input type="hidden" name="vehicleType" value={rate.vehicleType} />
      <div className="grid">
        {FIELDS.map((f) => (
          <label key={f.name}>
            {f.label}
            <input name={f.name} type="number" min={0} step={1} defaultValue={rate[f.name]} required />
          </label>
        ))}
      </div>
      <label className="check">
        <input type="checkbox" name="active" defaultChecked={rate.active} /> Passengers can book this vehicle
      </label>
      <button type="submit" disabled={pending}>
        {pending ? 'Saving…' : 'Save'}
      </button>
      {state.error ? <p className="error">{state.error}</p> : null}
      {state.ok ? <p className="ok">{state.ok}</p> : null}
    </form>
  );
}
