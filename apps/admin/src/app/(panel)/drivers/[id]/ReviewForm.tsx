'use client';

import type { DriverApprovalStatus } from '@apniride/shared';
import { useActionState } from 'react';
import { type ActionState, reviewDriver } from '../../actions';

const initial: ActionState = { error: null, ok: null };

/** The buttons that fit the driver's status. Reject and suspend need a reason the driver will read. */
export function ReviewForm({ id, status }: { id: string; status: DriverApprovalStatus }) {
  const [state, action, pending] = useActionState(reviewDriver, initial);
  const canApprove = status === 'pending' || status === 'suspended';
  const canReject = status === 'pending';
  const canSuspend = status === 'approved';

  if (!canApprove && !canReject && !canSuspend) {
    return (
      <p className="muted">
        {status === 'incomplete'
          ? 'Still registering: nothing to review until they send it.'
          : 'Waiting for the driver to fix and send it again.'}
      </p>
    );
  }

  return (
    <form action={action} className="stack review">
      <input type="hidden" name="id" value={id} />
      {canReject || canSuspend ? (
        <label>
          Reason (the driver sees this; needed for {canReject ? 'reject' : 'suspend'})
          <textarea name="reason" rows={2} maxLength={300} placeholder="e.g. CNIC photo is blurry, please take it again" />
        </label>
      ) : null}
      <div className="row">
        {canApprove ? (
          <button type="submit" name="action" value="approve" className="good" disabled={pending}>
            {status === 'suspended' ? 'Reinstate' : 'Approve'}
          </button>
        ) : null}
        {canReject ? (
          <button type="submit" name="action" value="reject" className="bad" disabled={pending}>
            Reject
          </button>
        ) : null}
        {canSuspend ? (
          <button type="submit" name="action" value="suspend" className="bad" disabled={pending}>
            Suspend
          </button>
        ) : null}
      </div>
      {state.error ? <p className="error">{state.error}</p> : null}
      {state.ok ? <p className="ok">{state.ok}</p> : null}
    </form>
  );
}
